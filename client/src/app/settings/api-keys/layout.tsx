"use client";

import { useExtracted } from "next-intl";
import { useUserOrganizations } from "../../../api/admin/hooks/useOrganizations";
import { ExternalLink } from "../../../components/ExternalLink";
import { authClient } from "../../../lib/auth";

export default function ApiKeysLayout({ children }: { children: React.ReactNode }) {
  const t = useExtracted();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const { data: userOrganizations } = useUserOrganizations();

  // Same gate as the sidebar's Settings group: owners and admins only.
  const currentMember = userOrganizations?.find(org => org.id === activeOrganization?.id);
  const isAdminOrOwner = currentMember?.role === "admin" || currentMember?.role === "owner";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("API keys")}</h1>
        <p className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
          {t("Organization-owned keys for scripts and integrations.")}
          <ExternalLink href="https://www.rybbit.com/docs/api">{t("Learn more")}</ExternalLink>
        </p>
      </div>

      {isAdminOrOwner ? (
        <div className="mt-6">{children}</div>
      ) : (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6 text-center text-neutral-500 dark:text-neutral-400">
          {t("You don't have permission to view API keys.")}
        </div>
      )}
    </div>
  );
}
