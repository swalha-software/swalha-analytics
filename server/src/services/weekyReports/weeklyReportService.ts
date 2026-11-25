import * as cron from "node-cron";
import { DateTime } from "luxon";
import { eq } from "drizzle-orm";
import { db } from "../../db/postgres/postgres.js";
import { organization, member, user, sites } from "../../db/postgres/schema.js";
import { clickhouse } from "../../db/clickhouse/clickhouse.js";
import { processResults } from "../../api/analytics/utils/utils.js";
import { getTimeStatement } from "../../api/analytics/utils/timeWindow.js";
import { createServiceLogger } from "../../lib/logger/logger.js";
import { sendWeeklyDigestEmail, sendWeeklyReportEmail } from "../../lib/email/email.js";
import { EMAIL_ENABLED } from "../../lib/const.js";
import {
  BreakdownDimension,
  buildBreakdownQuery,
  buildChartQuery,
  buildOverviewQuery,
  SiteMetricsSpec,
} from "../siteMetrics/siteMetrics.js";
import type { DailySessions, DigestSite, OverviewData, MetricData, SiteReport } from "./weeklyReportTypes.js";

/** The reported week and the one before it, as whole UTC days. */
interface ReportWindow {
  currentWeekStart: DateTime;
  /** Exclusive: midnight after the last reported day. */
  currentWeekEnd: DateTime;
  previousWeekStart: DateTime;
}

/** Pageviews in each week. */
interface SiteActivity {
  current: number;
  previous: number;
}

interface RecipientSite {
  siteId: number;
  name: string;
  domain: string;
  organizationId: string;
  organizationName: string;
}

interface Recipient {
  userId: string;
  email: string;
  sites: RecipientSite[];
}

/** Per-run state, so a site shared by many members is queried once. */
interface ReportRun {
  window: ReportWindow;
  activity: Map<number, SiteActivity>;
  reports: Map<number, Promise<SiteReport | null>>;
  digestSites: Map<number, Promise<DigestSite | null>>;
}

// Format dates for ClickHouse (YYYY-MM-DD HH:mm:ss). The windows are UTC, and
// getTimeStatement anchors the comparison in UTC too — the bound
// `toDateTime({date:String})` this replaced was interpreted in the ClickHouse
// server's timezone, so a non-UTC server shifted the week.
const formatDate = (date: DateTime) => date.toFormat("yyyy-MM-dd HH:mm:ss");

const specFor = (from: DateTime, to: DateTime): SiteMetricsSpec => ({
  timeStatement: getTimeStatement({
    start_datetime: formatDate(from),
    end_datetime: formatDate(to),
  }),
});

const memo = <T>(cache: Map<number, Promise<T>>, key: number, load: () => Promise<T>): Promise<T> => {
  let value = cache.get(key);
  if (!value) {
    value = load();
    cache.set(key, value);
  }
  return value;
};

class WeeklyReportService {
  private cronTask: cron.ScheduledTask | null = null;
  private logger = createServiceLogger("weekly-report");

  constructor() {}

  private async fetchOverviewData(siteId: number, spec: SiteMetricsSpec): Promise<OverviewData | null> {
    try {
      const result = await clickhouse.query({
        query: buildOverviewQuery(spec),
        format: "JSONEachRow",
        query_params: { siteId },
      });

      const data = await processResults<OverviewData>(result);
      return data[0] || null;
    } catch (error) {
      this.logger.error({ err: error, siteId }, "Error fetching overview data");
      return null;
    }
  }

  private async fetchTopN(
    siteId: number,
    dimension: BreakdownDimension,
    spec: SiteMetricsSpec,
    limit: number = 5
  ): Promise<MetricData[]> {
    try {
      const result = await clickhouse.query({
        query: buildBreakdownQuery(dimension, spec),
        format: "JSONEachRow",
        query_params: { siteId, limit },
      });

      return await processResults<MetricData>(result);
    } catch (error) {
      this.logger.error({ err: error, siteId, dimension }, "Error fetching top N data");
      return [];
    }
  }

  /**
   * Sessions per UTC day across both weeks, paired weekday to weekday. Days
   * with no sessions are absent from the query result and read as zero.
   */
  private async fetchDailySessions(
    siteId: number,
    spec: SiteMetricsSpec,
    currentWeekStart: DateTime
  ): Promise<DailySessions[]> {
    try {
      const result = await clickhouse.query({
        query: buildChartQuery(spec, "toStartOfDay"),
        format: "JSONEachRow",
        query_params: { siteId, timeZone: "UTC" },
      });
      const rows = await processResults<{ time: string; sessions: number }>(result);
      const byDay = new Map(rows.map(row => [row.time.slice(0, 10), Number(row.sessions) || 0]));
      return Array.from({ length: 7 }, (_, i) => {
        const date = currentWeekStart.plus({ days: i });
        return {
          date: date.toISODate()!,
          sessions: byDay.get(date.toISODate()!) ?? 0,
          previousSessions: byDay.get(date.minus({ days: 7 }).toISODate()!) ?? 0,
        };
      });
    } catch (error) {
      this.logger.error({ err: error, siteId }, "Error fetching daily sessions");
      return [];
    }
  }

