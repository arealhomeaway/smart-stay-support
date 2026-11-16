-- nightly-export-sunday (approved by the Admin, Nov 15 2026; applied live at the Admin's instruction).
-- 1. The export is called every 5 minutes instead of every 10 (twice the working time each night).
-- 2. On the weekly full copy night the calls continue to 7 AM Central and the missed check moves to 7 AM.
-- Other nights keep the 2 to 5 AM window and the 5 AM check. The call itself (address, token, time limit) is unchanged.

-- 0. Preflight.
DO $pre$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'private' AND p.proname = 'nightly_export_missed_check' AND md5(p.prosrc) = '3e27b9167c3e103634ce645ef56f80a3')
     OR NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly-export-continue' AND schedule = '5-55/10 7-10 * * *')
     OR NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly-export-missed-check' AND schedule = '15 10,11 * * *') THEN
    RAISE EXCEPTION 'Changed since the Nov 15 capture. Nothing was changed.';
  END IF;
END $pre$;

-- 1. Schedules (only the timing changes).
SELECT cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname = 'nightly-export-continue'), schedule := '5-55/5 7-12 * * *');
SELECT cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname = 'nightly-export-missed-check'), schedule := '15 10-13 * * *');

-- 2. Missed check: 7 AM on the weekly night, 5 AM otherwise.
CREATE OR REPLACE FUNCTION private.nightly_export_missed_check(_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _local timestamp := _now AT TIME ZONE 'America/Chicago';
  _folder text := to_char(_now AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD');
  _run record;
  -- nightly-export-sunday: the weekly full copy night works until 7 AM Central and is checked then.
  _end integer := CASE WHEN extract(dow FROM _local)::integer = coalesce((SELECT CASE WHEN (s.value->>'weekly_day') ~ '^[0-6]$'
                       THEN (s.value->>'weekly_day')::integer END FROM public.app_settings s WHERE s.key = 'nightly_export_settings'), 0)
                  THEN 7 ELSE 5 END;
BEGIN
  IF extract(hour FROM _local) <> _end THEN RETURN 0; END IF;
  IF EXISTS (
    SELECT 1 FROM public.backup_runs b
     WHERE b.kind = 'nightly' AND b.folder_name = _folder
       AND ((b.phase IS NOT NULL AND b.verify_status = 'passed') OR (b.phase IS NULL AND b.status = 'succeeded'))
  ) THEN
    -- Build 9 H2: a night that passed still tells Admin which tables have fewer rows now.
    RETURN private.nightly_export_fewer_alert(_folder);
  END IF;
  SELECT b.status, b.verify_status, b.error INTO _run
    FROM public.backup_runs b
   WHERE b.kind = 'nightly' AND b.folder_name = _folder AND b.phase IS NOT NULL
   ORDER BY b.started_at DESC LIMIT 1;
  RETURN public.nightly_export_alert(
    _folder,
    CASE WHEN FOUND AND (_run.verify_status = 'failed' OR _run.status = 'failed') THEN 'failed' ELSE 'missed' END,
    CASE
      WHEN NOT FOUND THEN format('No nightly export ran for %s by %s AM Central. Open the export check.', _folder, _end)
      WHEN _run.verify_status = 'failed' OR _run.status = 'failed'
        THEN format('The nightly export for %s failed. Open the export check for the reason.', _folder)
      ELSE format('The nightly export for %s had not finished by %s AM Central. Open the export check.', _folder, _end)
    END);
END
$function$;
REVOKE ALL ON FUNCTION private.nightly_export_missed_check(timestamptz) FROM PUBLIC, anon, authenticated;

-- 3. Change log.
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, before_value, after_value)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'nightly_export_sunday_applied', 'function', 'Nightly export: schedule and weekly window',
  'Approved by the Admin, Nov 15, applied live: export called every 5 minutes; the weekly full copy night works until 7 AM Central '
  || 'and is checked at 7 AM. Other nights unchanged. Undo: docs/pending/nightly-export-sunday/apply.undo.sql.',
  jsonb_build_object('continue', '5-55/10 7-10 * * *', 'missed_check', '15 10,11 * * *'),
  jsonb_build_object('continue', '5-55/5 7-12 * * *', 'missed_check', '15 10-13 * * *'));
