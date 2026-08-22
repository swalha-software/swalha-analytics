import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { admin, captcha, genericOAuth, mcp, organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, memberAc, ownerAc } from "better-auth/plugins/organization/access";
import { ALL_SCOPE_STRINGS, OIDC_STANDARD_SCOPES } from "./scopes.js";
import dotenv from "dotenv";
import { and, asc, eq, inArray } from "drizzle-orm";
import pg from "pg";
import { dash } from "@better-auth/infra";
import { apiKey } from "@better-auth/api-key";

import { db } from "../db/postgres/postgres.js";
import * as schema from "../db/postgres/schema.js";
import { member, user } from "../db/postgres/schema.js";
import { apiKeyLimitForPlan, countApiKeysForReference } from "./apiKeyLimits.js";
import { ORG_API_KEY_CONFIG_ID } from "./bearerAuth.js";
import { IS_CLOUD } from "./const.js";
import {
  addContactToAudience,
  sendChangeEmailVerification,
  sendEmailVerificationLink,
  sendWelcomeEmail,
} from "./email/email.js";
import { onboardingTipsService } from "../services/onboardingTips/onboardingTipsService.js";
import { getTrustedCorsOrigins } from "./cors.js";
import { createServiceLogger } from "./logger/logger.js";
import { applyLoginOrganizations } from "./orgSync/loginClaim.js";
import { getDiscovery } from "./orgSync/provider.js";
import type { UserinfoOrganization } from "./orgSync/types.js";

dotenv.config();

const authLogger = createServiceLogger("better-auth");

// better-auth organization endpoints that would change identity data. Auth
// owns it; manage at https://auth.swalha.com/account/organizations.
const ORG_MUTATION_PATHS = new Set([
  "/organization/create",
  "/organization/update",
  "/organization/delete",
  "/organization/invite-member",
  "/organization/cancel-invitation",
  "/organization/accept-invitation",
  "/organization/reject-invitation",
  "/organization/remove-member",
  "/organization/update-member-role",
  "/organization/leave",
  "/organization/create-team",
  "/organization/update-team",
  "/organization/remove-team",
  "/organization/add-team-member",
  "/organization/remove-team-member",
]);
const ORG_MANAGED_IN_AUTH_MESSAGE =
  "Organizations, members and teams are managed in SWALHA Auth: https://auth.swalha.com/account/organizations";

// The organization plugin's default access control, extended with an `apiKey`
// resource. The @better-auth/api-key plugin consults it (via hasPermission)
// for every operation on organization-owned keys: owners and admins manage
// them, members can't see them.
const ORG_API_KEY_ACTIONS = ["create", "read", "update", "delete"] as const;
const orgAccessControl = createAccessControl({
  ...defaultStatements,
  apiKey: [...ORG_API_KEY_ACTIONS],
});
const orgRoles = {
  owner: orgAccessControl.newRole({ ...ownerAc.statements, apiKey: [...ORG_API_KEY_ACTIONS] }),
  admin: orgAccessControl.newRole({ ...adminAc.statements, apiKey: [...ORG_API_KEY_ACTIONS] }),
  member: orgAccessControl.newRole({ ...memberAc.statements }),
};

// Rate limiting moved out of the plugin and into lib/apiRateLimit.ts, which
// enforces a burst tier and a daily quota per credential *owner* rather than a
// fixed window per key — the plugin's limiter is keyed on the key row, so an
// org could multiply its budget by minting more keys.
//
// Disabling it drops the read-modify-write on `requestCount`, but not every
// write: the plugin still stamps `lastRequest` on each verification (it takes
// the "skip" branch with a fresh timestamp), which is also what makes key
// last-used times work.
const apiKeyRateLimit = { enabled: false };

