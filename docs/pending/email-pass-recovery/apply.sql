-- Email pass recovery (Nov 16, approved by the Admin, built live).
-- 1. A pass that finds an open run older than 10 minutes closes it as failed, writes an audit row,
--    and continues. A run younger than 10 minutes is never closed and still blocks a new pass.
-- 2. If no pass has finished normally for 30 minutes, every Admin gets one in-app bell notice per
--    outage (never emailed); it is retracted when a pass finishes again.
-- Additive: one column, one table, one new private function, begin_email_job_run replaced.
-- Unchanged: record_email_job_part, finish_email_job_run, the schedule, every email part.

ALTER TABLE public.email_job_runs ADD COLUMN IF NOT EXISTS closed_reason text;
COMMENT ON COLUMN public.email_job_runs.closed_reason IS
  'Why a run was closed without finishing (automatically after 10 minutes, or by staff). NULL when the pass finished itself.';
-- Backfill: runs closed by staff before this change.
UPDATE public.email_job_runs SET closed_reason = errors->>0
 WHERE closed_reason IS NULL AND finished_at IS NOT NULL AND errors::text LIKE '%Closed by %';

CREATE TABLE IF NOT EXISTS public.email_pass_outages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_success_at timestamptz,
  noticed_at timestamptz NOT NULL DEFAULT now(),
  notified integer NOT NULL DEFAULT 0,
  cleared_at timestamptz
);
GRANT ALL ON public.email_pass_outages TO service_role;
ALTER TABLE public.email_pass_outages ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS email_pass_outages_one_open
  ON public.email_pass_outages ((true)) WHERE cleared_at IS NULL;

CREATE OR REPLACE FUNCTION private.email_pass_health_check()
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE last_ok timestamptz; first_run timestamptz; open_id uuid; outage uuid; n integer := 0; msg text;
BEGIN
  PERFORM pg_advisory_xact_lock(82401021);
  SELECT max(finished_at) INTO last_ok FROM public.email_job_runs
   WHERE finished_at IS NOT NULL AND closed_reason IS NULL;
  SELECT id INTO open_id FROM public.email_pass_outages WHERE cleared_at IS NULL;
  IF last_ok IS NOT NULL AND last_ok >= now() - interval '30 minutes' THEN
    IF open_id IS NOT NULL THEN
      UPDATE public.email_pass_outages SET cleared_at = now() WHERE id = open_id;
      UPDATE public.staff_notifications SET retracted_at = now(), retracted_reason = 'Emails are going out again.'
       WHERE kind = 'email_pass_outage' AND entity_id = open_id AND retracted_at IS NULL;
      INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_id, entity_label, reason)
      VALUES (NULL, 'Email pass (automatic)', 'email_pass_outage_cleared', 'email_pass_outage', open_id,
              'Email outage', 'A pass finished again; the Admin notice was cleared.');
      RETURN 'cleared';
    END IF;
    RETURN 'ok';
  END IF;
  IF open_id IS NOT NULL THEN RETURN 'already_noticed'; END IF;
  IF last_ok IS NULL THEN
    SELECT min(started_at) INTO first_run FROM public.email_job_runs;
    IF first_run IS NULL OR first_run >= now() - interval '30 minutes' THEN RETURN 'ok'; END IF;
  END IF;
  msg := 'Emails have not gone out since '
      || to_char(coalesce(last_ok, first_run) AT TIME ZONE 'America/Chicago', 'FMMon FMDD, FMHH12:MI AM') || ' Central';
  INSERT INTO public.email_pass_outages(last_success_at) VALUES (last_ok) RETURNING id INTO outage;
  INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, priority, email_status)
  SELECT DISTINCT ur.user_id, 'email_pass_outage', msg, '', 'email_pass_outage', outage, 'high', 'none'
    FROM public.user_roles ur WHERE ur.role = 'admin';
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.email_pass_outages SET notified = n WHERE id = outage;
  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_id, entity_label, reason)
  VALUES (NULL, 'Email pass (automatic)', 'email_pass_outage_noticed', 'email_pass_outage', outage,
          'Email outage', msg || '. In-app notice to ' || n || ' Admin role holders.');
  RETURN 'noticed';
END $function$;
REVOKE ALL ON FUNCTION private.email_pass_health_check() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.begin_email_job_run()
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE result uuid; r record;
  why constant text := 'Closed automatically: run did not finish within 10 minutes';
BEGIN
 PERFORM pg_advisory_xact_lock(82401020);
 FOR r IN SELECT id, started_at FROM public.email_job_runs
           WHERE finished_at IS NULL AND started_at < now() - interval '10 minutes' FOR UPDATE LOOP
   UPDATE public.email_job_runs SET finished_at = now(), closed_reason = why,
          errors = coalesce(errors, '[]'::jsonb) || to_jsonb(why)
    WHERE id = r.id AND finished_at IS NULL;
   INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
   VALUES (NULL, 'Email pass (automatic)', 'email_job_run_closed', 'email_job_run', r.id,
           'Run started ' || to_char(r.started_at AT TIME ZONE 'America/Chicago', 'FMMon FMDD, FMHH12:MI AM') || ' Central',
           why, jsonb_build_object('finished_at', NULL), jsonb_build_object('finished_at', now(), 'closed_reason', why));
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.email_job_runs WHERE finished_at IS NULL) THEN
   RAISE EXCEPTION 'An unfinished email run exists; staff review required, never automatic retry';
 END IF;
 BEGIN
   PERFORM private.email_pass_health_check();
 EXCEPTION WHEN OTHERS THEN
   RAISE WARNING 'email pass health check failed: %', SQLERRM;
 END;
 INSERT INTO public.email_job_runs DEFAULT VALUES RETURNING id INTO result; RETURN result;
END $function$;
REVOKE ALL ON FUNCTION public.begin_email_job_run() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_email_job_run() TO service_role;