  private async generateSiteReport(
    siteId: number,
    siteName: string,
    siteDomain: string,
    window: ReportWindow
  ): Promise<SiteReport | null> {
    try {
      const { currentWeekStart, currentWeekEnd, previousWeekStart } = window;
      const currentSpec = specFor(currentWeekStart, currentWeekEnd);
      const previousSpec = specFor(previousWeekStart, currentWeekStart);

      const [currentWeek, previousWeek, daily, topCountries, topPages, topReferrers, deviceBreakdown] =
        await Promise.all([
          this.fetchOverviewData(siteId, currentSpec),
          this.fetchOverviewData(siteId, previousSpec),
          this.fetchDailySessions(siteId, specFor(previousWeekStart, currentWeekEnd), currentWeekStart),
          this.fetchTopN(siteId, "country", currentSpec),
          this.fetchTopN(siteId, "pathname", currentSpec),
          this.fetchTopN(siteId, "referrer", currentSpec),
          this.fetchTopN(siteId, "device_type", currentSpec),
        ]);

      if (!currentWeek) {
        return null;
      }

      // Skip sites with no pageviews
      if (!currentWeek.pageviews || currentWeek.pageviews === 0) {
        return null;
      }

      return {
        siteId,
        siteName,
        siteDomain,
        weekStart: currentWeekStart.toISODate()!,
        weekEnd: currentWeekEnd.minus({ days: 1 }).toISODate()!,
        currentWeek,
        previousWeek: previousWeek || {
          sessions: 0,
          pageviews: 0,
          users: 0,
          pages_per_session: 0,
          bounce_rate: 0,
          session_duration: 0,
        },
        daily,
        topCountries,
        topPages,
        topReferrers,
        deviceBreakdown,
      };
    } catch (error) {
      this.logger.error({ err: error, siteId }, "Error generating site report");
      return null;
    }
  }

  /**
   * Pageviews per site in each of the two weeks, for every site that had any. One scan
   * instead of a report query per site: most sites are idle and get no email.
   */
  private async fetchSiteActivity(window: ReportWindow): Promise<Map<number, SiteActivity>> {
    const result = await clickhouse.query({
      query: `
        SELECT
          site_id,
          countIf(timestamp >= toDateTime({currentStart:String}, 'UTC')) AS current,
          countIf(timestamp < toDateTime({currentStart:String}, 'UTC')) AS previous
        FROM events
        WHERE type = 'pageview'
          AND timestamp >= toDateTime({previousStart:String}, 'UTC')
          AND timestamp < toDateTime({end:String}, 'UTC')
        GROUP BY site_id
      `,
      format: "JSONEachRow",
      query_params: {
        previousStart: formatDate(window.previousWeekStart),
        currentStart: formatDate(window.currentWeekStart),
        end: formatDate(window.currentWeekEnd),
      },
    });
    const rows = await processResults<{ site_id: number; current: number; previous: number }>(result);
    return new Map(
      rows.map(row => [Number(row.site_id), { current: Number(row.current), previous: Number(row.previous) }])
    );
  }

  private async fetchLastPageviewAt(siteId: number, since: DateTime): Promise<string | null> {
    const result = await clickhouse.query({
      query: `
        SELECT max(timestamp) AS last
        FROM events
        WHERE site_id = {siteId:Int32}
          AND type = 'pageview'
          AND timestamp >= toDateTime({since:String}, 'UTC')
      `,
      format: "JSONEachRow",
      query_params: { siteId, since: formatDate(since) },
    });
    const [row] = await processResults<{ last: string }>(result);
    const last = row?.last ? DateTime.fromSQL(row.last, { zone: "utc" }) : null;
    return last?.isValid ? last.toISO() : null;
  }

