-- Read only. Source creation for Notion is reported_at;
-- its retained import timestamp is created_at, not external_synced_at.
-- Non-Notion creation uses created_at. Central go-live = 2026-11-16 06:00 UTC.
WITH classified AS (
  SELECT t.*, CASE
    WHEN external_source = 'notion'
      AND reported_at >= created_at - interval '30 days'
      THEN CASE WHEN import_hold IS NULL THEN 'A' ELSE 'Recent held, outside A-E' END
    WHEN external_source = 'notion'
      THEN CASE WHEN import_hold IS NULL THEN 'C' ELSE 'B' END
    WHEN created_at < '2026-11-16 00:00:00 America/Chicago'::timestamptz THEN 'D'
    ELSE 'E' END AS group_name
  FROM public.tickets t
  WHERE status IN ('open','dispatched','in_progress','waiting','awaiting_guest')
    AND archived_at IS NULL AND NOT is_demo
)
SELECT group_name, count(*) AS open,
  count(*) FILTER (WHERE assigned_to IS NULL AND current_action_owner IS NULL) AS unassigned,
  count(*) FILTER (WHERE import_hold = 'backlog_review') AS backlog_review,
  count(*) FILTER (WHERE import_hold = 'needs_home') AS needs_home
FROM classified GROUP BY group_name ORDER BY group_name;