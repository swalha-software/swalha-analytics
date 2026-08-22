"use client";
import { useExtracted } from "next-intl";
import { useOrganizationMembers } from "../../../api/admin/hooks/useOrganizationMembers";
import { NoOrganization } from "../../../components/NoOrganization";
import { useSetPageTitle } from "../../../hooks/useSetPageTitle";
import { authClient } from "../../../lib/auth";
import { ApiKeyManager } from "../account/components/ApiKeyManager";
import { MembersTable } from "./components/MembersTable";

// Types for our component
export type Organization = {
  id: string;
  name: string;
  createdAt: Date;
  slug: string;
};

export type Member = {
  id: string;
  role: string;
  userId: string;
  organizationId: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  siteAccess?: {
    hasRestrictedSiteAccess: boolean;
    siteIds: number[];
  };
};

// Organization Component with Members Table
function Organization({
  org,
}: {
  org: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
  };
}) {
  const { data: members, refetch, isLoading: membersLoading } = useOrganizationMembers(org.id);
  const { data } = authClient.useSession();

  const isOwner = !!members?.data.find(member => member.role === "owner" && member.userId === data?.user?.id);
  const isAdmin = !!members?.data.find(member => member.role === "admin" && member.userId === data?.user?.id) || isOwner;

  const handleRefresh = () => {
    refetch();
  };

  return (
    <>
      <MembersTable
        members={members}
        membersLoading={membersLoading}
        isAdmin={isAdmin}
        onRefresh={handleRefresh}
      />

      {isAdmin && <ApiKeyManager organizationId={org.id} />}
    </>
  );
}

// Main Organizations component
export default function MembersPage() {
  useSetPageTitle("Organization Members");
  const t = useExtracted();
  const { data: activeOrganization, isPending } = authClient.useActiveOrganization();

  if (isPending) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-pulse">{t("Loading organization...")}</div>
      </div>
    );
  }

  if (!activeOrganization) {
    return (
      <NoOrganization message={t("You're not a member of any organization yet — manage organizations in SWALHA Auth.")} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Organization key={activeOrganization.id} org={activeOrganization} />
    </div>
  );
}
