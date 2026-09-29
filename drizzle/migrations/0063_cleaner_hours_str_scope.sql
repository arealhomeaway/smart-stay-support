-- Forward-only scope: tracking applies only to properties explicitly designated
-- as participating in the STR cleaner-hours safeguard, from a start date.
CREATE TABLE public.cleaner_hours_properties (
  property_id uuid PRIMARY KEY REFERENCES public.properties(id),
  active boolean NOT NULL DEFAULT true,
  tracking_from date NOT NULL,
  note text,
  designated_by uuid,
  designated_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  is_fixture boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.cleaner_hours_properties TO authenticated;
GRANT ALL ON public.cleaner_hours_properties TO service_role;
ALTER TABLE public.cleaner_hours_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership reads STR cleaner-hours participation" ON public.cleaner_hours_properties FOR SELECT TO authenticated USING (public.is_supervisor(auth.uid()));

CREATE TABLE public.cleaner_hours_property_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  active boolean NOT NULL,
  tracking_from date,
  note text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cleaner_hours_property_events TO authenticated;
GRANT ALL ON public.cleaner_hours_property_events TO service_role;
ALTER TABLE public.cleaner_hours_property_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership reads STR participation history" ON public.cleaner_hours_property_events FOR SELECT TO authenticated USING (public.is_supervisor(auth.uid()));
CREATE TRIGGER cleaner_property_events_append_only BEFORE UPDATE OR DELETE ON public.cleaner_hours_property_events
  FOR EACH ROW EXECUTE FUNCTION private.cleaner_block_snapshot_change();

CREATE OR REPLACE FUNCTION private.cleaner_tracking_from(_property uuid)
 RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT tracking_from FROM cleaner_hours_properties WHERE property_id=_property AND active;
$$;

CREATE OR REPLACE FUNCTION public.set_cleaner_hours_participation(_property uuid, _active boolean, _tracking_from date, _note text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_supervisor(auth.uid()) THEN RAISE EXCEPTION 'Only Operations leadership can change STR cleaner-hours tracking.'; END IF;
  IF length(btrim(coalesce(_note,''))) < 5 THEN RAISE EXCEPTION 'Add a note explaining this change.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM properties WHERE id=_property) THEN RAISE EXCEPTION 'Property not found.'; END IF;
  IF _active THEN
    IF _tracking_from IS NULL THEN RAISE EXCEPTION 'Choose the date tracking starts.'; END IF;
    IF _tracking_from < (now() AT TIME ZONE 'America/Chicago')::date - 45 THEN
      RAISE EXCEPTION 'Tracking is forward-looking; the start date can be at most 45 days back.'; END IF;
    INSERT INTO cleaner_hours_properties(property_id, active, tracking_from, note, designated_by, designated_at, ended_at)
    VALUES (_property, true, _tracking_from, btrim(_note), auth.uid(), now(), NULL)
    ON CONFLICT (property_id) DO UPDATE SET active=true, tracking_from=EXCLUDED.tracking_from, note=EXCLUDED.note,
      designated_by=EXCLUDED.designated_by, designated_at=now(), ended_at=NULL;
  ELSE
    UPDATE cleaner_hours_properties SET active=false, ended_at=now(), note=btrim(_note) WHERE property_id=_property;
  END IF;
  INSERT INTO cleaner_hours_property_events(property_id, active, tracking_from, note, actor_id, actor_name)
  VALUES (_property, _active, _tracking_from, btrim(_note), auth.uid(), private.cleaner_actor_name(auth.uid()));
END $$;
REVOKE ALL ON FUNCTION public.set_cleaner_hours_participation(uuid, boolean, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_cleaner_hours_participation(uuid, boolean, date, text) TO authenticated;

-- Ingest only for participating properties, and only cleans on/after the start date.
CREATE OR REPLACE FUNCTION public.cleaner_ingest_task(_payload jsonb, _property_id uuid, _source text, _fixture boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE task bigint; h text; latest record; snap uuid; created boolean := false; fin jsonb; res jsonb; start_on date; sched date; known boolean;
BEGIN
  task := (_payload->>'id')::bigint;
  IF task IS NULL THEN RAISE EXCEPTION 'Task payload has no id'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('cleaner_task:'||task, 0));
  known := EXISTS (SELECT 1 FROM cleaner_task_state WHERE breezeway_task_id=task);
  start_on := private.cleaner_tracking_from(_property_id);
  sched := coalesce(nullif(_payload->>'finished_at','')::timestamp::date, nullif(_payload->>'scheduled_date','')::date);
  -- Not in scope and never tracked before: store nothing.
  IF NOT known AND (_property_id IS NULL OR start_on IS NULL OR coalesce(_payload->>'type_department','') <> 'housekeeping'
                    OR (sched IS NOT NULL AND sched < start_on)) THEN
    RETURN jsonb_build_object('task', task, 'skipped', 'not an STR cleaner-hours Task');
  END IF;
  h := md5(_payload::text || '|' || coalesce(_property_id::text,''));
  SELECT id, payload_hash INTO latest FROM cleaner_task_snapshots WHERE breezeway_task_id=task ORDER BY synced_at DESC, id DESC LIMIT 1;
  IF latest.id IS NULL OR latest.payload_hash <> h THEN
    fin := _payload->'finished_by';
    INSERT INTO cleaner_task_snapshots(breezeway_task_id, breezeway_home_id, property_id, status_code, status_stage, department,
      template_id, task_name, scheduled_date, started_at, finished_at, total_time, elapsed_seconds, finished_by_id, finished_by_name,
      assignees, linked_reservation, source_updated_at, payload, payload_hash, source, is_fixture)
    VALUES (task, nullif(_payload->>'home_id','')::bigint, _property_id, _payload#>>'{type_task_status,code}', _payload#>>'{type_task_status,stage}',
      _payload->>'type_department', nullif(_payload->>'template_id','')::bigint, _payload->>'name', nullif(_payload->>'scheduled_date','')::date,
      CASE WHEN nullif(_payload->>'started_at','') IS NULL THEN NULL ELSE (_payload->>'started_at')::timestamp AT TIME ZONE 'UTC' END,
      CASE WHEN nullif(_payload->>'finished_at','') IS NULL THEN NULL ELSE (_payload->>'finished_at')::timestamp AT TIME ZONE 'UTC' END,
      _payload->>'total_time', private.cleaner_parse_elapsed(_payload->>'total_time'),
      CASE WHEN jsonb_typeof(fin)='object' THEN nullif(fin->>'id','')::bigint END,
      CASE WHEN jsonb_typeof(fin)='object' THEN fin->>'name' END,
      coalesce(CASE WHEN jsonb_typeof(_payload->'assignments')='array' THEN _payload->'assignments' END, '[]'::jsonb),
      CASE WHEN jsonb_typeof(_payload->'linked_reservation')='object' THEN _payload->'linked_reservation' END,
      nullif(_payload->>'updated_at','')::timestamptz, _payload, h, _source, _fixture)
    RETURNING id INTO snap;
    created := true;
  ELSE
    snap := latest.id;
  END IF;
  INSERT INTO cleaner_task_state(breezeway_task_id, latest_snapshot_id, property_id, last_synced_at, last_source, is_fixture)
  VALUES (task, snap, _property_id, now(), _source, _fixture)
  ON CONFLICT (breezeway_task_id) DO UPDATE SET latest_snapshot_id=EXCLUDED.latest_snapshot_id, property_id=EXCLUDED.property_id,
    last_synced_at=now(), last_source=EXCLUDED.last_source;
  res := private.cleaner_recompute_task(task);
  RETURN jsonb_build_object('task', task, 'snapshot_created', created) || res;
END $$;
REVOKE ALL ON FUNCTION public.cleaner_ingest_task(jsonb, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleaner_ingest_task(jsonb, uuid, text, boolean) TO service_role;

-- A tracked Task that moves out of scope (property no longer participating, or
-- clean before the start date) stops counting; its history stays.
CREATE OR REPLACE FUNCTION private.cleaner_scope_guard()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE start_on date;
BEGIN
  IF NEW.breezeway_task_id IS NULL OR NEW.attribution_method = 'manual_entry' THEN RETURN NEW; END IF;
  start_on := private.cleaner_tracking_from(NEW.property_id);
  IF start_on IS NULL OR NEW.completion_date < start_on THEN
    RAISE EXCEPTION 'cleaner_out_of_scope' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cleaner_ledger_scope BEFORE INSERT ON public.cleaner_exposure_ledger
  FOR EACH ROW EXECUTE FUNCTION private.cleaner_scope_guard();

-- Wrap recompute so out-of-scope Tasks void instead of failing.
CREATE OR REPLACE FUNCTION private.cleaner_recompute_scoped(_task bigint)
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
  RETURN private.cleaner_recompute_task(_task);
END $$;

-- Route both callers through the scoped wrapper.
CREATE OR REPLACE FUNCTION private.cleaner_after_ingest() RETURNS void LANGUAGE sql AS $$ SELECT $$;
DROP FUNCTION private.cleaner_after_ingest();

CREATE OR REPLACE FUNCTION public.classify_cleaner_account(_person bigint, _classification text, _worker_id uuid DEFAULT NULL,
  _new_worker_name text DEFAULT NULL, _note text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a record; w record; target uuid; t bigint; n int := 0;
BEGIN
  IF NOT public.is_supervisor(auth.uid()) THEN RAISE EXCEPTION 'Only Operations leadership can classify cleaner accounts.'; END IF;
  IF _classification NOT IN ('unclassified','individual','company','duplicate','unknown') THEN RAISE EXCEPTION 'Unknown classification.'; END IF;
  SELECT * INTO a FROM cleaner_breezeway_accounts WHERE breezeway_person_id=_person FOR UPDATE;
  IF a IS NULL THEN RAISE EXCEPTION 'This Breezeway account has not been seen on a cleaning Task.'; END IF;
  IF _classification = 'duplicate' THEN
    IF _worker_id IS NULL THEN RAISE EXCEPTION 'Choose the existing worker this account duplicates.'; END IF;
    IF length(btrim(coalesce(_note,''))) < 5 THEN RAISE EXCEPTION 'Explain how you confirmed these accounts are the same person.'; END IF;
  END IF;
  IF _classification IN ('individual','company','duplicate') THEN
    IF _worker_id IS NOT NULL THEN
      SELECT * INTO w FROM cleaner_workers WHERE id=_worker_id;
      IF w IS NULL THEN RAISE EXCEPTION 'Worker not found.'; END IF;
      IF _classification <> 'duplicate' AND w.account_type <> _classification THEN RAISE EXCEPTION 'That worker is a different account type.'; END IF;
      target := w.id;
    ELSE
      INSERT INTO cleaner_workers(display_name, account_type, created_by, updated_by)
      VALUES (coalesce(nullif(btrim(_new_worker_name),''), a.last_seen_name, 'Breezeway #'||_person), _classification, auth.uid(), auth.uid())
      RETURNING id INTO target;
    END IF;
  END IF;
  INSERT INTO cleaner_account_events(breezeway_person_id, from_classification, to_classification, from_worker_id, to_worker_id, note, actor_id, actor_name)
  VALUES (_person, a.classification, _classification, a.worker_id, target, nullif(btrim(_note),''), auth.uid(), private.cleaner_actor_name(auth.uid()));
  UPDATE cleaner_breezeway_accounts SET classification=_classification, worker_id=target, classification_note=nullif(btrim(_note),''),
    classified_by=auth.uid(), classified_at=now(), updated_at=now() WHERE breezeway_person_id=_person;
  PERFORM private.cleaner_person_reviews(_person, false);
  FOR t IN SELECT DISTINCT breezeway_task_id FROM cleaner_task_snapshots
            WHERE assignees @> jsonb_build_array(jsonb_build_object('assignee_id', _person)) LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('cleaner_task:'||t, 0));
    PERFORM private.cleaner_recompute_scoped(t);
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('worker_id', target, 'tasks_recalculated', n);
END $$;

COMMENT ON TABLE public.cleaner_sync_runs IS 'Nightly reconciliation runs. Historical backfill is out of scope (forward-only); kind=backfill is unused.';