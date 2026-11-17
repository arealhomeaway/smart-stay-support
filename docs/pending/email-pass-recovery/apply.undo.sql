-- Undo for email-pass-recovery: restores begin_email_job_run exactly as read live Nov 16 and
-- removes the health check. Keeps the closed_reason column and email_pass_outages table (nothing deleted),
-- marked retired. Open outage notices are retracted so none is left in the bell.
CREATE OR REPLACE FUNCTION public.begin_email_job_run()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE result uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(82401020);
 IF EXISTS(SELECT 1 FROM public.email_job_runs WHERE finished_at IS NULL) THEN
   RAISE EXCEPTION 'An unfinished email run exists; staff review required, never automatic retry';
 END IF;
 INSERT INTO public.email_job_runs DEFAULT VALUES RETURNING id INTO result; RETURN result;
END $function$;
REVOKE ALL ON FUNCTION public.begin_email_job_run() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_email_job_run() TO service_role;
DROP FUNCTION IF EXISTS private.email_pass_health_check();
UPDATE public.staff_notifications SET retracted_at = now(), retracted_reason = 'Email outage notice removed (undo).'
 WHERE kind = 'email_pass_outage' AND retracted_at IS NULL;
UPDATE public.email_pass_outages SET cleared_at = now() WHERE cleared_at IS NULL;
COMMENT ON TABLE public.email_pass_outages IS 'DEPRECATED: email-pass-recovery undone';
COMMENT ON COLUMN public.email_job_runs.closed_reason IS 'DEPRECATED: email-pass-recovery undone';
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'migration_undone', 'migration', 'email-pass-recovery',
        'Restored the email pass start step without automatic recovery or outage notice.');
