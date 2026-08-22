"use client";
import { useWindowSize } from "@uidotdev/usehooks";
import { useExtracted } from "next-intl";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { useUserOrganizations } from "@/api/admin/hooks/useOrganizations";
import { useGetSitesFromOrg } from "@/api/admin/hooks/useSites";
import { AppShellSidebar } from "@/components/sidebar/AppShellSidebar";
import { MobileSidebarTrigger } from "@/components/sidebar/MobileSidebarSheet";
import { StandardPage } from "@/components/StandardPage";
import { Card } from "@/components/ui/card";
import { useInView } from "@/hooks/useInView";
import { useSetPageTitle } from "@/hooks/useSetPageTitle";
import { authClient } from "@/lib/auth";
import { LITE_DASHBOARD } from "@/lib/const";
import { buildSiteColorMap } from "./components/MainSection/Chart";
import { MainSection } from "./components/MainSection/MainSection";
import { RollupTopBar } from "./components/RollupTopBar";
import { SiteToggleStrip } from "./components/SiteToggleStrip";
import { Countries } from "./components/sections/Countries";
import { CountriesLite } from "./components/sections/CountriesLite";
import { Devices } from "./components/sections/Devices";
import { PagesLite } from "./components/sections/PagesLite";
import { Referrers } from "./components/sections/Referrers";

function LazySection({ children, height = "405px" }: { children: ReactNode; height?: string }) {
  const { ref, isInView } = useInView({
    persistVisibility: true,
    rootMargin: "100px 0px",
  });
  return (
    <div ref={ref} style={{ minHeight: isInView ? undefined : height }}>
      {isInView ? children : null}
    </div>
  );
}

export default function RollupPage() {
  const t = useExtracted();
  useSetPageTitle("Rollup");
  const { width } = useWindowSize();
  const isDesktop = width !== null && width >= 768;

  const { data: activeOrganization } = authClient.useActiveOrganization();
  const { data: sitesData } = useGetSitesFromOrg(activeOrganization?.id);
  useUserOrganizations(); // ensure org list is loaded for header consistency

  const allSites = useMemo(() => sitesData?.sites ?? [], [sitesData]);

  const [selectedSiteIds, setSelectedSiteIds] = useState<number[] | null>(null);

  // Default selected sites = all sites (until user picks explicitly).
  // Drop explicit selections for sites that are no longer available.
  useEffect(() => {
    if (selectedSiteIds === null) return;
    const allowed = new Set(allSites.map(s => s.siteId));
    const pruned = selectedSiteIds.filter(id => allowed.has(id));
    if (pruned.length !== selectedSiteIds.length) {
      setSelectedSiteIds(pruned);
    }
  }, [allSites, selectedSiteIds]);

  const effectiveSiteIds = selectedSiteIds ?? allSites.map(s => s.siteId);

  // Color assignment is by position in allSites so no two sites in view
  // collide as long as count <= palette size.
  const siteColorMap = useMemo(() => buildSiteColorMap(allSites.map(s => s.siteId)), [allSites]);

  const content = (
    <div className="p-2 md:p-4 max-w-[1100px] mx-auto space-y-3">
      <RollupTopBar />
      <SiteToggleStrip
        sites={allSites}
        selectedSiteIds={effectiveSiteIds}
        siteColorMap={siteColorMap}
        onSelectedSiteIdsChange={setSelectedSiteIds}
      />
      {effectiveSiteIds.length === 0 ? (
        <Card className="p-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {t("Select at least one site to view rollup analytics.")}
        </Card>
      ) : LITE_DASHBOARD ? (
        <>
          <MainSection siteIds={effectiveSiteIds} sites={allSites} siteColorMap={siteColorMap} lite />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
            <LazySection>
              <PagesLite siteIds={effectiveSiteIds} />
            </LazySection>
            <LazySection>
              <CountriesLite siteIds={effectiveSiteIds} />
            </LazySection>
          </div>
        </>
      ) : (
        <>
          <MainSection siteIds={effectiveSiteIds} sites={allSites} siteColorMap={siteColorMap} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
            <LazySection>
              <Referrers siteIds={effectiveSiteIds} />
            </LazySection>
            <LazySection>
              <Devices siteIds={effectiveSiteIds} />
            </LazySection>
            <LazySection>
              <Countries siteIds={effectiveSiteIds} />
            </LazySection>
          </div>
        </>
      )}
    </div>
  );

  if (!isDesktop) {
    return (
      <StandardPage>
        <div className="mt-4">
          <MobileSidebarTrigger />
        </div>
        {content}
      </StandardPage>
    );
  }

  return (
    <div className="flex h-full">
      <AppShellSidebar />
      <StandardPage showSidebar={false}>{content}</StandardPage>
    </div>
  );
}
