import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CLIENT = path.join(REPO_ROOT, "client");
const DOCS = path.join(REPO_ROOT, "docs");

/** The canonical artwork, checked in exactly as downloaded from swalha.com. */
const CANONICAL = path.join(REPO_ROOT, "brand", "swalha-logo.png");

// ── Minimal PNG reader ──────────────────────────────────────────────────────
// Enough to assert what actually matters about a shipped icon: its pixel size
// and whether it carries transparency. Only the 8-bit non-interlaced forms the
// generator emits are supported; anything else fails loudly rather than
// silently passing.

interface PngInfo {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  /** True when at least one pixel is not fully opaque. */
  hasTransparency: boolean;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS_BY_COLOR_TYPE: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function readPng(file: string): PngInfo {
  const buf = readFileSync(file);
  expect(buf.subarray(0, 8).equals(PNG_SIGNATURE), `${file} is not a PNG`).toBe(true);

  let offset = 8;
  let header: { width: number; height: number; bitDepth: number; colorType: number; interlace: number } | undefined;
  const idat: Buffer[] = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  if (!header) throw new Error(`${file} has no IHDR chunk`);
  expect(header.bitDepth, `${file}: only 8-bit PNGs are supported here`).toBe(8);
  expect(header.interlace, `${file}: only non-interlaced PNGs are supported here`).toBe(0);

  const channels = CHANNELS_BY_COLOR_TYPE[header.colorType];
  if (!channels) throw new Error(`${file}: unsupported colour type ${header.colorType}`);

  // Colour types without an alpha channel cannot be transparent here (the
  // generator never emits a tRNS chunk).
  if (header.colorType !== 4 && header.colorType !== 6) {
    return { ...header, hasTransparency: false };
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = header.width * channels;
  const prior = Buffer.alloc(stride);
  const line = Buffer.alloc(stride);
  let hasTransparency = false;
  let pos = 0;

  for (let y = 0; y < header.height; y++) {
    const filter = raw[pos++];
    raw.copy(line, 0, pos, pos + stride);
    pos += stride;

    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? line[i - channels] : 0;
      const up = prior[i];
      const upLeft = i >= channels ? prior[i - channels] : 0;
      switch (filter) {
        case 0:
          break;
        case 1:
          line[i] = (line[i] + left) & 0xff;
          break;
        case 2:
          line[i] = (line[i] + up) & 0xff;
          break;
        case 3:
          line[i] = (line[i] + ((left + up) >> 1)) & 0xff;
          break;
        case 4:
          line[i] = (line[i] + paeth(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error(`${file}: unknown row filter ${filter}`);
      }
    }

    for (let i = channels - 1; i < stride; i += channels) {
      if (line[i] !== 255) {
        hasTransparency = true;
        break;
      }
    }

    line.copy(prior);
  }

  return { ...header, hasTransparency };
}

function sha256(file: string) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function walk(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  const skip = new Set(["node_modules", ".next", ".source", "dist", ".git"]);
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (extensions.includes(path.extname(entry.name))) out.push(full);
    }
  };
  visit(dir);
  return out;
}

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".css", ".json", ".md"];
const SOURCE_TREES = [path.join(CLIENT, "src"), path.join(DOCS, "src")];

/** Where this deployment lives; the only host product branding may link to. */
const APP_ORIGIN = "https://analytics.swalha.com";

/**
 * Copy that names Rybbit on purpose, to credit the upstream project rather
 * than let the SWALHA mark imply we publish its docs and policy pages.
 */
const UPSTREAM_ATTRIBUTION = /built on the open-source Rybbit project/i;

// ── Retired Rybbit logo artwork ─────────────────────────────────────────────

