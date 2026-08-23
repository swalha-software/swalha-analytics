"use client";

import { useExtracted } from "next-intl";
import type { OrganizationOverviewMetrics } from "@/api/analytics/endpoints";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { userLocale } from "@/lib/dateTimeUtils";
import { formatSecondsAsMinutesAndSeconds, formatter } from "@/lib/utils";
import { MetricChange } from "./MetricChange";

const TILE_CLASS = "flex flex-col gap-1 p-3 md:p-4";

function KpiTile({
  label,
  display,
  exact,
  current,
  previous,
  invert,
}: {
  label: string;
  display: string;
  /** Full-precision reading for the compacted counts ("1.2K" → "1,238"). */
  exact?: string;
  current: number;
  previous: number;
  invert?: boolean;
}) {
  return (
    <Card className={TILE_CLASS}>
      <div className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {exact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-2xl font-medium leading-none tabular-nums">{display}</span>
            </TooltipTrigger>
            <TooltipContent>{exact}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-2xl font-medium leading-none tabular-nums">{display}</span>
        )}
        <MetricChange current={current} previous={previous} invert={invert} />
      </div>
    </Card>
  );
}

function KpiSkeleton() {
  return (
    <Card className={TILE_CLASS}>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="mt-1 h-6 w-16" />
    </Card>
  );
}

/** The organization's headline numbers for the period, each against the previous one. */
export function OrgKpiRow({
  current,
  previous,
  isLoading,
}: {
  current: OrganizationOverviewMetrics | undefined;
  previous: OrganizationOverviewMetrics | undefined;
  isLoading: boolean;
}) {
  const t = useExtracted();
  const grid = "grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3 lg:grid-cols-5";

  if (isLoading || !current || !previous) {
    return (
      <div className={grid}>
        {[0, 1, 2, 3, 4].map(index => (
          <KpiSkeleton key={index} />
        ))}
      </div>
    );
  }

  const count = (value: number) => ({
    display: formatter(value),
    exact: value.toLocaleString(userLocale),
  });

  return (
    <div className={grid}>
      <KpiTile label={t("Users")} {...count(current.users)} current={current.users} previous={previous.users} />
      <KpiTile
        label={t("Sessions")}
        {...count(current.sessions)}
        current={current.sessions}
        previous={previous.sessions}
      />
      <KpiTile
        label={t("Pageviews")}
        {...count(current.pageviews)}
        current={current.pageviews}
        previous={previous.pageviews}
      />
      <KpiTile
        label={t("Bounce Rate")}
        display={`${current.bounceRate.toFixed(1)}%`}
        current={current.bounceRate}
        previous={previous.bounceRate}
        invert
      />
      <KpiTile
        label={t("Avg. Session Duration")}
        display={formatSecondsAsMinutesAndSeconds(current.avgSessionDuration)}
        current={current.avgSessionDuration}
        previous={previous.avgSessionDuration}
      />
    </div>
  );
}
