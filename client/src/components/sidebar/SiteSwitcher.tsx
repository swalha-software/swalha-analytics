"use client";

import { AppWindow, Check, ChevronsUpDown, Plus } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { useGetSite, useGetSitesFromOrg } from "@/api/admin/hooks/useSites";
import { AddSite } from "@/app/components/AddSite";
import { useEmbedablePage } from "@/app/[site]/utils";
import { Favicon } from "@/components/Favicon";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { authClient } from "@/lib/auth";
import { DEMO_HOSTNAME } from "@/lib/const";
import { getCurrentSiteId } from "@/lib/siteRoute";
import { userStore } from "@/lib/userStore";
import { cn, formatter } from "@/lib/utils";
import { SwitcherLabel, SwitcherSkeleton, switcherRowClass } from "./parts";

// Show the search field once the list is long enough to scan slowly.
const SEARCH_THRESHOLD = 10;

type SiteOption = {
  siteId: number;
  name: string;
  domain: string;
  sessions?: number;
};

const rowClass = "flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-start transition-colors";

function SiteRow({ site, isSelected }: { site: SiteOption; isSelected: boolean }) {
  const t = useExtracted();
  // Sites named after their own domain shouldn't print the same string twice.
  const showDomain = Boolean(site.domain) && site.domain !== site.name;
  const sessionsLabel =
    site.sessions !== undefined ? t("{count} sessions (24h)", { count: formatter(site.sessions) }) : null;

  return (
    <>
      <Favicon domain={site.domain} className="h-5 w-5 shrink-0 rounded" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm text-neutral-900 dark:text-white">{site.name}</span>
          {!showDomain && sessionsLabel && (
            <span className="shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
              {sessionsLabel}
            </span>
          )}
        </div>
        {showDomain && (
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">{site.domain}</span>
            {sessionsLabel && (
              <span className="shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                {sessionsLabel}
              </span>
            )}
          </div>
        )}
      </div>
      {isSelected && <Check className="h-4 w-4 shrink-0 text-accent-600 dark:text-accent-400" />}
    </>
  );
}

function SiteSkeletonRow() {
  return (
    <div className="flex animate-pulse items-center gap-3 rounded-md px-2 py-2">
      <div className="h-5 w-5 shrink-0 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3.5 w-32 rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-3 w-20 rounded bg-neutral-200 dark:bg-neutral-800" />
      </div>
    </div>
  );
}

function SiteListContent({ onSiteSelect }: { onSiteSelect: () => void }) {
  const t = useExtracted();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const { data: sites } = useGetSitesFromOrg(activeOrganization?.id);

  const pathname = usePathname();
  const router = useRouter();
  const currentSiteId = getCurrentSiteId(pathname);

  const { user } = userStore();

  const isDemo = typeof window !== "undefined" && globalThis.location.hostname === DEMO_HOSTNAME;

  if (!isDemo && !user) return null;

  const navigateToSite = (siteId: number) => {
    onSiteSelect();
    if (siteId === currentSiteId) return;

    // Already inside a site route: keep the tab and query, swap the site id.
    if (currentSiteId !== null) {
      const pathSegments = pathname.split("/");
      pathSegments[1] = siteId.toString();
      const newPath = pathSegments.join("/");
      const queryString = window.location.search;
      router.push(queryString ? `${newPath}${queryString}` : newPath);
      return;
    }

    router.push(`/${siteId}`);
  };

  const siteOptions: SiteOption[] | undefined = isDemo
    ? [{ siteId: 81, name: "rybbit.com", domain: "rybbit.com" }]
    : sites?.sites.map(site => ({
        siteId: site.siteId,
        name: site.name,
        domain: site.domain,
        sessions: site.sessionsLast24Hours,
      }));

  const isLoading = !siteOptions;
  const showSearch = (siteOptions?.length ?? 0) >= SEARCH_THRESHOLD;

  return (
    <PopoverContent align="start" sideOffset={6} className="w-80 overflow-hidden p-0">
      {isLoading ? (
        <div className="p-1">
          {Array.from({ length: 3 }).map((_, index) => (
            <SiteSkeletonRow key={`skeleton-${index}`} />
          ))}
        </div>
      ) : siteOptions.length === 0 ? (
        <div className="px-3 py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {t("No sites found")}
        </div>
      ) : showSearch ? (
        <Command defaultValue={String(currentSiteId)} className="bg-transparent">
          <CommandInput autoFocus placeholder={t("Search sites...")} />
          <CommandList className="max-h-80 p-1">
            <CommandEmpty>{t("No sites found")}</CommandEmpty>
            {siteOptions.map(site => {
              const isSelected = site.siteId === currentSiteId;
              return (
                <CommandItem
                  key={site.siteId}
                  value={String(site.siteId)}
                  keywords={[site.name, site.domain]}
                  onSelect={() => navigateToSite(site.siteId)}
                  className={cn(rowClass, isSelected && "bg-neutral-50 dark:bg-neutral-800/40")}
                >
                  <SiteRow site={site} isSelected={isSelected} />
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      ) : (
        <div className="max-h-80 overflow-y-auto p-1">
          {siteOptions.map(site => {
            const isSelected = site.siteId === currentSiteId;
            return (
              <button
                key={site.siteId}
                type="button"
                onClick={() => navigateToSite(site.siteId)}
                className={cn(
                  rowClass,
                  "hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-300 dark:hover:bg-neutral-800/50 dark:focus-visible:ring-neutral-700",
                  isSelected && "bg-neutral-50 dark:bg-neutral-800/40"
                )}
              >
                <SiteRow site={site} isSelected={isSelected} />
              </button>
            );
          })}
        </div>
      )}

      {!isDemo && (
        <div className="border-t border-neutral-200 p-1 dark:border-neutral-800">
          <AddSite
            trigger={
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Plus className="h-4 w-4" />
                {t("Add Site")}
              </Button>
            }
          />
        </div>
      )}
    </PopoverContent>
  );
}

function SiteSwitcherInner() {
  const t = useExtracted();
  const pathname = usePathname();
  const currentSiteId = getCurrentSiteId(pathname);
  const { data: site } = useGetSite(currentSiteId ?? undefined);
  const [open, setOpen] = useState(false);
  const embed = useEmbedablePage();

  // On a site route we know the id but not the name yet: hold the row's shape.
  if (currentSiteId !== null && !site) return <SwitcherSkeleton />;

  const trigger = site ? (
    <>
      <Favicon domain={site.domain} className="size-7 shrink-0 rounded-md" />
      <SwitcherLabel primary={site.name} secondary={site.domain !== site.name ? site.domain : null} />
    </>
  ) : (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        <AppWindow className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-500 dark:text-neutral-400">
        {t("Select a site")}
      </span>
    </>
  );

  // Embedded dashboards show which site they are, but cannot switch away.
  if (embed) {
    return <div className={cn(switcherRowClass, "pointer-events-none")}>{trigger}</div>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={switcherRowClass} aria-label={t("Switch site")}>
        {trigger}
        <ChevronsUpDown className="size-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
      </PopoverTrigger>
      <Suspense fallback={null}>
        <SiteListContent onSiteSelect={() => setOpen(false)} />
      </Suspense>
    </Popover>
  );
}

export function SiteSwitcher() {
  return (
    <Suspense fallback={<SwitcherSkeleton />}>
      <SiteSwitcherInner />
    </Suspense>
  );
}
