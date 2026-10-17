// The tables custom analytics SQL may read. Both are CTEs prepended to every
// custom query, so user SQL never names `events` itself and site scoping can't
// be bypassed. Both runners (the Query page and dashboard cards) share these
// definitions so the two surfaces never drift apart.
//
// scoped_events — every event of the allowed sites. Dashboard cards clip it to
// the selected time range as well; the Query page does not.
//
// scoped_users — one row per (site_id, user_id) over the site's whole history,
// never clipped to a time range. It exists for the questions the clipped view
// cannot answer, above all "is this user new?": that needs the first event the
// site ever saw from them, not the first one inside the selected range. A card
// counts new users as those whose first_seen falls inside the range of
// scoped_events, so an all-time table beside the clipped one is what makes
// that join possible. ClickHouse only evaluates a CTE where it is referenced,
// so queries that never mention scoped_users pay nothing for it.
export const SCOPED_TABLE_NAMES = ["scoped_events", "scoped_users"] as const;

// Expects a `siteIds` Array(UInt16) query parameter, like scoped_events does.
export const SCOPED_USERS_CTE = `
    scoped_users AS (
      SELECT
        site_id,
        user_id,
        min(timestamp) AS first_seen,
        max(timestamp) AS last_seen,
        countDistinct(session_id) AS session_count,
        count() AS event_count,
        argMin(country, timestamp) AS first_country,
        argMin(operating_system, timestamp) AS first_operating_system,
        argMin(device_type, timestamp) AS first_device_type
      FROM events
      PREWHERE site_id IN {siteIds:Array(UInt16)}
      WHERE user_id != ''
      GROUP BY site_id, user_id
    )`;
