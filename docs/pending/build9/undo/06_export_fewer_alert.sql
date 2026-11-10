-- Build 9 H2 undo: restore the 5 AM export check exactly as it was and remove the fewer rows alert.
-- The body below is the live function captured before this step (md5 of the captured definition
-- b5db7e5faf89f05344cbd54afd7ec915).
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
  ) THEN RETURN 0; END IF;
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

DROP FUNCTION IF EXISTS private.nightly_export_fewer_alert(text);
