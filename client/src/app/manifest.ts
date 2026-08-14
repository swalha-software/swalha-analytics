import type { MetadataRoute } from "next";

// Icons are generated from the canonical SWALHA logo by
// scripts/generate-brand-assets.py; see brand/swalha-logo.png.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Swalha Analytics",
    short_name: "Swalha",
    description:
      "Privacy-friendly, cookieless web and product analytics. Understand your traffic without tracking your visitors.",
    start_url: "/",
    display: "standalone",
    background_color: "#141414",
    theme_color: "#141414",
    icons: [
      { src: "/swalha/mark-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/swalha/mark-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/swalha/mark-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
