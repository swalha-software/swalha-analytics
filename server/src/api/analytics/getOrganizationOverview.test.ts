import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted: vi.mock factories run before the module body.
const { queryMock, getSitesUserHasAccessToMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  getSitesUserHasAccessToMock: vi.fn(),
}));

vi.mock("../../db/clickhouse/clickhouse.js", () => ({
  clickhouse: { query: queryMock },
}));
vi.mock("../../db/postgres/postgres.js", () => ({
  db: {},
}));
vi.mock("../../lib/auth-utils.js", () => ({
  getSitesUserHasAccessTo: getSitesUserHasAccessToMock,
}));

import {
  buildOrganizationSeriesQuery,
  buildOrganizationTotalsQuery,
  getOrganizationOverview,
  previousTimeWindow,
  sumSiteTotals,
  toOverviewMetrics,
  type OrganizationOverviewResponse,
  type SiteSeriesRow,
  type SiteTotalsRow,
} from "./getOrganizationOverview.js";

const ORG = "org_1";
const OTHER_ORG = "org_2";

const site = (siteId: number, overrides: Record<string, unknown> = {}) => ({
  siteId,
  name: `site-${siteId}`,
  domain: `site${siteId}.example`,
  type: "web",
  organizationId: ORG,
  ...overrides,
});

const totalsRow = (site_id: number, overrides: Partial<SiteTotalsRow> = {}): SiteTotalsRow => ({
  site_id,
  sessions: 10,
  pageviews: 30,
  users: 8,
  bounced_sessions: 2,
  total_session_duration: 600,
  ...overrides,
});

const seriesRow = (site_id: number, time: string, overrides: Partial<SiteSeriesRow> = {}): SiteSeriesRow => ({
  site_id,
  time,
  users: 1,
  sessions: 1,
  pageviews: 1,
  ...overrides,
});

/** Queue of result sets, handed out in the order the handler issues its queries. */
function queueResults(...resultSets: unknown[][]) {
  queryMock.mockReset();
  let call = 0;
  queryMock.mockImplementation(async () => {
    const rows = resultSets[call] ?? [];
    call += 1;
    return { json: async () => rows };
  });
}

function fakeReply() {
  const captured: { statusCode: number; payload: unknown } = { statusCode: 200, payload: undefined };
  const reply = {
    status(code: number) {
      captured.statusCode = code;
      return reply;
    },
    send(payload: unknown) {
      captured.payload = payload;
      return reply;
    },
  };
  return { reply, captured };
}

async function callHandler(query: Record<string, unknown> = {}, organizationId = ORG) {
  const { reply, captured } = fakeReply();
  const req = {
    params: { organizationId },
    query,
    log: { error: vi.fn(), debug: vi.fn() },
  };
  await getOrganizationOverview(req as any, reply as any);
  return captured;
}

const DATE_WINDOW = { start_date: "2026-07-17", end_date: "2026-07-23", time_zone: "UTC", bucket: "day" };

beforeEach(() => {
  queueResults();
  getSitesUserHasAccessToMock.mockReset();
  getSitesUserHasAccessToMock.mockResolvedValue([]);
});

describe("previousTimeWindow", () => {
  it("steps a date range back by its own inclusive length", () => {
    expect(previousTimeWindow({ start_date: "2026-07-17", end_date: "2026-07-23", time_zone: "UTC" })).toEqual({
      start_date: "2026-07-10",
      end_date: "2026-07-16",
      time_zone: "UTC",
    });
  });

  it("steps a past-minutes window back by its own length", () => {
    expect(previousTimeWindow({ past_minutes_start: 60, past_minutes_end: 0 })).toEqual({
      past_minutes_start: 120,
      past_minutes_end: 60,
      time_zone: undefined,
    });
  });

  it("leaves an all-time request alone: there is no period before all of time", () => {
    expect(previousTimeWindow({ time_zone: "UTC" })).toEqual({ time_zone: "UTC" });
  });
});

