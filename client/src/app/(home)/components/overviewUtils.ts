import { TimeBucket } from "@rybbit/shared";
import { DateTime } from "luxon";
import type { OrganizationOverviewMetrics, OrganizationOverviewPoint } from "@/api/analytics/endpoints";
import type { Time } from "@/components/DateSelector/types";
import { timeToUrlParams } from "@/lib/time";

/** The three plottable count metrics; the chart and the sort control share them. */
export type OverviewMetric = "users" | "sessions" | "pageviews";

export const OVERVIEW_METRICS: OverviewMetric[] = ["users", "sessions", "pageviews"];

/** Percentage change against the previous period, or null when it had nothing to compare to. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Series timestamps come back in the API's ClickHouse datetime format
 * ("2026-08-22 13:00:00") read in the dashboard timezone. ISO is accepted too
 * so a timezone-suffixed value does not silently become an invalid date.
 */
export function parseSeriesTime(time: string, timeZone: string): DateTime {
  const sql = DateTime.fromSQL(time, { zone: timeZone });
  return (sql.isValid ? sql : DateTime.fromISO(time, { zone: timeZone })).toUTC();
}

/** Sum of a metric across a site's series — the y-scale needs it, per site. */
export function seriesMax(series: OrganizationOverviewPoint[], metric: OverviewMetric): number {
  return series.reduce((max, point) => Math.max(max, point[metric] ?? 0), 0);
}

export function hasTraffic(metrics: OrganizationOverviewMetrics): boolean {
  return metrics.users > 0 || metrics.sessions > 0 || metrics.pageviews > 0;
}

/**
 * A site's dashboard for the period currently selected here, so following a
 * row does not silently reset the reader's time window.
 */
export function siteDashboardHref(siteId: number, time: Time, bucket: TimeBucket): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(timeToUrlParams(time))) {
    if (value !== null && value !== undefined) params.set(key, String(value));
  }
  params.set("bucket", bucket);
  return `/${siteId}/main?${params.toString()}`;
}
