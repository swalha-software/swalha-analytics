import { render } from "@react-email/components";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  firstDays,
  installCheck,
  installFinal,
  installSnippet,
  noPlan1,
  noPlan2,
  noSite1,
  noSite2,
  nudgeEvents,
  nudgeGoals,
  siteLive,
  welcome,
  wentQuiet,
} from "../../services/lifecycleEmails/lifecycleContent.js";
import { letterText, SIGNOFF, type Letter } from "./letter.js";
import { BRAND_LOGO_URL, BRAND_NAME } from "./templates/BrandHeader.js";
import { InvitationEmail } from "./templates/InvitationEmail.js";
import { LetterEmail } from "./templates/LetterEmail.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "..", "..");
const TEMPLATE_DIR = path.join(HERE, "templates");
const PDF_TEMPLATE = path.join(SRC, "services", "pdfReports", "templates", "PdfReportTemplate.tsx");

/**
 * Every server-side source that emits copy a recipient actually reads: mail
 * subjects and sender names, the marketing lifecycle content, the unsubscribe
 * page rendered in the browser, and the PDF report footer.
 */
const COPY_SOURCES = [
  "lib/email/email.ts",
  "lib/email/letter.ts",
  "lib/email/format.ts",
  "api/user/unsubscribeMarketing.ts",
  "api/user/unsubscribeReports.ts",
  "api/user/unsubscribeWeeklyReports.ts",
  "services/lifecycleEmails/lifecycleContent.ts",
  "services/pdfReports/templates/PdfReportTemplate.tsx",
];

function templateSources() {
  return readdirSync(TEMPLATE_DIR)
    .filter(name => name.endsWith(".tsx") && !name.endsWith(".test.tsx"))
    .map(name => [name, readFileSync(path.join(TEMPLATE_DIR, name), "utf8")] as const);
}

function copySources() {
  return COPY_SOURCES.map(rel => [rel, readFileSync(path.join(SRC, ...rel.split("/")), "utf8")] as const);
}

/** Strip markup so assertions only see what a recipient actually reads. */
function visibleText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Mail routing domains (email.rybbit.com, app.rybbit.io), reply-to mailboxes and
 * docs links are functional addresses, not branding; the tracker API identifiers
 * (window.rybbit, data-rybbit-event) are lowercase and never match `\bRybbit\b`.
 */
