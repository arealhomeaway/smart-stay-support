SELECT to_regclass('public.owner_work_saves') AS receipts;
SELECT count(*), md5(string_agg(e::text,'|' ORDER BY id)) AS fingerprint FROM public.owner_time_entries e WHERE NOT is_demo;
SELECT md5(pg_get_functiondef('public.log_owner_time_entry(jsonb,uuid[])'::regprocedure)) AS logging_definition;
