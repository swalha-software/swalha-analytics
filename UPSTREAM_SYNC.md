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

`b858276fc8a7806f8ab4c6d1e7684217a8c1e88a` (2026-08-15)

Baseline before the first recorded sync: `0d0437cf1536`.

## Log

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
| `0ae17319` — `refactor(uptime)`: remove uptime monitoring components and API (#1114) | Upstream product-scope removal, not a fix. Deletes the entire uptime feature (~14k lines: monitors, incidents, notifications, regions, Twilio) plus the referrer-spam blocklist, and carries a destructive Drizzle migration (`0014_huge_dagger.sql`) that drops the uptime tables. Uptime is part of this fork's documented product surface (`PRODUCT.md`), and `CLAUDE.md` forbids running migrations. Not ported; revisit only as a deliberate Swalha product decision. |

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
