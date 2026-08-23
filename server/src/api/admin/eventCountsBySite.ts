import { DateTime } from "luxon";
import { clickhouse } from "../../db/clickhouse/clickhouse.js";
import { IS_CLOUD } from "../../lib/const.js";

// Events per site in a window. Cloud deployments keep the hourly aggregate
// materialized view (schema/cloud.ts); self-hosted ones never create it, so
// count straight from `events` — the volumes there make that cheap.
export async function eventCountsBySite(from: DateTime, to: DateTime): Promise<Map<number, number>> {
  const fromSql = from.toFormat("yyyy-MM-dd HH:mm:ss");
  const toSql = to.toFormat("yyyy-MM-dd HH:mm:ss");
  const query = IS_CLOUD
    ? `SELECT site_id, sum(event_count) AS total_events FROM hourly_events_by_site_mv_target
       WHERE event_hour >= toDateTime('${fromSql}') AND event_hour <= toDateTime('${toSql}') GROUP BY site_id`
    : `SELECT site_id, count() AS total_events FROM events
       WHERE timestamp >= toDateTime('${fromSql}') AND timestamp <= toDateTime('${toSql}') GROUP BY site_id`;
  const result = await clickhouse.query({ query, format: "JSONEachRow" });
  const rows = (await result.json()) as { site_id: number; total_events: number | string }[];
  return new Map(rows.map(r => [Number(r.site_id), Number(r.total_events)]));
}
