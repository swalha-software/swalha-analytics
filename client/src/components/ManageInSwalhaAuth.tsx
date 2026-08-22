"use client";

import { ExternalLink } from "lucide-react";
import { useExtracted } from "next-intl";
import { AUTH_ORGANIZATIONS_URL } from "../lib/const";
import { Button } from "./ui/button";

// Organizations, members and invitations are owned by SWALHA Auth.
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
