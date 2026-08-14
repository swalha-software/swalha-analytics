"use client";

import { AuthError } from "@/components/auth/AuthError";
import { SwalhaSSOButton } from "@/components/auth/SwalhaSSOButton";
import { useExtracted } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { SwalhaTextLogo } from "../../components/SwalhaLogo";
import { SpinningGlobe } from "../../components/SpinningGlobe";
import { useSetPageTitle } from "../../hooks/useSetPageTitle";
import { useConfigs } from "../../lib/configs";
import { IS_CLOUD } from "../../lib/const";

// Sign-in is SSO-only: identity lives at auth.swalha.com. Email/password and
// social sign-in were removed from this page; existing password accounts
// link to their SWALHA account by email on first SSO sign-in.
export default function Page() {
  const { configs, isLoading: isLoadingConfigs } = useConfigs();
  useSetPageTitle("Login");
  const t = useExtracted();
  const [error, setError] = useState<string>();

  return (
    <div className="flex h-dvh w-full">
      {/* Left panel - login */}
      <div className="w-full lg:w-[550px] flex flex-col p-6 lg:p-10">
        {/* Logo at top left */}
        <div className="mb-8">
          <a href="https://analytics.swalha.com" target="_blank" className="inline-block">
            <SwalhaTextLogo />
          </a>
        </div>
        <div className="flex-1 flex flex-col justify-center w-full max-w-[550px] mx-auto">
          <h1 className="text-lg text-neutral-600 dark:text-neutral-300 mb-6">{t("Welcome back")}</h1>
          <div className="flex flex-col gap-4">
            <SwalhaSSOButton onError={setError} divider={false} />

            <AuthError error={error} title={t("Error Logging In")} />

            {!isLoadingConfigs && !configs?.disableSignup && (
              <div className="text-center text-sm">
                {t("Don't have an account?")}{" "}
                <Link
                  href="/signup"
                  className="underline underline-offset-4 hover:text-accent-400 transition-colors duration-300"
                >
                  {t("Sign up")}
                </Link>
              </div>
            )}
          </div>
        </div>

        {!IS_CLOUD && (
          <div className="text-xs text-muted-foreground mt-8">
            <a
              href="https://analytics.swalha.com"
              target="_blank"
              rel="noopener"
              title="SWALHA Analytics - Open Source Privacy-Focused Web Analytics"
            >
              {t("Open source web analytics powered by SWALHA Analytics")}
            </a>
          </div>
        )}
      </div>

      {/* Right panel - globe (hidden on mobile/tablet) */}
      <div className="hidden lg:block lg:w-[calc(100%-550px)] relative m-3 rounded-2xl overflow-hidden">
        <SpinningGlobe />
      </div>
    </div>
  );
}
