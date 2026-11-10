-- Practice for 01 on the real database, Build 11. Everything runs in one block that ends
-- with an error on purpose, so nothing is kept. Uses one real home (1399 Foxtail Ln).
DO $practice$
DECLARE r record; msg text := ''; ok boolean;
BEGIN
  EXECUTE $mig$-- Build 11 (Emily, Nov 10; register O1, O3, A16): the Notion Onboarding Project Database fields
-- Resolve did not have, all optional and empty until a person fills them. Additive only.
-- Status options are Notion's own (read Nov 10 from the Onboarding Project Database).

ALTER TABLE public.onboarding_projects
  ADD COLUMN IF NOT EXISTS owner_type text,
  ADD COLUMN IF NOT EXISTS project_status text,
  ADD COLUMN IF NOT EXISTS pma_status text,
  ADD COLUMN IF NOT EXISTS invoice_status text,
  ADD COLUMN IF NOT EXISTS greater_area text,
  ADD COLUMN IF NOT EXISTS weekly_status text,
  ADD COLUMN IF NOT EXISTS committed_handoff_on date,
  ADD COLUMN IF NOT EXISTS committed_handoff_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS committed_handoff_set_by uuid;

ALTER TABLE public.onboarding_projects
  ADD CONSTRAINT onboarding_projects_owner_type_chk CHECK (owner_type IS NULL OR owner_type IN
    ('Standard DFY', 'Active Owner', 'Acquisition', 'Local/Direct')),
  ADD CONSTRAINT onboarding_projects_project_status_chk CHECK (project_status IS NULL OR project_status IN
    ('Upcoming Property', 'Waiting on New House Assessment', 'Waiting for Design', 'Waiting for Closing',
     'Waiting for Access to Home', 'Starting Onboard Process', 'Waiting for Deliveries', 'Repairs',
     'Staging/Furniture Setup', 'Waiting for Handoff', 'Property Handed Off', 'Contract Fell Through')),
  ADD CONSTRAINT onboarding_projects_pma_status_chk CHECK (pma_status IS NULL OR pma_status IN
    ('Not started', 'Utilities LOA + Exhibit D Sent', 'Utilities LOA + Exhibit D Signed',
     'HOA & Amenity Information Sent', 'HOA & Amenity Information Signed', 'PMA In Progress', 'PMA Received')),
  ADD CONSTRAINT onboarding_projects_invoice_status_chk CHECK (invoice_status IS NULL OR invoice_status IN
    ('Not Started', 'Estimate Created', 'Estimate Sent', 'Estimate Approved', 'First Invoice Requested',
     'First Invoice Sent', 'First Invoice Paid', 'Second Furnishing Invoice Sent', 'Second Furnishing Invoice Paid',
     'Repair Invoice Reviewed & Sent', 'All Invoices Paid')),
  ADD CONSTRAINT onboarding_projects_greater_area_chk CHECK (greater_area IS NULL OR length(greater_area) <= 120),
  ADD CONSTRAINT onboarding_projects_weekly_status_chk CHECK (weekly_status IS NULL OR length(weekly_status) <= 2000);

COMMENT ON COLUMN public.onboarding_projects.project_status IS
  'Notion Onboarding Project Database Status (12 options). Set by the Project Manager (register O3).';
COMMENT ON COLUMN public.onboarding_projects.committed_handoff_on IS
  'Committed Handoff Date: set once, then locked; only correct_committed_handoff_date changes it (register O3).';

-- Set once, then locked. The first value stamps who and when; after that only the
-- correction function (Supervisor or Admin, with a reason) may change it.
CREATE OR REPLACE FUNCTION private.lock_committed_handoff()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _correcting boolean := coalesce(current_setting('app.committed_handoff_correction', true), '') = 'on';
BEGIN
  IF TG_OP = 'UPDATE' AND NOT _correcting THEN
    IF OLD.committed_handoff_on IS NOT NULL
       AND NEW.committed_handoff_on IS DISTINCT FROM OLD.committed_handoff_on THEN
      RAISE EXCEPTION 'The Committed Handoff Date is locked. A Supervisor or Admin can correct it with a reason.'
        USING ERRCODE = '42501';
    END IF;
    IF (NEW.committed_handoff_set_at IS DISTINCT FROM OLD.committed_handoff_set_at
        OR NEW.committed_handoff_set_by IS DISTINCT FROM OLD.committed_handoff_set_by)
       AND NOT (OLD.committed_handoff_on IS NULL AND NEW.committed_handoff_on IS NOT NULL) THEN
      RAISE EXCEPTION 'The Committed Handoff Date record cannot be changed.' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NEW.committed_handoff_on IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.committed_handoff_on IS NULL) THEN
    NEW.committed_handoff_set_at := now();
    NEW.committed_handoff_set_by := auth.uid();
  ELSIF NEW.committed_handoff_on IS NULL AND TG_OP = 'INSERT' THEN
    NEW.committed_handoff_set_at := NULL;
    NEW.committed_handoff_set_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_committed_handoff ON public.onboarding_projects;
