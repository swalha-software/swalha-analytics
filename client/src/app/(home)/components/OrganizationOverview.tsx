"use client";

import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { useOrganizationOverview } from "@/api/analytics/hooks/useOrganizationOverview";
import { ErrorState } from "@/components/ErrorState";
import { Card } from "@/components/ui/card";
import { getDashboardTimeForRange } from "@/lib/defaultTimeRange";
import { getTimezone, useStore } from "@/lib/store";
import { OrgKpiRow } from "./OrgKpiRow";
import { OrgTotalsChart } from "./OrgTotalsChart";
import { SiteTrafficList } from "./SiteTrafficList";
import { OverviewHeader } from "./OverviewHeader";
import type { OverviewMetric } from "./overviewUtils";

/**
 * The organization-wide dashboard: totals for the selected period, the same
 * period plotted, and every site in the organization ranked by traffic.
 */
export function OrganizationOverview({
  organizationId,
  organizationName,
}: {
  organizationId: string | undefined;
  organizationName: string | undefined;
}) {
  const t = useExtracted();
  // The chart's metric also picks which shape the per-site sparklines draw, so
  // the whole page answers the same question at once.
  const [metric, setMetric] = useState<OverviewMetric>("users");
  const setTime = useStore(state => state.setTime);

  // The store's initial period is computed in UTC so the server and the client
  // hydrate identical markup; the site pages then re-derive it from the URL.
  // "/" carries no time params, so it opens on today in the reader's own
  // timezone — and only queries once that is settled, so the first render does
  // not fire a request for the wrong day.
  const [isPeriodReady, setIsPeriodReady] = useState(false);
  useEffect(() => {
    setTime(getDashboardTimeForRange("today", getTimezone()));
    setIsPeriodReady(true);
  }, [setTime]);

  const { data, isFetching, error, refetch } = useOrganizationOverview(isPeriodReady ? organizationId : undefined);
  // Also covers "the organization id has not arrived yet", where the query is
  // still disabled and would otherwise report itself as idle.
  const isLoading = !data && !error;

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <OverviewHeader organizationName={organizationName} />

      {error && !data ? (
        <Card>
          <ErrorState
            title={t("Could not load this organization's traffic")}
            message={error.message}
            refetch={refetch}
          />
        </Card>
      ) : (
        <>
          <OrgKpiRow current={data?.totals.current} previous={data?.totals.previous} isLoading={isLoading} />
          <OrgTotalsChart
            totals={data?.totals}
            metric={metric}
            onMetricChange={setMetric}
            isFetching={isFetching && !isLoading}
          />
          <SiteTrafficList sites={data?.sites} metric={metric} isLoading={isLoading} isFetching={isFetching} />
        </>
      )}
    </div>
  );
}
