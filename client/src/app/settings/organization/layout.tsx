"use client";

import { useExtracted } from "next-intl";
import { ManageInSwalhaAuthNotice } from "../../../components/ManageInSwalhaAuth";
import { OrganizationSelector } from "../../../components/OrganizationSelector";
import { authClient } from "../../../lib/auth";

export default function OrganizationLayout({ children }: { children: React.ReactNode }) {
  const t = useExtracted();
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const currentMember = activeOrg?.members?.find(
    (m) => m.userId === session?.user?.id
  );
  const isMember = currentMember?.role === "member";

  return (
    <>
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("Organization Settings")}</h1>
          <p className="text-neutral-500 dark:text-neutral-400">{t("Manage your organization settings and members")}</p>
        </div>

        <div className="flex items-center gap-2">
          <OrganizationSelector />
        </div>

        <ManageInSwalhaAuthNotice
          description={t("Organizations, members, roles and invitations are managed in SWALHA Auth. Analytics shows a read-only copy and controls site access only.")}
        />

        {isMember ? (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6 text-center text-neutral-500 dark:text-neutral-400">
            {t("You don't have permission to view organization settings.")}
          </div>
        ) : (
          <>
            <div className="mt-6">{children}</div>
          </>
        )}
      </div>
    </>
  );
}