function withoutAddresses(source: string) {
  return source.replace(/https?:\/\/[^\s"'`]+/g, " ").replace(/[\w.+-]+@[\w.-]+/g, " ");
}

/**
 * Upstream (Rybbit) history, people and commercial claims must not be
 * re-pointed at SWALHA: the fork inherits the software, not the company story.
 */
const UNSUPPORTED_CLAIMS: { pattern: RegExp; why: string }[] = [
  { pattern: /\b(self[- ]funded|bootstrapped|venture[- ]backed|vc[- ]backed|profitable since)\b/i, why: "funding history" },
  { pattern: /\bfounders?\b|\bfounded (in|by)\b|\bwe (built|created|started|launched) SWALHA\b/i, why: "founder / origin story" },
  { pattern: /\bBill\b/, why: "named individual carried over from upstream" },
  {
    pattern: /\b(thousands|millions|hundreds) of (developers|users|customers|companies|sites|websites|teams)\b/i,
    why: "unsupported adoption claim",
  },
  { pattern: /\b(since|est\.?) (19|20)\d{2}\b/i, why: "company-age claim" },
  {
    pattern: /\b(award[- ]winning|industry[- ]leading|most popular|the #1|world's (best|leading))\b/i,
    why: "unsupported superlative",
  },
  { pattern: /\b(money[- ]back|free forever|lifetime (deal|access)|guaranteed)\b/i, why: "commercial promise" },
  { pattern: /Swalha Analytics analytics\b/i, why: "duplicated brand token" },
];

/** One of every state-machine lifecycle letter, single- and multi-site where the copy forks. */
function lifecycleLetters(): [string, Letter][] {
  const one = [{ domain: "acme.com", siteId: 1 }];
  const two = [...one, { domain: "docs.acme.com", siteId: 2 }];
  const platform = { key: "wordpress", label: "WordPress", guideUrl: "https://example.com/guides/wordpress" };
  const snippet = (sitesIn: typeof two, withPlatform: boolean) =>
    sitesIn.map(s => ({ ...s, platform: withPlatform ? platform : null }));
  const check = (sitesIn: typeof two) => sitesIn.map(s => ({ domain: s.domain, checkInstallUrl: "https://example.com/check" }));
  const quiet = (sitesIn: typeof two) => sitesIn.map(s => ({ ...s, lastEventAt: "Oct 12" }));
  const first = { receivedAt: "Oct 12, 2026 at 14:02 UTC", country: "Germany", pathname: "/pricing", device: "Desktop" };
  const stats = { sessions: 120, pageviews: 340, topReferrer: "google.com", topPage: "/pricing" };
  return [
    ["welcome", welcome("Ada")],
    ["noSite1", noSite1("Ada")],
    ["noSite2", noSite2("Ada")],
    ["noPlan1 (trial)", noPlan1(one, true, "Ada")],
    ["noPlan1 (plans, several sites)", noPlan1(two, false, "Ada")],
    ["noPlan2 (trial)", noPlan2(one, true, "Ada")],
    ["noPlan2 (plans, several sites)", noPlan2(two, false, "Ada")],
    ["installSnippet", installSnippet(snippet(one, false), "Ada")],
    ["installSnippet (platform)", installSnippet(snippet(one, true), "Ada")],
    ["installSnippet (several sites)", installSnippet(snippet(two, true), "Ada")],
    ["installCheck", installCheck(check(one), "Ada")],
    ["installCheck (several sites)", installCheck(check(two), "Ada")],
    ["installFinal", installFinal(["acme.com"], "Ada")],
    ["installFinal (several sites)", installFinal(["acme.com", "docs.acme.com"], "Ada")],
    ["siteLive", siteLive(one, first, "Ada")],
    ["siteLive (several sites)", siteLive(two, null, "Ada")],
    ["firstDays", firstDays("acme.com", 1, stats, 3, "Ada")],
    ["nudgeEvents", nudgeEvents("acme.com", 1, "Ada")],
    ["nudgeGoals", nudgeGoals("acme.com", 1, { pathname: "/thank-you", sessions: 12 }, "Ada")],
    ["wentQuiet", wentQuiet(quiet(one), "Ada")],
    ["wentQuiet (several sites)", wentQuiet(quiet(two), "Ada")],
  ];
}

function claimsIn(text: string) {
  return UNSUPPORTED_CLAIMS.filter(({ pattern }) => pattern.test(text)).map(({ why }) => why);
}

describe("email templates carry SWALHA branding", () => {
  it("no template still embeds the Rybbit logo", () => {
    const offenders = templateSources()
      .filter(([, source]) => /rybbit\/(horizontal|vertical|frog|type)/.test(source) || /alt="Rybbit"/.test(source))
      .map(([name]) => name);
    expect(offenders).toEqual([]);
  });

  // Every email is laid out by LedgerLayout (ledger.tsx), and LedgerLayout opens
  // with the shared lockup. So: the layout must render <BrandHeader />, every
  // other template must go through the layout, and none may bring its own logo.
  it("the shared layout opens with the brand lockup", () => {
    const ledger = readFileSync(path.join(TEMPLATE_DIR, "ledger.tsx"), "utf8");
    expect(ledger).toContain("<BrandHeader");
    expect(ledger).not.toMatch(/<Img\b/);
  });

  it("every template renders its header through the shared brand lockup", () => {
    const offenders = templateSources()
      .filter(([name]) => name !== "BrandHeader.tsx" && name !== "ledger.tsx")
      .filter(([, source]) => !source.includes("<LedgerLayout") || /<Img\b/.test(source))
      .map(([name]) => name);
    expect(offenders).toEqual([]);
  });

  it("no template or mail helper references a Rybbit-hosted logo or mailbox", () => {
    const sources = [...templateSources(), ...copySources()];
    const offenders = sources
      .filter(([, source]) => /email-logo\.png|app\.rybbit\.io|@(email\.)?rybbit\.com/.test(source))
      .map(([name]) => name);
    expect(offenders).toEqual([]);
  });

  it("the brand lockup points at the canonical logo", () => {
    expect(BRAND_NAME).toBe("Swalha Analytics");
    expect(BRAND_LOGO_URL).toBe("https://swalha.com/logo.png");
  });

  it("no template body still says Rybbit", () => {
    const offenders = templateSources()
      .filter(([, source]) => /\bRybbit\b/.test(withoutAddresses(source)))
      .map(([name]) => name);
    expect(offenders).toEqual([]);
  });

  it("the invitation email renders the SWALHA lockup", async () => {
    const html = await render(
      InvitationEmail({
        inviterName: "Ada",
        inviterEmail: "ada@example.com",
        organizationName: "Acme",
        role: "member",
        expiresAt: new Date("2026-12-01T00:00:00Z"),
        inviteLink: "https://example.com/invite/abc",
      })
    );
    expect(html).toContain(BRAND_LOGO_URL);
    expect(visibleText(html)).toContain(BRAND_NAME);
    expect(visibleText(html)).not.toMatch(/\bRybbit\b/);
    expect(claimsIn(visibleText(html))).toEqual([]);
  });
});

describe("server-sent copy carries SWALHA branding", () => {
  it("no server-sent copy still says Rybbit", () => {
    const offenders = copySources()
      .filter(([, source]) => /\bRybbit\b/.test(withoutAddresses(source)))
      .map(([rel]) => rel);
    expect(offenders).toEqual([]);
  });

  it("every email is sent through the single configured sender", () => {
    const source = readFileSync(path.join(SRC, "lib", "email", "email.ts"), "utf8");
    // The sender is centralised in EMAIL_FROM so a deploy can point mail at its
    // own verified domain; no call site may hardcode one.
    expect([...source.matchAll(/from:\s*"([^"]+)"/g)].map(match => match[1])).toEqual([]);
    expect(source).toMatch(/from:\s*EMAIL_FROM/);
  });

  it("the default sender falls back to the SWALHA brand name", () => {
    const source = readFileSync(path.join(SRC, "lib", "const.ts"), "utf8");
    const fallback = source.match(/EMAIL_FROM\s*=\s*process\.env\.EMAIL_FROM\s*\|\|\s*"([^"<]+)</);
    // Catches personal sender names such as "Bill from Swalha Analytics".
    expect(fallback?.[1].trim()).toBe(BRAND_NAME);
  });

  it("no mail goes out with a reply-to mailbox other than the configured sender", () => {
    const source = readFileSync(path.join(SRC, "lib", "email", "email.ts"), "utf8");
    expect(source).not.toMatch(/replyTo\s*:/);
  });

  it("the mail client follows the Resend key, not CLOUD", () => {
    const source = readFileSync(path.join(SRC, "lib", "email", "email.ts"), "utf8");
    expect(source).toMatch(/if \(RESEND_API_KEY\)/);
    expect(source).not.toMatch(/\bIS_CLOUD\b/);
  });

  it("mail subjects are branded SWALHA and never Rybbit", () => {
    // Subjects passed to sendEmail() as string or template literals; the rest
    // are built by the templates and lifecycle content, both covered below.
    const source = readFileSync(path.join(SRC, "lib", "email", "email.ts"), "utf8");
    const subjects = [...source.matchAll(/sendEmail\(\s*[\w.]+,\s*(["`])([^"`]+)\1/g)].map(match => match[2]);
    expect(subjects.length).toBeGreaterThan(0);
    for (const subject of subjects) {
      expect(subject).not.toMatch(/\bRybbit\b/);
      expect(claimsIn(subject)).toEqual([]);
    }
    expect(subjects.some(subject => subject.includes(BRAND_NAME))).toBe(true);
  });

  it("the one-click unsubscribe page is branded SWALHA", () => {
    const source = readFileSync(path.join(SRC, "api", "user", "unsubscribeMarketing.ts"), "utf8");
    expect(source).toContain(`Unsubscribe - ${BRAND_NAME}`);
    expect(source).toContain(`Unsubscribed - ${BRAND_NAME}`);
    expect(source).toContain(`unsubscribed from ${BRAND_NAME} marketing emails`);
    expect(withoutAddresses(source)).not.toMatch(/\bRybbit\b/);
  });
});

describe("no upstream history or business claims are reassigned to SWALHA", () => {
  it.each(COPY_SOURCES)("%s makes no unsupported claim", rel => {
    const source = withoutAddresses(readFileSync(path.join(SRC, ...rel.split("/")), "utf8"));
    expect(claimsIn(source)).toEqual([]);
  });

  it.each(templateSources().map(([name]) => name))("templates/%s makes no unsupported claim", name => {
    const source = withoutAddresses(readFileSync(path.join(TEMPLATE_DIR, name), "utf8"));
    expect(claimsIn(source)).toEqual([]);
  });

  it("letters are signed by the team, not a named person", () => {
    expect(SIGNOFF).toBe(`The ${BRAND_NAME} team`);
    expect(claimsIn(SIGNOFF)).toEqual([]);
  });

  it.each(lifecycleLetters())("the %s lifecycle email is neutral product copy", async (_name, letter) => {
    for (const copy of [letter.subject, letter.preview, letter.greeting, letterText(letter)]) {
      expect(claimsIn(copy)).toEqual([]);
      expect(withoutAddresses(copy)).not.toMatch(/\bRybbit\b/);
      // Letters speak for the team: no first-person singular carried over from
      // upstream's founder letters.
      expect(copy).not.toMatch(/\bI('m|'ll|'d|'ve)?\b|\b[Mm]y\b/);
    }

    const html = await render(
      LetterEmail({ letter, footer: [{ label: "Unsubscribe from these emails", href: "https://example.com/unsub" }] })
    );
    const text = visibleText(html);
    expect(html).toContain(BRAND_LOGO_URL);
    expect(text).toContain(BRAND_NAME);
    expect(withoutAddresses(text)).not.toMatch(/\bRybbit\b/);
    expect(claimsIn(text)).toEqual([]);
  });

  // Guards the guard: a typo'd pattern that matches nothing would silently let
  // every regression below back in.
  it.each([
    "Swalha Analytics is fully self-funded and we're fully committed",
    "Bill from Swalha Analytics",
    "Bill – Founder of Swalha Analytics",
    "You've joined thousands of developers who care about privacy",
    "We built Swalha Analytics because we were tired of tools that treat users as products",
    "Your Swalha Analytics analytics are waiting",
    "Trusted by millions of users since 2021",
  ])("the claim guard rejects %j", sample => {
    expect(claimsIn(sample).length).toBeGreaterThan(0);
  });
});

describe("PDF report branding", () => {
  it("the report footer is branded SWALHA", () => {
    const source = readFileSync(PDF_TEMPLATE, "utf8");
    expect(source).toContain("Powered by Swalha Analytics");
    expect(source).not.toMatch(/Powered by Rybbit/);
  });

  it("the report footer points at the SWALHA app origin", () => {
    const source = readFileSync(PDF_TEMPLATE, "utf8");
    expect(source).toContain("https://analytics.swalha.com");
    expect(source).not.toMatch(/https:\/\/rybbit\.com/);
  });
});