  /** A site's line in the digest: visitors in both weeks and sessions per day. */
  private async generateDigestSite(
    site: RecipientSite,
    activity: SiteActivity,
    window: ReportWindow
  ): Promise<DigestSite | null> {
    try {
      const { currentWeekStart, currentWeekEnd, previousWeekStart } = window;
      const quiet = activity.current === 0;
      const currentSpec = specFor(currentWeekStart, currentWeekEnd);

      const [currentWeek, previousWeek, daily, lastPageviewAt] = await Promise.all([
        quiet ? null : this.fetchOverviewData(site.siteId, currentSpec),
        activity.previous > 0
          ? this.fetchOverviewData(site.siteId, specFor(previousWeekStart, currentWeekStart))
          : null,
        quiet ? [] : this.fetchDailySessions(site.siteId, currentSpec, currentWeekStart),
        quiet ? this.fetchLastPageviewAt(site.siteId, previousWeekStart) : null,
      ]);

      // A failed query would show a busy site as empty; leave it out instead.
      if ((!quiet && !currentWeek) || (activity.previous > 0 && !previousWeek) || (quiet && !lastPageviewAt)) {
        return null;
      }

      return {
        siteId: site.siteId,
        siteDomain: site.domain,
        organizationId: site.organizationId,
        organizationName: site.organizationName,
        users: currentWeek?.users ?? 0,
        previousUsers: previousWeek?.users ?? 0,
        daily: quiet ? Array(7).fill(0) : daily.map(day => day.sessions),
        lastPageviewAt: quiet ? lastPageviewAt : null,
      };
    } catch (error) {
      this.logger.error({ err: error, siteId: site.siteId }, "Error generating digest line for site");
      return null;
    }
  }

  /**
   * Everyone who gets weekly reports, with the sites that had pageviews in either week.
   * Owners only: they reach every site of their organization, so there is no per-member
   * site filtering to do. `onlyUserId` narrows the run to one person and ignores their
   * opt-out, for the admin "send me this week's report" trigger.
   */
  private async loadRecipients(activity: Map<number, SiteActivity>, onlyUserId?: string): Promise<Recipient[]> {
    const [memberships, organizations, siteRows] = await Promise.all([
      db
        .select({
          memberId: member.id,
          userId: member.userId,
          role: member.role,
          organizationId: member.organizationId,
          email: user.email,
          sendAutoEmailReports: user.sendAutoEmailReports,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id)),
      db.select({ id: organization.id, name: organization.name }).from(organization),
      db
        .select({ siteId: sites.siteId, name: sites.name, domain: sites.domain, organizationId: sites.organizationId })
        .from(sites),
    ]);

    const organizationNames = new Map(organizations.map(org => [org.id, org.name]));
    const activeSitesByOrg = new Map<string, RecipientSite[]>();
    for (const site of siteRows) {
      if (!site.organizationId || !activity.has(site.siteId)) continue;
      const orgSites = activeSitesByOrg.get(site.organizationId) ?? [];
      orgSites.push({
        siteId: site.siteId,
        name: site.name,
        domain: site.domain,
        organizationId: site.organizationId,
        organizationName: organizationNames.get(site.organizationId) ?? "",
      });
      activeSitesByOrg.set(site.organizationId, orgSites);
    }

    const recipients = new Map<string, Recipient>();
    for (const membership of memberships) {
      if (membership.role !== "owner") continue;
      if (onlyUserId !== undefined) {
        if (membership.userId !== onlyUserId) continue;
      } else if (membership.sendAutoEmailReports === false) {
        // Skip users who have disabled email reports
        continue;
      }

      const orgSites = activeSitesByOrg.get(membership.organizationId);
      if (!orgSites) continue;

      const recipient = recipients.get(membership.userId) ?? {
        userId: membership.userId,
        email: membership.email,
        sites: [],
      };
      recipient.sites.push(...orgSites);
      recipients.set(membership.userId, recipient);
    }
    return [...recipients.values()];
  }

  /**
   * One email per person: the full report when they have one site with traffic, a digest of
   * every site otherwise. Returns whether an email went out.
   */
  private async sendToRecipient(recipient: Recipient, run: ReportRun): Promise<boolean> {
    const active = recipient.sites.filter(site => run.activity.get(site.siteId)!.current > 0);
    if (active.length === 0) {
      return false;
    }

    let digestSites: DigestSite[] = [];
    if (recipient.sites.length > 1) {
      for (const site of recipient.sites) {
        const line = await memo(run.digestSites, site.siteId, () =>
          this.generateDigestSite(site, run.activity.get(site.siteId)!, run.window)
        );
        if (line) digestSites.push(line);
      }
      digestSites = digestSites.sort((a, b) => b.users - a.users || a.siteDomain.localeCompare(b.siteDomain));
    }

    if (digestSites.length > 1 && digestSites.some(site => site.lastPageviewAt === null)) {
      await sendWeeklyDigestEmail({
        email: recipient.email,
        userId: recipient.userId,
        digest: {
          weekStart: run.window.currentWeekStart.toISODate()!,
          weekEnd: run.window.currentWeekEnd.minus({ days: 1 }).toISODate()!,
          sites: digestSites,
        },
      });
      this.logger.info({ userId: recipient.userId, sites: digestSites.length }, "Sent weekly digest email");
      return true;
    }

    // One site with traffic (or the digest lines failed): the full report for the busiest.
    const [site] = active.sort((x, y) => run.activity.get(y.siteId)!.current - run.activity.get(x.siteId)!.current);
    const report = await memo(run.reports, site.siteId, () =>
      this.generateSiteReport(site.siteId, site.name, site.domain, run.window)
    );
    if (!report) {
      return false;
    }
    await sendWeeklyReportEmail({ email: recipient.email, userId: recipient.userId, site: report });
    this.logger.info({ userId: recipient.userId, siteId: site.siteId }, "Sent weekly report email for site");
    return true;
  }

