"use client";

import { Plus } from "lucide-react";
import { useExtracted } from "next-intl";
import { useUserOrganizations } from "../../api/admin/hooks/useOrganizations";
import { useGetSitesFromOrg } from "../../api/admin/hooks/useSites";
import { NoOrganization } from "../../components/NoOrganization";
import { MobileSidebarTrigger } from "../../components/sidebar/MobileSidebarSheet";
import { StandardPage } from "../../components/StandardPage";
import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardTitle } from "../../components/ui/card";
import { useSetPageTitle } from "../../hooks/useSetPageTitle";
import { authClient } from "../../lib/auth";
import { AddSite } from "../components/AddSite";
import { OrganizationOverview } from "./components/OrganizationOverview";

/**
 * "/" is the organization-wide overview: every site in the active organization
 * with its traffic for the selected period. Individual sites are reached from
 * here or from the sidebar's site switcher.
 */
export default function Home() {
  const t = useExtracted();
  useSetPageTitle("Overview");

  const { data: activeOrganization, isPending: isOrganizationPending } = authClient.useActiveOrganization();
  const { data: sitesData, isLoading: isLoadingSites } = useGetSitesFromOrg(activeOrganization?.id);
  const { data: userOrganizations, isLoading: isLoadingOrganizations } = useUserOrganizations();

  const organizationId = activeOrganization?.id;
  const sites = sitesData?.sites;
  const hasOrganizations = Array.isArray(userOrganizations) && userOrganizations.length > 0;
  const isUserMember = userOrganizations?.find(org => org.id === organizationId)?.role === "member";

  const content = () => {
    // No organization at all is a different situation from an empty one, and
    // only answerable once the memberships have actually loaded.
    if (!isLoadingOrganizations && !isOrganizationPending && !hasOrganizations) {
      return <NoOrganization />;
    }

    if (!isLoadingSites && sites?.length === 0) {
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
    }

    return (
      <OrganizationOverview
        organizationId={organizationId}
        organizationName={activeOrganization?.name}
        canAddSite={!isUserMember}
      />
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
