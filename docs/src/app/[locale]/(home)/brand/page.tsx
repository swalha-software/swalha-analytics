import { Check, Download, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { GridCrosses } from "@/components/GridCrosses";
import { InteriorPageHero } from "@/components/InteriorPageHero";
import { createMetadata, createOGImageUrl } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Brand Kit",
  description:
    "Download the official SWALHA Analytics logo and brand assets for use in your projects",
  openGraph: {
    images: [
      createOGImageUrl(
        "Brand Kit",
        "Download the official SWALHA Analytics logo and brand assets for use in your projects"
      ),
    ],
  },
  twitter: {
    images: [
      createOGImageUrl(
        "Brand Kit",
        "Download the official SWALHA Analytics logo and brand assets for use in your projects"
      ),
    ],
  },
});

type Variant = {
  name: string;
  file: string;
  size: string;
  bg: "light" | "dark";
};

function LogoCard({ variant, downloadLabel }: { variant: Variant; downloadLabel: string }) {
  const path = `/swalha/${variant.file}.png`;

  return (
    <div className="bg-white dark:bg-neutral-950">
      <div
        className={`flex h-44 items-center justify-center border-b border-neutral-200 p-8 dark:border-neutral-800 ${
          variant.bg === "dark" ? "bg-neutral-900" : "bg-neutral-100"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={path} alt={`SWALHA Analytics logo, ${variant.name}`} className="max-h-full max-w-full object-contain" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <div>
          <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{variant.name}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{variant.size}</p>
        </div>
        <a
          href={path}
          download
          className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 transition-colors duration-200 hover:border-neutral-300 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:text-white"
        >
          <Download className="size-3" aria-hidden="true" />
          {downloadLabel}
        </a>
      </div>
    </div>
  );
}

export default function BrandKit() {
  const t = useExtracted();

  const downloadLabel = t("PNG");

  // Every file below is the same canonical artwork; the derivatives differ only
  // in pixel size, and the maskable tile adds the brand backdrop and safe zone.
  const VARIANTS: Variant[] = [
    { name: t("Logo"), file: "logo", size: "1024 × 1024", bg: "light" },
    { name: t("Logo, dark background"), file: "logo", size: "1024 × 1024", bg: "dark" },
    { name: t("App icon"), file: "mark-512", size: "512 × 512", bg: "light" },
    { name: t("Maskable icon"), file: "mark-maskable-512", size: "512 × 512", bg: "dark" },
    { name: t("Favicon"), file: "mark-64", size: "64 × 64", bg: "light" },
    { name: t("Favicon, small"), file: "mark-32", size: "32 × 32", bg: "dark" },
  ];

  const doItems = [
    t("Use the logo in its original proportions"),
    t("Keep the gold mark on backgrounds it stays legible against"),
    t("Maintain clear space around the logo"),
    t("Use the largest size that fits, and scale down rather than up"),
  ];

  const dontItems = [
    t("Stretch or distort the logo"),
    t("Recolour, invert, or redraw the mark"),
    t("Add effects like shadows or gradients to the logo"),
    t("Use the logo in a way that implies endorsement"),
  ];

  return (
    <div className="overflow-x-clip">
      <InteriorPageHero
        title={t("Brand Kit")}
        description={t(
          "Download the official SWALHA Analytics logo. Every file is the same artwork, exported at the sizes you are most likely to need for projects, integrations, and content."
        )}
        eventLocation="brand_hero"
        primaryAction={null}
        secondaryAction={null}
        note={null}
      />

      <section className="border-b border-neutral-200 dark:border-neutral-800" aria-labelledby="brand-logo">
        <div className="relative mx-auto grid max-w-[1200px] border-x border-neutral-200 dark:border-neutral-800 lg:grid-cols-12">
          <GridCrosses />
          <div className="border-b border-neutral-200 px-5 py-10 dark:border-neutral-800 sm:px-8 lg:col-span-4 lg:border-b-0 lg:border-r lg:px-10 lg:py-14">
            <div className="lg:sticky lg:top-24">
              <h2
                id="brand-logo"
                className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 md:text-3xl"
              >
                {t("Logo")}
              </h2>
            </div>
          </div>
          <div className="grid gap-px bg-neutral-200 dark:bg-neutral-800 sm:grid-cols-2 lg:col-span-8">
            {VARIANTS.map(variant => (
              <LogoCard key={`${variant.file}-${variant.bg}`} variant={variant} downloadLabel={downloadLabel} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-200 dark:border-neutral-800" aria-labelledby="brand-guidelines">
        <div className="relative mx-auto grid max-w-[1200px] border-x border-neutral-200 dark:border-neutral-800 lg:grid-cols-12">
          <GridCrosses />
          <div className="border-b border-neutral-200 px-5 py-10 dark:border-neutral-800 sm:px-8 lg:col-span-4 lg:border-b-0 lg:border-r lg:px-10 lg:py-14">
            <div className="lg:sticky lg:top-24">
              <h2
                id="brand-guidelines"
                className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 md:text-3xl"
              >
                {t("Usage Guidelines")}
              </h2>
            </div>
          </div>
          <div className="grid gap-px bg-neutral-200 dark:bg-neutral-800 lg:col-span-8 md:grid-cols-2">
            <div className="bg-white px-5 py-9 dark:bg-neutral-950 sm:px-8 lg:px-10">
              <h3 className="flex items-center gap-2 font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
                <Check className="size-4" aria-hidden="true" />
                {t("Do")}
              </h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                {doItems.map(item => (
                  <li key={item} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white px-5 py-9 dark:bg-neutral-950 sm:px-8 lg:px-10">
              <h3 className="flex items-center gap-2 font-semibold tracking-tight text-neutral-700 dark:text-neutral-300">
                <X className="size-4" aria-hidden="true" />
                {t("Don't")}
              </h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                {dontItems.map(item => (
                  <li key={item} className="flex gap-2.5">
                    <X className="mt-0.5 size-4 shrink-0 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
