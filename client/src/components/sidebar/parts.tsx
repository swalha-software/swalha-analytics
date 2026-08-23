"use client";

import { type LucideIcon, PanelLeft, User } from "lucide-react";
import { useExtracted } from "next-intl";
import Link from "next/link";
import { createContext, useContext, useEffect } from "react";
import { SwalhaLogo } from "@/components/SwalhaLogo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebarStore } from "@/lib/sidebarStore";
import { cn } from "@/lib/utils";

// The mobile sheet renders the same tree but always expanded, so the icon-rail
// mode travels by context instead of a prop on every nav row.
const CollapsedContext = createContext(false);

export function SidebarCollapsedProvider({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  return <CollapsedContext.Provider value={collapsed}>{children}</CollapsedContext.Provider>;
}

export function useSidebarCollapsed() {
  return useContext(CollapsedContext);
}

/** Wraps a row in a tooltip only while the sidebar is an icon rail. */
export function CollapsedTooltip({
  label,
  collapsed,
  children,
}: {
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  if (!collapsed) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      {/* Radix sides are physical; "right" is the inline end in this LTR app. */}
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function getInitials(name?: string | null, fallback?: string | null) {
  const trimmed = name?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/);
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }
  return fallback?.trim()[0]?.toUpperCase() ?? "";
}

/** Gold-tinted initials tile. Round for people, rounded-square for organizations. */
export function InitialsAvatar({
  name,
  fallback,
  image,
  round = false,
  className,
}: {
  name?: string | null;
  fallback?: string | null;
  image?: string | null;
  round?: boolean;
  className?: string;
}) {
  const initials = getInitials(name, fallback);

  return (
    <span
      className={cn(
        "flex size-7 shrink-0 select-none items-center justify-center overflow-hidden text-[11px] font-semibold uppercase",
        round ? "rounded-full" : "rounded-md",
        "bg-neutral-200 text-neutral-700 ring-1 ring-neutral-300/60 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700/60",
        className
      )}
    >
      {image ? (
        <img src={image} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      ) : initials ? (
        initials
      ) : (
        <User className="size-[18px]" />
      )}
    </span>
  );
}

/** Shared look for the org / site / user rows that open a menu. */
export function switcherRowClass(collapsed = false) {
  return cn(
    "flex items-center rounded-md text-start transition-colors",
    collapsed ? "size-10 justify-center p-0" : "h-11 w-full gap-2 px-2",
    "hover:bg-neutral-150 dark:hover:bg-neutral-800/70",
    "data-[state=open]:bg-neutral-150 dark:data-[state=open]:bg-neutral-800/70",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
  );
}

export function SwitcherLabel({ primary, secondary }: { primary: string; secondary?: string | null }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13px] font-medium leading-tight text-neutral-900 dark:text-white">
        {primary}
      </span>
      {secondary && (
        <span className="mt-0.5 block truncate text-[11px] leading-tight text-neutral-500 dark:text-neutral-400">
          {secondary}
        </span>
      )}
    </span>
  );
}

export function SwitcherSkeleton() {
  const collapsed = useSidebarCollapsed();

  if (collapsed) {
    return (
      <div className={cn(switcherRowClass(true), "pointer-events-none animate-pulse")}>
        <div className="size-7 shrink-0 rounded-md bg-neutral-200 dark:bg-neutral-800" />
      </div>
    );
  }

  return (
    <div className={cn(switcherRowClass(), "pointer-events-none animate-pulse")}>
      <div className="size-7 shrink-0 rounded-md bg-neutral-200 dark:bg-neutral-800" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-2.5 w-16 rounded bg-neutral-200 dark:bg-neutral-800" />
      </div>
    </div>
  );
}

