# Upstream Sync

This repository is an AGPL hard fork of [rybbit-io/rybbit](https://github.com/rybbit-io/rybbit).
Upstream changes are reviewed weekly and selectively ported onto `master`.

Swalha-specific behavior that must survive every sync:

- **Self-hosted Cloudflare R2 replay storage** activated by the presence of
  `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` (not by `CLOUD=true`).
- **Organization-scoped GHCR image names** —
  `ghcr.io/<org>/swalha-analytics-{backend,client}`.
- **SSO-only authentication** against the central SWALHA identity provider
  (email/password disabled, account linking by verified email).
- **SWALHA branding** across client, emails, and PDF report templates.

## Last reviewed upstream SHA

`5b94f2ff39f32cda14541d07f97e0717b0674a0b` (2026-08-31)

Baseline before the first recorded sync: `0d0437cf1536`.

## Log

### 2026-W36 — reviewed `64f8c4fb..5b94f2ff`

Twenty-nine upstream commits. No upstream release since `v2.8.0` (2026-07-27)
and no open GitHub security advisories on `rybbit-io/rybbit` at review time.

**Ported (13)**

| Upstream | Why |
| --- | --- |
| `f307375a` / `a0b34258` | Access-cache correctness after site creation; analytics accuracy by retaining untitled pages. |
| `1404cb1c` | Session-level filters now select sessions once and consistently constrain analytics, funnels, goals, experiments, reports, and site metrics. |
| `b5a93f8a` / `7a97e468` | Replaces the key-dependent CARTO map with OpenFreeMap; resolves replay click labels against the snapshot active when the click occurred. |
| `66e0cffa` / `5b94f2ff` | Preserves millisecond event ordering across ingestion, funnels, sessions, goals, and metric queries. |
| `e7ef9790` | Hardens custom SQL validation, uses a least-privilege ClickHouse query user, and rate-limits user-authored/generated queries. |
| `05ee87a7` | Prevents stale dashboard state and lost edits with optimistic updates and rollback. |
| `9aacb4f2` / `534f3f42` | Adds site-relative flood detection while excluding residential-volume false positives. |
| `6c73cc8d` | Refreshes the committed GeoLite2 City and ASN databases. |
| `efd3e80c` | Adds coverage for client query utilities, onboarding, and R2 replay storage; normalizes onboarding schedule milliseconds. The deleted member-access endpoint/test and absent teams API tests were not restored because organization synchronization is Auth-owned in this fork. |

**Skipped (16)**

| Upstream | Why |
| --- | --- |
| `04da28fb`, `1d06afbf`, `73b2bf8b` | Upstream docs-site/agent-readiness, hosted privacy-copy, and documentation cleanup; not runtime fixes for the fork. |
| `873009a6` | Rybbit frog-avatar branding, intentionally excluded from Swalha. |
| `15050fa7`, `6e6618ed` | Bulk translations coupled to excluded upstream UI and hosted admin/subscription management. |
| `02d6caa5`, `e2cdffef`, `30d98e11`, `6c3a980f` | Product/UI feature work (trait editor and date/comparison redesign), outside this sync's security/correctness scope. |
| `5ab683c6` | Hosted subscription-source presentation. |
| `47929755` | Large AI-bot dashboard/product expansion; useful but not required for the ingestion fixes selected this week and too broad for a correctness-only port. |
| `71b0f30d` | Cosmetic sidebar refactor with no fork-relevant fix. |
| `940eb108` | Upstream deployment branding/config flag; the fork already owns deployment and branding behavior. |
| `98aabf8d` | Upstream marketing landing-page experiments and pricing content. |
| `0e700aa2` | Lockfile-only cleanup with no runtime or security change. |

**Adaptations required**

- `getOverviewBucketed.ts` retains the fork's invalid-bucket `400` validation while
  adopting the session-filter CTE.
- The OpenFreeMap port keeps the fork's newer OpenLayers `^10.10.0` dependency.
- `pageviewQueue.ts` retains the fork's ASN diagnostic fields while combining the
  flood-detection error boundary with the new `timestamp_ms` column.
- Query hardening retains the Swalha organization-overview route. The least-privilege
  query-user configuration is additive and does not alter R2 credential activation.
- The member-access update and its test from `efd3e80c` were dropped because that
  endpoint was deliberately removed when organization membership became Auth-owned;
  its tests for the absent upstream teams API were dropped for the same reason. The
  R2 initialization test now asserts the fork's credential-gated behavior.

The R2 credential-gated storage path, organization-scoped GHCR names, SSO/Auth-owned
organization behavior, and Swalha branding were reviewed after the ports and remain
fork-owned.

**Gates run**

- `shared`: `npm run build` — pass.
- `server`: `npx tsc --noEmit` — pass.
- `server`: targeted Vitest command for analytics/session filters, ClickHouse query
  hardening, flood detection, pageview ingestion, site metrics, and R2 storage —
  12 files / 193 tests pass.
- `server`: `npm run test:run` — 115 files / 1,678 tests pass; 40 assertions in the
  unchanged `src/lib/auth-utils.test.ts` fail because its PGlite fixture lacks the
  pre-existing `sites.overview_layout` column already present on `origin/master`.
- `server`: `npm run build` — pass; analytics bundles have no resulting drift.
- `server`: Prettier check over every changed server source file — pass. The repository-wide
  `npm run format:check` also reports unchanged pre-existing formatting failures.
- `client`: `npx tsc --noEmit` and `npm run lint` — pass (ESLint warns that the repo's
  config is empty).
- `client`: targeted Vitest command — 6 files / 50 tests pass; `npm test` — 21 files /
  370 tests pass.
- `client`: `npm run build` reaches Turbopack and fails on the unchanged
  `src/api/admin/hooks/useOrgApiKeys.ts` import of the local `@rybbit/shared` package,
  the same pre-existing failure documented in 2026-W34.

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
