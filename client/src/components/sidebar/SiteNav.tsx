"use client";

import {
  AlertTriangle,
  Bot,
  ChartColumnDecreasing,
  File,
  Funnel,
  Gauge,
  Globe2,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  MousePointerClick,
  Rewind,
  Settings,
  Split,
  Target,
  User,
  Video,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { useGetSite } from "@/api/admin/hooks/useSites";
import { useEmbedPageOptions } from "@/app/[site]/utils";
import { SiteSettings } from "@/components/SiteSettings/SiteSettings";
import { useAppEnv } from "@/hooks/useIsProduction";
import { getCurrentSiteId, getSiteRouteContext } from "@/lib/siteRoute";
import { useStripeSubscription } from "@/lib/subscription/useStripeSubscription";
import { NavActionRow, NavGroup, NavItem } from "./parts";

/** The analytics tabs for the site currently in the URL. */
export function SiteNav() {
  const t = useExtracted();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { embed } = useEmbedPageOptions();
  const { isLoading: isSubscriptionLoading } = useStripeSubscription();
  const appEnv = useAppEnv();

  const { data: site } = useGetSite(getCurrentSiteId(pathname) ?? undefined);
  const isMobileSite = site?.type === "mobile";

  // Build path: /siteId/[privateKey]/tabName, carrying the current query along.
  const tabHref = (tab: string) => {
    const { siteId, privateKey } = getSiteRouteContext(pathname);
    const basePath = privateKey ? `/${siteId}/${privateKey}/${tab}` : `/${siteId}/${tab}`;
    const queryString = searchParams.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const isActive = (tab: string) => (getSiteRouteContext(pathname).route ?? "main") === tab;

  const tab = (label: string, name: string, icon: React.ComponentProps<typeof NavItem>["icon"]) => (
    <NavItem label={label} href={tabHref(name)} icon={icon} active={isActive(name)} />
  );

  return (
    <>
      {/* The organization-wide view. It shares the dashboard glyph with "Main"
          on purpose: same page, one scope up. */}
      <NavGroup label={t("Organization")}>
        <NavItem label={t("Overview")} href="/" icon={Layers} active={pathname === "/"} />
      </NavGroup>

      <NavGroup label={isMobileSite ? t("App Analytics") : t("Web Analytics")}>
        {tab(t("Main"), "main", LayoutDashboard)}
        {tab(t("Dashboards"), "dashboards", LayoutGrid)}
        {tab(t("Globe"), "globe", Globe2)}
        {tab(t("Pages"), "pages", File)}
        {/* Web vitals are a web-only signal; the mobile SDK sends none. */}
        {!isMobileSite && tab(t("Performance"), "performance", Gauge)}
        {tab(t("Bots"), "bots", Bot)}
        {tab(t("Goals"), "goals", Target)}
      </NavGroup>

      {/*
        API Playground and Query are builder tools, not analytics views — you
        reach for them while wiring up an integration or answering a one-off
        question, not daily. They stay fully working at /{site}/api-playground
        and /{site}/query; only the nav entries are gone.
      */}
      <NavGroup label={t("Product Analytics")}>
        {!isMobileSite && !isSubscriptionLoading && appEnv !== "demo" && (
          <div className="hidden md:block">{tab(t("Replay"), "replay", Video)}</div>
        )}
        {tab(t("Funnels"), "funnels", Funnel)}
        {tab(t("Journeys"), "journeys", Split)}
        {tab(t("Retention"), "retention", ChartColumnDecreasing)}
      </NavGroup>

      <NavGroup label={t("Behavior")}>
        {tab(t("Sessions"), "sessions", Rewind)}
        {tab(t("Users"), "users", User)}
        {tab(t("Events"), "events", MousePointerClick)}
        {tab(t("Errors"), "errors", AlertTriangle)}
      </NavGroup>

      {!embed && (
        <NavGroup label={t("Settings")}>
          <SiteSettings
            siteId={site?.siteId ?? 0}
            trigger={
              <div>
                <NavActionRow label={t("Site Settings")} icon={Settings} />
              </div>
            }
          />
        </NavGroup>
      )}
    </>
  );
}