  /** Whole UTC days, so the report covers exactly Monday to Sunday when the cron fires at Monday midnight. */
  private currentWindow(): ReportWindow {
    const today = DateTime.utc().startOf("day");
    return {
      currentWeekStart: today.minus({ days: 7 }),
      currentWeekEnd: today,
      previousWeekStart: today.minus({ days: 14 }),
    };
  }

  /**
   * This week's report for the organizations a single user owns, delivered to
   * that user alone. Backs the admin "send me a test" trigger: it exercises the
   * real generation and mail path without touching anyone else's inbox, and
   * ignores the user's own sendAutoEmailReports opt-out since the send was
   * explicitly asked for. Like Monday's run it is one email: the full report
   * for a single site, a digest across several.
   */
  public async sendReportsToUser(userId: string): Promise<{ organizations: number; emails: number }> {
    if (!EMAIL_ENABLED) {
      throw new Error("Email is not configured");
    }

    const window = this.currentWindow();
    const activity = await this.fetchSiteActivity(window);
    const [recipient] = await this.loadRecipients(activity, userId);
    if (!recipient) {
      return { organizations: 0, emails: 0 };
    }

    const run: ReportRun = { window, activity, reports: new Map(), digestSites: new Map() };
    const sent = await this.sendToRecipient(recipient, run);
    const organizations = new Set(recipient.sites.map(site => site.organizationId)).size;

    this.logger.info({ userId, organizations, emails: sent ? 1 : 0 }, "Sent test weekly report to user");
    return { organizations, emails: sent ? 1 : 0 };
  }

  public async generateAndSendReports(): Promise<void> {
    if (!EMAIL_ENABLED) {
      this.logger.info("Skipping weekly reports: no RESEND_API_KEY configured");
      return;
    }

    this.logger.info("Starting weekly report generation and sending");

    try {
      // Every email in the run shares the same window.
      const window = this.currentWindow();
      const activity = await this.fetchSiteActivity(window);
      const recipients = await this.loadRecipients(activity);
      const run: ReportRun = { window, activity, reports: new Map(), digestSites: new Map() };

      this.logger.info({ activeSites: activity.size, recipients: recipients.length }, "Sending weekly reports");

      let sentCount = 0;
      for (const [i, recipient] of recipients.entries()) {
        try {
          if (await this.sendToRecipient(recipient, run)) sentCount++;
        } catch (error) {
          this.logger.error({ err: error, userId: recipient.userId }, "Failed to send weekly report email");
        }

        if ((i + 1) % 50 === 0) {
          this.logger.info({ processed: i + 1, total: recipients.length, sent: sentCount }, "Weekly report progress");
        }
      }

      this.logger.info(
        { totalRecipients: recipients.length, totalSent: sentCount },
        "Completed weekly report generation and sending"
      );
    } catch (error) {
      this.logger.error({ err: error }, "Error in weekly report generation");
    }
  }

  private initializeWeeklyReportCron(): void {
    if (!EMAIL_ENABLED) {
      this.logger.info("Skipping weekly report cron: no RESEND_API_KEY configured");
      return;
    }

    this.logger.info("Initializing weekly report cron");

    // Schedule weekly reports to run every Monday at midnight UTC
    this.cronTask = cron.schedule(
      "0 0 * * 1",
      async () => {
        try {
          await this.generateAndSendReports();
        } catch (error) {
          this.logger.error({ err: error }, "Error during weekly report generation");
        }
      },
      { timezone: "UTC" }
    );

    this.logger.info("Weekly report cron initialized (runs every Monday at midnight UTC)");
  }

  public stopWeeklyReportCron(): void {
    if (this.cronTask) {
      this.cronTask.stop();
      this.logger.info("Weekly report cron stopped");
    }
  }

  public startWeeklyReportCron(): void {
    this.initializeWeeklyReportCron();
  }
}

// Create a singleton instance
export const weeklyReportService = new WeeklyReportService();
