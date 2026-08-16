import * as cron from "node-cron";
import { DateTime } from "luxon";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/postgres/postgres.js";
import { organization, member, user, sites } from "../../db/postgres/schema.js";
import { clickhouse } from "../../db/clickhouse/clickhouse.js";
import { getTimeStatement, processResults } from "../../api/analytics/utils/utils.js";
import { createServiceLogger } from "../../lib/logger/logger.js";
import { sendWeeklyReportEmail } from "../../lib/email/email.js";
import { EMAIL_ENABLED } from "../../lib/const.js";
import {
  BreakdownDimension,
  buildBreakdownQuery,
  buildOverviewQuery,
  SiteMetricsSpec,
} from "../siteMetrics/siteMetrics.js";
import type { OverviewData, MetricData, SiteReport, OrganizationReport } from "./weeklyReportTypes.js";

const MAX_SITE_REPORTS_PER_ORG = 10;

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

  private async generateSiteReport(siteId: number, siteName: string, siteDomain: string): Promise<SiteReport | null> {
    try {
      // Use UTC timezone for consistency
      const now = DateTime.utc();

      // Calculate current week (last 7 days)
      const currentWeekEnd = now;
      const currentWeekStart = now.minus({ days: 7 });

      // Calculate previous week (8-14 days ago)
      const previousWeekEnd = currentWeekStart;
      const previousWeekStart = currentWeekStart.minus({ days: 7 });

      // Format dates for ClickHouse (YYYY-MM-DD HH:mm:ss). The windows above are
      // UTC, and getTimeStatement anchors the comparison in UTC too — the bound
      // `toDateTime({date:String})` this replaced was interpreted in the
      // ClickHouse server's timezone, so a non-UTC server shifted the week.
      const formatDate = (date: DateTime) => date.toFormat("yyyy-MM-dd HH:mm:ss");
      const specFor = (from: DateTime, to: DateTime): SiteMetricsSpec => ({
        timeStatement: getTimeStatement({
          start_datetime: formatDate(from),
          end_datetime: formatDate(to),
        }),
      });

      const currentSpec = specFor(currentWeekStart, currentWeekEnd);
      const previousSpec = specFor(previousWeekStart, previousWeekEnd);

      const [currentWeek, previousWeek, topCountries, topPages, topReferrers, deviceBreakdown] = await Promise.all([
        this.fetchOverviewData(siteId, currentSpec),
        this.fetchOverviewData(siteId, previousSpec),
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
        currentWeek,
        previousWeek: previousWeek || {
          sessions: 0,
          pageviews: 0,
          users: 0,
          pages_per_session: 0,
          bounce_rate: 0,
          session_duration: 0,
        },
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

  private async generateOrganizationReport(organizationId: string): Promise<OrganizationReport | null> {
    try {
      // Fetch organization details
      const [org] = await db.select().from(organization).where(eq(organization.id, organizationId));

      if (!org) {
        return null;
      }

      // Fetch all sites for this organization
      const orgSites = await db.select().from(sites).where(eq(sites.organizationId, org.id));

      if (orgSites.length === 0) {
        return null;
      }

      const siteReports: SiteReport[] = [];

      for (const site of orgSites) {
        if (siteReports.length >= MAX_SITE_REPORTS_PER_ORG) {
          this.logger.info(
            { organizationId, totalSites: orgSites.length, limit: MAX_SITE_REPORTS_PER_ORG },
            "Reached site report limit for organization, skipping remaining sites"
          );
          break;
        }

        const report = await this.generateSiteReport(site.siteId, site.name, site.domain);
        if (report) {
          siteReports.push(report);
        }
      }

      if (siteReports.length === 0) {
        return null;
      }

      return {
        organizationId: org.id,
        organizationName: org.name,
        sites: siteReports,
      };
    } catch (error) {
      this.logger.error({ err: error, organizationId }, "Error generating organization report");
      return null;
    }
  }

  private async sendReportsToOrganization(report: OrganizationReport): Promise<void> {
    try {
      // Owners only. They have unrestricted access to every site in the org, so
      // there is no per-member site filtering to do.
      const owners = await db
        .select({
          email: user.email,
          name: user.name,
          sendAutoEmailReports: user.sendAutoEmailReports,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(and(eq(member.organizationId, report.organizationId), eq(member.role, "owner")));

      // Send a separate email for each site to each owner
      for (const memberData of owners) {
        // Skip users who have disabled email reports
        if (memberData.sendAutoEmailReports === false) {
          continue;
        }

        for (const site of report.sites) {
          try {
            await sendWeeklyReportEmail(memberData.email, memberData.name, report.organizationName, site);
            this.logger.info(
              {
                organizationId: report.organizationId,
                siteId: site.siteId,
              },
              "Sent weekly report email for site"
            );
          } catch (error) {
            this.logger.error(
              { err: error, organizationId: report.organizationId, siteId: site.siteId },
              "Failed to send email to member for site"
            );
          }
        }
      }
    } catch (error) {
      this.logger.error({ err: error, organizationId: report.organizationId }, "Error sending reports to organization");
    }
  }

  /**
   * This week's reports for the orgs a single user owns, delivered to that
   * user alone. Backs the admin "send me a test" trigger: it exercises the
   * real generation and mail path without touching anyone else's inbox, and
   * ignores the user's own sendAutoEmailReports opt-out since the send was
   * explicitly asked for.
   */
  public async sendReportsToUser(
    userId: string,
    email: string,
    name: string
  ): Promise<{ organizations: number; emails: number }> {
    if (!EMAIL_ENABLED) {
      throw new Error("Email is not configured");
    }

    const memberships = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(and(eq(member.userId, userId), eq(member.role, "owner")));

    let emails = 0;
    for (const { organizationId } of memberships) {
      const report = await this.generateOrganizationReport(organizationId);
      if (!report) continue;

      for (const site of report.sites) {
        await sendWeeklyReportEmail(email, name, report.organizationName, site);
        emails++;
      }
    }

    this.logger.info({ userId, organizations: memberships.length, emails }, "Sent test weekly reports to user");
    return { organizations: memberships.length, emails };
  }

  public async generateAndSendReports(): Promise<void> {
    if (!EMAIL_ENABLED) {
      this.logger.info("Skipping weekly reports: no RESEND_API_KEY configured");
      return;
    }

    this.logger.info("Starting weekly report generation and sending");

    try {
      // Fetch all organizations
      const organizations = await db.select().from(organization);
      const totalOrgs = organizations.length;

      this.logger.info({ totalOrganizations: totalOrgs }, "Processing organizations");

      let processedCount = 0;
      let sentCount = 0;

      for (let i = 0; i < organizations.length; i++) {
        const org = organizations[i];

        // Generate report for this organization
        const report = await this.generateOrganizationReport(org.id);

        if (report) {
          // Send reports immediately after generation
          await this.sendReportsToOrganization(report);
          sentCount++;
        }

        processedCount++;

        // Log progress every 10 organizations
        if (processedCount % 10 === 0 || processedCount === totalOrgs) {
          this.logger.info(
            { processed: processedCount, total: totalOrgs, sent: sentCount },
            `Progress: ${processedCount}/${totalOrgs} organizations processed, ${sentCount} reports sent`
          );
        }
      }

      this.logger.info(
        { totalProcessed: processedCount, totalSent: sentCount },
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
