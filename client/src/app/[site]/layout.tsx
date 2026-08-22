"use client";
import { useWindowSize } from "@uidotdev/usehooks";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { authClient } from "../../lib/auth";
import { rememberLastSiteId } from "../../lib/lastSite";
import { getMainDashboardPath, getSiteRouteContext } from "../../lib/siteRoute";
import { useStore } from "../../lib/store";
import { useSyncStateWithUrl } from "../../lib/urlParams";
import { Footer } from "../components/Footer";
import { Header } from "./components/Header/Header";
import { AppShellSidebar } from "../../components/sidebar/AppShellSidebar";
import { useEmbedPageOptions } from "./utils";

function isMainDashboardPath(pathname: string) {
  return getSiteRouteContext(pathname).route === "main";
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setSiteContext, site, privateKey } = useStore();
  const { embed, hideSidebar } = useEmbedPageOptions();
  const { data: activeOrganization } = authClient.useActiveOrganization();

  // Sync store state with URL parameters
  useSyncStateWithUrl();

  useEffect(() => {
    const routeContext = getSiteRouteContext(pathname);
    if (!routeContext.siteId || isNaN(Number(routeContext.siteId))) return;
    if (routeContext.siteId === site && routeContext.privateKey === privateKey) return;

    setSiteContext(routeContext.siteId, routeContext.privateKey);
  }, [pathname, privateKey, setSiteContext, site]);

  // "/" forwards to whichever site was open last in this organization.
  useEffect(() => {
    const siteId = Number(getSiteRouteContext(pathname).siteId);
    if (!Number.isInteger(siteId)) return;

    rememberLastSiteId(activeOrganization?.id, siteId);
  }, [activeOrganization?.id, pathname]);

  useEffect(() => {
    if (!hideSidebar || isMainDashboardPath(pathname)) return;

    const mainPath = getMainDashboardPath(pathname);
    if (!mainPath) return;

    router.replace(`${mainPath}${window.location.search}`);
  }, [hideSidebar, pathname, router]);

  const { width } = useWindowSize();

  if (width && width < 768) {
    return (
      <div>
        <Header />
        <div>{children}</div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-row overflow-hidden">
      {!hideSidebar && <AppShellSidebar className="hidden md:flex" />}
      <div className="flex-1 overflow-auto">
        <div className="min-h-full flex flex-col">
          <Header />
          <div className="flex-1">{children}</div>
          {!pathname.includes("/map") &&
            !pathname.includes("/realtime") &&
            !pathname.includes("/replay") &&
            !pathname.includes("/globe") &&
            !pathname.includes("/api-playground") &&
            !pathname.includes("/query") && <Footer disabled={embed} />}
        </div>
      </div>
    </div>
  );
}
