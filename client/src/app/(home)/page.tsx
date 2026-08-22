"use client";

import { Plus } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUserOrganizations } from "../../api/admin/hooks/useOrganizations";
import { useGetSitesFromOrg } from "../../api/admin/hooks/useSites";
import { NoOrganization } from "../../components/NoOrganization";
import { MobileSidebarTrigger } from "../../components/sidebar/MobileSidebarSheet";
import { StandardPage } from "../../components/StandardPage";
import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardTitle } from "../../components/ui/card";
import { useSetPageTitle } from "../../hooks/useSetPageTitle";
import { authClient } from "../../lib/auth";
import { getLastSiteId } from "../../lib/lastSite";
import { getMainDashboardPath } from "../../lib/siteRoute";
import { AddSite } from "../components/AddSite";

/**
 * There is no site list any more: "/" is a doorway that forwards to a site
 * dashboard — the one last visited in this organization, or its first site.
 * Sites are switched from the sidebar.
 */
export default function Home() {
  const t = useExtracted();
  useSetPageTitle("Home");

  const router = useRouter();
  const { data: activeOrganization, isPending: isOrganizationPending } = authClient.useActiveOrganization();
  const { data: sitesData, isLoading: isLoadingSites } = useGetSitesFromOrg(activeOrganization?.id);
  const { data: userOrganizations, isLoading: isLoadingOrganizations } = useUserOrganizations();

  const sites = sitesData?.sites;
  const organizationId = activeOrganization?.id;

  useEffect(() => {
    if (!organizationId || !sites?.length) return;

    const remembered = getLastSiteId(organizationId);
    const target = sites.find(site => site.siteId === remembered) ?? sites[0];
    router.replace(getMainDashboardPath(`/${target.siteId}`) ?? `/${target.siteId}`);
  }, [organizationId, router, sites]);

  const isLoading = isLoadingOrganizations || isOrganizationPending || isLoadingSites;
  const hasOrganizations = Array.isArray(userOrganizations) && userOrganizations.length > 0;
  const isUserMember = userOrganizations?.find(org => org.id === organizationId)?.role === "member";
  // A redirect is already queued, so the page must stay blank rather than
  // flashing an empty state on its way out.
  const isRedirecting = !!sites?.length;

  const content = () => {
    if (isLoading || isRedirecting) return null;
    if (!hasOrganizations) return <NoOrganization />;

    return (
      <Card className="mt-10 flex flex-col items-center p-8 text-center">
        <CardTitle className="mb-2 text-xl">{t("No sites yet")}</CardTitle>
        <CardDescription className="mb-4">{t("Add your first website to start tracking analytics")}</CardDescription>
        <AddSite
          trigger={
            <Button variant="success" disabled={isUserMember}>
              <Plus className="h-4 w-4" />
              {t("Add Website")}
            </Button>
          }
        />
      </Card>
    );
  };

  return (
    <StandardPage>
      <div className="my-4 md:hidden">
        <MobileSidebarTrigger />
      </div>
      {content()}
    </StandardPage>
  );
}
