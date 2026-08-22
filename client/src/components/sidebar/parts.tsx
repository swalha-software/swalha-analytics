"use client";

import { type LucideIcon, User } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
        <User className="size-4" />
      )}
    </span>
  );
}

/** Shared look for the org / site / user rows that open a menu. */
export const switcherRowClass = cn(
  "flex h-11 w-full items-center gap-2 rounded-md px-2 text-start transition-colors",
  "hover:bg-neutral-150 dark:hover:bg-neutral-800/70",
  "data-[state=open]:bg-neutral-150 dark:data-[state=open]:bg-neutral-800/70",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
);

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
  return (
    <div className={cn(switcherRowClass, "pointer-events-none animate-pulse")}>
      <div className="size-7 shrink-0 rounded-md bg-neutral-200 dark:bg-neutral-800" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-2.5 w-16 rounded bg-neutral-200 dark:bg-neutral-800" />
      </div>
    </div>
  );
}

export function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 px-2 text-xs font-medium tracking-wide text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

export function navRowClass(active: boolean) {
  return cn(
    "flex h-9 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60",
    active
      ? "bg-neutral-150 text-neutral-900 dark:bg-neutral-800 dark:text-white"
      : "text-neutral-700 hover:bg-neutral-150/70 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800/60 dark:hover:text-white"
  );
}

export function navIconClass(active: boolean) {
  return cn(
    "size-4 shrink-0",
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
  return (
    <Link href={href} target={target} className={navRowClass(active)}>
      <Icon className={navIconClass(active)} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/** Same row, but for things that open a dialog instead of navigating. */
export function NavActionRow({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <div className={navRowClass(false)}>
      <Icon className={navIconClass(false)} />
      <span className="truncate">{label}</span>
    </div>
  );
}
