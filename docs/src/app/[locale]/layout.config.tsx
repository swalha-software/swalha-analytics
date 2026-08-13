import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { SwalhaTextLogo } from "@/components/SwalhaLogo";

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/[locale]/(home)/layout.tsx
 * Docs Layout: app/[locale]/docs/layout.tsx
 */
export function baseOptions(lang: string): BaseLayoutProps {
  return {
    nav: {
      transparentMode: "top",
      title: <SwalhaTextLogo height={24} className="mr-2" />,
    },
    // see https://fumadocs.dev/docs/ui/navigation/links
    links: [
      {
        text: "Demo",
        url: "https://demo.rybbit.com/81",
        external: true,
      },
    ],
  };
}
