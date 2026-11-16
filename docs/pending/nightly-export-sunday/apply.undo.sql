-- Undo for nightly-export-sunday: puts back the Nov 15 schedules and missed check exactly.
SELECT cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname = 'nightly-export-continue'), schedule := '5-55/10 7-10 * * *');
SELECT cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname = 'nightly-export-missed-check'), schedule := '15 10,11 * * *');
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
BEGIN
  IF extract(hour FROM _local) <> 5 THEN RETURN 0; END IF;
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
      WHEN NOT FOUND THEN format('No nightly export ran for %s by 5 AM Central. Open the export check.', _folder)
      WHEN _run.verify_status = 'failed' OR _run.status = 'failed'
        THEN format('The nightly export for %s failed. Open the export check for the reason.', _folder)
      ELSE format('The nightly export for %s had not finished by 5 AM Central. Open the export check.', _folder)
    END);
END
$function$;
REVOKE ALL ON FUNCTION private.nightly_export_missed_check(timestamptz) FROM PUBLIC, anon, authenticated;
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'nightly_export_sunday_undone', 'function', 'Nightly export: schedule and weekly window',
  'Undo of nightly-export-sunday: every 10 minutes, 2 to 5 AM every night, 5 AM check.');
