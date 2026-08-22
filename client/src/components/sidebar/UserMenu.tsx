"use client";

import { useWindowSize } from "@uidotdev/usehooks";
import { ChevronsUpDown, ExternalLink, LogOut, Moon, ShieldUser, Sun, User } from "lucide-react";
import { useExtracted } from "next-intl";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useAdminPermission } from "@/app/admin/hooks/useAdminPermission";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignout } from "@/hooks/useSignout";
import { authClient } from "@/lib/auth";
import { AUTH_ACCOUNT_URL, DEPLOYMENT, IS_CLOUD } from "@/lib/const";
import { InitialsAvatar, SwitcherLabel, SwitcherSkeleton, switcherRowClass } from "./parts";

function ThemeRow() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useExtracted();
  const isDark = resolvedTheme === "dark";

  return (
    <DropdownMenuItem
      className="text-[13px]"
      // Keep the menu open so the switch is visible where it was made.
      onSelect={event => {
        event.preventDefault();
        setTheme(isDark ? "light" : "dark");
      }}
    >
      {isDark ? <Moon /> : <Sun />}
      {t("Theme")}
      <span className="ms-auto text-xs text-neutral-500 dark:text-neutral-400">{isDark ? t("Dark") : t("Light")}</span>
    </DropdownMenuItem>
  );
}

/** The footer owns its own border and padding so it can disappear cleanly. */
function UserMenuFrame({ children }: { children: React.ReactNode }) {
  return <div className="shrink-0 border-t border-neutral-150 p-3 dark:border-neutral-850">{children}</div>;
}

export function UserMenu() {
  const t = useExtracted();
  const router = useRouter();
  const signout = useSignout();
  const { width } = useWindowSize();
  const { data: session, isPending } = authClient.useSession();
  const { isAdmin } = useAdminPermission();

  const user = session?.user;
  if (isPending && !user)
    return (
      <UserMenuFrame>
        <SwitcherSkeleton />
      </UserMenuFrame>
    );
  // Signed-out surfaces (demo, public dashboards) get no footer at all.
  if (!user) return null;

  const showAdmin = (IS_CLOUD || !!DEPLOYMENT) && isAdmin;

  return (
    <UserMenuFrame>
      <DropdownMenu>
        <DropdownMenuTrigger className={switcherRowClass} aria-label={user.name || user.email || t("Account")}>
          <InitialsAvatar name={user.name} fallback={user.email} image={user.image} round />
          <SwitcherLabel primary={user.name || user.email} secondary={user.name ? user.email : null} />
          <ChevronsUpDown className="size-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={width !== null && width < 768 ? "bottom" : "right"}
          align="end"
          sideOffset={8}
          className="w-64"
        >
          <div className="flex items-center gap-2 px-2 py-2">
            <InitialsAvatar name={user.name} fallback={user.email} image={user.image} round />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">{user.name}</span>
              <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">{user.email}</span>
            </span>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-[13px]"
            onSelect={() => window.open(AUTH_ACCOUNT_URL, "_blank", "noopener,noreferrer")}
          >
            <User />
            {t("Manage account")}
            <ExternalLink className="ms-auto size-3.5 text-neutral-400 dark:text-neutral-500" />
          </DropdownMenuItem>
          {showAdmin && (
            <DropdownMenuItem className="text-[13px]" onSelect={() => router.push("/admin")}>
              <ShieldUser />
              {t("Admin console")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <ThemeRow />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-[13px] text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
            onSelect={() => signout()}
          >
            <LogOut />
            {t("Sign out")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </UserMenuFrame>
  );
}
