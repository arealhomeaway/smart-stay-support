-- Build 9 H2 (Emily, Nov 10): when last night's export passed but some tables now hold fewer rows
-- than the export saved, Admin gets one alert the next morning (the existing 5 AM check) with the
-- table names. The night still passes; nothing else about the check changes. STAGE ONLY.

CREATE OR REPLACE FUNCTION private.nightly_export_fewer_alert(_folder text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tables text;
  _n integer := 0;
BEGIN
  SELECT string_agg(DISTINCT l->>'table', ', ' ORDER BY l->>'table') INTO _tables
    FROM public.backup_runs b, jsonb_array_elements(coalesce(b.verify_result->'lines', '[]'::jsonb)) l
   WHERE b.kind = 'nightly' AND b.folder_name = _folder AND b.phase IS NOT NULL
     AND b.verify_status = 'passed' AND l->>'state' = 'fewer';
  IF _tables IS NULL THEN RETURN 0; END IF;
  -- Once per night: the 5 AM check runs more than once inside that hour.
  IF EXISTS (
    SELECT 1 FROM public.staff_notifications s
     WHERE s.kind = 'nightly_export_fewer' AND s.link_path = '/export-check?night=' || _folder
  ) THEN RETURN 0; END IF;
  INSERT INTO public.staff_notifications (user_id, kind, title, body, link_path, priority, email_status)
  SELECT ur.user_id, 'nightly_export_fewer', 'Nightly export: fewer rows now',
         left(format('The nightly export for %s passed, but these tables have fewer rows now than in the export: %s. Check that nothing was removed by mistake.', _folder, _tables), 900),
         '/export-check?night=' || _folder, 'normal', 'pending'
    FROM (SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin') ur;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END
$function$;

REVOKE ALL ON FUNCTION private.nightly_export_fewer_alert(text) FROM PUBLIC;

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