CREATE TRIGGER lock_committed_handoff
  BEFORE INSERT OR UPDATE OF committed_handoff_on, committed_handoff_set_at, committed_handoff_set_by
  ON public.onboarding_projects
  FOR EACH ROW EXECUTE FUNCTION private.lock_committed_handoff();

-- One caller-authenticated save for these fields. Runs as the caller, so the existing
-- update rule on onboarding_projects decides who may save (Director of Onboarding,
-- Admin, the home's Project Manager). Status: the Project Manager, the Director of
-- Onboarding or Admin. Every change is one history line.
CREATE OR REPLACE FUNCTION public.save_onboarding_project_details(_project_id uuid, _patch jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _old public.onboarding_projects;
  _new public.onboarding_projects;
  _key text;
  _fields text[] := ARRAY['owner_type', 'project_status', 'pma_status', 'invoice_status',
    'greater_area', 'weekly_status', 'committed_handoff_on'];
  _labels jsonb := jsonb_build_object(
    'owner_type', 'Owner Type', 'project_status', 'Status', 'pma_status', 'PMA Status',
    'invoice_status', 'Invoice Status', 'greater_area', 'Greater Area', 'weekly_status', 'Weekly status',
    'committed_handoff_on', 'Committed Handoff Date');
  _changed integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to save.' USING ERRCODE = '42501';
  END IF;
  IF _patch IS NULL OR jsonb_typeof(_patch) <> 'object' THEN
    RAISE EXCEPTION 'Nothing to save.';
  END IF;
  FOR _key IN SELECT jsonb_object_keys(_patch) LOOP
    IF NOT _key = ANY(_fields) THEN
      RAISE EXCEPTION 'This field cannot be saved here: %', _key;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.onboarding_projects WHERE id = _project_id) THEN
    RAISE EXCEPTION 'This home could not be found.';
  END IF;
  SELECT * INTO _old FROM public.onboarding_projects WHERE id = _project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You can view this home but not change it.' USING ERRCODE = '42501';
  END IF;
  IF _patch ? 'project_status'
     AND nullif(btrim(_patch->>'project_status'), '') IS DISTINCT FROM _old.project_status
     AND NOT (_old.project_manager = _uid OR public.is_onboarding_director(_uid) OR public.has_role(_uid, 'admin')) THEN
    RAISE EXCEPTION 'Status is set by the Project Manager.' USING ERRCODE = '42501';
  END IF;
  IF _patch ? 'committed_handoff_on' AND _old.committed_handoff_on IS NOT NULL
     AND nullif(_patch->>'committed_handoff_on', '')::date IS DISTINCT FROM _old.committed_handoff_on THEN
    RAISE EXCEPTION 'The Committed Handoff Date is locked. A Supervisor or Admin can correct it with a reason.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.onboarding_projects SET
    owner_type = CASE WHEN _patch ? 'owner_type' THEN nullif(btrim(_patch->>'owner_type'), '') ELSE owner_type END,
    project_status = CASE WHEN _patch ? 'project_status' THEN nullif(btrim(_patch->>'project_status'), '') ELSE project_status END,
    pma_status = CASE WHEN _patch ? 'pma_status' THEN nullif(btrim(_patch->>'pma_status'), '') ELSE pma_status END,
    invoice_status = CASE WHEN _patch ? 'invoice_status' THEN nullif(btrim(_patch->>'invoice_status'), '') ELSE invoice_status END,
    greater_area = CASE WHEN _patch ? 'greater_area' THEN nullif(btrim(_patch->>'greater_area'), '') ELSE greater_area END,
    weekly_status = CASE WHEN _patch ? 'weekly_status' THEN nullif(btrim(_patch->>'weekly_status'), '') ELSE weekly_status END,
    committed_handoff_on = CASE WHEN _patch ? 'committed_handoff_on'
      THEN nullif(_patch->>'committed_handoff_on', '')::date ELSE committed_handoff_on END
  WHERE id = _project_id
  RETURNING * INTO _new;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You can view this home but not change it.' USING ERRCODE = '42501';
  END IF;

  FOREACH _key IN ARRAY _fields LOOP
    IF (to_jsonb(_old)->>_key) IS DISTINCT FROM (to_jsonb(_new)->>_key) THEN
      INSERT INTO public.onboarding_project_events
        (project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
      VALUES (_new.id, _new.property_id, 'project_detail_changed',
        (_labels->>_key) || ' changed', NULL, to_jsonb(_old)->>_key, to_jsonb(_new)->>_key, _uid, _new.is_demo);
      _changed := _changed + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('projectId', _new.id, 'changed', _changed);
END;
$$;

-- The only way to change a Committed Handoff Date once set: a Supervisor or Admin, with a reason.
CREATE OR REPLACE FUNCTION public.correct_committed_handoff_date(_project_id uuid, _date date, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _old public.onboarding_projects;
BEGIN
  IF _uid IS NULL OR NOT (public.has_role(_uid, 'admin') OR public.has_role(_uid, 'manager')) THEN
    RAISE EXCEPTION 'Only a Supervisor or Admin can correct the Committed Handoff Date.' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Give a reason for the correction.';
  END IF;
  IF _date IS NULL THEN
    RAISE EXCEPTION 'Pick the corrected date.';
  END IF;
  SELECT * INTO _old FROM public.onboarding_projects WHERE id = _project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This home could not be found.';
  END IF;
  IF private.is_synthetic_account() AND NOT coalesce(_old.is_demo, false) THEN
    RAISE EXCEPTION 'A preview account changes demo homes only.' USING ERRCODE = '42501';
  END IF;
  IF _old.committed_handoff_on IS NULL THEN
    RAISE EXCEPTION 'There is no Committed Handoff Date to correct yet.';
  END IF;
  IF _old.committed_handoff_on = _date THEN
    RAISE EXCEPTION 'That is already the Committed Handoff Date.';
  END IF;
  PERFORM set_config('app.committed_handoff_correction', 'on', true);
  UPDATE public.onboarding_projects SET committed_handoff_on = _date WHERE id = _project_id;
  PERFORM set_config('app.committed_handoff_correction', 'off', true);
  INSERT INTO public.onboarding_project_events
    (project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
  VALUES (_old.id, _old.property_id, 'committed_handoff_corrected', 'Committed Handoff Date corrected',
    btrim(_reason), _old.committed_handoff_on::text, _date::text, _uid, _old.is_demo);
  RETURN jsonb_build_object('projectId', _old.id, 'committedHandoffOn', _date);
END;
$$;

REVOKE ALL ON FUNCTION public.save_onboarding_project_details(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.correct_committed_handoff_date(uuid, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.lock_committed_handoff() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_onboarding_project_details(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.correct_committed_handoff_date(uuid, date, text) TO authenticated, service_role;

-- Design folders on the home's files (Floor plans, Mood boards, Pick lists, Install
-- instructions, Staging instructions, Photos). Existing values unchanged.
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_category_chk;
ALTER TABLE public.documents ADD CONSTRAINT documents_category_chk CHECK ((category IS NULL) OR (category = ANY (ARRAY[
  'pma'::text, 'insurance'::text, 'ownership'::text, 'hoa'::text, 'covenants'::text, 'permit_license'::text,
  'compliance'::text, 'manual'::text, 'hvac_doc'::text, 'warranty'::text, 'equipment'::text, 'access_security'::text,
  'measurements'::text, 'design'::text, 'onboarding_evidence'::text, 'assessment'::text, 'operations'::text,
  'maintenance'::text, 'media'::text, 'reference'::text, 'other'::text,
  'design_floor_plan'::text, 'design_mood_board'::text, 'design_pick_list'::text, 'design_install'::text,
  'design_staging'::text, 'design_photo'::text])));

-- Handoff reminders follow the Committed Handoff Date once it is set (register O4); until then
-- they follow the date they follow today. Only the date expression changes.
CREATE OR REPLACE FUNCTION public.run_handoff_reminders(_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _local timestamp := _now AT TIME ZONE 'America/Chicago';
  _today date := (_now AT TIME ZONE 'America/Chicago')::date;
  _sup uuid;
  _dir uuid;
  _p record;
  _kind text;
  _log uuid;
  _label text;
  _title text;
  _body text;
  _who uuid;
  _sent uuid[];
  _count integer := 0;
BEGIN
  IF extract(hour FROM _local) <> 8 THEN
    RETURN 0;
  END IF;
  _sup := public.seat_holder_at('ops_supervisor', _now);
  _dir := public.seat_holder_at('director_ops', _now);

  FOR _p IN
    SELECT pr.id, pr.property_id, coalesce(pr.committed_handoff_on, pr.target_handoff_on) AS handoff_on,
           (coalesce(pr.committed_handoff_on, pr.target_handoff_on) - _today) AS days_left, to_jsonb(h) AS home
      FROM public.onboarding_projects pr
      JOIN public.properties h ON h.id = pr.property_id
     WHERE coalesce(pr.committed_handoff_on, pr.target_handoff_on) IS NOT NULL
       AND coalesce(pr.committed_handoff_on, pr.target_handoff_on) - _today IN (7, 2, 0)
       AND coalesce(pr.status, '') NOT IN ('cancelled', 'complete')
       AND pr.handoff_state IS DISTINCT FROM 'accepted'
       AND pr.ops_accepted_at IS NULL
       AND h.handoff_accepted_at IS NULL
       AND NOT coalesce(pr.is_demo, false)
       AND NOT coalesce(h.is_demo, false)
  LOOP
    _kind := CASE _p.days_left WHEN 7 THEN 'seven_days' WHEN 2 THEN 'two_days' ELSE 'day_of' END;
    _log := NULL;
    INSERT INTO public.handoff_reminders(project_id, property_id, handoff_on, kind, sent_on)
    VALUES (_p.id, _p.property_id, _p.handoff_on, _kind, _today)
    ON CONFLICT ON CONSTRAINT handoff_reminders_once DO NOTHING
    RETURNING id INTO _log;
    CONTINUE WHEN _log IS NULL;

    _label := coalesce(public.format_property_label(_p.home)->>'primary', 'A home');
    _title := CASE _kind
      WHEN 'seven_days' THEN 'Handoff in 7 days: '
      WHEN 'two_days' THEN 'Handoff in 2 days: '
      ELSE 'Handoff today: ' END || _label;
    _body := 'Handoff date: ' || to_char(_p.handoff_on, 'FMDay, FMMonth FMDD')
      || '. Anything still open carries over to Operations.';

    _sent := '{}';
    FOR _who IN SELECT DISTINCT x FROM unnest(ARRAY[_sup, _dir]) x WHERE x IS NOT NULL LOOP
      PERFORM public.notify_staff(
        _who, 'handoff_reminder', _title, _body,
        'onboarding_project', _p.id, '/property/' || _p.property_id::text || '?tab=handoff',
        'normal', NULL, true, false);
      _sent := _sent || _who;
    END LOOP;
    UPDATE public.handoff_reminders SET recipients = _sent WHERE id = _log;
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END;
$function$;
$mig$;

  PERFORM set_config('request.jwt.claims', json_build_object('sub','f2a762fa-f28b-4df3-8f33-a94461c6837f','role','authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  PERFORM public.save_onboarding_project_details('add4e549-2929-42db-b5fd-131787088768', '{"owner_type":"Standard DFY","project_status":"Repairs","committed_handoff_on":"2026-11-20"}'::jsonb);
  ok := false;
  BEGIN
    PERFORM public.save_onboarding_project_details('add4e549-2929-42db-b5fd-131787088768', '{"committed_handoff_on":"2026-11-25"}'::jsonb);
  EXCEPTION WHEN OTHERS THEN ok := SQLERRM LIKE '%locked%';
  END;
  msg := msg || ' lock_refused=' || ok;
  ok := false;
  BEGIN
    PERFORM public.correct_committed_handoff_date('add4e549-2929-42db-b5fd-131787088768', '2026-11-27', 'Practice correction');
  EXCEPTION WHEN OTHERS THEN ok := SQLERRM LIKE '%Only a Supervisor or Admin%';
  END;
  msg := msg || ' pm_correct_refused=' || ok;
  PERFORM set_config('role', 'none', true);

  PERFORM set_config('request.jwt.claims', json_build_object('sub','452f6db5-ba38-44bf-a8bd-f4b9197a0032','role','authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  PERFORM public.correct_committed_handoff_date('add4e549-2929-42db-b5fd-131787088768', '2026-11-27', 'Practice correction');
  PERFORM set_config('role', 'none', true);

  SELECT owner_type, project_status, committed_handoff_on, committed_handoff_set_by INTO r FROM public.onboarding_projects WHERE id='add4e549-2929-42db-b5fd-131787088768';
  msg := msg || ' owner_type=' || r.owner_type || ' status=' || r.project_status || ' committed=' || r.committed_handoff_on
    || ' set_by_pm=' || (r.committed_handoff_set_by = 'f2a762fa-f28b-4df3-8f33-a94461c6837f');
  msg := msg || ' events=' || (SELECT count(*) FROM public.onboarding_project_events WHERE project_id='add4e549-2929-42db-b5fd-131787088768' AND kind IN ('project_detail_changed','committed_handoff_corrected') AND created_at > now() - interval '1 minute');
  msg := msg || ' design_ok=' || EXISTS(SELECT 1 FROM pg_constraint WHERE conname='documents_category_chk' AND pg_get_constraintdef(oid) LIKE '%design_photo%');
  RAISE EXCEPTION 'PRACTICE CANCELLED ON PURPOSE:%', msg;
END
$practice$;