const pluginList = [
  admin(),
  // OAuth provider for MCP clients (RFC 8414/9728 discovery, dynamic client
  // registration, authorization-code + PKCE). The root /.well-known routes are
  // registered in index.ts; token validation happens via auth.api.getMcpSession.
  mcp({
    loginPage: "/login",
    ...(process.env.BASE_URL ? { resource: `${process.env.BASE_URL.replace(/\/$/, "")}/api/mcp` } : {}),
    oidcConfig: {
      loginPage: "/login",
      // Registers the custom resource:action scopes so /mcp/authorize's
      // invalid_scope check accepts them (merged after the standard scopes).
      scopes: [...ALL_SCOPE_STRINGS],
      // Advertised metadata is NOT derived from `scopes`. This feeds the
      // RFC 9728 protected-resource document; the RFC 8414 authorization-server
      // document is augmented in mcp/wellKnown.ts (better-auth builds it from a
      // top-level option the mcp() plugin type doesn't expose).
      metadata: {
        scopes_supported: [...OIDC_STANDARD_SCOPES, ...ALL_SCOPE_STRINGS],
      },
    },
  }),
  apiKey([
    {
      // User-owned keys. Pre-existing rows (NULL configId) resolve here.
      configId: "default",
      rateLimit: apiKeyRateLimit,
    },
    {
      // Organization-owned keys: referenceId is an organization id and the
      // key authenticates as the org itself (bearerAuth.ts branches on this
      // configId). Management is authorized through orgRoles' apiKey resource.
      configId: ORG_API_KEY_CONFIG_ID,
      references: "organization",
      defaultPrefix: "rb_org_",
      // Org keys store { createdBy } so actions stay attributable to the
      // admin who minted the key.
      enableMetadata: true,
      rateLimit: apiKeyRateLimit,
    },
  ]),
  dash(),
  organization({
    // Organizations are created, membered and deleted in SWALHA Auth and
    // mirrored here (lib/orgSync); every local mutation is refused in hooks.before.
    allowUserToCreateOrganization: false,
    creatorRole: "owner",
    ac: orgAccessControl,
    roles: orgRoles,
    teams: {
      enabled: true,
    },
    schema: {
      invitation: {
        additionalFields: {
          hasRestrictedSiteAccess: {
            type: "boolean",
            required: false,
            defaultValue: false,
            fieldName: "has_restricted_site_access",
          },
          siteIds: {
            type: "number[]",
            required: false,
            defaultValue: [],
            fieldName: "site_ids",
          },
        },
      },
      organization: {
        additionalFields: {
          stripeCustomerId: {
            type: "string",
            required: false,
          },
          monthlyEventCount: {
            type: "number",
            required: false,
            defaultValue: 0,
          },
          overMonthlyLimit: {
            type: "boolean",
            required: false,
            defaultValue: false,
          },
          planOverride: {
            type: "string",
            required: false,
          },
          customPlan: {
            type: "string",
            required: false,
          },
        },
      },
    },
  }),
  // Add Cloudflare Turnstile captcha (cloud only)
  ...(IS_CLOUD && process.env.TURNSTILE_SECRET_KEY && process.env.NODE_ENV === "production"
    ? [
        captcha({
          provider: "cloudflare-turnstile",
          secretKey: process.env.TURNSTILE_SECRET_KEY,
        }),
      ]
    : []),
  // Single sign-on against the central SWALHA identity provider
  // (auth.swalha.com). Plain OIDC over the genericOAuth client — analytics
  // keeps its own user table and links by verified email on first SSO login
  // (see account.accountLinking below). Registered there as a trusted client,
  // so the consent screen is skipped.
  ...(process.env.SWALHA_SSO_CLIENT_ID && process.env.SWALHA_SSO_CLIENT_SECRET
    ? [
        genericOAuth({
          config: [
            {
              providerId: "swalha",
              clientId: process.env.SWALHA_SSO_CLIENT_ID,
              clientSecret: process.env.SWALHA_SSO_CLIENT_SECRET,
              discoveryUrl:
                process.env.SWALHA_SSO_DISCOVERY_URL ?? "https://auth.swalha.com/.well-known/openid-configuration",
              scopes: ["openid", "email", "profile", "organizations"],
              pkce: true,
              // better-auth's default reads the id_token and skips userinfo, but
              // the `organizations` claim is userinfo-only: fetch it ourselves
              // and sync the user's memberships before they are signed in.
              getUserInfo: async tokens => {
                const { userinfo_endpoint } = await getDiscovery();
                const res = await fetch(userinfo_endpoint, {
                  headers: { authorization: `Bearer ${tokens.accessToken}` },
                });
                if (!res.ok) {
                  authLogger.error({ status: res.status }, "SSO userinfo request failed");
                  return null;
                }
                const profile = (await res.json()) as {
                  sub: string;
                  email?: string;
                  email_verified?: boolean;
                  name?: string;
                  picture?: string;
                  organizations?: UserinfoOrganization[];
                };
                if (!profile.sub || !profile.email) return null;
                await applyLoginOrganizations(profile).catch(err =>
                  authLogger.error({ err, sub: profile.sub }, "Login-time organization sync failed")
                );
                return {
                  id: profile.sub,
                  email: profile.email,
                  emailVerified: profile.email_verified ?? false,
                  name: profile.name ?? profile.email,
                  image: profile.picture,
                };
              },
              // auth.swalha.com is the gate — reaching this callback already
              // means approved, so provision on first login.
              disableSignUp: false,
            },
          ],
        }),
      ]
    : []),
];

