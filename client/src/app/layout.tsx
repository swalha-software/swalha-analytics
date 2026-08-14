import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getLocale, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { cn } from "../lib/utils";
import "./globals.css";
import { Providers } from "./Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const DESCRIPTION =
  "Privacy-friendly, cookieless web and product analytics. Understand your traffic without tracking your visitors.";

// Icons and the social card come from the App Router file conventions in this
// directory (icon.png, apple-icon.png, opengraph-image.png), all generated from
// the canonical SWALHA logo by scripts/generate-brand-assets.py.
export const metadata: Metadata = {
  metadataBase: new URL("https://analytics.swalha.com"),
  title: { default: "Swalha Analytics", template: "%s | Swalha Analytics" },
  description: DESCRIPTION,
  applicationName: "Swalha Analytics",
  openGraph: {
    type: "website",
    siteName: "Swalha Analytics",
    title: "Swalha Analytics",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Swalha Analytics",
    description: DESCRIPTION,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={cn("bg-background text-foreground h-full", inter.variable, inter.className)} suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
