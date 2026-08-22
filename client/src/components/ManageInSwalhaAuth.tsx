"use client";

import { ExternalLink } from "lucide-react";
import { useExtracted } from "next-intl";
import { AUTH_ORGANIZATIONS_URL } from "../lib/const";
import { Button } from "./ui/button";

// Organizations, members, teams and invitations are owned by SWALHA Auth.
export function ManageInSwalhaAuthButton({ className }: { className?: string }) {
  const t = useExtracted();

  return (
    <Button variant="outline" size="sm" asChild className={className}>
      <a href={AUTH_ORGANIZATIONS_URL} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="h-4 w-4 me-1" />
        {t("Manage in SWALHA Auth")}
      </a>
    </Button>
  );
}

export function ManageInSwalhaAuthNotice({ description }: { description?: string }) {
  const t = useExtracted();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
      <p className="text-sm text-neutral-500 dark:text-neutral-400 text-start">
        {description ||
          t("Organizations, members and teams are managed in SWALHA Auth. Analytics shows a read-only copy.")}
      </p>
      <ManageInSwalhaAuthButton />
    </div>
  );
}
