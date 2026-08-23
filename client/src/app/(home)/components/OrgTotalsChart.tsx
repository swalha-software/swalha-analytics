"use client";

import { DateTime } from "luxon";
import { useExtracted } from "next-intl";
import { useMemo } from "react";
import type { OrganizationOverviewTotals } from "@/api/analytics/endpoints";
import { BucketSelection } from "@/components/BucketSelection";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { TimeSeriesChart, type TimeSeriesChartPoint } from "@/components/charts/TimeSeriesChart";
import { getChartTimeBounds, shouldDashLastSegment } from "@/components/charts/timeSeriesChartUtils";
import { ToggleChip } from "@/components/ToggleChip";
import { Card, CardContent, CardLoader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatChartDateTime } from "@/lib/dateTimeUtils";
import { getTimezone, useStore } from "@/lib/store";
import { OVERVIEW_METRICS, parseSeriesTime, type OverviewMetric } from "./overviewUtils";

type CurrentPoint = TimeSeriesChartPoint & { currentTime: DateTime };
type PreviousPoint = TimeSeriesChartPoint & { originalTime: DateTime };

const CHART_HEIGHT = "h-[220px] md:h-[300px]";

/**
 * The organization's traffic over the selected period: current period in gold
 * with a gradient fill, the previous period shifted onto the same axis as a
 * grey backdrop, and the still-filling final bucket dashed.
 */
export function OrgTotalsChart({
  totals,
  metric,
  onMetricChange,
  isFetching,
}: {
  totals: OrganizationOverviewTotals | undefined;
  metric: OverviewMetric;
  onMetricChange: (metric: OverviewMetric) => void;
  isFetching: boolean;
}) {
  const t = useExtracted();
  const time = useStore(state => state.time);
  const previousTime = useStore(state => state.previousTime);
  const bucket = useStore(state => state.bucket);
  const timezone = getTimezone();

  const metricLabel = (value: OverviewMetric) => {
    if (value === "users") return t("Users");
    if (value === "sessions") return t("Sessions");
    return t("Pageviews");
  };

  const { current, previous, chartMin, chartMax, max, displayDashed } = useMemo(() => {
    const { min: boundsMin, max: boundsMax } = getChartTimeBounds(time, bucket, timezone);
    const now = DateTime.now();
    const lowerBoundMs = boundsMin?.getTime();
    const upperBoundMs = (boundsMax ?? now.toJSDate()).getTime();

    const inBounds = (ms: number) => (lowerBoundMs === undefined || ms >= lowerBoundMs) && ms <= upperBoundMs;

    const currentPoints: CurrentPoint[] = [];
    totals?.series.forEach(point => {
      const ts = parseSeriesTime(point.time, timezone);
      if (!ts.isValid || ts > now || !inBounds(ts.toMillis())) return;
      currentPoints.push({ x: ts.toJSDate(), y: point[metric] ?? 0, currentTime: ts });
    });

    // The previous period is drawn on the current period's axis, but keeps its
    // real timestamp so the tooltip can name the day it actually came from.
    const { min: prevMin } = getChartTimeBounds(previousTime, bucket, timezone);
    const offsetMs = boundsMin && prevMin ? boundsMin.getTime() - prevMin.getTime() : 0;
    const previousPoints: PreviousPoint[] = [];
    if (time.mode !== "all-time") {
      totals?.previousSeries.forEach(point => {
        const ts = parseSeriesTime(point.time, timezone);
        if (!ts.isValid) return;
        const mappedMs = ts.toMillis() + offsetMs;
        if (!inBounds(mappedMs)) return;
        previousPoints.push({ x: new Date(mappedMs), y: point[metric] ?? 0, originalTime: ts });
      });
    }

    // An open-ended range (Last 7 Days, a custom range) has no period end to
    // anchor on, so the right edge is the last bucket that has happened.
    const lastCurrentX = currentPoints.length ? currentPoints[currentPoints.length - 1].x : undefined;
    const effectiveMax =
      time.mode === "range" ? (lastCurrentX ?? boundsMax) : (boundsMax ?? lastCurrentX ?? now.toJSDate());

    return {
      current: currentPoints,
      previous: previousPoints,
      chartMin: boundsMin ?? (currentPoints.length ? currentPoints[0].x : undefined),
      chartMax: effectiveMax,
      max: Math.max(0, ...currentPoints.map(p => p.y), ...previousPoints.map(p => p.y)),
      displayDashed: currentPoints.length >= 2 && shouldDashLastSegment(time, bucket),
    };
  }, [totals, metric, time, previousTime, bucket, timezone]);

  return (
    <Card>
      {isFetching && <CardLoader />}
      <CardContent className="w-full p-3 pt-3 md:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {OVERVIEW_METRICS.map(value => (
              <ToggleChip
                key={value}
                isSelected={metric === value}
                onClick={() => onMetricChange(value)}
                label={metricLabel(value)}
                swatchColor="hsl(var(--dataviz))"
              />
            ))}
          </div>
          <BucketSelection />
        </div>

        <div className={CHART_HEIGHT}>
          {totals ? (
            <TimeSeriesChart
              current={current}
              previous={previous}
              max={max}
              chartMin={chartMin}
              chartMax={chartMax}
              displayDashed={displayDashed}
              renderTooltip={({ point, previousPoint, bucket: tooltipBucket }) => {
                const previousValue = previousPoint?.y ?? 0;
                const diffPct =
                  previousPoint && previousValue ? ((point.y - previousValue) / previousValue) * 100 : null;

                return (
                  <ChartTooltip>
                    {diffPct !== null && (
                      <div
                        className="px-2 pb-1 pt-1.5 text-base font-medium"
                        style={{ color: diffPct > 0 ? "hsl(var(--green-400))" : "hsl(var(--red-400))" }}
                      >
                        {diffPct > 0 ? "+" : ""}
                        {diffPct.toFixed(2)}%
                      </div>
                    )}
                    <div className="h-px w-full bg-neutral-100 dark:bg-neutral-750" />
                    <div className="m-2 flex flex-col gap-1">
                      <div className="flex justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="h-3 w-1 shrink-0 rounded-[3px] bg-dataviz" />
                          <span className="truncate">{formatChartDateTime(point.currentTime, tooltipBucket)}</span>
                        </div>
                        <div className="shrink-0">{point.y.toLocaleString()}</div>
                      </div>
                      {previousPoint && (
                        <div className="flex justify-between gap-3 text-sm text-muted-foreground">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="h-3 w-1 shrink-0 rounded-[3px] bg-neutral-200 dark:bg-neutral-750" />
                            <span className="truncate">
                              {formatChartDateTime(previousPoint.originalTime, tooltipBucket)}
                            </span>
                          </div>
                          <div className="shrink-0">{previousValue.toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                  </ChartTooltip>
                );
              }}
            />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </div>

        <div className="mt-2 flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-dataviz" />
            {metricLabel(metric)}
          </span>
          {previous.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-neutral-200 dark:bg-neutral-700" />
              {t("Previous period")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
