import { TimeBucket } from "@rybbit/shared";
import { FastifyReply, FastifyRequest } from "fastify";
import { DateTime } from "luxon";
import SqlString from "sqlstring";
import { getSitesUserHasAccessTo } from "../../lib/auth-utils.js";
import { analyticsRoute, runAnalyticsQuery } from "./utils/analyticsQuery.js";
import { EFFECTIVE_SESSION_USER_ID, effectiveUserId } from "./utils/effectiveUserId.js";
import { isTimeBucket, resolveTimeWindow, TimeWindowParams } from "./utils/timeWindow.js";

/**
 * The organization-wide overview: one row of headline metrics per site, plus an
 * organization total, for a period and the period before it.
 *
 * Two things shape this module.
 *
 * **Which sites the caller sees.** `:organizationId` says which organization is
 * being asked about; it does not say what the caller may read. The site list is
 * therefore the *intersection* of the organization's sites with
 * `getSitesUserHasAccessTo`, which is the single place that knows about
 * `hasRestrictedSiteAccess`, member site grants and team grants. An org member
 * restricted to two of the organization's forty sites gets two rows here, and
 * the ClickHouse queries are bound to those two site ids — a restricted member
 * can never be included in a total they are not allowed to see. Organization-
 * owned API keys keep their org-wide authority because that helper already
 * grants it to them. An empty intersection is not an error: an org member with
 * no site grants legitimately has an empty overview, and answering 403 would
 * make "no sites yet" indistinguishable from "forbidden".
 *
 * **Why the queries are batched.** The obvious implementation runs the site
 * dashboard's queries once per site, so an organization with fifty sites costs
 * two hundred ClickHouse round trips and scales with the org. Every query here
 * instead binds the whole site list at once and carries `site_id` through the
 * `GROUP BY`, so the cost is a fixed four queries — current totals, previous
 * totals, current series, previous series — no matter how many sites the caller
 * can reach. The organization totals are then summed in Node rather than asked
 * for separately.
 *
 * The metric definitions are the site dashboard's, transcribed from
 * `services/siteMetrics/siteMetrics.ts` (unbucketed) and `getOverviewBucketed.ts`
 * (bucketed) so that a site's row here and that site's own Main tab report the
 * same numbers for the same period. This endpoint takes no filters, which is
 * what lets the transcription drop the site queries' filtered/unfiltered session
 * split: with no filter the "all sessions" and "filtered sessions" sets are the
 * same rows, so their join is an identity and the two CTEs collapse into one.
 */

/** Headline metrics for one site (or for the organization) over one window. */
export interface OverviewMetrics {
  users: number;
  sessions: number;
  pageviews: number;
  /** 0–100, not 0–1. */
  bounceRate: number;
  /** Seconds. */
  avgSessionDuration: number;
}

/** One bucket of a time series. `time` is ClickHouse's `YYYY-MM-DD hh:mm:ss`. */
export interface OverviewPoint {
  time: string;
  users: number;
  sessions: number;
  pageviews: number;
}

export interface OrganizationOverviewSite {
  siteId: number;
  name: string;
  domain: string;
  type: "web" | "mobile";
  current: OverviewMetrics;
  previous: OverviewMetrics;
  series: OverviewPoint[];
}

export interface OrganizationOverviewResponse {
  sites: OrganizationOverviewSite[];
  totals: {
    current: OverviewMetrics;
    previous: OverviewMetrics;
    series: OverviewPoint[];
    previousSeries: OverviewPoint[];
  };
}

/**
 * The counts a window yields per site, before they are turned into
 * {@link OverviewMetrics}.
 *
 * Bounces and total duration are carried as raw sums rather than as the
 * dashboard's `… / COUNT() * 100` and `AVG(…)` because the organization total
 * needs them that way: averaging fifty sites' bounce percentages gives a tiny
 * site the same weight as a busy one. Summing the components and dividing once
 * is the weighted aggregate, and it is the same arithmetic the per-site numbers
 * go through, so the two can never disagree.
 */
export interface SiteMetricTotals {
  sessions: number;
  pageviews: number;
  users: number;
  bounced_sessions: number;
  total_session_duration: number;
}

/** A totals row as ClickHouse returns it. */
export interface SiteTotalsRow extends SiteMetricTotals {
  site_id: number;
}

/** A series row as ClickHouse returns it. */
export interface SiteSeriesRow {
  site_id: number;
  time: string;
  users: number;
  sessions: number;
  pageviews: number;
}

/** The six time params this endpoint accepts, named as on the site endpoints. */
export interface OrganizationOverviewQuery {
  start_date?: string;
  end_date?: string;
  time_zone?: string;
  bucket?: TimeBucket;
  // Typed as numbers to match the shared FilterParams, though a querystring
  // delivers them as strings; both readers below coerce.
  past_minutes_start?: number;
  past_minutes_end?: number;
}

