"use client";

import { useExtracted } from "next-intl";
import { NoOrganization } from "../../../components/NoOrganization";
import { useSetPageTitle } from "../../../hooks/useSetPageTitle";
import { authClient } from "../../../lib/auth";
import { ApiKeyManager } from "./components/ApiKeyManager";
import { ApiUsage } from "./components/ApiUsage";

export default function ApiKeysPage() {
  useSetPageTitle("API keys");
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
      <NoOrganization
        message={t("You're not a member of any organization yet — manage organizations in SWALHA Auth.")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ApiKeyManager organizationId={activeOrganization.id} />
      <ApiUsage organizationId={activeOrganization.id} />
    </div>
  );
}
