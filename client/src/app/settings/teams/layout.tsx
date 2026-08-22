"use client";

import { useExtracted } from "next-intl";
import { ManageInSwalhaAuthNotice } from "../../../components/ManageInSwalhaAuth";
import { authClient } from "../../../lib/auth";
import { ExternalLink } from "../../../components/ExternalLink";

export default function TeamsLayout({ children }: { children: React.ReactNode }) {
  const t = useExtracted();
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const currentMember = activeOrg?.members?.find(m => m.userId === session?.user?.id);
  const isMember = currentMember?.role === "member";

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("Teams")}</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            {t("Organize sites into teams to control which members can access them.")}
          </p>
        </div>
      </div>

      <ManageInSwalhaAuthNotice
        description={t(
          "Teams and their members are managed in SWALHA Auth. Here you decide which sites each team can access."
        )}
      />

      {isMember ? (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6 text-center text-neutral-500 dark:text-neutral-400">
          {t("You don't have permission to view team settings.")}
        </div>
      ) : (
        <div className="mt-6">{children}</div>
      )}
    </div>
  );
}
