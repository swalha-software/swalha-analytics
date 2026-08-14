import { render } from "@react-email/components";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ONBOARDING_TIPS } from "../../services/onboardingTips/onboardingTipsContent.js";
import { REENGAGEMENT_EMAILS } from "../../services/reengagement/reengagementContent.js";
import { BRAND_LOGO_URL, BRAND_NAME } from "./templates/BrandHeader.js";
import { InvitationEmail } from "./templates/InvitationEmail.js";
import { OnboardingTipEmail } from "./templates/OnboardingTipEmail.js";
import { OtpEmail, type OtpEmailType } from "./templates/OtpEmail.js";
import { ReengagementEmail } from "./templates/ReengagementEmail.js";

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
  "api/user/unsubscribeMarketing.ts",
  "services/onboardingTips/onboardingTipsContent.ts",
  "services/reengagement/reengagementContent.ts",
  "services/pdfReports/templates/PdfReportTemplate.tsx",
];

function templateSources() {
  return readdirSync(TEMPLATE_DIR)
    .filter(name => name.endsWith(".tsx"))
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

  it("every template renders its header through the shared brand lockup", () => {
    const offenders = templateSources()
      .filter(([name]) => name !== "BrandHeader.tsx")
      .filter(([, source]) => !source.includes("<BrandHeader"))
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

  it.each<OtpEmailType>(["sign-in", "email-verification", "forget-password", "change-email"])(
    "the %s OTP email renders the SWALHA lockup",
    async type => {
      const html = await render(OtpEmail({ otp: "123456", type }));
      expect(html).toContain(BRAND_LOGO_URL);
      expect(visibleText(html)).toContain(BRAND_NAME);
      expect(visibleText(html)).not.toMatch(/\bRybbit\b/);
    }
  );

  it("the invitation email renders the SWALHA lockup", async () => {
    const html = await render(
      InvitationEmail({
        email: "someone@example.com",
        invitedBy: "Ada",
        organizationName: "Acme",
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

  it("every email is sent under the SWALHA sender name", () => {
    const source = readFileSync(path.join(SRC, "lib", "email", "email.ts"), "utf8");
    const senders = [...source.matchAll(/from:\s*"([^"<]+)</g)].map(match => match[1].trim());
    expect(senders.length).toBeGreaterThan(0);
    // Catches personal sender names such as "Bill from Swalha Analytics".
    expect([...new Set(senders)]).toEqual([BRAND_NAME]);
  });

  it("mail subjects are branded SWALHA and never Rybbit", () => {
    const source = readFileSync(path.join(SRC, "lib", "email", "email.ts"), "utf8");
    const subjects = [...source.matchAll(/subject:\s*"([^"]+)"/g)].map(match => match[1]);
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

  it.each(ONBOARDING_TIPS.map(tip => tip.day))("the day %i onboarding tip is neutral product copy", async day => {
    const tip = ONBOARDING_TIPS.find(candidate => candidate.day === day)!;
    expect(claimsIn(tip.subject)).toEqual([]);
    expect(claimsIn(tip.body)).toEqual([]);
    expect(tip.subject).not.toMatch(/\bRybbit\b/);
    expect(withoutAddresses(tip.body)).not.toMatch(/\bRybbit\b/);

    const html = await render(
      OnboardingTipEmail({
        userName: "Ada",
        body: tip.body,
        linkText: tip.linkText,
        linkUrl: tip.linkUrl,
        unsubscribeUrl: "https://example.com/unsubscribe",
      })
    );
    const text = visibleText(html);
    expect(text).toContain(BRAND_NAME);
    expect(text).not.toMatch(/\bRybbit\b/);
    expect(claimsIn(text)).toEqual([]);
  });

  it.each(Object.keys(REENGAGEMENT_EMAILS).map(Number))(
    "the day %i reengagement email is neutral product copy",
    async day => {
      const content = REENGAGEMENT_EMAILS[day];
      for (const copy of [content.subject, content.title, content.message, content.ctaText]) {
        expect(claimsIn(copy)).toEqual([]);
        expect(copy).not.toMatch(/\bRybbit\b/);
      }

      const html = await render(
        ReengagementEmail({
          userName: "Ada",
          day: content.day,
          title: content.title,
          message: content.message,
          ctaText: content.ctaText,
          siteId: 1,
          domain: "example.com",
          unsubscribeUrl: "https://example.com/unsubscribe",
        })
      );
      const text = visibleText(html);
      expect(text).toContain(BRAND_NAME);
      expect(text).not.toMatch(/\bRybbit\b/);
      expect(claimsIn(text)).toEqual([]);
    }
  );

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
