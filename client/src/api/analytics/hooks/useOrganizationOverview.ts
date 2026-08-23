import { useQuery } from "@tanstack/react-query";
import { useStore } from "../../../lib/store";
import { buildAnalyticsRequest } from "../analyticsRequest";
import { fetchOrganizationOverview, GetOrganizationOverviewResponse } from "../endpoints";
import { useAnalyticsContext } from "../useAnalyticsQuery";

/**
 * The organization-wide overview for the selected period.
 *
 * The request is built from the same store context the site analytics hooks
 * use, and the query key is built from that request — so key and request
 * cannot drift. Dashboard filters are site-scoped and do not apply here.
 */
export function useOrganizationOverview(organizationId: string | undefined) {
  const bucket = useStore(state => state.bucket);
  const { context } = useAnalyticsContext({ useFilters: false });
  const request = buildAnalyticsRequest({ path: "overview", params: { bucket } }, context);

  return useQuery<GetOrganizationOverviewResponse, Error>({
    queryKey: ["organization-overview", organizationId, request.params],
    queryFn: () => fetchOrganizationOverview(organizationId!, request.params),
    staleTime: 60_000,
    enabled: !!organizationId,
    // Keep the previous period on screen while a time change refetches, so the
    // page does not collapse to skeletons on every date-selector tweak.
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey?.includes(organizationId) ? previousData : undefined,
  });
}
