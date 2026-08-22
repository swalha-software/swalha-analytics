"use client";

import {
  Activity,
  AlertCircle,
  AppWindow,
  Building2,
  Combine,
  CreditCard,
  Globe,
  Plug2,
  UserCircle,
  Users,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { usePathname } from "next/navigation";
import { useUserOrganizations } from "@/api/admin/hooks/useOrganizations";
import { authClient } from "@/lib/auth";
import { IS_CLOUD } from "@/lib/const";
import { NavGroup, NavItem } from "./parts";

/** Getting back up a level: the org's site list and the cross-site rollup. */
export function WorkspaceGroup() {
  const t = useExtracted();
  const pathname = usePathname();

  return (
    <NavGroup label={t("Workspace")}>
      <NavItem label={t("Properties")} href="/" icon={AppWindow} active={pathname === "/"} />
      <NavItem label={t("Rollup")} href="/rollup" icon={Combine} active={pathname.startsWith("/rollup")} />
    </NavGroup>
  );
}

export function SettingsGroup() {
  const t = useExtracted();
  const pathname = usePathname();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const { data: userOrganizations } = useUserOrganizations();

  const currentMember = userOrganizations?.find(org => org.id === activeOrganization?.id);
  const isAdminOrOwner = currentMember?.role === "admin" || currentMember?.role === "owner";

  return (
    <NavGroup label={t("Settings")}>
      <NavItem
        label={t("Account")}
        href="/settings/account"
        icon={UserCircle}
        active={pathname.startsWith("/settings/account")}
      />
      {isAdminOrOwner && (
        <>
          <NavItem
            label={t("Organization")}
            href="/settings/organization"
            icon={Building2}
            active={pathname === "/settings/organization"}
          />
          <NavItem
            label={t("Teams")}
            href="/settings/teams"
            icon={Users}
            active={pathname.startsWith("/settings/teams")}
          />
          {IS_CLOUD && (
            <NavItem
              label={t("Billing")}
              href="/settings/billing"
              icon={CreditCard}
              active={pathname.startsWith("/settings/billing")}
            />
          )}
        </>
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