export interface OrganizationOverviewRequest {
  Params: { organizationId: string };
  Querystring: OrganizationOverviewQuery;
}

export const ZERO_METRICS: OverviewMetrics = {
  users: 0,
  sessions: 0,
  pageviews: 0,
  bounceRate: 0,
  avgSessionDuration: 0,
};

const EMPTY_TOTALS: SiteMetricTotals = {
  sessions: 0,
  pageviews: 0,
  users: 0,
  bounced_sessions: 0,
  total_session_duration: 0,
};

/**
 * Turns raw counts into the reported metrics.
 *
 * A window with no sessions divides 0 by 0. The site dashboard's SQL answers
 * that with NaN/NULL; here it is 0, because the client plots these directly and
 * "no sessions" is unambiguously a zero bounce rate to draw, not a gap.
 */
export function toOverviewMetrics(totals: SiteMetricTotals): OverviewMetrics {
  return {
    users: totals.users,
    sessions: totals.sessions,
    pageviews: totals.pageviews,
    bounceRate: totals.sessions === 0 ? 0 : (totals.bounced_sessions / totals.sessions) * 100,
    avgSessionDuration: totals.sessions === 0 ? 0 : totals.total_session_duration / totals.sessions,
  };
}

/**
 * The organization total across sites.
 *
 * `users` is a plain sum: a person who visits two of the organization's sites
 * counts twice, because identity is per-site (see effectiveUserId) and there is
 * no cross-site key to deduplicate on. Bounce rate and average duration are
 * weighted by summing their components first — see {@link SiteMetricTotals}.
 */
export function sumSiteTotals(rows: SiteMetricTotals[]): SiteMetricTotals {
  return rows.reduce<SiteMetricTotals>(
    (accumulator, row) => ({
      sessions: accumulator.sessions + row.sessions,
      pageviews: accumulator.pageviews + row.pageviews,
      users: accumulator.users + row.users,
      bounced_sessions: accumulator.bounced_sessions + row.bounced_sessions,
      total_session_duration: accumulator.total_session_duration + row.total_session_duration,
    }),
    { ...EMPTY_TOTALS }
  );
}

/**
 * The window immediately before `params`, for the period-over-period comparison.
 *
 * The rules are the dashboard's (client/src/lib/time.ts `deriveTimeState`): a
 * date range steps back by its own inclusive length, a past-minutes window steps
 * back by its own length and stays relative to now. A request that names no
 * usable window is asking for all time, which has nothing before it, so the
 * comparison period is the window itself — the same degenerate answer the site
 * dashboard gives.
 */
export function previousTimeWindow(params: OrganizationOverviewQuery): TimeWindowParams {
  const time_zone = params.time_zone;

  if (params.start_date && params.end_date) {
    const start = DateTime.fromISO(params.start_date, { zone: "utc" });
    const end = DateTime.fromISO(params.end_date, { zone: "utc" });
    if (start.isValid && end.isValid && end >= start) {
      const lengthInDays = Math.floor(end.diff(start, "days").days) + 1;
      return {
        start_date: start.minus({ days: lengthInDays }).toISODate() ?? params.start_date,
        end_date: start.minus({ days: 1 }).toISODate() ?? params.end_date,
        time_zone,
      };
    }
  }

  if (params.past_minutes_start !== undefined && params.past_minutes_end !== undefined) {
    const start = Number(params.past_minutes_start);
    const end = Number(params.past_minutes_end);
    if (Number.isFinite(start) && Number.isFinite(end) && start > end) {
      const lengthInMinutes = start - end;
      return {
        past_minutes_start: start + lengthInMinutes,
        past_minutes_end: end + lengthInMinutes,
        time_zone,
      };
    }
  }

  return { ...params };
}

/** `site_id IN (…)`, escaped. Never interpolated from anything but site ids. */
const siteIdList = (siteIds: number[]) => siteIds.map(siteId => SqlString.escape(siteId)).join(", ");

/**
 * Sessions, pageviews, users, bounces and total duration per site for one
 * window, in a single `GROUP BY site_id` pass.
 *
 * The session grain is `(site_id, session_id)`: session ids are only unique
 * within a site, and grouping them org-wide would merge two sites' sessions into
 * one.
 */
