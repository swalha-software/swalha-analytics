"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useEmbedPageOptions } from "@/app/[site]/utils";
import { getCurrentSiteId } from "@/lib/siteRoute";
import { cn } from "@/lib/utils";
import { OrgSwitcher } from "./OrgSwitcher";
import { SidebarNav, SidebarShell, useSidebarCollapsed } from "./parts";
import { SiteNav } from "./SiteNav";
import { SiteSwitcher } from "./SiteSwitcher";
import { UserMenu } from "./UserMenu";
import { OrganizationGroup, SettingsGroup } from "./WorkspaceNav";

function AppShellSections() {
  const pathname = usePathname();
  const { embed } = useEmbedPageOptions();
  const collapsed = useSidebarCollapsed();

  const isSitePage = getCurrentSiteId(pathname) !== null;

  return (
    <>
      <div
        className={cn(
          "flex shrink-0 flex-col gap-2 border-b border-neutral-150 dark:border-neutral-850",
          collapsed ? "items-center p-2" : "p-3"
        )}
      >
        {!embed && <OrgSwitcher />}
        <SiteSwitcher />
      </div>

      <SidebarNav>
        {isSitePage ? <SiteNav /> : <OrganizationGroup />}
        <SettingsGroup />
      </SidebarNav>

      {!embed && <UserMenu />}
    </>
  );
}

function AppShellSidebarContent({ className, forceExpanded }: { className?: string; forceExpanded?: boolean }) {
  const { hideSidebar } = useEmbedPageOptions();

  if (hideSidebar) return null;

  return (
    <SidebarShell className={className} forceExpanded={forceExpanded}>
      <AppShellSections />
    </SidebarShell>
  );
}

/** The single shell sidebar: brand, org + site context, nav, and the user menu. */
export function AppShellSidebar({ className, forceExpanded }: { className?: string; forceExpanded?: boolean }) {
  return (
    <Suspense fallback={null}>
      <AppShellSidebarContent className={className} forceExpanded={forceExpanded} />
    </Suspense>
  );
}
