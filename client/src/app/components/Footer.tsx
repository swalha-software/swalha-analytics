import { useExtracted } from "next-intl";
import { useWhiteLabel } from "../../hooks/useIsWhiteLabel";
import { SwalhaLogo } from "../../components/SwalhaLogo";

interface FooterProps {
  disabled?: boolean;
}

// Minimal footer: the wordmark as in the sidebar header, plus the upstream
// attribution this AGPL fork keeps.
export function Footer({ disabled = false }: FooterProps) {
  const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;
  const { isWhiteLabel } = useWhiteLabel();
  const t = useExtracted();
  if (disabled || isWhiteLabel) {
    return null;
  }

  return (
    <footer className="border-t border-neutral-150 bg-neutral-50 dark:border-neutral-850 dark:bg-neutral-900">
      <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-2 px-4 py-8 text-center">
        <div className="flex items-center gap-2">
          <SwalhaLogo width={22} height={22} />
          <span className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">Swalha</span>
            <span className="text-[13px] tracking-wide text-neutral-500 dark:text-neutral-400">Analytics</span>
          </span>
        </div>
        <p className="text-xs text-neutral-500">
          {t("Built on the open-source Rybbit project")}
          {APP_VERSION ? ` · v${APP_VERSION}` : ""}
        </p>
      </div>
    </footer>
  );
}
