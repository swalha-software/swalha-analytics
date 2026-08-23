"use client";

import { ChevronRight, Smartphone } from "lucide-react";
import { useExtracted } from "next-intl";
import Link from "next/link";
import type { OrganizationOverviewSite } from "@/api/analytics/endpoints";
import { Favicon } from "@/components/Favicon";
import { userLocale } from "@/lib/dateTimeUtils";
import { formatter } from "@/lib/utils";
import { MetricChange } from "./MetricChange";
import { Sparkline } from "./Sparkline";
import type { OverviewMetric } from "./overviewUtils";

// One grid, declared once, so the header labels and every row stay in step.
export const SITE_ROW_GRID =
  "md:grid md:grid-cols-[minmax(0,1fr)_110px_repeat(3,84px)_24px] md:items-center md:gap-3 lg:grid-cols-[minmax(0,1fr)_130px_repeat(4,90px)_24px]";

function MetricCell({
  label,
  value,
  current,
  previous,
  invert,
  className,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  invert?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 md:hidden">{label}</div>
      <div className="text-sm font-medium tabular-nums text-neutral-900 dark:text-neutral-100 md:text-end">{value}</div>
      <div className="md:text-end">
        <MetricChange current={current} previous={previous} invert={invert} />
      </div>
    </div>
  );
}

/** One site's period at a glance; the whole row opens its dashboard. */
export function SiteTrafficRow({
  site,
  metric,
  href,
}: {
  site: OrganizationOverviewSite;
  metric: OverviewMetric;
  href: string;
}) {
  const t = useExtracted();
  const { current, previous } = site;

  return (
    <Link
      href={href}
      className={`group flex flex-col gap-3 rounded-lg border border-transparent px-3 py-3 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60 dark:hover:bg-neutral-850/60 ${SITE_ROW_GRID}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {site.type === "mobile" ? (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-neutral-150 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            <Smartphone className="size-3.5" />
          </span>
        ) : (
          <Favicon domain={site.domain} className="size-5 shrink-0 rounded-sm" />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-neutral-900 dark:text-neutral-50">{site.name}</span>
          <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">{site.domain}</span>
        </span>
      </div>

      <div className="h-8">
        <Sparkline series={site.series} metric={metric} />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 md:contents">
        <MetricCell
          label={t("Users")}
          value={formatter(current.users)}
          current={current.users}
          previous={previous.users}
        />
        <MetricCell
          label={t("Sessions")}
          value={formatter(current.sessions)}
          current={current.sessions}
          previous={previous.sessions}
        />
        <MetricCell
          label={t("Pageviews")}
          value={formatter(current.pageviews)}
          current={current.pageviews}
          previous={previous.pageviews}
        />
        <MetricCell
          label={t("Bounce Rate")}
          value={`${current.bounceRate.toFixed(1)}%`}
          current={current.bounceRate}
          previous={previous.bounceRate}
          invert
          className="max-lg:md:hidden"
        />
      </div>

      <ChevronRight className="hidden size-4 shrink-0 text-neutral-400 transition-colors group-hover:text-neutral-700 md:block rtl:rotate-180 dark:text-neutral-600 dark:group-hover:text-neutral-300" />
    </Link>
  );
}

export function SiteTrafficRowSkeleton() {
  return (
    <div className={`flex flex-col gap-3 px-3 py-3 ${SITE_ROW_GRID}`}>
      <div className="flex items-center gap-2.5">
        <div className="size-5 shrink-0 animate-pulse rounded-sm bg-neutral-200 dark:bg-neutral-850" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-3.5 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-850" />
          <div className="h-2.5 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-850" />
        </div>
      </div>
      <div className="h-8 animate-pulse rounded bg-neutral-200 dark:bg-neutral-850" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 md:contents">
        {[0, 1, 2, 3].map(index => (
          <div
            key={index}
            className={`h-8 animate-pulse rounded bg-neutral-200 dark:bg-neutral-850 ${index === 3 ? "max-lg:md:hidden" : ""}`}
          />
        ))}
      </div>
      <div className="hidden md:block" />
    </div>
  );
}
