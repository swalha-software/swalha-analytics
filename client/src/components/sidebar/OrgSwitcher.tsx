"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronsUpDown, ExternalLink } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUserOrganizations } from "@/api/admin/hooks/useOrganizations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth";
import { AUTH_ORGANIZATIONS_URL } from "@/lib/const";
import { useOrgSwitch } from "@/lib/orgSwitch";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  CollapsedTooltip,
  InitialsAvatar,
  SwitcherLabel,
  SwitcherSkeleton,
  switcherRowClass,
  useSidebarCollapsed,
} from "./parts";

export function OrgSwitcher() {
  const t = useExtracted();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const collapsed = useSidebarCollapsed();
  const setSiteContext = useStore(state => state.setSiteContext);
  const setSwitching = useOrgSwitch(state => state.setSwitching);
  const { data: organizations, isLoading } = useUserOrganizations();
  const { data: activeOrganization, isPending } = authClient.useActiveOrganization();

  // Switching is async on the server; track the pick locally so the row updates now.
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  useEffect(() => {
    if (activeOrganization?.id) setSelectedOrgId(activeOrganization.id);
  }, [activeOrganization?.id]);

  // The router landing on a new route ends the switch: from here on the URL and
  // the active organization describe the same place again.
  useEffect(() => {
    setSwitching(false);
  }, [pathname, setSwitching]);

  const activeId = selectedOrgId ?? activeOrganization?.id ?? null;
  const activeOrg = organizations?.find(org => org.id === activeId);
  const activeName = activeOrg?.name ?? activeOrganization?.name ?? null;

  // Literal keys only: the message extractor cannot follow a computed argument.
  const roleLabel = (role?: string) => {
    if (role === "owner") return t("Owner");
    if (role === "admin") return t("Admin");
    if (role === "member") return t("Member");
    return t("Organization");
  };

  const switchOrganization = async (organizationId: string) => {
    if (organizationId === activeId) return;

    setSelectedOrgId(organizationId);
    // Drop the old organization's site before anything can read it again.
    setSwitching(true);
    setSiteContext("", null);

    // "/" picks a site for whichever organization is active, so the switch has
    // to be committed before we navigate there.
    await authClient.organization.setActive({ organizationId });
    await queryClient.invalidateQueries({ queryKey: ["get-sites-from-org"] });
    router.push("/");
  };

  if (!isLoading && organizations?.length === 0) {
    return (
      <div className={cn(switcherRowClass(collapsed), "pointer-events-none")}>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          <Building2 className="size-4" />
        </span>
        {!collapsed && <SwitcherLabel primary={t("No organizations")} secondary={t("Organization")} />}
      </div>
    );
  }

  if ((isLoading || isPending) && !activeName) return <SwitcherSkeleton />;

  const triggerLabel = activeName ?? t("Select an organization");

  return (
    <DropdownMenu>
      <CollapsedTooltip label={triggerLabel} collapsed={collapsed}>
        <DropdownMenuTrigger className={switcherRowClass(collapsed)} aria-label={t("Switch organization")}>
          <InitialsAvatar name={activeName} />
          {!collapsed && (
            <>
              <SwitcherLabel primary={triggerLabel} secondary={roleLabel(activeOrg?.role)} />
              <ChevronsUpDown className="size-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
            </>
          )}
        </DropdownMenuTrigger>
      </CollapsedTooltip>
      <DropdownMenuContent
        side={collapsed ? "right" : "bottom"}
        align="start"
        sideOffset={6}
        className={cn("min-w-56", !collapsed && "w-[var(--radix-dropdown-menu-trigger-width)]")}
      >
        {organizations?.map(org => (
          <DropdownMenuItem key={org.id} onSelect={() => switchOrganization(org.id)} className="gap-2 py-1.5">
            <InitialsAvatar name={org.name} className="size-6" />
            <span className="min-w-0 flex-1 truncate text-[13px]">{org.name}</span>
            {org.id === activeId && <Check className="size-4 shrink-0 text-accent-600 dark:text-accent-400" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => window.open(AUTH_ORGANIZATIONS_URL, "_blank", "noopener,noreferrer")}
          className="gap-2 text-[13px] text-neutral-600 dark:text-neutral-400"
        >
          <Building2 className="size-4 shrink-0" />
          <span className="flex-1 truncate">{t("Manage organizations")}</span>
          <ExternalLink className="size-3.5 shrink-0" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