export function buildOrganizationTotalsQuery(params: TimeWindowParams, siteIds: number[]): string {
  const timeStatement = resolveTimeWindow(params).where();

  return `
    WITH SiteSessions AS (
        SELECT
            site_id,
            session_id,
            -- Aliased away from \`user_id\`: an alias shadowing a column used inside
            -- its own expression is a cyclic-alias error in ClickHouse.
            ${EFFECTIVE_SESSION_USER_ID} AS effective_user_id,
            MIN(timestamp) AS start_time,
            MAX(timestamp) AS end_time,
            countIf(type = 'pageview') AS session_pageviews
        FROM events
        WHERE
            site_id IN (${siteIdList(siteIds)})
            ${timeStatement}
        GROUP BY site_id, session_id
    )
    SELECT
        site_id,
        COUNT() AS sessions,
        SUM(session_pageviews) AS pageviews,
        COUNT(DISTINCT effective_user_id) AS users,
        sumIf(1, session_pageviews = 1) AS bounced_sessions,
        SUM(end_time - start_time) AS total_session_duration
    FROM SiteSessions
    GROUP BY site_id`;
}

/**
 * Users, sessions and pageviews per site per bucket, gap-filled.
 *
 * Users and pageviews are counted at event grain and sessions at session-start
 * grain, exactly as the site chart does. The site chart FULL JOINs the two
 * because it fills each side separately; here a LEFT JOIN from the event side is
 * enough and the fill happens once, at the end. A session's start is one of its
 * own events, so it falls in the same site and the same bucket as a row the
 * event side already has: the session side can never contribute a `(site_id,
 * time)` pair the event side is missing.
 *
 * `ORDER BY site_id, time WITH FILL` fills within each site's group rather than
 * across the whole result, so every site that appears comes back with every
 * bucket of the window. A site with no events at all appears in no group and so
 * returns no rows; the handler gives it the same grid, zero-filled.
 */
export function buildOrganizationSeriesQuery(params: TimeWindowParams, siteIds: number[], bucket: TimeBucket): string {
  const window = resolveTimeWindow(params);
  const timeStatement = window.where();
  const ids = siteIdList(siteIds);

  return `
    SELECT
        page_stats.site_id AS site_id,
        page_stats.time AS time,
        session_stats.sessions AS sessions,
        page_stats.pageviews AS pageviews,
        page_stats.users AS users
    FROM
    (
        SELECT
            site_id,
            ${window.bucketed("timestamp", bucket)} AS time,
            countIf(type = 'pageview') AS pageviews,
            COUNT(DISTINCT ${effectiveUserId()}) AS users
        FROM events
        WHERE
            site_id IN (${ids})
            ${timeStatement}
        GROUP BY site_id, time
    ) AS page_stats
    LEFT JOIN
    (
        SELECT
            site_id,
            ${window.bucketed("start_time", bucket)} AS time,
            COUNT() AS sessions
        FROM
        (
            SELECT
                site_id,
                session_id,
                MIN(timestamp) AS start_time
            FROM events
            WHERE
                site_id IN (${ids})
                ${timeStatement}
            GROUP BY site_id, session_id
        )
        GROUP BY site_id, time
    ) AS session_stats
    USING (site_id, time)
    ORDER BY site_id, time ${window.fill(bucket)}`;
}

/**
 * The window's full list of buckets, in order.
 *
 * `WITH FILL` guarantees every site in the result carries every bucket, so any
 * one site's rows describe the whole grid — and when no site has data at all the
 * fill still emits the bare grid (under site id 0, which is not a real site).
 * Reading it off the rows is what lets a site with no traffic be given a
 * zero-filled series without a second query for the bucket boundaries.
 */
export function seriesGrid(rows: SiteSeriesRow[]): string[] {
  const seen = new Set<string>();
  const grid: string[] = [];
  for (const row of rows) {
    if (!seen.has(row.time)) {
      seen.add(row.time);
      grid.push(row.time);
    }
  }
  return grid;
}

/** One site's series, laid on the shared grid so every bucket is present. */
export function siteSeries(grid: string[], rowsForSite: Map<string, SiteSeriesRow>): OverviewPoint[] {
  return grid.map(time => {
    const row = rowsForSite.get(time);
    return {
      time,
      users: row?.users ?? 0,
      sessions: row?.sessions ?? 0,
      pageviews: row?.pageviews ?? 0,
    };
  });
}

/** Per-bucket organization totals: the site series summed bucket by bucket. */
export function totalsSeries(grid: string[], rows: SiteSeriesRow[], siteIds: Set<number>): OverviewPoint[] {
  const byTime = new Map<string, OverviewPoint>(
    grid.map(time => [time, { time, users: 0, sessions: 0, pageviews: 0 }])
  );
  for (const row of rows) {
    const point = byTime.get(row.time);
    // Site id 0 is the grid the fill emits when nothing matched; skip it and
    // anything else outside the caller's site list.
    if (!point || !siteIds.has(row.site_id)) {
      continue;
    }
    point.users += row.users;
    point.sessions += row.sessions;
    point.pageviews += row.pageviews;
  }
  return grid.map(time => byTime.get(time)!);
}

