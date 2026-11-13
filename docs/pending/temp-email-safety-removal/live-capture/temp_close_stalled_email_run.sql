-- Live copy of private.temp_close_stalled_email_run() read Nov 13 (pg_get_functiondef).
CREATE OR REPLACE FUNCTION private.temp_close_stalled_email_run()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE r record; n int := 0;
BEGIN
  -- TEMPORARY (Nov 12 to Nov 13, approved by the COO so the PID copy runs tonight): a run with no
  -- finish after 15 minutes and no email activity for 10 minutes is closed with a note. Remove on Nov 13.
  FOR r IN SELECT id FROM public.email_job_runs WHERE finished_at IS NULL AND started_at < now() - interval '15 minutes'
           AND NOT EXISTS (SELECT 1 FROM public.email_log l WHERE l.email_job_run_id = email_job_runs.id AND l.created_at > now() - interval '10 minutes') LOOP
    PERFORM public.finish_email_job_run(r.id, '["Closed automatically overnight Nov 12: the run stopped without finishing (temporary safety for the PID copy)."]'::jsonb);
    INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
    VALUES ('98bd6696-4018-4965-b645-0471c5ae3925','COO (temporary rule)','email_job_run_closed','email_job_run', r.id::text, 'Stalled run closed by the temporary overnight safety.');
    n := n + 1;
  END LOOP;
  RETURN n;
END $function$
;