describe("organization totals arithmetic", () => {
  it("weights bounce rate by sessions instead of averaging the sites' percentages", () => {
    // 1000 sessions at 10% and 10 sessions at 100%: the flat mean of the two
    // percentages is 55%, which lets a site with a thousandth of the traffic
    // drag the organization's headline number up by 45 points.
    const busy = { sessions: 1000, pageviews: 4000, users: 700, bounced_sessions: 100, total_session_duration: 100000 };
    const tiny = { sessions: 10, pageviews: 10, users: 9, bounced_sessions: 10, total_session_duration: 50 };

    const metrics = toOverviewMetrics(sumSiteTotals([busy, tiny]));

    expect(metrics.bounceRate).toBeCloseTo((110 / 1010) * 100, 10);
    expect(metrics.bounceRate).not.toBeCloseTo(55, 1);
  });

  it("weights average session duration by sessions", () => {
    const busy = { sessions: 1000, pageviews: 4000, users: 700, bounced_sessions: 100, total_session_duration: 100000 };
    const tiny = { sessions: 10, pageviews: 10, users: 9, bounced_sessions: 10, total_session_duration: 50 };

    const metrics = toOverviewMetrics(sumSiteTotals([busy, tiny]));

    expect(metrics.avgSessionDuration).toBeCloseTo(100050 / 1010, 10);
  });

  it("sums the countable metrics", () => {
    const metrics = toOverviewMetrics(sumSiteTotals([totalsRow(1), totalsRow(2)]));

    expect(metrics.sessions).toBe(20);
    expect(metrics.pageviews).toBe(60);
    // Identity is per-site, so a visitor to two sites counts on both.
    expect(metrics.users).toBe(16);
  });

  it("reports zeros rather than NaN for a window with no sessions", () => {
    const metrics = toOverviewMetrics(sumSiteTotals([]));

    expect(metrics).toEqual({ users: 0, sessions: 0, pageviews: 0, bounceRate: 0, avgSessionDuration: 0 });
  });
});

describe("query building", () => {
  it("binds every site in one query rather than one query per site", () => {
    const sql = buildOrganizationTotalsQuery({ start_date: "2026-07-17", end_date: "2026-07-23" }, [4, 9, 11]);

    expect(sql).toContain("site_id IN (4, 9, 11)");
    expect(sql).toContain("GROUP BY site_id");
  });

  it("keys sessions per site, since session ids are only unique within a site", () => {
    const sql = buildOrganizationTotalsQuery({}, [1, 2]);

    expect(sql).toContain("GROUP BY site_id, session_id");
  });

  it("counts users by identity, falling back to the device fingerprint", () => {
    const sql = buildOrganizationSeriesQuery(DATE_WINDOW, [1], "day");

    expect(sql).toContain("COUNT(DISTINCT COALESCE(NULLIF(identified_user_id, ''), user_id)) AS users");
  });

  it("gap-fills each site's buckets independently", () => {
    const sql = buildOrganizationSeriesQuery(DATE_WINDOW, [1, 2], "day");

    expect(sql).toContain("ORDER BY site_id, time WITH FILL FROM");
    expect(sql).toContain("STEP INTERVAL 1 DAY");
  });
});

