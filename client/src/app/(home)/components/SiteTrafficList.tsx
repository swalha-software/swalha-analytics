"use client";

import { ArrowDownWideNarrow, Plus, Search } from "lucide-react";
import { useExtracted } from "next-intl";
import { useMemo, useState } from "react";
import type { OrganizationOverviewSite } from "@/api/analytics/endpoints";
import { NothingFound } from "@/components/NothingFound";
import { Card, CardLoader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddSite } from "@/app/components/AddSite";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { SITE_ROW_GRID, SiteTrafficRow, SiteTrafficRowSkeleton } from "./SiteTrafficRow";
import { siteDashboardHref, type OverviewMetric } from "./overviewUtils";

type SortKey = "users" | "sessions" | "pageviews" | "name";

const SORT_KEYS: SortKey[] = ["users", "sessions", "pageviews", "name"];

function ColumnHeaders() {
  const t = useExtracted();
  const numeric = "text-end text-[11px] font-medium text-neutral-500 dark:text-neutral-400";

  return (
    <div className={`hidden border-b border-neutral-100 px-3 pb-2 dark:border-neutral-850 ${SITE_ROW_GRID}`}>
      <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">{t("Site")}</div>
      <div />
      <div className={numeric}>{t("Users")}</div>
      <div className={numeric}>{t("Sessions")}</div>
      <div className={numeric}>{t("Pageviews")}</div>
      <div className={`${numeric} max-lg:md:hidden`}>{t("Bounce Rate")}</div>
      <div />
    </div>
  );
}

/**
 * Every site in the organization, busiest first, with a search box and a sort
 * control for the point where scanning the list stops being enough.
 */
export function SiteTrafficList({
  sites,
  metric,
  isLoading,
  isFetching,
  canAddSite,
}: {
  sites: OrganizationOverviewSite[] | undefined;
  metric: OverviewMetric;
  isLoading: boolean;
  isFetching: boolean;
  /** Members cannot add sites; the trigger stays visible but disabled. */
  canAddSite: boolean;
}) {
  const t = useExtracted();
  const time = useStore(state => state.time);
  const bucket = useStore(state => state.bucket);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("users");

  const sortLabel = (key: SortKey) => {
    if (key === "users") return t("Users");
    if (key === "sessions") return t("Sessions");
    if (key === "pageviews") return t("Pageviews");
    return t("Name");
  };

  const visibleSites = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? (sites ?? []).filter(
          site => site.name.toLowerCase().includes(needle) || site.domain.toLowerCase().includes(needle)
        )
      : (sites ?? []);

    // Counts read busiest-first; a name reads A→Z. Ties fall back to users so
    // the order does not jitter between refetches.
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      return b.current[sortKey] - a.current[sortKey] || b.current.users - a.current.users;
    });
  }, [sites, query, sortKey]);

  return (
    <Card className="p-3 md:p-4">
      {isFetching && !isLoading && <CardLoader />}

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          {t("Sites")}
          {sites ? (
            <span className="ms-2 font-normal text-neutral-500 dark:text-neutral-400">
              {query.trim() ? `${visibleSites.length}/${sites.length}` : sites.length}
            </span>
          ) : null}
        </h2>

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={t("Search sites")}
              aria-label={t("Search sites")}
              className="h-8 px-0 ps-8 pe-3 text-sm"
            />
          </div>
          <Select value={sortKey} onValueChange={value => setSortKey(value as SortKey)}>
            <SelectTrigger size="sm" className="h-8 w-[124px]" aria-label={t("Sort by")}>
              <div className="flex items-center gap-1">
                <ArrowDownWideNarrow className="size-3" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent size="sm">
              {SORT_KEYS.map(key => (
                <SelectItem key={key} size="sm" value={key}>
                  {sortLabel(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AddSite
            disabled={!canAddSite}
            trigger={
              <Button size="sm" variant="success" className="h-8" disabled={!canAddSite}>
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">{t("Add Site")}</span>
              </Button>
            }
          />
        </div>
      </div>

      <ColumnHeaders />

      {isLoading ? (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-850">
          {[0, 1, 2, 3].map(index => (
            <SiteTrafficRowSkeleton key={index} />
          ))}
        </div>
      ) : visibleSites.length === 0 ? (
        query.trim() ? (
          <NothingFound
            icon={<Search className="size-8 text-neutral-400" />}
            title={t("No sites match your search")}
            description={t("Try a different name or domain.")}
          />
        ) : (
          <NothingFound
            icon={<Search className="size-8 text-neutral-400" />}
            title={t("No sites reported traffic")}
            description={t("Nothing was recorded for this organization in the selected period.")}
          />
        )
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-850">
          {visibleSites.map(site => (
            <SiteTrafficRow
              key={site.siteId}
              site={site}
              metric={metric}
              href={siteDashboardHref(site.siteId, time, bucket)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
