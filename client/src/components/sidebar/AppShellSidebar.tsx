"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useExtracted } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useEmbedPageOptions } from "@/app/[site]/utils";
import { SwalhaLogo } from "@/components/SwalhaLogo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebarStore } from "@/lib/sidebarStore";
import { getCurrentSiteId } from "@/lib/siteRoute";
import { cn } from "@/lib/utils";
import { OrgSwitcher } from "./OrgSwitcher";
import { SidebarCollapsedProvider } from "./parts";
import { SiteNav } from "./SiteNav";
import { SiteSwitcher } from "./SiteSwitcher";
import { UserMenu } from "./UserMenu";
import { SettingsGroup, UptimeGroup } from "./WorkspaceNav";

const toggleButtonClass = cn(
  "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors",
  "text-neutral-500 hover:bg-neutral-150 hover:text-neutral-900",
  "dark:text-neutral-400 dark:hover:bg-neutral-800/70 dark:hover:text-white",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
);

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Reads the stored preference once, and wires the "[" shortcut. */
function useCollapseControls(enabled: boolean) {
  const hydrateCollapsed = useSidebarStore(state => state.hydrateCollapsed);
  const toggleCollapsed = useSidebarStore(state => state.toggleCollapsed);

  useEffect(() => {
    if (!enabled) return;
    hydrateCollapsed();
  }, [enabled, hydrateCollapsed]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "[" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      toggleCollapsed();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, toggleCollapsed]);

  return toggleCollapsed;
}

function AppShellSidebarContent({ className, forceExpanded }: { className?: string; forceExpanded?: boolean }) {
  const t = useExtracted();
  const pathname = usePathname();
  const { embed, hideSidebar } = useEmbedPageOptions();
  const storedCollapsed = useSidebarStore(state => state.collapsed);
  // The mobile sheet is a full-width drawer: the rail would make no sense there.
  const collapsed = forceExpanded ? false : storedCollapsed;
  const toggleCollapsed = useCollapseControls(!forceExpanded);

  if (hideSidebar) return null;

  const isSitePage = getCurrentSiteId(pathname) !== null;
  const isUptimePage = pathname.startsWith("/uptime");

  return (
    <SidebarCollapsedProvider collapsed={collapsed}>
      <div
        className={cn(
          "flex h-dvh shrink-0 flex-col overflow-hidden border-e border-neutral-150 bg-neutral-50 transition-[width] duration-200 dark:border-neutral-850 dark:bg-neutral-900",
          collapsed ? "w-14" : "w-60",
          className
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-neutral-150 dark:border-neutral-850",
            collapsed ? "justify-center px-2" : "gap-1 px-3"
          )}
        >
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  aria-label={t("Expand sidebar")}
                  className={cn(toggleButtonClass, "group size-9")}
                >
                  <span className="flex items-center group-hover:hidden group-focus-visible:hidden">
                    <SwalhaLogo width={24} height={24} />
                  </span>
                  <PanelLeftOpen className="hidden size-4 group-hover:block group-focus-visible:block" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {t("Expand sidebar")}
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              <Link
                href="/"
                aria-label="Swalha Analytics"
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
              >
                <SwalhaLogo width={24} height={24} />
                <span className="flex min-w-0 items-baseline gap-1.5 truncate">
                  <span className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">Swalha</span>
                  <span className="truncate text-[13px] font-normal tracking-wide text-neutral-500 dark:text-neutral-400">
                    Analytics
                  </span>
                </span>
              </Link>
              {!forceExpanded && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleCollapsed}
                      aria-label={t("Collapse sidebar")}
                      className={cn(toggleButtonClass, "ms-auto")}
                    >
                      <PanelLeftClose className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>
                    {t("Collapse sidebar")}
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>

        <div
          className={cn(
            "flex shrink-0 flex-col gap-2 border-b border-neutral-150 dark:border-neutral-850",
            collapsed ? "items-center p-2" : "p-3"
          )}
        >
          {!embed && <OrgSwitcher />}
          <SiteSwitcher />
        </div>

        <nav
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto",
            // The rail's leading divider would double up on the border above it.
            collapsed ? "gap-3 p-2 [&>.nav-divider:first-child]:hidden" : "gap-4 p-3"
          )}
        >
          {isSitePage ? (
            <>
              <SiteNav />
              <SettingsGroup />
            </>
          ) : (
            <>
              {isUptimePage && <UptimeGroup />}
              <SettingsGroup />
            </>
          )}
        </nav>

        {!embed && <UserMenu />}
      </div>
    </SidebarCollapsedProvider>
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
