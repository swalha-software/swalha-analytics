import { authedFetch } from "../../utils";

/**
 * Organization-wide overview: every site in the organization with its traffic
 * for the selected period, plus the organization totals.
 *
 * GET /organizations/:organizationId/overview
 *
 * Takes the same time query params as the site analytics endpoints
 * (start_date, end_date, time_zone, bucket, past_minutes_start,
 * past_minutes_end), so the request is built by `buildAnalyticsRequest` from
 * the same store context the site pages use.
 */
export type OrganizationOverviewMetrics = {
  users: number;
  sessions: number;
  pageviews: number;
  bounceRate: number;
  avgSessionDuration: number;
};

export type OrganizationOverviewPoint = {
  time: string;
  users: number;
  sessions: number;
  pageviews: number;
};

export type OrganizationOverviewSite = {
  siteId: number;
  name: string;
  domain: string;
  type: "web" | "mobile";
  current: OrganizationOverviewMetrics;
  previous: OrganizationOverviewMetrics;
  /** Gap-filled: every bucket in the period is present, zeros included. */
  series: OrganizationOverviewPoint[];
};

export type OrganizationOverviewTotals = {
  current: OrganizationOverviewMetrics;
  previous: OrganizationOverviewMetrics;
  series: OrganizationOverviewPoint[];
  previousSeries: OrganizationOverviewPoint[];
};

export type GetOrganizationOverviewResponse = {
  sites: OrganizationOverviewSite[];
  totals: OrganizationOverviewTotals;
};

export async function fetchOrganizationOverview(
  organizationId: string,
  params: Record<string, unknown>
): Promise<GetOrganizationOverviewResponse> {
  const body = await authedFetch<GetOrganizationOverviewResponse | { data: GetOrganizationOverviewResponse }>(
    `/organizations/${organizationId}/overview`,
    params
  );

  // Analytics reads are `{ data }`-wrapped, the admin/org reads are not; this
  // endpoint straddles both worlds, so accept either rather than guess.
  return "sites" in body ? body : body.data;
}
