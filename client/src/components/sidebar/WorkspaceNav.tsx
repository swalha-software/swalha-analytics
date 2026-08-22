"use client";

import { Activity, AlertCircle, CreditCard, Globe, KeyRound, Plug2 } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePathname } from "next/navigation";
import { useUserOrganizations } from "@/api/admin/hooks/useOrganizations";
import { authClient } from "@/lib/auth";
import { IS_CLOUD } from "@/lib/const";
import { NavGroup, NavItem } from "./parts";

export function SettingsGroup() {
  const t = useExtracted();
  const pathname = usePathname();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const { data: userOrganizations } = useUserOrganizations();

  const currentMember = userOrganizations?.find(org => org.id === activeOrganization?.id);
  const isAdminOrOwner = currentMember?.role === "admin" || currentMember?.role === "owner";

  // Every entry is admin-only, so a plain member gets no group at all rather
  // than an empty "Settings" heading.
  if (!isAdminOrOwner) return null;

  return (
    <NavGroup label={t("Settings")}>
      <NavItem
        label={t("API keys")}
        href="/settings/api-keys"
        icon={KeyRound}
        active={pathname.startsWith("/settings/api-keys")}
      />
      {IS_CLOUD && (
        <NavItem
          label={t("Billing")}
          href="/settings/billing"
          icon={CreditCard}
          active={pathname.startsWith("/settings/billing")}
        />
      )}
    </NavGroup>
  );
}

export function UptimeGroup() {
  const t = useExtracted();
  const pathname = usePathname();

  return (
    <NavGroup label={t("Uptime")}>
      <NavItem
        label={t("Monitors")}
        href="/uptime/monitors"
        icon={Activity}
        active={pathname.startsWith("/uptime/monitors")}
      />
      <NavItem
        label={t("Incidents")}
        href="/uptime/incidents"
        icon={AlertCircle}
        active={pathname.startsWith("/uptime/incidents")}
      />
      <NavItem
        label={t("Notifications")}
        href="/uptime/notifications"
        icon={Plug2}
        active={pathname.startsWith("/uptime/notifications")}
      />
      <NavItem
        label={t("Status Page")}
        href="/uptime/status-page"
        icon={Globe}
        active={pathname.startsWith("/uptime/status-page")}
      />
    </NavGroup>
  );
}
