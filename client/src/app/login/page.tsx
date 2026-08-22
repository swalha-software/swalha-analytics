"use client";

import { AuthError } from "@/components/auth/AuthError";
import { SwalhaSSOButton } from "@/components/auth/SwalhaSSOButton";
import { Loader2 } from "lucide-react";
import { useExtracted } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { SwalhaTextLogo } from "../../components/SwalhaLogo";
import { SpinningGlobe } from "../../components/SpinningGlobe";
import { useSetPageTitle } from "../../hooks/useSetPageTitle";
import { authClient } from "../../lib/auth";

// Only same-origin paths may be used as the post-login destination.
function safeNext(value: string | null): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

// Sign-in is SSO-only: identity lives at auth.swalha.com. The page starts the
// redirect by itself so the hop is invisible when an Auth session exists; it
// waits for a click only after an explicit sign-out or a failed attempt, so
// it can never loop.
function LoginContent() {
  useSetPageTitle("Login");
  const t = useExtracted();
  const params = useSearchParams();
  const [error, setError] = useState<string | undefined>(params.get("error") ?? undefined);
  const callbackURL = safeNext(params.get("next"));
  const autoStart = !params.get("error") && !params.get("signed_out");
  const started = useRef(false);

  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    authClient.signIn.oauth2({ providerId: "swalha", ...(callbackURL ? { callbackURL } : {}) }).catch(e => {
      setError(String(e));
    });
  }, [autoStart, callbackURL]);

  const redirecting = autoStart && !error;

  return (
    <div className="flex h-dvh w-full">
      <div className="flex w-full flex-col p-6 lg:w-[550px] lg:p-10">
        <div className="mb-8">
          <SwalhaTextLogo />
        </div>
        <div className="mx-auto flex w-full max-w-[550px] flex-1 flex-col justify-center">
          {redirecting ? (
            <div className="flex items-center gap-3 text-neutral-600 dark:text-neutral-300">
              <Loader2 className="size-5 animate-spin" />
              <span>{t("Taking you to your Swalha account…")}</span>
            </div>
          ) : (
            <>
              <h1 className="mb-6 text-lg text-neutral-600 dark:text-neutral-300">
                {params.get("signed_out") ? t("You've been signed out.") : t("Welcome back")}
              </h1>
              <div className="flex flex-col gap-4">
                <SwalhaSSOButton onError={setError} callbackURL={callbackURL} divider={false} />
                <AuthError error={error} title={t("Error Logging In")} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="relative m-3 hidden overflow-hidden rounded-2xl lg:block lg:w-[calc(100%-550px)]">
        <SpinningGlobe />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