/** Groups series rows by site, keyed by bucket, ignoring sites we may not read. */
function indexSeriesRows(rows: SiteSeriesRow[], siteIds: Set<number>): Map<number, Map<string, SiteSeriesRow>> {
  const bySite = new Map<number, Map<string, SiteSeriesRow>>();
  for (const row of rows) {
    if (!siteIds.has(row.site_id)) {
      continue;
    }
    let forSite = bySite.get(row.site_id);
    if (!forSite) {
      forSite = new Map();
      bySite.set(row.site_id, forSite);
    }
    forSite.set(row.time, row);
  }
  return bySite;
}

const emptyResponse = (): OrganizationOverviewResponse => ({
  sites: [],
  totals: {
    current: { ...ZERO_METRICS },
    previous: { ...ZERO_METRICS },
    series: [],
    previousSeries: [],
  },
});

export const getOrganizationOverview = analyticsRoute<OrganizationOverviewRequest>(
  "organization overview",
  async (req: FastifyRequest<OrganizationOverviewRequest>, res: FastifyReply) => {
    const { organizationId } = req.params;
    const { start_date, end_date, time_zone, bucket, past_minutes_start, past_minutes_end } = req.query;

    // `bucket` reaches SQL as a function name, so an unknown value would be
    // interpolated as `undefined(…)`. validateHttpTimeParams does not cover it.
    if (bucket !== undefined && !isTimeBucket(bucket)) {
      return res.status(400).send({ error: "Invalid bucket parameter" });
    }
    const resolvedBucket: TimeBucket = bucket ?? "hour";

    // Exactly the six accepted params, so a stray `start_datetime` cannot move
    // the current window without also moving the previous one.
    const currentParams: OrganizationOverviewQuery = {
      start_date,
      end_date,
      time_zone,
      past_minutes_start,
      past_minutes_end,
    };
    const previousParams = previousTimeWindow(currentParams);

    // The access intersection: this organization's sites, narrowed to the ones
    // this caller may read. See the module comment.
    const accessibleSites = (await getSitesUserHasAccessTo(req))
      .filter(site => site.organizationId === organizationId)
      .sort((a, b) => a.siteId - b.siteId);

    if (accessibleSites.length === 0) {
      return res.send(emptyResponse());
    }

    const siteIds = accessibleSites.map(site => site.siteId);
    const siteIdSet = new Set(siteIds);

    const [currentTotals, previousTotals, currentSeries, previousSeries] = await Promise.all([
      runAnalyticsQuery<SiteTotalsRow>({ query: buildOrganizationTotalsQuery(currentParams, siteIds) }),
      runAnalyticsQuery<SiteTotalsRow>({ query: buildOrganizationTotalsQuery(previousParams, siteIds) }),
      runAnalyticsQuery<SiteSeriesRow>({
        query: buildOrganizationSeriesQuery(currentParams, siteIds, resolvedBucket),
      }),
      runAnalyticsQuery<SiteSeriesRow>({
        query: buildOrganizationSeriesQuery(previousParams, siteIds, resolvedBucket),
      }),
    ]);

    const currentBySite = new Map(currentTotals.map(row => [row.site_id, row]));
    const previousBySite = new Map(previousTotals.map(row => [row.site_id, row]));
    const grid = seriesGrid(currentSeries);
    const seriesBySite = indexSeriesRows(currentSeries, siteIdSet);

    const sites: OrganizationOverviewSite[] = accessibleSites.map(site => ({
      siteId: site.siteId,
      name: site.name,
      domain: site.domain,
      // The column is nullable; sites predating the mobile/web split are web.
      type: site.type === "mobile" ? "mobile" : "web",
      current: toOverviewMetrics(currentBySite.get(site.siteId) ?? EMPTY_TOTALS),
      previous: toOverviewMetrics(previousBySite.get(site.siteId) ?? EMPTY_TOTALS),
      series: siteSeries(grid, seriesBySite.get(site.siteId) ?? new Map()),
    }));

    return res.send({
      sites,
      totals: {
        current: toOverviewMetrics(sumSiteTotals(currentTotals.filter(row => siteIdSet.has(row.site_id)))),
        previous: toOverviewMetrics(sumSiteTotals(previousTotals.filter(row => siteIdSet.has(row.site_id)))),
        series: totalsSeries(grid, currentSeries, siteIdSet),
        previousSeries: totalsSeries(seriesGrid(previousSeries), previousSeries, siteIdSet),
      },
    } satisfies OrganizationOverviewResponse);
  }
);
