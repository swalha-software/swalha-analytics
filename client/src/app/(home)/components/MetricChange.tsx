"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useExtracted } from "next-intl";
import { cn } from "@/lib/utils";
import { percentChange } from "./overviewUtils";

/**
 * Change against the previous period. Direction is carried by an arrow as well
 * as by colour, and a previous period of zero stays neutral rather than
 * reporting an infinite rise.
 */
export function MetricChange({
  current,
  previous,
  invert = false,
  className,
}: {
  current: number;
  previous: number;
  /** For metrics where down is good (bounce rate). */
  invert?: boolean;
  className?: string;
}) {
  const t = useExtracted();
  const change = percentChange(current, previous);
  const neutral = cn("text-xs tabular-nums text-neutral-500 dark:text-neutral-400", className);

  if (change === null) {
    return <span className={neutral}>{current > 0 ? t("New") : "—"}</span>;
  }

  // Anything that rounds to 0.0% is flat, not a direction.
  if (Math.abs(change) < 0.05) return <span className={neutral}>0%</span>;

  const isUp = change > 0;
  const isGood = invert ? !isUp : isUp;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        isGood ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
        className
      )}
    >
      {isUp ? <ArrowUp className="size-3" strokeWidth={3} /> : <ArrowDown className="size-3" strokeWidth={3} />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}
