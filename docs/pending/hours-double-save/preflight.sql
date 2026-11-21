-- hours-double-save: preflight (read only). Every row must say ok = true before apply.
-- Run after homeowner-reopen is applied: it needs the Edit and Add more action.
SELECT 'Log hours action is the one captured Nov 21' AS check,
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.log_owner_time_entry(jsonb,uuid[])'::regprocedure) = 'eebeaa3064236750e229914ce101b3af' AS ok
UNION ALL SELECT 'Edit and Add more action is the homeowner-reopen one',
  coalesce((SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.owner_update_time_entry(uuid,jsonb)')) = 'f360b0cfed229f21574863e160365db7', false)
UNION ALL SELECT 'the rule does not exist yet', to_regprocedure('private.owner_time_recent_repeat(uuid,uuid,date,integer,text,text,uuid)') IS NULL;
