import { SwalhaSSOButton } from "@/components/auth/SwalhaSSOButton";
import { useExtracted } from "next-intl";
import Link from "next/link";

interface AccountStepProps {
  setError: (v: string) => void;
}

// Account creation is SSO-only: identity lives at auth.swalha.com. The SSO
// callback returns to step 2 to continue onboarding. Whether a new local
// account may be created at all is controlled server-side by DISABLE_SIGNUP.
export function AccountStep({ setError }: AccountStepProps) {
  const t = useExtracted();

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">{t("Signup")}</h2>
      <div className="space-y-4">
        <SwalhaSSOButton onError={setError} callbackURL="/signup?step=2" divider={false} />
        <div className="text-center text-sm">
          {t("Already have an account?")}{" "}
          <Link
            href="/login"
            className="underline underline-offset-4 hover:text-accent-400 transition-colors duration-300"
          >
            {t("Log in")}
          </Link>
        </div>
      </div>
    </div>
  );
}
