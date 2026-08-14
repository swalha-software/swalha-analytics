"use client";

import Image from "next/image";
import { useExtracted } from "next-intl";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth";

interface SwalhaSSOButtonProps {
  onError: (error: string) => void;
  callbackURL?: string;
  className?: string;
  /** Render the "Or" separator under the button (for pages that keep other methods). */
  divider?: boolean;
}

/**
 * Single sign-on with the central SWALHA account (auth.swalha.com). Available
 * on every deployment — unlike SocialButtons, which are cloud-only — because
 * the OAuth credentials live server-side and the flow is a plain redirect.
 * Existing analytics accounts with the same verified email are linked on the
 * first SSO sign-in.
 */
export function SwalhaSSOButton({ onError, callbackURL, className = "", divider = true }: SwalhaSSOButtonProps) {
  const t = useExtracted();

  const handleSSO = async () => {
    try {
      await authClient.signIn.oauth2({
        providerId: "swalha",
        ...(callbackURL ? { callbackURL } : {}),
      });
    } catch (error) {
      onError(String(error));
    }
  };

  return (
    <>
      <div className={`flex flex-col ${className}`}>
        <Button type="button" onClick={handleSSO} className="h-11">
          <Image src="/swalha/mark-32.png" alt="" width={16} height={16} />
          {t("Continue with SWALHA account")}
        </Button>
      </div>
      {divider && (
        <div className="relative flex items-center text-xs uppercase">
          <div className="flex-1 border-t border-neutral-200 dark:border-neutral-800" />
          <span className="px-3 text-muted-foreground">{t("Or")}</span>
          <div className="flex-1 border-t border-neutral-200 dark:border-neutral-800" />
        </div>
      )}
    </>
  );
}