export const auth = betterAuth({
  basePath: "/api/auth",
  appName: "Swalha Analytics",
  logger: {
    log: (level, message, ...args) => {
      // Route better-auth's internal logs (e.g. API key rate-limit errors)
      // through the project's pino logger instead of console.
      authLogger[level]({ args }, message);
    },
  },
  database: new pg.Pool({
    host: process.env.POSTGRES_HOST || "postgres",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  }),
  emailAndPassword: {
    // Sign-in is SSO-only through the central SWALHA identity provider —
    // email/password sign-up and sign-in are fully disabled. Pre-SSO password
    // accounts keep working via their linked SWALHA account.
    enabled: false,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string; token: string }) => {
      await sendEmailVerificationLink(user.email, url);
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      // "swalha" is the central SWALHA identity provider. Trusting it lets an
      // SSO sign-in whose verified email matches an existing analytics user
      // link to that user instead of creating a duplicate — this is how
      // pre-SSO accounts migrate without losing their organizations or sites.
      trustedProviders: ["swalha"],
      // Pre-SSO analytics accounts are unverified (requireEmailVerification
      // was always false here), so the default local-verification gate would
      // refuse every migration link with account_not_linked. The identity
      // provider only asserts emails it verified itself, and better-auth
      // marks the local account verified after a successful link.
      requireLocalEmailVerified: false,
    },
  },
  user: {
    additionalFields: {
      sendAutoEmailReports: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: true,
      },
      // scheduledTipEmailIds: {
      //   type: "string[]",
      //   required: false,
      //   defaultValue: [],
      // },
    },
    deleteUser: {
      enabled: true,
      // apikey.referenceId no longer has a cascading FK to user.id (it holds
      // user OR org ids), so the user's keys are purged explicitly. Keys of a
      // user removed through other paths are unusable anyway — bearer auth
      // requires a live org membership — this is hygiene, not security.
      afterDelete: async deletedUser => {
        try {
          await db.delete(schema.apiKey).where(eq(schema.apiKey.referenceId, deletedUser.id));
        } catch (error) {
          authLogger.error({ err: error, userId: deletedUser.id }, "Error deleting API keys for removed user");
        }
      },
    },
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({
        user,
        newEmail,
        url,
      }: {
        user: { email: string };
        newEmail: string;
        url: string;
        token: string;
      }) => {
        await sendChangeEmailVerification(user.email, newEmail, url);
      },
    },
  },
  plugins: pluginList,
  trustedOrigins: getTrustedCorsOrigins(),
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production", // don't mark Secure in dev
    defaultCookieAttributes: {
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async u => {
          authLogger.info({ userId: u.id }, "User created");
          const users = await db.select().from(schema.user).orderBy(asc(user.createdAt));

          // If this is the first user, make them an admin
          if (users.length === 1) {
            await db.update(user).set({ role: "admin" }).where(eq(user.id, users[0].id));
          }

          sendWelcomeEmail(u.email, u.name);
          // Add contact to marketing audience and schedule onboarding emails
          try {
            await addContactToAudience(u.email, u.name);

            const emailIds = await onboardingTipsService.scheduleOnboardingEmails(u.email, u.name);

            // Store scheduled email IDs for potential cancellation
            if (emailIds.length > 0) {
              await db.update(user).set({ scheduledTipEmailIds: emailIds }).where(eq(user.id, u.id));
            }
          } catch (error) {
            authLogger.error({ err: error, userId: u.id }, "Error setting up onboarding emails");
          }
        },
      },
      update: {
        before: async userUpdate => {
          // Security: Prevent role field from being updated via regular update-user endpoint
          // Role changes should only go through the admin setRole endpoint
          if (userUpdate && typeof userUpdate === "object") {
            if ("role" in userUpdate) {
              // Remove role from the update data
              const { role: _, ...dataWithoutRole } = userUpdate;
              return {
                data: dataWithoutRole,
              };
            }
            // Always return the data, even if role wasn't present
            return {
              data: userUpdate,
            };
          }
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async ctx => {
      // Organizations, members, teams and invitations live in SWALHA Auth;
      // this app only mirrors them (lib/orgSync). Refuse local mutations.
      if (ORG_MUTATION_PATHS.has(ctx.path)) {
        throw new APIError("FORBIDDEN", { message: ORG_MANAGED_IN_AUTH_MESSAGE });
      }

      // Gate API key creation on better-auth's own /api-key/create route. This
      // is the only choke point that covers direct client calls — the Fastify
      // endpoints (createUserApiKey / createOrgApiKey) do richer plan checks
      // before calling in server-side (no ctx.request), so they gate there.
      if (ctx.path === "/api-key/create" && ctx.request) {
        const body = (ctx.body ?? {}) as { configId?: string; organizationId?: string };
        const isOrgKey = body.configId === ORG_API_KEY_CONFIG_ID;
        const session = await getSessionFromCtx(ctx);

        // The key's owner: the org for org keys, the session user otherwise.
        const referenceId = isOrgKey ? body.organizationId : session?.user?.id;
        if (!referenceId) return; // the api-key plugin rejects these itself

        // Don't reveal an org's plan tier or key quota to non-members: skip
        // the gate and let the plugin's own membership/permission check
        // produce its canonical rejection.
        if (isOrgKey) {
          const userId = session?.user?.id;
          if (!userId) return;
          const membership = await db
            .select({ id: member.id })
            .from(member)
            .where(and(eq(member.userId, userId), eq(member.organizationId, referenceId)))
            .limit(1);
          if (membership.length === 0) return;

          // createdBy must identify the session user who minted the key —
          // never caller-supplied metadata. The Fastify endpoint sets it
          // server-side; this covers direct /api-key/create calls. In-place
          // mutation is effective: better-auth hands this same body object to
          // the endpoint.
          const orgKeyBody = ctx.body as { metadata?: Record<string, unknown> };
          orgKeyBody.metadata = { ...orgKeyBody.metadata, createdBy: userId };
        }

        let planName: string | null = null;
        if (IS_CLOUD) {
          // Billing org: the owning org for org keys, the active org for user keys.
          const billingOrgId = isOrgKey
            ? body.organizationId
            : ((session?.session as any)?.activeOrganizationId as string | undefined);
          if (!billingOrgId) {
            throw new APIError("BAD_REQUEST", { message: "No active organization" });
          }
          const { getSubscriptionInner } = await import("../api/stripe/getSubscription.js");
          const subscription = await getSubscriptionInner(billingOrgId);
          planName = subscription?.planName || "free";
          if (planName === "free" || planName.includes("basic")) {
            throw new APIError("FORBIDDEN", {
              message: "API keys require a Standard or Pro plan. Please upgrade to create API keys.",
            });
          }
        }

        // Best-effort pre-check: the insert happens inside the plugin after
        // this hook returns, so no lock can span check-and-create here.
        // Concurrent direct calls can overshoot the cap slightly — it's an
        // advisory quota on the caller's own plan, not a security boundary.
        // The Fastify endpoints (the documented path) enforce it atomically
        // via createApiKeyWithinLimit.
        const limit = apiKeyLimitForPlan(planName);
        const existing = await countApiKeysForReference(referenceId);
        if (existing >= limit) {
          throw new APIError("FORBIDDEN", {
            message: `You have reached the limit of ${limit} API keys. Delete an unused key or upgrade your plan.`,
          });
        }
      }
    }),
  },
});
