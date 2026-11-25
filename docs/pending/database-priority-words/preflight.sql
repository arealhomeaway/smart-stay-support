SELECT md5(pg_get_functiondef('public.run_ticket_timed_alerts()'::regprocedure)) AS current_definition_md5;
