"use client";

import * as d3 from "d3";
import { useId, useMemo } from "react";
import type { OrganizationOverviewPoint } from "@/api/analytics/endpoints";
import { cn } from "@/lib/utils";
import type { OverviewMetric } from "./overviewUtils";

// Drawn in a fixed coordinate space and stretched by CSS; the stroke keeps its
// width through `vector-effect`, so one sparkline reads the same at any column
// width without measuring the DOM.
const VIEW_WIDTH = 120;
const VIEW_HEIGHT = 32;

/** A site's shape over the period: gold line, soft fill, no axes. */
export function Sparkline({
  series,
  metric,
  className,
}: {
  series: OrganizationOverviewPoint[];
  metric: OverviewMetric;
  className?: string;
}) {
  const gradientId = `sparkline-${useId().replace(/:/g, "")}`;

  const { linePath, areaPath } = useMemo(() => {
    const values = series.map(point => point[metric] ?? 0);
    if (values.length === 0) return { linePath: "", areaPath: "" };

    const x = d3
      .scaleLinear()
      .domain([0, Math.max(values.length - 1, 1)])
      .range([0, VIEW_WIDTH]);
    // A period with no traffic still draws — a flat line on the baseline says
    // "zero", a blank cell says "broken".
    const y = d3
      .scaleLinear()
      .domain([0, Math.max(...values, 1)])
      .range([VIEW_HEIGHT - 1, 1]);

    const indexed = values.map((value, index) => ({ index, value }));
    const line = d3
      .line<{ index: number; value: number }>()
      .x(point => x(point.index))
      .y(point => y(point.value));
    const area = d3
      .area<{ index: number; value: number }>()
      .x(point => x(point.index))
      .y0(VIEW_HEIGHT)
      .y1(point => y(point.value));

    return { linePath: line(indexed) ?? "", areaPath: area(indexed) ?? "" };
  }, [series, metric]);

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("h-8 w-full", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--dataviz))" stopOpacity={0.35} />
          <stop offset="100%" stopColor="hsl(var(--dataviz))" stopOpacity={0} />
        </linearGradient>
      </defs>
      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
      {linePath && (
        <path
          d={linePath}
          fill="none"
          stroke="hsl(var(--dataviz))"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