describe("no product-owned Rybbit logo artwork remains", () => {
  it("the Rybbit logo asset directories are gone", () => {
    expect(existsSync(path.join(CLIENT, "public", "rybbit"))).toBe(false);
    expect(existsSync(path.join(DOCS, "public", "rybbit"))).toBe(false);
  });

  it("no source file references a Rybbit logo asset path", () => {
    const offenders: string[] = [];
    for (const tree of SOURCE_TREES) {
      for (const file of walk(tree, SOURCE_EXTENSIONS)) {
        const text = readFileSync(file, "utf8");
        // Public-asset references only. The `@rybbit/shared` package specifier
        // and rybbit.com links are deliberately untouched.
        if (/["'`(]\/?rybbit\/[\w .-]+\.(svg|png)/.test(text)) {
          offenders.push(path.relative(REPO_ROOT, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no source file references the retired frog or wordmark artwork", () => {
    const offenders: string[] = [];
    for (const tree of SOURCE_TREES) {
      for (const file of walk(tree, SOURCE_EXTENSIONS)) {
        const text = readFileSync(file, "utf8");
        if (/\b(frog|horizontal|vertical|type)_(white|black|light green|dark green|for dark BG)\b/.test(text)) {
          offenders.push(path.relative(REPO_ROOT, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no icon route still serves the Rybbit mark", () => {
    for (const app of [path.join(CLIENT, "src", "app"), path.join(DOCS, "src", "app")]) {
      expect(existsSync(path.join(app, "icon.svg")), `${app}/icon.svg should be gone`).toBe(false);
    }
  });
});

// ── Visible product name ────────────────────────────────────────────────────

describe("visible brand labels use the SWALHA product name", () => {
  it("no English UI string in the client still says Rybbit", () => {
    const messages = JSON.parse(readFileSync(path.join(CLIENT, "messages", "en.json"), "utf8")) as Record<
      string,
      string
    >;
    const offenders = Object.entries(messages)
      .filter(([, value]) => /\bRybbit\b/.test(value) && !UPSTREAM_ATTRIBUTION.test(value))
      .map(([key, value]) => `${key}: ${value}`);
    expect(offenders).toEqual([]);
  });

  it("credits the upstream project instead of letting the mark imply ownership", () => {
    const messages = JSON.parse(readFileSync(path.join(CLIENT, "messages", "en.json"), "utf8")) as Record<
      string,
      string
    >;
    const attribution = Object.values(messages).filter(value => UPSTREAM_ATTRIBUTION.test(value));
    expect(attribution.length, "the footer must credit Rybbit for the docs and policy pages").toBe(1);
    expect(readFileSync(path.join(CLIENT, "src", "app", "components", "Footer.tsx"), "utf8")).toMatch(
      UPSTREAM_ATTRIBUTION
    );
  });

  it("no locale still shows the old brand name", () => {
    const dir = path.join(CLIENT, "messages");
    const en = JSON.parse(readFileSync(path.join(dir, "en.json"), "utf8")) as Record<string, string>;
    const rebranded = Object.keys(en).filter(key => /Swalha Analytics/.test(en[key]));
    expect(rebranded.length).toBeGreaterThan(0);

    for (const file of readdirSync(dir).filter(name => name.endsWith(".json"))) {
      const messages = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as Record<string, string>;
      // An empty value means "not translated yet" — the repo's own convention
      // for a freshly extracted key, and not something this rebrand introduced.
      const stale = Object.entries(messages)
        .filter(([, value]) => /\bRybbit\b/.test(value) && !UPSTREAM_ATTRIBUTION.test(value))
        .map(([key]) => key);
      expect(stale, `${file} still says Rybbit`).toEqual([]);

      const absent = rebranded.filter(key => !(key in messages));
      expect(absent, `${file} is missing rebranded keys entirely`).toEqual([]);
    }
  });

  it("existing translations were carried across the rebrand, not blanked", () => {
    // German was fully translated before the rebrand, so every string that only
    // swapped the product name must still have a German translation — proving
    // the brand token was substituted into the existing sentence rather than
    // the key being reset. Genuinely new copy is exempt: it has no prior
    // translation to carry, and the repo seeds those as empty.
    const dir = path.join(CLIENT, "messages");
    const en = JSON.parse(readFileSync(path.join(dir, "en.json"), "utf8")) as Record<string, string>;
    const de = JSON.parse(readFileSync(path.join(dir, "de.json"), "utf8")) as Record<string, string>;
    const rebranded = Object.keys(en).filter(
      key => /Swalha Analytics/.test(en[key]) && !UPSTREAM_ATTRIBUTION.test(en[key])
    );

    const untranslated = rebranded.filter(key => !de[key]);
    expect(untranslated, "German lost translations during the rebrand").toEqual([]);
    expect(rebranded.every(key => de[key].includes("Swalha Analytics"))).toBe(true);
  });

  it("makes no affiliate or commission promise SWALHA does not offer", () => {
    const messages = JSON.parse(readFileSync(path.join(CLIENT, "messages", "en.json"), "utf8")) as Record<
      string,
      string
    >;
    const promises = Object.entries(messages)
      .filter(([, value]) => /affiliate|recurring commission/i.test(value))
      .map(([key, value]) => `${key}: ${value}`);
    expect(promises).toEqual([]);

    const linking: string[] = [];
    for (const file of walk(path.join(CLIENT, "src"), SOURCE_EXTENSIONS)) {
      if (/rybbit\.com\/affiliate/.test(readFileSync(file, "utf8"))) {
        linking.push(path.relative(REPO_ROOT, file));
      }
    }
    expect(linking).toEqual([]);
  });
});

// ── Product link targets ────────────────────────────────────────────────────

describe("product branding links to this deployment", () => {
  it("the canonical metadata base is the deployment origin", () => {
    const layout = readFileSync(path.join(CLIENT, "src", "app", "layout.tsx"), "utf8");
    expect(layout).toContain(`metadataBase: new URL("${APP_ORIGIN}")`);
  });

  it("no logo or wordmark click target still points at rybbit.com", () => {
    // Surfaces that carry the SWALHA lockup. Where the lockup is a link it must
    // point at this deployment; where it is decorative — the login page shows it
    // to a visitor already on the origin — only the "never upstream" rule holds.
    // Documentation, release and package links elsewhere stay upstream on purpose.
    const linkedSurfaces = [
      "src/app/signup/page.tsx",
      "src/app/widget/[siteId]/route.ts",
      "src/app/[site]/bots/components/BotChart.tsx",
      "src/app/[site]/main/components/MainSection/MainSection.tsx",
      "src/app/[site]/main/components/MainSection/MainSectionLite.tsx",
      "src/app/[site]/performance/components/PerformanceChart.tsx",
    ];
    const decorativeSurfaces = ["src/app/login/page.tsx"];

    for (const rel of [...linkedSurfaces, ...decorativeSurfaces]) {
      const source = readFileSync(path.join(CLIENT, rel), "utf8");
      const brandHrefs = [...source.matchAll(/href=(?:"([^"]+)"|\{[^}]*?"(https?:\/\/[^"]+)"[^}]*\})/g)]
        .flatMap(match => [match[1], match[2]])
        .filter((href): href is string => Boolean(href) && /rybbit\.(com|io)\/?$/.test(href));
      expect(brandHrefs, `${rel} links its logo at the upstream site`).toEqual([]);
      if (linkedSurfaces.includes(rel)) {
        expect(source, `${rel} should link the deployment origin`).toContain(APP_ORIGIN);
      }
    }
  });

  it("the app metadata and manifest carry the product name", () => {
    const layout = readFileSync(path.join(CLIENT, "src", "app", "layout.tsx"), "utf8");
    expect(layout).toContain("Swalha Analytics");
    const manifest = readFileSync(path.join(CLIENT, "src", "app", "manifest.ts"), "utf8");
    expect(manifest).toContain('name: "Swalha Analytics"');
  });
});

// ── Canonical artwork ───────────────────────────────────────────────────────

describe("canonical SWALHA artwork", () => {
  it("is checked in and served byte-for-byte", () => {
    expect(existsSync(CANONICAL)).toBe(true);
    const canonical = sha256(CANONICAL);
    for (const served of [
      path.join(CLIENT, "public", "swalha", "logo.png"),
      path.join(DOCS, "public", "swalha", "logo.png"),
    ]) {
      expect(sha256(served), `${served} must be the canonical bytes`).toBe(canonical);
    }
  });

  it("is a 1024x1024 RGBA image with a transparent background", () => {
    const info = readPng(CANONICAL);
    expect({ width: info.width, height: info.height }).toEqual({ width: 1024, height: 1024 });
    expect(info.colorType).toBe(6);
    expect(info.hasTransparency).toBe(true);
  });
});

// ── Generated icons ─────────────────────────────────────────────────────────

describe("icon metadata resolves to valid assets", () => {
  const markSizes = [512, 256, 192, 128, 64, 32];

  it.each([CLIENT, DOCS])("%s ships every mark size at its declared dimensions", root => {
    for (const size of markSizes) {
      const file = path.join(root, "public", "swalha", `mark-${size}.png`);
      expect(existsSync(file), `${file} is missing`).toBe(true);
      const info = readPng(file);
      expect({ width: info.width, height: info.height }, file).toEqual({ width: size, height: size });
      expect(info.hasTransparency, `${file} should keep its transparent background`).toBe(true);
    }
  });

  it.each([CLIENT, DOCS])("%s app icons are the right size and opacity", root => {
    const icon = readPng(path.join(root, "src", "app", "icon.png"));
    expect({ width: icon.width, height: icon.height }).toEqual({ width: 512, height: 512 });
    expect(icon.hasTransparency, "the favicon should keep its transparent background").toBe(true);

    // Apple flattens alpha onto black, so the touch icon must be opaque.
    const apple = readPng(path.join(root, "src", "app", "apple-icon.png"));
    expect({ width: apple.width, height: apple.height }).toEqual({ width: 180, height: 180 });
    expect(apple.hasTransparency, "apple-icon.png must be fully opaque").toBe(false);

    const og = readPng(path.join(root, "src", "app", "opengraph-image.png"));
    expect({ width: og.width, height: og.height }).toEqual({ width: 1200, height: 630 });
    expect(og.hasTransparency, "the social card must be fully opaque").toBe(false);
  });

  it("the maskable PWA icon is opaque at 512x512", () => {
    for (const root of [CLIENT, DOCS]) {
      const info = readPng(path.join(root, "public", "swalha", "mark-maskable-512.png"));
      expect({ width: info.width, height: info.height }).toEqual({ width: 512, height: 512 });
      expect(info.hasTransparency, "a maskable icon must fill its safe zone opaquely").toBe(false);
    }
  });

  it("every manifest icon resolves to a file matching its declared size", () => {
    const manifest = readFileSync(path.join(CLIENT, "src", "app", "manifest.ts"), "utf8");
    const entries = [...manifest.matchAll(/src:\s*"([^"]+)",\s*sizes:\s*"(\d+)x(\d+)"/g)];
    expect(entries.length).toBeGreaterThan(0);

    for (const [, src, width, height] of entries) {
      const file = path.join(CLIENT, "public", src);
      expect(existsSync(file), `manifest icon ${src} does not exist`).toBe(true);
      const info = readPng(file);
      expect({ width: info.width, height: info.height }, src).toEqual({
        width: Number(width),
        height: Number(height),
      });
    }
  });

  it("every SWALHA asset referenced from source exists on disk", () => {
    const missing: string[] = [];
    for (const [tree, publicDir] of [
      [path.join(CLIENT, "src"), path.join(CLIENT, "public")],
      [path.join(DOCS, "src"), path.join(DOCS, "public")],
    ]) {
      for (const file of walk(tree, SOURCE_EXTENSIONS)) {
        const text = readFileSync(file, "utf8");
        for (const match of text.matchAll(/["'`](\/?(?:public\/)?swalha\/[\w.-]+\.png)["'`]/g)) {
          const asset = match[1].replace(/^\/?(?:public\/)?/, "");
          const resolved = path.join(publicDir, "swalha", path.basename(asset));
          if (!existsSync(resolved) || !statSync(resolved).isFile()) {
            missing.push(`${path.relative(REPO_ROOT, file)} -> ${match[1]}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
