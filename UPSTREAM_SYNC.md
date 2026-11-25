# Upstream Sync

This repository is an AGPL hard fork of [rybbit-io/rybbit](https://github.com/rybbit-io/rybbit).
Upstream changes are reviewed weekly. Through 2026-W34 they were ported selectively;
2026-W48 was a full merge of `upstream/master`, so the two histories now share a merge
base and later syncs can merge again instead of cherry-picking.

Swalha-specific behavior that must survive every sync:

- **Self-hosted Cloudflare R2 replay storage** activated by the presence of
  `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` (not by `CLOUD=true`).
- **Organization-scoped GHCR image names** —
  `ghcr.io/<org>/swalha-analytics-{backend,client}`.
- **SSO-only authentication** against the central SWALHA identity provider
  (email/password disabled, account linking by verified email).
- **SWALHA branding** across client, emails, and PDF report templates.
- **Organizations managed by SWALHA Auth** — mirrored by `server/src/lib/orgSync`;
  no local organization, member, team or invitation management.
- **The fork's own product decisions** — gold restyle, unified sidebar, organization
  overview at `/`, org-only API keys, no AppSumo, no uptime monitoring, the native
  Android / iOS / React Native SDKs, and the custom SQL `scoped_users` table.

## Last reviewed upstream SHA

`a46032b5bcdd72f176b259bd1c1ff35140167268` (2026-11-21)

Baseline before the first recorded sync: `0d0437cf1536`.

## Log

### 2026-W48 — full sync, merged `64f8c4fb..a46032b5`

A merge of `upstream/master`, not a port: 233 upstream commits (2026-08-20 → 2026-11-21),
covering upstream releases `v2.9.0` – `v2.9.3`. The owner asked for everything upstream
has except where it would undo Swalha-specific behavior. Supersedes the open
2026-W47 PR (#24): the ClickHouse `26.3.62.3` bump for CVE-2026-116366 (upstream #1337)
is included here, in every Compose file and self-hosting guide.

The merge base moved from `0d0437cf` to `a46032b5`, so the hand-ported weeks W33/W34
showed up as 302 conflicted files. Where the fork's copy was byte-identical to the
ported upstream version, upstream's newer copy was taken without review (130 files);
the rest were resolved file by file — upstream for logic, the fork for the items in
the list at the top of this document.

**What came in** (grouped; every commit in the range is in the merge)

| Area | Upstream | Notes |
| --- | --- | --- |
| Map | `b5a93f8a` — replace the CARTO basemap with OpenFreeMap (#1145) | Fixes the "API KEY REQUIRED" tiles on the 2D globe. `git grep -i cartocdn` is empty. |
| Security | `ee11b416` — validate funnel steps, escape map tooltips, restrict framing and token reach (#1378); `1a8f1ff9` — harden site scoping for custom SQL, site-id params and user deletion (#1308); `e7ef9790` — query hardening (#1141); `6914a878` — security bumps for next, fastify, MCP SDK, better-auth (#1363); `7bc5c262` — ClickHouse CVE bump (#1337) | Custom SQL now runs as a least-privilege ClickHouse user behind a row policy. The fork's `scoped_users` table reads `events` through the same policy. **Cutover below.** |
| Bug sweeps | `fe676c67` / `caf1cf7e` — critical, high and medium bugs from the October sweep (#1328, #1329); `bc23257d` (#1303) | |
| Auth | `36a0cf8a` / `e9b940cf` — Better Auth 1.7 and the OAuth provider plugin; `dcdf3920` — drop the `dash` plugin (#1338); `d61502e0` — resolve the session once per request (#1312); `24eee008` (#1304); `d552225c` (#1352) | Better Auth 1.7 moves generic OAuth providers onto the core social flow. **Cutover below.** |
| Access | `fd99474e` — editor/viewer roles, per-site roles, site transfers (#1275) | The permission map and route guards are in. The UI and endpoints that *edit* members are not — see "not taken". |
| Analytics | `c9b8f5db` — pin every ClickHouse time column to UTC (#1207); `66e0cffa` — sub-second event ordering (#1144); `46d99acd` (#1169); `76861283`; `a0b34258` (#1143); `17bcab77` (#1177); `90e4f857` — refreshed browser/device/channel classification (#1278); `e7629899` — hashbang routes and opt-in URL fragments (#1300); `d983b2a1` — LCP/CLS for visitors who don't interact (#1327) | |
| Bots | `47929755` — name the bot, split AI crawlers from AI agents (#1147); `9aacb4f2` / `534f3f42` — site flood detection; `c6ee33d6` (#1370); `048a82c9` (#1379) | |
| Features | saved segments (#1165); timeline annotations (#1164, #1168, #1173); date selector rewrite with comparison choice (#1148, #1152, #1167, #1307); A/B experiments finished (#1240); raw event export (#1362); MCP Google Search Console tools (#1226); admin API-key management (#1350); dynamic favicons; session replay capped at 50 MB per session (`4d15d59b`) | Admin API keys are wired into the fork's admin sidebar as `/admin/api-keys`. |
| Performance | `a404e376` — share analytics responses across users and workers (#1212); `eb2aaf51` (#1211); `e33f5bf9` (#1349); `3fc6af8e` — gzip ClickHouse responses (#1310); `8244ee8f` (#1311); `829b2dc7` (#1316); `7f3ce916` (#1313); `d02f43fc` (#1315); `7bfe1d07` — site deletes no longer time out behind mutations | |
| UI | settings ledger (#1276, #1277); site page redesign (#1280, #1296); command palette (#1259); motion presets and reduced-motion (#1251); tonal popovers/alerts (#1187, #1189, #1192); one control height (#1384); copy sweeps (#1371, #1381, #1383) | Restyled onto the fork's gold tokens — see adaptations. |
| Email | `47d6a8ed` — every email redesigned in the Ledger style (#1330); `3d059a10` — lifecycle emails replace the onboarding drip (#1162); `877e3c6b` — weekly digest per person, post-trial grace (#1331); payment-failure recovery (#1374, #1375) | Re-branded — see adaptations. |
| Build | `8ea0b218` — pnpm workspace for client, server and shared (#1214); `199079d2` — TypeScript 7 (#1369); `5b8a8882` — Node base images pinned to a patch version (#1319); `5ea50a4a` — tests that guard no behavior pruned (#1367) | `npm ci` no longer applies: the per-package `package-lock.json` files are gone and the root `pnpm-lock.yaml` is the lockfile. |
| Docs site | landing-page experiments, blog posts, SEO tooling, translations | Taken as-is under `docs/`, which this fork does not publish. |

**Deliberately not taken**

| Upstream | Why |
| --- | --- |
| Member and team management: `/settings/organization`, `/settings/teams`, invitations, `addUserToOrganization`, `createUserInOrganization`, `updateMemberSiteAccess`, the team CRUD routes and MCP team tools, the admin "edit member" dialog and its `GET/PATCH/DELETE /admin/organizations/:id/members/:memberId` routes | Organizations, members and teams are owned by SWALHA Auth and mirrored by `lib/orgSync`; every local mutation is refused in `auth.ts`. A locally edited role would be overwritten by the next sync. The handlers that still compile stay in the tree unregistered. |
| Email/password, email OTP, `/invitation`, `/reset-password`, `/settings/account`, upstream's login and sign-up pages | SSO is the only door. The fork's login and sign-up pages are kept as they were. |
| Personal API keys (`POST /user/api-keys`, the personal mode of `ApiKeyManager`) | Org-only API keys. Upstream's Ledger redesign of the key manager is taken, in organization mode only. |
| AppSumo (`/as/*`, license lookup, `appsumo-N` plan overrides, the plan card) | Removed in this fork (#18). An organization whose `planOverride` is still `appsumo-N` now resolves to no override. |
| Try-before-signup: `/try`, `POST /sites/unclaimed`, `POST /sites/:siteId/claim`, the claim banner | It creates sites for callers with no account. The cleanup cron and the `claim_expires_at` column come in (unused). |
| `/settings/dpa` (self-serve countersigned DPA, #1365) | It is Rybbit's legal agreement, signed by Rybbit. The server route is cloud-only and stays; the client pages are removed. |
| Generated frog avatars (`lib/frogAvatar`, `FrogAvatar`) in the client | Same reasoning as W34: the frog is Rybbit's brand character. The call sites are upstream's; `lib/visitorAvatar` gives them the neutral avatar. `docs/` keeps upstream's. |
| Upstream home page (`SiteCards`, `StartTrial`), site `Sidebar`, `AppSidebar`, `NavigationSidebar`, full footer, 404 help links | The fork's organization overview at `/`, unified sidebar and minimal footer replace them. |
| Weekly report recipients | Upstream now mails every member who can reach a site. The fork keeps owners only (`acd1c72b`), on upstream's new one-email-per-person run. |
| `0014_huge_dagger.sql` | Drops the uptime tables, which this fork already did in `0015_drop_uptime.sql`. |
| `.github/dependabot.yml`, `claude.yml`, `issue-manager.yml` | Already deleted in this fork. |
| `FEATURE_AUDIT.md` | Deleted upstream as outdated. `PRODUCT.md` was deleted upstream too but is kept: `CLAUDE.md` still points design work at it. |

**Adaptations required**

- **Postgres migrations renumbered.** Upstream's `0014`–`0024` collided with the fork's
  `0014_org_sync`, `0015_drop_uptime` and `0016_marvelous_forgotten_one`, which are
  already applied in production. The fork's three stay where they are; upstream's
  `0015`–`0024` follow as `0017_round_trish_tilby` … `0026_sites_id_index`, SQL
  unchanged, keeping their original journal timestamps (all later than the fork's
  last, so the migrator applies them in order). `meta/0026_snapshot.json` was
  generated offline from the merged `schema.ts`; `drizzle-kit generate` then reports
  no schema changes. Snapshots `0017`–`0025` do not exist. **Every later upstream
  migration needs the same +2 renumbering.**
- **Better Auth 1.7 and SSO.** `genericOAuthClient` no longer exists: the client now
  signs in with `authClient.signIn.social({ provider: "swalha" })`. The callback moved
  from `/api/auth/oauth2/callback/swalha` to `/api/auth/callback/swalha`. The provider
  keeps sending the old redirect URI (the one registered in SWALHA Auth) and
  `server/src/index.ts` forwards it to the new endpoint, so nothing changes on the
  Auth side. `getUserInfo` also returns `sub`, which 1.7 checks against the ID token.
- **`server/src/lib/auth-utils.ts`** is upstream's, with its cache and cache keys moved
  into the fork's `lib/sitesAccessCache.ts` so `lib/orgSync` can still invalidate
  without importing the Better Auth setup.
- **Routes.** Upstream moved every route into `server/src/api/routes.ts` under a new
  access-declaration scheme. The fork's routes were re-added there
  (`/organizations/:id/overview`, `/sync/organizations`, `/user/sso-sign-out`,
  `/admin/weekly-report`, `/user/unsubscribe-weekly-reports`).
- **Email.** `ledger.tsx` renders the SWALHA lockup through `BrandHeader`; every send
  goes through `EMAIL_FROM`; the Resend client and the weekly cron follow
  `RESEND_API_KEY`, not `CLOUD`; the "Bill, the founder" and "self-funded" copy is
  gone from the lifecycle letters. `branding.test.ts` was rewritten for the new
  structure. `client/public/rybbit/email-logo.png` is deleted.
- **Gold restyle.** Upstream rewrote most charts onto `--dataviz`, which is already
  gold here, so little needed re-applying: `checkbox.tsx` keeps `text-accent-950`,
  `events/utils/eventTypes.ts` swaps `amber-300` for `fuchsia-400` beside the gold
  data hue, `NoData.tsx` uses the accent hover. `globals.css` keeps the fork's tokens
  and gains every new upstream rule. The "4 months free" chip is now upstream's
  green success badge, not gold.
- **Site transfers** are kept, adapted to SSO: a signed-out recipient gets the SSO
  button and is brought back to the link; a recipient with no organization is sent to
  SWALHA Auth instead of creating one here.
- **Command palette** navigates to `/settings/api-keys` instead of upstream's Account,
  Organization and Teams pages.
- **Message catalogs** were rebuilt from the three inputs and re-extracted
  (2433 keys). Catalog keys are a hash of the English text, so upstream strings that
  named Rybbit were re-branded in source, not in the catalog. In each non-English
  locale 53 fork-owned strings have no translation and fall back to English; 51 of
  them were already untranslated on `master`.
- **Visible "Rybbit" in new upstream UI** — OAuth consent page, first-pageview card,
  referral prompt, plan cards, experiment wizard — reads Swalha Analytics. The
  first-pageview card shows the SWALHA mark instead of the frog.
- **AppSumo** was stripped again from `subscriptionUtils.ts`, `subscriptionService.ts`,
  `adminOrganizationManagement.ts`, the billing page, `TrackingTab.tsx` and the tests
  upstream had grown around it.

All must-survive behaviors verified in the merged tree: R2 storage still switches on
`R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`
(`r2StorageService.ts`, with a test for "enabled outside cloud"); GHCR names in
`docker-compose.yml` and `.github/workflows/docker-publish.yml` are unchanged;
`emailAndPassword.enabled` is `false`, `trustedProviders` is `["swalha"]`, and
`ORG_MUTATION_PATHS` is still refused; the client and email branding guards pass;
`android/`, `ios/`, `react-native/` and `brand/` are untouched.

**Manual cutover — read before deploying**

1. **Back up Postgres first.** The backend container's entrypoint runs
   `drizzle-kit migrate` on start, so ten migrations (`0017`–`0026`) apply on the first
   boot of the new image. Nothing in this sync ran them. They are upstream's, written
   to be idempotent, and add: `lifecycle_email_log`, `segments`, `annotations`, the
   Better Auth 1.7 OAuth tables (`jwks`, `oauthClient`, `oauthAccessTokenV2`,
   `oauthConsentV2`, `oauthRefreshToken`, `oauthResource`, …) with a copy of the 1.6
   OAuth clients, `invitation.createdAt`, `sites.detected_platform`,
   `sites.claim_expires_at`, site-grant roles (`invitation.site_role`,
   `member_site_access.role`, `team_site_access.role`), `team."memberCount"` and
   `"teamMember"."membershipKey"`, `site_transfers`, `sites."trackUrlFragments"`, and
   an index on `sites.id`.
2. **`0020_better_auth_173` refuses to run** if `account` holds duplicate
   `("providerId", "accountId")` pairs or `"oauthApplication".metadata` holds invalid
   JSON, and the backend will not start until that is resolved. Check first:
   `SELECT "providerId", "accountId", count(*) FROM account GROUP BY 1, 2 HAVING count(*) > 1;`
3. **MCP / OAuth clients must sign in again.** 1.6 access tokens and consents are kept
   in their old tables for rollback but are not accepted by 1.7. Registered clients
   are carried over. Organization API keys are unaffected.
4. **ClickHouse.** The image moves `26.3.17.4` → `26.3.62.3`. The ClickHouse service
   now needs `CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1` and the backend gets
   `CLICKHOUSE_QUERY_PASSWORD` (it defaults to `CLICKHOUSE_PASSWORD`); both are in
   `docker-compose.yml`, but a deployment that does not use that file must add them.
   On boot the backend creates the `rybbit_query` user, its settings profile and a
   row policy on `events`. **Until that succeeds the Query page and every custom-SQL
   dashboard card answer 503** — they fail closed. On boot it also re-types every
   time column to an explicit `'UTC'` (`ensureUtcTimeColumns`) on `events`,
   `bot_events`, `bot_observations`, `session_replay_events`,
   `session_replay_metadata` and `session_replay_metadata_v2`. Its cost on a large
   `events` table was not measured here; watch the first boot's log.
5. **`BASE_URL` must be the public origin** (`https://analytics.swalha.com`). Better
   Auth's base URL and the SSO redirect URI are now derived from it
   (`getAuthBaseUrl()`), not from the incoming request.
6. **After deploy, check by hand:** sign in through SWALHA Auth with an existing
   account and with a first-time account; open the 2D globe; run one query on the
   Query page; send yourself the weekly report from `/admin/email`; play one session
   replay stored in R2.
7. **Optional, later:** register `https://analytics.swalha.com/api/auth/callback/swalha`
   in SWALHA Auth, then drop `redirectURI` from `auth.ts` and the forwarding route from
   `index.ts`.
8. The `session_replay_metadata_v2` backfill from 2026-W34 still applies if it has not
   been run.

**Gates run** (Node 24.22.1, pnpm 10.33.0; `npm ci` replaced by `pnpm install --frozen-lockfile`)

- `shared`: `pnpm --filter @rybbit/shared build` — pass
- `server`: `tsc --noEmit` — pass
- `server`: `pnpm run build:server` (tsc + analytics bundle) — pass; the committed
  `server/public/script.js` / `script-full.js` match a fresh build
- `server`: `TZ=UTC vitest run` (CI sets `TZ=UTC`) — 194 files / 2970 tests: 2917 pass,
  52 skipped, 1 fail. The failure is `trackUrlFragmentsMigration.test.ts` hitting its
  5 s timeout on a PGlite cold start under the parallel run; it passes alone
- `client`: `tsc --noEmit` — pass
- `client`: `pnpm run lint` — pass
- `client`: `vitest run` — 128 files / 1439 tests pass, including `branding.test.ts`
- `client`: `next build` — pass. The `@rybbit/shared` resolution failure recorded in
  W34 is gone with the pnpm workspace
- `server/drizzle`: `drizzle-kit generate` — "No schema changes"
- `pnpm install --frozen-lockfile` — pass (the Dockerfiles install this way)

Known, not caused by this sync:

- In a non-UTC local zone two server tests fail — `siteTransfers.test.ts` ("is refused
  after the link expires") and `trialGraceEmails.test.ts` ("starts, turns midway…").
  Both files are byte-identical to upstream and pass under `TZ=UTC`.
- `pnpm run lint` fails if it runs *after* `next build`: upstream's ESLint config
  ignores nothing, so it lints `client/.next/`. On a clean tree it passes.
- `next build` and `next dev` rewrite `client/messages/*.json` in extraction order.
  The committed files are sorted (`pnpm --filter client extract`); discard the rewrite.
- `next build` logs `Failed to parse URL from /api/auth/get-session` while
  prerendering; the build completes.

**Not verified**

- **The SSO round trip against the real `auth.swalha.com` under Better Auth 1.7.** This
  is the main risk in the sync. The provider registration, the callback forward and
  the client call typecheck and are covered by nothing else: 1.7 verifies the ID token
  against the discovery JWKS and binds a nonce to it, and whether SWALHA Auth's tokens
  satisfy that could only be read from the library, not exercised. Test on a staging
  copy before production.
- The migrations against real data. `oauth.test.ts` replays the fork's chain plus
  `0020` in PGlite; no real database was touched.
- ClickHouse boot-time changes and the `rybbit_query` provisioning (no ClickHouse was
  started).
- Docker image builds, the `docs/` site build, and PDF report rendering (the local
  Puppeteer Chrome download was skipped).
- `team."memberCount"` is backfilled once by `0020`. `lib/orgSync` writes team
  members directly and does not maintain it; nothing in this fork reads it.
- The map was checked against a stub backend, not a real one: a headless Chromium
  loaded `/1/globe` from `next dev` and requested `tiles.openfreemap.org` (style,
  TileJSON, vector tiles) with the OpenFreeMap attribution rendered, no request to
  any Carto host and no "API KEY" text on the page.

### 2026-W34 — reviewed `b858276f..64f8c4fb`

Nineteen upstream commits. Still no upstream release since `v2.8.0` (2026-07-27,
already in this fork) and no open GitHub security advisories on `rybbit-io/rybbit`.

**Ported (13)**

| Upstream | Why |
| --- | --- |
| `9c66672b` — `refactor(analytics)`: one time window, one fill, for every bucketed query (#1119) | Analytics accuracy. The time window and bucket fill were re-derived in `lite/utils`, `getPerformanceTimeSeries`, `runDashboardCardQuery` and `query-validation`, each with its own rounding and gap-filling. One `timeWindow` module now serves every bucketed query, so a period's first and last buckets are computed the same way whichever surface asks. |
| `4e9f5166` — `refactor(sites)`: one module for every read of a Site's tracking configuration (#1122) | Ingestion correctness. Excluded IPs, excluded countries, the private-link config and the tracking config were four independent reads of the same Site row that could disagree. Collapsed into `lib/siteConfig`, with `getSiteExclusions` covered by tests. |
| `7dcce6fa` — `feat(bots)`: detect for every site, and catch the paced distributed crawler (#1123) | Bot detection accuracy. Detection now runs for every site, not only those opting into blocking: unenforced detections track the event normally and write a forensic row to `bot_observations` (30-day TTL), so a site that opted out is no longer invisible in the data used to tune the rules. The cohort key gains the browser family — without it Chrome/Safari/Firefox version numbers pooled into one distribution and manufactured the exact conditions the uniformity rule fires on, the only rule that catches a crawler pacing itself under every per-identity threshold. Adds the `missingScreenDimensions` signal (bit 12). |
| `b9dc8143` — `test(userIdService)` + `normalizeUserAgent` | Analytics accuracy. A browser auto-update changed the user agent and so changed the derived user id, splitting one returning visitor into two. Normalising the version out of the UA before hashing keeps the id stable across updates while still separating different browsers. |
| `613cd015` — `fix(analytics)`: `processResults` whitespace and non-finite strings | Data correctness. Result post-processing coerced anything numeric-looking, so `"Infinity"`/`"NaN"` dimension values became non-finite numbers and whitespace-only strings collapsed to empty. Both are legitimate values in event properties. |
| `c65b3931` — `perf(clickhouse)`: cut mutation-driven parts-lock contention on the hot ingest path (#1131) | Performance, ingestion reliability and replay data loss. **Carries a manual cutover — see below.** Four parts: replay metadata moves to an `AggregatingMergeTree` so a batch no longer re-reads the whole session (818 billion rows scanned in six days, 76% of all cluster reads, 2.5M single-row parts); replay timestamps from devices with broken clocks are shifted by a median offset instead of writing rows dated 2032–2090 into partitions a 30-day TTL never expires; identity backfill mutations are batched so N identifies cost one mutation per table instead of N, with failed assignments requeued rather than silently dropped; and the dashboard stops polling "does this site have data yet?" every 5s forever. |
| `8dbed0d7` — `refactor(client)`: collapse the analytics query layer onto one descriptor-driven seam (#1121) | Correctness and performance in the client read path. Analytics hooks hand-assembled queryKeys listing store inputs, so a key could drift from the request actually sent and serve another period's data. `useAnalyticsQuery` now builds the key from the same request object it sends, and reads the store through selectors so a `selectedStat` change no longer re-renders every analytics hook. |
| `ff45fb4c` — `test(timeSeriesChartUtils)` | Covers `getChartTimeBounds` across time modes and DST transitions. |
| `3fca2772` — `fix(api)`: past-minutes date ranges in GSC and PDF exports | Reporting accuracy. Both derived the start from `pastMinutesStart` but always ended today, which is right only while the newer edge is pinned to now. A stepped-back window now ends on its own edge instead of covering days the dashboard is not showing. |
| `64f8c4fb` — Fix period chart axes ending a bucket early, add past-minutes time navigation (#1130) | Analytics accuracy. Weekly buckets are floored two ways at once — analytics queries via ClickHouse `toStartOfWeek` (Sunday), dashboard cards via `toStartOfInterval(.., INTERVAL 1 WEEK)` (Monday). Flooring the axis max to Sunday put a card's final Monday bucket outside the domain, where the plot clips it and a whole week disappears for any period not ending on a Sunday. Also enables back/forward navigation on past-minutes windows. |
| `f96317e2` — `fix(geoStore)`: handle empty region input | Avoids a lookup throwing on sessions with no region. |
| `9ec40e2c` — `test`: cover authorization, billing and SQL-generation paths, run the suites in CI (#1125) | Test coverage across access control, usage, GSC, funnels, goals, event/user conditions, feature-flag regex and IP utils, plus the client suites and `.github/workflows/test.yml`. |
| `37baf329` — `chore`: upgrade Node.js to 24 | Self-hosting maintenance. Node 20 is end-of-life; the client and server Dockerfiles, the CI workflows, and `@types/node` move to 24. |

**Skipped (6)**

| Upstream | Why |
| --- | --- |
| `3f9d7bd2` / `d80c26ce` — `feat(avatars)`/`fix(avatars)`: generated frog avatars (#1127, #1128) | Upstream mascot branding. The frog is Rybbit's brand personality; this fork uses neutral initials avatars in the sidebar (`ae556381`). Porting would reintroduce Rybbit branding the fork deliberately replaced. |
| `39a5677f` — `feat(company)`: Company Information page and footer link | Marketing-only, and describes the upstream company. |
| `98e5dd92` — Update docs translations | Marketing/docs-site translations for pages this fork does not publish. |
| `c6ee0ac9` — `docs`: fix the star history chart provider (#1124) | Upstream README marketing badge. |
| `88b5a37b` — Forward `.well-known` to backend in custom Nginx configuration (#1107) | Docs-only change to a self-hosting guide for an Nginx layout this fork does not ship — it deploys behind the repo's own `Caddyfile` / `docker-compose.yml`. |

**Adaptations required**

- `client/src/app/(home)/page.tsx` and `client/src/app/(home)/SiteCard.tsx` (#1130, #1121):
  this fork's `/` is a doorway that forwards to a site dashboard, with no site list
  and no time navigation, so upstream's `canGoBack` wiring and the `SiteCard` edits
  have nothing to apply to. Resolved to the fork's version; the other four toolbars
  that do carry the control took the fix.
- `client/src/api/gsc/gscDateRange.ts` (#1130 before #1121): the past-minutes fix
  landed on a module #1121 had not yet extracted. Applied to the fork's inline
  `getGSCDateRange`, then carried onto the extracted module when #1121 followed.
- AppSumo tests from #1125 (`server/src/lib/subscriptionUtils.test.ts`,
  `server/src/services/admin/subscriptionService.test.ts`, and cases in
  `client/src/lib/parsers.test.ts` / `client/src/lib/subscription/planUtils.test.tsx`):
  this fork removed the AppSumo integration (#18), so these cover symbols that no
  longer exist. The two server files are AppSumo-threaded throughout and were
  dropped; the two client files lost one import and two `it` blocks each.
- `docs/messages/*.json` from `37baf329`: dropped, since the only addition is
  the `Company information` key for the marketing page that was not ported.
- `server/public/script.js` / `script-full.js` regenerated — #1123 added a bot-signal
  bit without rebuilding the bundles this fork commits. The `_bsm` ingest bound is
  derived from `ALL_CLIENT_BOT_SIGNAL_BITS`, so bit 12 needed no schema change.

All four Swalha behaviors verified intact: `server/src/lib/auth.ts`,
`server/src/services/storage/`, `.github/workflows/docker-publish.yml`,
`docker-compose.yml` and `server/src/lib/email/` are byte-identical to `master`.

**Operational note — `session_replay_metadata_v2` needs a manual backfill**

`c65b3931` repoints replay metadata reads and writes at a new
`session_replay_metadata_v2` table. The application creates the table on boot, but
**does not migrate the existing rows**. Until an operator runs the backfill in
`clickhouse/REPLAY_METADATA_V2.md`, replays recorded before the deploy will have no
metadata (they will not appear in the session replay list). The backfill requires
`FINAL` and is **not idempotent** — running it twice doubles `event_count` and
`compressed_size_bytes` for every session. Plan the deploy and the backfill together.

**Gates run** (Node 24, matching the version this sync moves the images to):

- `shared`: `npm run build` — pass
- `server`: `npx tsc --noEmit` — pass
- `server`: `npx vitest run` — 102 files / 1592 tests pass (base `origin/master`: 87 files / 1223 tests)
- `server`: `npm run build` (tsc + analytics bundle) — pass; the regenerated bundles are
  committed, and a second build produces no further drift
- `client`: `npx tsc --noEmit` — pass
- `client`: `npm run lint` — pass
- `client`: `npx vitest run` — 14 files / 318 tests, 313 pass and 5 fail, all 5 in
  `src/lib/branding.test.ts` (base `origin/master`: 2 files / 50 tests, 43 pass and
  7 fail — the same 5 branding failures plus 2 in `src/lib/time.test.ts` that this
  sync fixes)

Two known failures, both **pre-existing on `origin/master`** and unrelated to this sync:

- `client/src/lib/branding.test.ts` — the same 5 assertions fail identically on
  `origin/master`. The fork's own branding guard is out of date with the recent
  footer/sidebar/SSO-login rework (`#19`, `#20`, `f3c2de7c`): the footer's upstream
  attribution string moved, and `src/app/login/page.tsx` no longer carries the
  deployment-origin link the test looks for. Worth a separate fix; not touched here.
- `client`: `npm run build` fails to resolve `@rybbit/shared` from
  `src/api/admin/hooks/useOrgApiKeys.ts` under Turbopack. Reproduced identically on
  `origin/master` with a clean `.next`, so it is not a regression from this sync.

The server suite also emits four unhandled `socket.destroySoon is not a function`
teardown errors from `@hono/node-server` in `src/mcp/mcp.test.ts`. Pre-existing noise;
the file passes in isolation.

### 2026-W33 — reviewed `0d0437cf1536..b858276f`

Five upstream commits since the baseline. No upstream release since `v2.8.0`
(2026-07-27, already in this fork) and no open GitHub security advisories on
`rybbit-io/rybbit`.

**Ported (4)**

| Upstream | Why |
| --- | --- |
| `8fc99175` — `refactor(analytics)`: one definition of the Site metrics (#1115) | Analytics accuracy. Bounce rate / unique users / breakdowns were transcribed three times (dashboard, PDF reports, weekly email) and had drifted. Consolidating into `services/siteMetrics` also fixes: PDF filters built without the period's time statement (session-level filters matched events outside the reported period and scanned full site history), the weekly report window compared via `toDateTime` in server-local time against UTC-formatted dates, and users double-counted when a pageview fired before `identify()` resolved. |
| `4ca4117a` — `refactor(tracker)`: resolve the Tracking Request once (#1118) | Ingestion reliability + performance + privacy. One `resolveTrackingRequest()` replaces seven modules independently mining the request, collapsing up to seven MaxMind lookups and two site-cache keys per event into one. Makes ingestion ordering explicit (exclusion → over-limit → bot detection → identity → enqueue) so an owner's excluded IP no longer drives anomaly counters. Fixes a UTC-day skew where `getDailySalt()` read the wall clock at hash time, so an event accepted at 23:59:59.9 could be fingerprinted with the next day's salt. |
| `b858276f` — `fix(tracker)`: one Bot Signal contract module (#1116) | Data loss + bot-detection correctness. The `_bsm` ingest schema capped at `.max(2047)` while the tracker emits `squareScreen = 1 << 11 = 2048`, so **any event carrying that bit was rejected with a 400 and dropped entirely**. Also fixes an anomaly-counter namespace split where `BotBlockingPayload.siteId` took the raw text identifier while the rest of ingestion used the numeric site id, letting one site occupy two counter namespaces. Moves the bit table, weights, bounds, and thresholds into `shared/src/botSignalContract.ts` shared by tracker and server. |
| `480da7e5` — `refactor(access)`: collapse org and site access checks (#1117) | Access-control correctness. The site access policy was written out twice with nothing forcing the two copies to agree. Two real fixes ride along: a restricted member's explicit grants are now scoped to organizations they actually belong to (a stale grant could previously surface a site from another org), and invitation site grants are re-validated at acceptance against `siteIdsInOrganization` (a site can move orgs or be deleted while an invite sits pending). Merged cleanly with the Swalha SSO block in `server/src/lib/auth.ts`. |

**Skipped (1)**

| Upstream | Why |
| --- | --- |
| `0ae17319` — `refactor(uptime)`: remove uptime monitoring components and API (#1114) | Upstream product-scope removal, not a fix. Deletes the entire uptime feature (~14k lines: monitors, incidents, notifications, regions, Twilio) plus the referrer-spam blocklist, and carries a destructive Drizzle migration (`0014_huge_dagger.sql`) that drops the uptime tables. Uptime was part of this fork's documented product surface (`PRODUCT.md`), and `CLAUDE.md` forbids running migrations. Not ported at sync time. **Superseded:** uptime has since been removed from this fork as a deliberate Swalha product decision (its own removal, not this port) — see the `drop_uptime` Drizzle migration. |

**Adaptations required:** none beyond the automatic merge in `server/src/lib/auth.ts`,
where upstream's `siteIdsInOrganization` import and invitation-acceptance re-validation
landed alongside the Swalha `genericOAuth` SSO plugin, `emailAndPassword.enabled: false`,
and trusted-provider account linking. All four Swalha behaviors above verified intact;
R2 storage, GHCR image names, and `.github/` workflows were untouched by the ports.

**Gates run** (`server/` and `shared/` only — no client or infra files changed):

- `shared`: `npm run build` — pass
- `server`: `npx tsc --noEmit` — pass
- `server`: `npx vitest run` — 88 files / 1282 tests pass (base `origin/master`: 82 files / 1202 tests)
- `server`: `npm run build` (tsc + analytics bundle) — pass, no drift in the committed
  `server/public/script.js` / `script-full.js`

One unhandled teardown error in `src/mcp/mcp.test.ts`
(`socket.destroySoon is not a function`, from `@hono/node-server` on Node 22) appears in
the full parallel run. It is pre-existing and unrelated: `origin/master` produces five of
them, this branch one, and the file passes cleanly in isolation on both.
