-- PREPARED ONLY. Requires a privileged transaction-capable runner, stop on error and always rollback/disconnect. Never run through migration tooling.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
-- NOT APPLIED. Adds audit storage; needs release approval, never applies a schedule.
CREATE TABLE public.email_job_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz, parts jsonb NOT NULL DEFAULT '{}', email_counts jsonb NOT NULL DEFAULT '{}',
 errors jsonb NOT NULL DEFAULT '[]'
);
GRANT ALL ON public.email_job_runs TO service_role;
ALTER TABLE public.email_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS email_job_run_id uuid REFERENCES public.email_job_runs(id);
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS email_job_part text;
ALTER TABLE public.owner_notifications ADD COLUMN IF NOT EXISTS email_job_run_id uuid REFERENCES public.email_job_runs(id);
CREATE OR REPLACE FUNCTION public.begin_email_job_run() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(82401020);
 IF EXISTS(SELECT 1 FROM public.email_job_runs WHERE finished_at IS NULL) THEN
   RAISE EXCEPTION 'An unfinished email run exists; staff review required, never automatic retry';
 END IF;
 INSERT INTO public.email_job_runs DEFAULT VALUES RETURNING id INTO result; RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.record_email_job_part(_run_id uuid,_part text,_result jsonb,_errors jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.email_job_runs SET parts=parts || jsonb_build_object(_part,_result),errors=_errors
 WHERE id=_run_id AND finished_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Run is missing or already finished'; END IF;
END
$$;
CREATE OR REPLACE FUNCTION public.finish_email_job_run(_run_id uuid,_errors jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE counts jsonb; result jsonb;
BEGIN
 SELECT '{"progress":0,"deadlines_and_vendor_reminders":0,"owner":0,"staff":0,"scheduled":0,"welcomes":0}'::jsonb || coalesce(jsonb_object_agg(part,n),'{}') INTO counts FROM
   (SELECT email_job_part AS part,count(*) AS n FROM public.email_log
     WHERE email_job_run_id=_run_id AND status='sent' GROUP BY email_job_part) s;
 UPDATE public.email_job_runs SET finished_at=now(),errors=_errors,email_counts=counts WHERE id=_run_id AND finished_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Run is missing or already finished'; END IF;
 SELECT to_jsonb(r) INTO result FROM public.email_job_runs r WHERE id=_run_id; RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.begin_email_job_run(),public.record_email_job_part(uuid,text,jsonb,jsonb),public.finish_email_job_run(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_email_job_run(),public.record_email_job_part(uuid,text,jsonb,jsonb),public.finish_email_job_run(uuid,jsonb) TO service_role;
-- Preserve the existing callback URL/key verbatim in the database; do not copy its value to source.
DO $patch$
DECLARE def text; anchor text := 'IF NEW.email_status = ''pending'' AND NOT coalesce(NEW.is_demo,false) THEN';
BEGIN
 def := pg_get_functiondef('private.dispatch_owner_notification_email()'::regprocedure);
 IF position(anchor IN def)=0 THEN RAISE EXCEPTION 'Owner callback definition changed; stop release'; END IF;
 EXECUTE replace(def,anchor,'IF NEW.email_job_run_id IS NULL AND NEW.email_status = ''pending'' AND NOT coalesce(NEW.is_demo,false) THEN');
END $patch$;
DO $checks$
DECLARE rid uuid; result jsonb;
BEGIN
 rid := public.begin_email_job_run();
 IF rid IS NULL THEN RAISE EXCEPTION 'Missing run ID'; END IF;
 PERFORM public.record_email_job_part(rid,'staff','{"considered":0,"emailed":0}'::jsonb,'[]'::jsonb);
 result := public.finish_email_job_run(rid,'[]'::jsonb);
 IF result->>'finished_at' IS NULL OR result->'parts'->'staff' IS NULL OR (result->'email_counts'->>'staff')::int<>0 THEN RAISE EXCEPTION 'Run audit assertion failed'; END IF;
 RAISE NOTICE 'Run lifecycle passed: %',result;
END $checks$;
ROLLBACK;
