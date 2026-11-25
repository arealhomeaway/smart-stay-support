-- Read only. Expect: no hours report tables yet, ao_owner_email_run matches run_old.sql, 6 live programs.
SELECT to_regclass('public.ao_hours_reports') IS NULL AS no_table_yet;
SELECT md5(pg_get_functiondef('public.ao_owner_email_run(timestamptz)'::regprocedure)) AS run_md5;
SELECT count(*) AS live_programs FROM public.owner_programs WHERE NOT is_demo AND status NOT IN ('closed','archived') AND archived_at IS NULL;
