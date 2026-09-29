ALTER FUNCTION private.cleaner_recompute_task(bigint) RENAME TO cleaner_recompute_core;
DROP FUNCTION private.cleaner_recompute_scoped(bigint);
-- Every caller (ingest, reclassification) goes through this scope-aware entry point.
CREATE OR REPLACE FUNCTION private.cleaner_recompute_task(_task bigint)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE s record; start_on date; n int := 0;
BEGIN
  SELECT * INTO s FROM cleaner_task_snapshots WHERE breezeway_task_id=_task ORDER BY synced_at DESC, id DESC LIMIT 1;
  IF s IS NULL THEN RETURN '{}'::jsonb; END IF;
  start_on := private.cleaner_tracking_from(s.property_id);
  IF s.property_id IS NOT NULL AND (start_on IS NULL OR (s.finished_at IS NOT NULL AND (s.finished_at AT TIME ZONE 'America/Chicago')::date < start_on)) THEN
    UPDATE cleaner_exposure_ledger SET superseded_at=now(), superseded_reason='Property not participating in STR cleaner-hours tracking for this date'
     WHERE breezeway_task_id=_task AND superseded_at IS NULL AND entry_key LIKE 'bz:%';
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN jsonb_build_object('out_of_scope', true, 'voided', n);
  END IF;
  RETURN private.cleaner_recompute_core(_task);
END $$;
CREATE OR REPLACE FUNCTION public.cleaner_recalculate_task(_task bigint)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('cleaner_task:'||_task, 0));
  RETURN private.cleaner_recompute_task(_task);
END $$;
REVOKE ALL ON FUNCTION public.cleaner_recalculate_task(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleaner_recalculate_task(bigint) TO service_role;