describe("access intersection", () => {
  it("reports only the granted sites of a restricted member, and queries only those", async () => {
    // getSitesUserHasAccessTo has already applied the member's site grants: of
    // the organization's sites this member reaches 2 and 7 only, and site 5
    // belongs to an organization they are not asking about.
    getSitesUserHasAccessToMock.mockResolvedValue([site(7), site(2), site(5, { organizationId: OTHER_ORG })]);
    queueResults([totalsRow(2), totalsRow(7)], [totalsRow(2)], [], []);

    const captured = await callHandler(DATE_WINDOW);
    const body = captured.payload as OrganizationOverviewResponse;

    expect(captured.statusCode).toBe(200);
    expect(body.sites.map(entry => entry.siteId)).toEqual([2, 7]);

    // Every site list interpolated into SQL, across all four queries.
    const boundSiteLists = queryMock.mock.calls.flatMap(call =>
      [...String(call[0].query).matchAll(/site_id IN \(([^)]*)\)/g)].map(match => match[1])
    );
    expect(boundSiteLists.length).toBeGreaterThan(0);
    expect(new Set(boundSiteLists)).toEqual(new Set(["2, 7"]));
  });

  it("never lets an ungranted site into the organization totals", async () => {
    getSitesUserHasAccessToMock.mockResolvedValue([site(2)]);
    // A row for site 5 could only arrive from a query we did not ask for, but
    // the totals must be built from the caller's site list regardless.
    queueResults([totalsRow(2, { sessions: 4 }), totalsRow(5, { sessions: 999 })], [], [], []);

    const body = (await callHandler(DATE_WINDOW)).payload as OrganizationOverviewResponse;

    expect(body.totals.current.sessions).toBe(4);
  });

  it("answers an empty intersection with zeroed totals rather than an error", async () => {
    getSitesUserHasAccessToMock.mockResolvedValue([site(5, { organizationId: OTHER_ORG })]);

    const captured = await callHandler(DATE_WINDOW);
    const body = captured.payload as OrganizationOverviewResponse;

    expect(captured.statusCode).toBe(200);
    expect(body).toEqual({
      sites: [],
      totals: {
        current: { users: 0, sessions: 0, pageviews: 0, bounceRate: 0, avgSessionDuration: 0 },
        previous: { users: 0, sessions: 0, pageviews: 0, bounceRate: 0, avgSessionDuration: 0 },
        series: [],
        previousSeries: [],
      },
    });
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe("the response", () => {
  it("costs four ClickHouse queries however many sites the caller can reach", async () => {
    getSitesUserHasAccessToMock.mockResolvedValue([site(1), site(2), site(3), site(4), site(5)]);
    queueResults([], [], [], []);

    await callHandler(DATE_WINDOW);

    expect(queryMock).toHaveBeenCalledTimes(4);
  });

  it("rejects a bucket that is not a bucket", async () => {
    getSitesUserHasAccessToMock.mockResolvedValue([site(1)]);

    const captured = await callHandler({ ...DATE_WINDOW, bucket: "toStartOfDay(now())" });

    expect(captured.statusCode).toBe(400);
    expect(captured.payload).toEqual({ error: "Invalid bucket parameter" });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("carries the site's identity and both periods' metrics", async () => {
    getSitesUserHasAccessToMock.mockResolvedValue([site(1, { type: "mobile" })]);
    queueResults(
      [totalsRow(1, { sessions: 10, bounced_sessions: 3, total_session_duration: 900 })],
      [totalsRow(1, { sessions: 5, bounced_sessions: 1, total_session_duration: 100 })],
      [seriesRow(1, "2026-07-17 00:00:00")],
      [seriesRow(1, "2026-07-10 00:00:00")]
    );

    const body = (await callHandler(DATE_WINDOW)).payload as OrganizationOverviewResponse;

    expect(body.sites[0]).toMatchObject({
      siteId: 1,
      name: "site-1",
      domain: "site1.example",
      type: "mobile",
    });
    expect(body.sites[0].current.bounceRate).toBe(30);
    expect(body.sites[0].current.avgSessionDuration).toBe(90);
    expect(body.sites[0].previous.bounceRate).toBe(20);
    expect(body.totals.previousSeries).toEqual([{ time: "2026-07-10 00:00:00", users: 1, sessions: 1, pageviews: 1 }]);
  });

  it("gives a site with no traffic the same filled grid, zeroed", async () => {
    getSitesUserHasAccessToMock.mockResolvedValue([site(1), site(2)]);
    queueResults(
      [totalsRow(1)],
      [],
      // WITH FILL emits every bucket for site 1; site 2 has no rows at all.
      [seriesRow(1, "2026-07-17 00:00:00", { users: 3 }), seriesRow(1, "2026-07-18 00:00:00", { users: 4 })],
      []
    );

    const body = (await callHandler(DATE_WINDOW)).payload as OrganizationOverviewResponse;
    const quiet = body.sites.find(entry => entry.siteId === 2)!;

    expect(quiet.series.map(point => point.time)).toEqual(["2026-07-17 00:00:00", "2026-07-18 00:00:00"]);
    expect(quiet.series.every(point => point.users === 0 && point.sessions === 0 && point.pageviews === 0)).toBe(true);
    expect(quiet.current).toEqual({ users: 0, sessions: 0, pageviews: 0, bounceRate: 0, avgSessionDuration: 0 });
    expect(body.totals.series.map(point => point.users)).toEqual([3, 4]);
  });

  it("ignores the site-id-0 grid rows the fill emits when nothing matched", async () => {
    getSitesUserHasAccessToMock.mockResolvedValue([site(1)]);
    queueResults([], [], [seriesRow(0, "2026-07-17 00:00:00", { users: 0 })], []);

    const body = (await callHandler(DATE_WINDOW)).payload as OrganizationOverviewResponse;

    expect(body.sites).toHaveLength(1);
    expect(body.sites[0].series).toEqual([{ time: "2026-07-17 00:00:00", users: 0, sessions: 0, pageviews: 0 }]);
    expect(body.totals.current.sessions).toBe(0);
  });
});
