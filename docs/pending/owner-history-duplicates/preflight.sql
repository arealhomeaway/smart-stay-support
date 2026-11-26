-- Read-only preflight. Expected before apply: zero archive columns, 203 real entries, and the reviewed function hashes.
SELECT count(*)::int AS archive_columns
FROM information_schema.columns
WHERE table_schema='public' AND table_name='owner_time_entries'
  AND column_name IN ('archived_at','archived_by','archive_reason');

SELECT count(*)::int AS real_entries,
  md5(coalesce(string_agg(id::text||'|'||entry_date::text||'|'||minutes::text||'|'||activity||'|'||coalesce(amends_entry_id::text,''),',' ORDER BY id),'')) AS real_entry_fingerprint
FROM public.owner_time_entries WHERE NOT is_demo;

SELECT
  md5(pg_get_functiondef('public.read_owner_work_history(uuid)'::regprocedure)) AS history_hash,
  md5(pg_get_functiondef('public.read_owner_participation(text,uuid,boolean,uuid)'::regprocedure)) AS participation_hash,
  md5(pg_get_functiondef('private.owner_time_recent_repeat(uuid,uuid,date,integer,text,text,uuid)'::regprocedure)) AS repeat_hash,
  md5(pg_get_functiondef('public.owner_update_time_entry(uuid,jsonb)'::regprocedure)) AS update_hash,
  md5(pg_get_functiondef('public.guard_owner_time_write()'::regprocedure)) AS guard_hash;

-- Expected Nov 26: history c791d1da218fd4a645e2e45261c4b911; participation 9876781e186ac19a63bc4321d2343f66;
-- repeat abef5c9a85260e9ece665847f8f8d14b; update 700d1081ba23e554160ad3ba793432bc.
-- Guard before finish.sql: 8d8f39084d56dc02f75c872b8d115a99.
-- Expected real-entry fingerprint: 1df7ed5e54acc116b04faae6f73a7ea2.
