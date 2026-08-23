"use client";

import { AppWindow, Building2, Database, Mail, ShieldUser, Undo2, Users } from "lucide-react";
import { useExtracted } from "next-intl";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CollapsedTooltip, NavGroup, NavItem, SidebarNav, SidebarShell, useSidebarCollapsed } from "./parts";
import { UserMenu } from "./UserMenu";

/** Static "you are in the admin console" row, where the app sidebar has switchers. */
function AdminConsoleLabel() {
  const t = useExtracted();
  const collapsed = useSidebarCollapsed();
  const label = t("Admin console");

  return (
    <div
      className={cn(
        "flex shrink-0 items-center border-b border-neutral-150 dark:border-neutral-850",
        collapsed ? "justify-center p-2" : "px-3 py-3"
      )}
    >
      <CollapsedTooltip label={label} collapsed={collapsed}>
        <div
          aria-label={collapsed ? label : undefined}
          className={cn(
            "flex items-center text-neutral-500 dark:text-neutral-400",
            collapsed ? "size-10 justify-center" : "h-9 w-full gap-2 px-2"
          )}
        >
          <ShieldUser className="size-[18px] shrink-0" />
          {!collapsed && <span className="truncate text-[13px] font-medium">{label}</span>}
        </div>
      </CollapsedTooltip>
    </div>
  );
}

function AdminSections() {
  const t = useExtracted();
  const pathname = usePathname();

  return (
    <>
      <AdminConsoleLabel />

      <SidebarNav>
        <NavGroup label={t("Admin")}>
          <NavItem
            label={t("Organizations")}
            href="/admin/organizations"
            icon={Building2}
            active={pathname.startsWith("/admin/organizations")}
          />
          <NavItem
            label={t("Sites")}
            href="/admin/sites"
            icon={AppWindow}
            active={pathname.startsWith("/admin/sites")}
          />
          <NavItem label={t("Users")} href="/admin/users" icon={Users} active={pathname.startsWith("/admin/users")} />
          <NavItem
            label={t("Database")}
            href="/admin/database"
            icon={Database}
            active={pathname.startsWith("/admin/database")}
          />
          <NavItem label={t("Email")} href="/admin/email" icon={Mail} active={pathname.startsWith("/admin/email")} />
        </NavGroup>

        {/* Undo2 rather than an arrow: it reads as "go back" without pointing at
            a physical side, so RTL needs no flip. */}
        <div className="mt-auto flex flex-col gap-3">
          <NavGroup label={t("Analytics")}>
            <NavItem label={t("Back to Analytics")} href="/" icon={Undo2} />
          </NavGroup>
        </div>
      </SidebarNav>

      <UserMenu />
    </>
  );
}

/** The admin console's own sidebar: same shell, admin-only navigation. */
export function AdminSidebar({ className, forceExpanded }: { className?: string; forceExpanded?: boolean }) {
  return (
    <SidebarShell className={className} forceExpanded={forceExpanded}>
      <AdminSections />
    </SidebarShell>
  );
}
