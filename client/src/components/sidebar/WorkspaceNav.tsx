"use client";

import { CreditCard, KeyRound, LayoutDashboard } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePathname } from "next/navigation";
import { useUserOrganizations } from "@/api/admin/hooks/useOrganizations";
import { authClient } from "@/lib/auth";
import { IS_CLOUD } from "@/lib/const";
import { NavGroup, NavItem } from "./parts";

/**
 * The organization-level nav shown on pages that are not scoped to a site
 * (the overview itself, settings). On a site page `SiteNav` carries the same
 * Overview entry, so the two never appear at once.
 */
export function OrganizationGroup() {
  const t = useExtracted();
  const pathname = usePathname();

  return (
    <NavGroup label={t("Organization")}>
      <NavItem label={t("Overview")} href="/" icon={LayoutDashboard} active={pathname === "/"} />
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
