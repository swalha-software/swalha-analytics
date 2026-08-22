"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useEmbedPageOptions } from "@/app/[site]/utils";
import { SwalhaLogo } from "@/components/SwalhaLogo";
import { getCurrentSiteId } from "@/lib/siteRoute";
import { cn } from "@/lib/utils";
import { OrgSwitcher } from "./OrgSwitcher";
import { SiteNav } from "./SiteNav";
import { SiteSwitcher } from "./SiteSwitcher";
import { UserMenu } from "./UserMenu";
import { SettingsGroup, UptimeGroup } from "./WorkspaceNav";

function AppShellSidebarContent({ className }: { className?: string }) {
  const pathname = usePathname();
  const { embed, hideSidebar } = useEmbedPageOptions();

  if (hideSidebar) return null;

  const isSitePage = getCurrentSiteId(pathname) !== null;
  const isUptimePage = pathname.startsWith("/uptime");

  return (
    <div
      className={cn(
        "flex h-dvh w-60 shrink-0 flex-col border-e border-neutral-150 bg-neutral-50 dark:border-neutral-850 dark:bg-neutral-900",
        className
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-neutral-150 px-3 dark:border-neutral-850">
        <Link
          href="/"
          aria-label="Swalha Analytics"
          className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
        >
          <SwalhaLogo width={24} height={24} />
          <span className="flex min-w-0 items-baseline gap-1.5 truncate">
            <span className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">Swalha</span>
            <span className="truncate text-[13px] font-normal tracking-wide text-neutral-500 dark:text-neutral-400">
              Analytics
            </span>
          </span>
        </Link>
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-b border-neutral-150 p-3 dark:border-neutral-850">
        {!embed && <OrgSwitcher />}
        <SiteSwitcher />
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
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
  );
}

/** The single shell sidebar: brand, org + site context, nav, and the user menu. */
export function AppShellSidebar({ className }: { className?: string }) {
  return (
    <Suspense fallback={null}>
      <AppShellSidebarContent className={className} />
    </Suspense>
  );
}