export function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const collapsed = useSidebarCollapsed();

  // Group labels have nowhere to go on the rail; a short rule keeps the
  // grouping readable. The nav container hides the very first one.
  if (collapsed) {
    return (
      <>
        <div className="nav-divider mx-auto h-px w-6 shrink-0 bg-neutral-200 dark:bg-neutral-800" />
        <div className="flex flex-col items-center gap-0.5">{children}</div>
      </>
    );
  }

  return (
    <div>
      <div className="mb-1 px-2 text-xs font-medium tracking-wide text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

export function navRowClass(active: boolean, collapsed = false) {
  return cn(
    "flex h-9 cursor-pointer items-center rounded-md text-[13px] transition-colors",
    collapsed ? "w-9 justify-center px-0" : "w-full gap-2 px-2",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60",
    active
      ? "bg-neutral-150 text-neutral-900 dark:bg-neutral-800 dark:text-white"
      : "text-neutral-700 hover:bg-neutral-150/70 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800/60 dark:hover:text-white"
  );
}

export function navIconClass(active: boolean) {
  return cn(
    "size-[18px] shrink-0",
    active ? "text-accent-600 dark:text-accent-400" : "text-neutral-500 dark:text-neutral-400"
  );
}

export function NavItem({
  label,
  href,
  icon: Icon,
  active = false,
  target,
}: {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
  target?: string;
}) {
  const collapsed = useSidebarCollapsed();

  return (
    <CollapsedTooltip label={label} collapsed={collapsed}>
      <Link
        href={href}
        target={target}
        aria-label={collapsed ? label : undefined}
        className={navRowClass(active, collapsed)}
      >
        <Icon className={navIconClass(active)} />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    </CollapsedTooltip>
  );
}

/** Same row, but for things that open a dialog instead of navigating. */
export function NavActionRow({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  const collapsed = useSidebarCollapsed();

  return (
    <CollapsedTooltip label={label} collapsed={collapsed}>
      <div aria-label={collapsed ? label : undefined} className={navRowClass(false, collapsed)}>
        <Icon className={navIconClass(false)} />
        {!collapsed && <span className="truncate">{label}</span>}
      </div>
    </CollapsedTooltip>
  );
}

const toggleButtonClass = cn(
  "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors",
  "text-neutral-500 hover:bg-neutral-150 hover:text-neutral-900",
  "dark:text-neutral-400 dark:hover:bg-neutral-800/70 dark:hover:text-white",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
);

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Reads the stored preference once, and wires the "[" shortcut. */
function useCollapseControls(enabled: boolean) {
  const hydrateCollapsed = useSidebarStore(state => state.hydrateCollapsed);
  const toggleCollapsed = useSidebarStore(state => state.toggleCollapsed);

  useEffect(() => {
    if (!enabled) return;
    hydrateCollapsed();
  }, [enabled, hydrateCollapsed]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "[" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      toggleCollapsed();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, toggleCollapsed]);

  return toggleCollapsed;
}

/**
 * The frame and brand header both sidebars share: fixed widths, the collapse
 * toggle, and the collapsed flag on context for every row below.
 */
export function SidebarShell({
  className,
  forceExpanded,
  children,
}: {
  className?: string;
  forceExpanded?: boolean;
  children: React.ReactNode;
}) {
  const t = useExtracted();
  const storedCollapsed = useSidebarStore(state => state.collapsed);
  // The mobile sheet is a full-width drawer: the rail would make no sense there.
  const collapsed = forceExpanded ? false : storedCollapsed;
  const toggleCollapsed = useCollapseControls(!forceExpanded);

  return (
    <SidebarCollapsedProvider collapsed={collapsed}>
      <div
        className={cn(
          "flex h-dvh shrink-0 flex-col overflow-hidden border-e border-neutral-150 bg-neutral-50 transition-[width] duration-200 dark:border-neutral-850 dark:bg-neutral-900",
          collapsed ? "w-14" : "w-60",
          className
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-neutral-150 dark:border-neutral-850",
            collapsed ? "justify-center px-2" : "gap-1 px-3"
          )}
        >
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  aria-label={t("Expand sidebar")}
                  className={cn(toggleButtonClass, "group size-10 p-1")}
                >
                  <span className="flex items-center group-hover:hidden group-focus-visible:hidden">
                    <SwalhaLogo width={24} height={24} />
                  </span>
                  <PanelLeft className="hidden size-4 group-hover:block group-focus-visible:block" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {t("Expand sidebar")}
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              <Link
                href="/"
                aria-label="Swalha Analytics"
                className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
              >
                <SwalhaLogo width={24} height={24} />
                <span className="flex min-w-0 items-baseline gap-1.5 truncate">
                  <span className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">Swalha</span>
                  <span className="truncate text-[13px] font-normal tracking-wide text-neutral-500 dark:text-neutral-400">
                    Analytics
                  </span>
                </span>
              </Link>
              {!forceExpanded && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleCollapsed}
                      aria-label={t("Collapse sidebar")}
                      className={cn(toggleButtonClass, "ms-auto")}
                    >
                      <PanelLeft className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>
                    {t("Collapse sidebar")}
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>

        {children}
      </div>
    </SidebarCollapsedProvider>
  );
}

/** The scrolling nav column both sidebars share. */
export function SidebarNav({ children }: { children: React.ReactNode }) {
  const collapsed = useSidebarCollapsed();

  return (
    <nav
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto",
        // The rail's leading divider would double up on the border above it.
        collapsed ? "gap-3 p-2 [&>.nav-divider:first-child]:hidden" : "gap-4 p-3"
      )}
    >
      {children}
    </nav>
  );
}
