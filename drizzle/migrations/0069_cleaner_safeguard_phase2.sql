-- STR Cleaner Hours Safeguard — Phase 2: staged safeguard states, dispatch
-- decisions, single-clean leadership overrides, provisional durations, alerts.
-- Operational decision support only: no tax, IRS or participation conclusions.

-- 1. Vocabulary extensions -------------------------------------------------
ALTER TABLE public.cleaner_exposure_ledger DROP CONSTRAINT IF EXISTS cleaner_exposure_ledger_attribution_method_check;
ALTER TABLE public.cleaner_exposure_ledger ADD CONSTRAINT cleaner_exposure_ledger_attribution_method_check CHECK (attribution_method = ANY (ARRAY[
  'single_individual_assignee','multi_assignee_full_elapsed','manual_correction','manual_entry','company_only_needs_review',
  'invalid_duration_needs_review','company_account_not_counted','provisional_duration','provisional_cap']));

ALTER TABLE public.cleaner_review_items DROP CONSTRAINT IF EXISTS cleaner_review_items_kind_check;
ALTER TABLE public.cleaner_review_items ADD CONSTRAINT cleaner_review_items_kind_check CHECK (kind = ANY (ARRAY[
  'company_only','unclassified_assignee','possible_duplicate_identity','zero_duration','short_duration','long_duration',
  'unmatched_property','manual_entry','source_changed_after_correction','source_missing',
  'company_identity_needed','override_request','native_assignment_alert','threshold_reached']));

ALTER TABLE public.cleaner_hours_properties ADD COLUMN IF NOT EXISTS standard_clean_minutes integer;
ALTER TABLE public.cleaner_hours_properties DROP CONSTRAINT IF EXISTS cleaner_hours_properties_standard_minutes_check;
ALTER TABLE public.cleaner_hours_properties ADD CONSTRAINT cleaner_hours_properties_standard_minutes_check
  CHECK (standard_clean_minutes IS NULL OR standard_clean_minutes BETWEEN 30 AND 720);

-- 2. Helpers -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.cleaner_standard_minutes(_property uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT standard_clean_minutes FROM cleaner_hours_properties WHERE property_id=_property), 240)::numeric
$$;

-- Leadership recipients: Admins plus whoever holds the Director of Operations seat.
CREATE OR REPLACE FUNCTION private.cleaner_leadership_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT u FROM (
    SELECT user_id AS u FROM user_roles WHERE role = 'admin'
    UNION SELECT public.seat_holder_at('director_ops')
  ) x WHERE u IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION private.cleaner_pc_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT u FROM (SELECT public.seat_holder_at('po_day') u UNION SELECT public.seat_holder_at('po_evening')) x WHERE u IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION private.cleaner_alert(_audience text, _title text, _body text, _priority text, _entity uuid, _actor uuid, _demo boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r uuid;
BEGIN
  FOR r IN SELECT * FROM private.cleaner_leadership_ids() WHERE _audience IN ('leadership','both') LOOP
    PERFORM public.notify_staff(r, 'cleaner_safeguard', _title, _body, 'cleaner_safeguard', _entity, '/cleaner-hours', _priority, _actor, false, _demo);
  END LOOP;
  FOR r IN SELECT * FROM private.cleaner_pc_ids() WHERE _audience IN ('pc','both') LOOP
    PERFORM public.notify_staff(r, 'cleaner_safeguard', _title, _body, 'cleaner_safeguard', _entity, '/str-dispatch-check', _priority, _actor, false, _demo);
  END LOOP;
END $$;

-- Ownership period from Active Owner: the latest owner program for the home
-- that started on/before the evaluated year. Pre-period cleaner history stays
-- on the home but is not compared against this owner.
CREATE OR REPLACE FUNCTION private.cleaner_owner_segment(_property uuid, _year int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE demo boolean; p record; seg date := make_date(_year,1,1);
BEGIN
  SELECT coalesce(is_demo,false) INTO demo FROM properties WHERE id=_property;
  SELECT op.id, op.owner_user_id, op.owner_name, op.started_on INTO p
    FROM owner_programs op
   WHERE op.archived_at IS NULL AND (NOT op.is_demo OR demo)
     AND (op.property_id = _property OR EXISTS (SELECT 1 FROM owner_program_properties x WHERE x.program_id=op.id AND x.property_id=_property AND x.archived_at IS NULL))
     AND (op.started_on IS NULL OR op.started_on <= make_date(_year,12,31))
   ORDER BY op.started_on DESC NULLS LAST, op.created_at DESC LIMIT 1;
  IF p.id IS NOT NULL AND p.started_on IS NOT NULL AND p.started_on > seg THEN seg := p.started_on; END IF;
  RETURN jsonb_build_object('segment_start', seg, 'program_id', p.id, 'owner_user_id', p.owner_user_id, 'owner_name', p.owner_name);
END $$;

CREATE OR REPLACE FUNCTION private.cleaner_owner_minutes(_property uuid, _year int, _from date, _owner uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(e.minutes),0)::numeric
    FROM owner_time_entries e JOIN owner_time_entry_properties ep ON ep.entry_id = e.id
    JOIN properties pr ON pr.id = ep.property_id
   WHERE ep.property_id = _property AND extract(year FROM e.entry_date)::int = _year AND e.entry_date >= _from
     AND (_owner IS NULL OR e.owner_user_id = _owner)
     AND (NOT e.is_demo OR coalesce(pr.is_demo,false))
     AND NOT EXISTS (SELECT 1 FROM owner_time_entries x WHERE x.amends_entry_id = e.id)
$$;

CREATE OR REPLACE FUNCTION private.cleaner_worker_minutes(_property uuid, _worker uuid, _year int, _from date)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(attributed_minutes),0)::numeric FROM cleaner_exposure_ledger
   WHERE property_id=_property AND worker_id=_worker AND superseded_at IS NULL AND counted
     AND extract(year FROM completion_date)::int = _year AND completion_date >= _from
$$;

-- Projected clean estimate: property standard → last-5 average → 4.0 h default.
CREATE OR REPLACE FUNCTION private.cleaner_estimate(_property uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE std int; avg_m numeric; n int;
BEGIN
  SELECT standard_clean_minutes INTO std FROM cleaner_hours_properties WHERE property_id=_property;
  IF std IS NOT NULL THEN RETURN jsonb_build_object('minutes', std, 'source', 'property_standard'); END IF;
  SELECT avg(m), count(*) INTO avg_m, n FROM (
    SELECT DISTINCT ON (breezeway_task_id) breezeway_task_id, raw_elapsed_seconds/60.0 AS m, completion_date
      FROM cleaner_exposure_ledger
     WHERE property_id=_property AND superseded_at IS NULL AND breezeway_task_id IS NOT NULL
       AND attribution_method IN ('single_individual_assignee','multi_assignee_full_elapsed') AND raw_elapsed_seconds > 0
     ORDER BY breezeway_task_id, completion_date DESC) t
   WHERE true ORDER BY 1 LIMIT 1;
  SELECT avg(m), count(*) INTO avg_m, n FROM (
    SELECT m FROM (SELECT DISTINCT ON (breezeway_task_id) breezeway_task_id, raw_elapsed_seconds/60.0 AS m, completion_date
      FROM cleaner_exposure_ledger
     WHERE property_id=_property AND superseded_at IS NULL AND breezeway_task_id IS NOT NULL
       AND attribution_method IN ('single_individual_assignee','multi_assignee_full_elapsed') AND raw_elapsed_seconds > 0
     ORDER BY breezeway_task_id, completion_date DESC) d ORDER BY completion_date DESC LIMIT 5) t;
  IF n > 0 THEN RETURN jsonb_build_object('minutes', round(avg_m,2), 'source', 'historical_average', 'cleans', n); END IF;
  RETURN jsonb_build_object('minutes', 240, 'source', 'conservative_default');
END $$;

-- The one authoritative state rule.
CREATE OR REPLACE FUNCTION private.cleaner_safeguard_state(_total_h numeric, _owner_h numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _total_h >= 95 THEN 'hard_block'
    WHEN coalesce(_owner_h,0) <= 0 THEN
      CASE WHEN _total_h >= 75 THEN 'restricted' WHEN _total_h >= 50 THEN 'warning' WHEN _total_h >= 35 THEN 'monitor' ELSE 'normal' END
    WHEN _total_h >= 75 OR (_owner_h - _total_h) <= 5 THEN 'restricted'
    WHEN _total_h >= 50 OR (_owner_h - _total_h) <= 15 THEN 'warning'
    WHEN _total_h >= 35 OR (_owner_h - _total_h) <= 25 THEN 'monitor'
    ELSE 'normal' END
$$;

CREATE OR REPLACE FUNCTION private.cleaner_safeguard_eval(_property uuid, _worker uuid, _on date, _projected_minutes numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE y int := extract(year FROM _on)::int; seg jsonb; seg_from date; cur_m numeric; own_m numeric; est jsonb; proj_m numeric;
  total_h numeric; own_h numeric; w record;
BEGIN
  SELECT id, display_name, account_type INTO w FROM cleaner_workers WHERE id=_worker;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Cleaner not found.'; END IF;
  IF private.cleaner_tracking_from(_property) IS NULL THEN
    RETURN jsonb_build_object('enrolled', false, 'state', 'not_tracked');
  END IF;
  IF w.account_type <> 'individual' THEN
    RETURN jsonb_build_object('enrolled', true, 'state', 'identity_required', 'worker_name', w.display_name, 'worker_type', w.account_type);
  END IF;
  seg := private.cleaner_owner_segment(_property, y);
  seg_from := (seg->>'segment_start')::date;
  cur_m := private.cleaner_worker_minutes(_property, _worker, y, seg_from);
  own_m := private.cleaner_owner_minutes(_property, y, seg_from, nullif(seg->>'owner_user_id','')::uuid);
  IF _projected_minutes IS NULL THEN est := private.cleaner_estimate(_property); proj_m := (est->>'minutes')::numeric;
  ELSE est := jsonb_build_object('minutes', _projected_minutes, 'source', CASE WHEN _projected_minutes = 0 THEN 'none' ELSE 'supplied' END); proj_m := _projected_minutes; END IF;
  total_h := round((cur_m + proj_m)/60.0, 2);
  own_h := round(own_m/60.0, 2);
  RETURN jsonb_build_object(
    'enrolled', true, 'year', y, 'worker_name', w.display_name, 'worker_type', w.account_type,
    'current_hours', round(cur_m/60.0,2), 'projected_clean_hours', round(proj_m/60.0,2), 'estimate_source', est->>'source',
    'projected_total_hours', total_h, 'owner_hours', own_h, 'owner_zero', own_m <= 0,
    'buffer_hours', CASE WHEN own_m > 0 THEN round(own_h - total_h, 2) END,
    'inversion', own_m > 0 AND total_h >= own_h,
    'segment_start', seg_from, 'owner_name', seg->>'owner_name',
    'state', private.cleaner_safeguard_state(total_h, own_h));
END $$;

-- 3. Provisional durations in the shared recalculation ------------------------
DO $$
DECLARE f oid; d text; old_t text := $o$    ELSIF invalid THEN
      d_method := 'invalid_duration_needs_review'; d_minutes := NULL; d_counted := false; d_state := 'needs_review'; d_conf := 'low';
    ELSE$o$;
  new_t text := $n$    ELSIF invalid OR short THEN
      -- Conservative provisional duration pending review (never zero).
      d_method := 'provisional_duration'; d_minutes := private.cleaner_standard_minutes(s.property_id); d_counted := true; d_state := 'needs_review'; d_conf := 'low';
    ELSIF long THEN
      -- Provisional cap: standard duration + 2.0 h, pending review.
      d_method := 'provisional_cap'; d_minutes := least(round(secs/60.0, 2), private.cleaner_standard_minutes(s.property_id) + 120); d_counted := true; d_state := 'needs_review'; d_conf := 'low';
    ELSE$n$;
BEGIN
  FOR f IN SELECT oid FROM pg_proc WHERE proname = 'cleaner_recompute_core' LOOP
    d := pg_get_functiondef(f);
    IF position(old_t in d) = 0 THEN RAISE EXCEPTION 'recompute duration branch not found'; END IF;
    EXECUTE replace(d, old_t, new_t);
  END LOOP;
END $$;

-- 4. Audit tables -----------------------------------------------------------
CREATE TABLE public.cleaner_safeguard_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('manager','emergency')),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  worker_id uuid NOT NULL REFERENCES public.cleaner_workers(id),
  task_ref text NOT NULL,
  breezeway_task_id bigint,
  scheduled_date date,
  year int NOT NULL,
  current_hours numeric NOT NULL,
  projected_clean_hours numeric NOT NULL,
  projected_total_hours numeric NOT NULL,
  owner_hours numeric NOT NULL,
  buffer_hours numeric,
  state_at_approval text NOT NULL,
  estimate_source text,
  reason_category text NOT NULL,
  justification text NOT NULL,
  approved_by uuid NOT NULL,
  approved_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_fixture boolean NOT NULL DEFAULT false,
  UNIQUE (task_ref, worker_id)
);
GRANT SELECT ON public.cleaner_safeguard_overrides TO authenticated;
GRANT ALL ON public.cleaner_safeguard_overrides TO service_role;
ALTER TABLE public.cleaner_safeguard_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership reads safeguard overrides" ON public.cleaner_safeguard_overrides FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.is_director(auth.uid()));
CREATE TRIGGER cleaner_overrides_append_only BEFORE UPDATE OR DELETE ON public.cleaner_safeguard_overrides
  FOR EACH ROW EXECUTE FUNCTION private.cleaner_block_snapshot_change();

CREATE TABLE public.cleaner_dispatch_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  worker_id uuid REFERENCES public.cleaner_workers(id),
  company_worker_id uuid REFERENCES public.cleaner_workers(id),
  task_ref text NOT NULL,
  breezeway_task_id bigint,
  scheduled_date date,
  state text NOT NULL,
  action text NOT NULL CHECK (action IN ('standard','acknowledged','manager_override','emergency_override','identity_review','override_requested','native_assignment')),
  evaluation jsonb NOT NULL DEFAULT '{}'::jsonb,
  override_id uuid REFERENCES public.cleaner_safeguard_overrides(id),
  note text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_fixture boolean NOT NULL DEFAULT false
);
CREATE INDEX cleaner_dispatch_task_idx ON public.cleaner_dispatch_decisions(task_ref, worker_id);
GRANT SELECT ON public.cleaner_dispatch_decisions TO authenticated;
GRANT ALL ON public.cleaner_dispatch_decisions TO service_role;
ALTER TABLE public.cleaner_dispatch_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership reads dispatch decisions" ON public.cleaner_dispatch_decisions FOR SELECT TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.is_director(auth.uid()));
CREATE TRIGGER cleaner_dispatch_append_only BEFORE UPDATE OR DELETE ON public.cleaner_dispatch_decisions
  FOR EACH ROW EXECUTE FUNCTION private.cleaner_block_snapshot_change();

-- 5. Staff-facing RPCs ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleaner_safeguard_check(_property uuid, _worker uuid, _task_ref text, _scheduled date DEFAULT NULL, _projected_minutes numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ev jsonb; ov record;
BEGIN
  IF NOT (public.is_internal_staff(auth.uid()) OR public.is_director(auth.uid())) THEN RAISE EXCEPTION 'Not permitted.'; END IF;
  ev := private.cleaner_safeguard_eval(_property, _worker, coalesce(_scheduled, (now() AT TIME ZONE 'America/Chicago')::date), _projected_minutes);
  SELECT id, kind, created_at, approved_by_name INTO ov FROM cleaner_safeguard_overrides WHERE task_ref = btrim(coalesce(_task_ref,'')) AND worker_id = _worker;
  RETURN ev || jsonb_build_object('can_override', public.is_director(auth.uid()),
    'override', CASE WHEN ov.id IS NULL THEN NULL ELSE jsonb_build_object('id', ov.id, 'kind', ov.kind, 'at', ov.created_at, 'by', ov.approved_by_name) END);
END $$;

CREATE OR REPLACE FUNCTION public.cleaner_record_dispatch(_property uuid, _worker uuid, _task_ref text, _scheduled date, _acknowledged boolean DEFAULT false, _individuals uuid[] DEFAULT NULL, _breezeway_task_id bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w record; ev jsonb; st text; ov record; act text; ind uuid; results jsonb := '[]'::jsonb; ref text := btrim(coalesce(_task_ref,''));
  fx boolean; rid uuid; on_date date := coalesce(_scheduled, (now() AT TIME ZONE 'America/Chicago')::date);
BEGIN
  IF NOT (public.is_internal_staff(auth.uid()) OR public.is_director(auth.uid())) THEN RAISE EXCEPTION 'Not permitted.'; END IF;
  IF length(ref) < 1 THEN RAISE EXCEPTION 'Enter the Breezeway Task or work item this clean belongs to.'; END IF;
  IF private.cleaner_tracking_from(_property) IS NULL THEN RAISE EXCEPTION 'This home is not enrolled in the STR cleaner-hours safeguard.'; END IF;
  SELECT is_fixture INTO fx FROM cleaner_hours_properties WHERE property_id=_property;
  SELECT * INTO w FROM cleaner_workers WHERE id=_worker;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Cleaner not found.'; END IF;

  IF w.account_type <> 'individual' THEN
    IF _individuals IS NULL OR cardinality(_individuals) = 0 THEN
      INSERT INTO cleaner_review_items(kind, dedupe_key, property_id, detail, is_fixture)
      VALUES ('company_identity_needed', 'identity:'||ref||':'||_worker, _property,
        jsonb_build_object('task_ref', ref, 'company', w.display_name, 'scheduled', on_date), fx)
      ON CONFLICT (dedupe_key) WHERE status='open' DO NOTHING RETURNING id INTO rid;
      INSERT INTO cleaner_dispatch_decisions(property_id, worker_id, company_worker_id, task_ref, breezeway_task_id, scheduled_date, state, action, actor_id, actor_name, is_fixture)
      VALUES (_property, NULL, _worker, ref, _breezeway_task_id, on_date, 'identity_required', 'identity_review', auth.uid(), private.cleaner_actor_name(auth.uid()), fx);
      IF rid IS NOT NULL THEN
        PERFORM private.cleaner_alert('leadership', 'Cleaner identity needed before dispatch',
          w.display_name||' was selected for an STR clean ('||ref||'). Identify the individual cleaner(s) before dispatch.', 'high', rid, auth.uid(), fx);
      END IF;
      RETURN jsonb_build_object('status', 'identity_review');
    END IF;
    FOREACH ind IN ARRAY _individuals LOOP
      results := results || public.cleaner_record_dispatch_one(_property, ind, _worker, ref, on_date, _acknowledged, _breezeway_task_id, fx);
    END LOOP;
    RETURN jsonb_build_object('status', 'dispatched', 'cleaners', results);
  END IF;
  RETURN jsonb_build_object('status', 'dispatched', 'cleaners', jsonb_build_array(public.cleaner_record_dispatch_one(_property, _worker, NULL, ref, on_date, _acknowledged, _breezeway_task_id, fx)));
END $$;

CREATE OR REPLACE FUNCTION public.cleaner_record_dispatch_one(_property uuid, _worker uuid, _company uuid, _ref text, _on date, _ack boolean, _bz bigint, _fx boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev jsonb; st text; ov record; act text; nm text;
BEGIN
  IF NOT (public.is_internal_staff(auth.uid()) OR public.is_director(auth.uid())) THEN RAISE EXCEPTION 'Not permitted.'; END IF;
  ev := private.cleaner_safeguard_eval(_property, _worker, _on, NULL);
  st := ev->>'state'; nm := ev->>'worker_name';
  IF st = 'identity_required' THEN RAISE EXCEPTION '% is not an individual cleaner. Choose the individual people doing the work.', nm; END IF;
  SELECT * INTO ov FROM cleaner_safeguard_overrides WHERE task_ref=_ref AND worker_id=_worker;
  IF st IN ('normal','monitor') THEN act := 'standard';
  ELSIF st = 'warning' THEN
    IF NOT coalesce(_ack,false) THEN RAISE EXCEPTION 'SAFEGUARD_ACK_REQUIRED: % is in Warning. Confirm that rotating to another cleaner was considered.', nm; END IF;
    act := 'acknowledged';
  ELSIF st = 'restricted' THEN
    IF ov.id IS NULL THEN RAISE EXCEPTION 'SAFEGUARD_RESTRICTED: % is Restricted for this home. Standard dispatch is locked; a single-clean override by the Director of Operations or an Admin is required.', nm; END IF;
    act := CASE WHEN ov.kind = 'emergency' THEN 'emergency_override' ELSE 'manager_override' END;
  ELSE
    IF ov.id IS NULL OR ov.kind <> 'emergency' THEN RAISE EXCEPTION 'SAFEGUARD_HARD_BLOCK: % is Hard Blocked for this home. Only a single-clean emergency override by the Director of Operations or an Admin can allow this clean.', nm; END IF;
    act := 'emergency_override';
  END IF;
  INSERT INTO cleaner_dispatch_decisions(property_id, worker_id, company_worker_id, task_ref, breezeway_task_id, scheduled_date, state, action, evaluation, override_id, actor_id, actor_name, is_fixture)
  VALUES (_property, _worker, _company, _ref, _bz, _on, st, act, ev, ov.id, auth.uid(), private.cleaner_actor_name(auth.uid()), _fx);
  -- Company login resolved to named people: close the identity item.
  IF _company IS NOT NULL THEN
    UPDATE cleaner_review_items SET status='resolved', resolved_at=now(), resolved_by=auth.uid(), resolved_by_name=private.cleaner_actor_name(auth.uid()),
      resolution_note='Individual cleaner(s) identified at dispatch' WHERE dedupe_key='identity:'||_ref||':'||_company AND status='open';
  END IF;
  RETURN jsonb_build_object('worker_id', _worker, 'worker_name', nm, 'state', st, 'action', act);
END $$;
REVOKE ALL ON FUNCTION public.cleaner_record_dispatch_one(uuid,uuid,uuid,text,date,boolean,bigint,boolean) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.cleaner_safeguard_override(_kind text, _property uuid, _worker uuid, _task_ref text, _scheduled date, _category text, _justification text, _breezeway_task_id bigint DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev jsonb; st text; oid_ uuid; ref text := btrim(coalesce(_task_ref,'')); fx boolean; nm text; on_date date := coalesce(_scheduled, (now() AT TIME ZONE 'America/Chicago')::date);
BEGIN
  -- Director of Operations seat holder or Admin only (never PCs, Primary PMs or Onboarding).
  IF NOT private.is_director(auth.uid()) THEN RAISE EXCEPTION 'Only the Director of Operations or an Admin can approve a safeguard override.'; END IF;
  IF _kind NOT IN ('manager','emergency') THEN RAISE EXCEPTION 'Unknown override type.'; END IF;
  IF length(ref) < 1 THEN RAISE EXCEPTION 'An override applies to one specific clean; enter its Breezeway Task or work item.'; END IF;
  IF length(btrim(coalesce(_justification,''))) < 25 THEN RAISE EXCEPTION 'Detailed justification is required (at least 25 characters).'; END IF;
  IF _kind = 'emergency' AND _category NOT IN ('emergency_guest_arrival_imminent','emergency_no_qualified_alternative','emergency_health_safety','emergency_property_damage') THEN
    RAISE EXCEPTION 'Choose an emergency reason category.'; END IF;
  IF _kind = 'manager' AND _category NOT IN ('no_alternative_cleaner','guest_or_owner_request','quality_recovery','schedule_conflict','other') THEN
    RAISE EXCEPTION 'Choose an override reason category.'; END IF;
  ev := private.cleaner_safeguard_eval(_property, _worker, on_date, NULL);
  st := ev->>'state'; nm := ev->>'worker_name';
  IF st = 'identity_required' OR st = 'not_tracked' THEN RAISE EXCEPTION 'Overrides apply only to individual cleaners at enrolled homes.'; END IF;
  IF _kind = 'manager' AND st = 'hard_block' THEN RAISE EXCEPTION 'This cleaner is Hard Blocked. Only an emergency override can allow this clean.'; END IF;
  IF _kind = 'manager' AND st <> 'restricted' THEN RAISE EXCEPTION 'A manager override is only needed in the Restricted state (current: %).', st; END IF;
  IF _kind = 'emergency' AND st <> 'hard_block' THEN RAISE EXCEPTION 'An emergency override is only for the Hard Block state (current: %).', st; END IF;
  SELECT is_fixture INTO fx FROM cleaner_hours_properties WHERE property_id=_property;
  INSERT INTO cleaner_safeguard_overrides(kind, property_id, worker_id, task_ref, breezeway_task_id, scheduled_date, year, current_hours,
    projected_clean_hours, projected_total_hours, owner_hours, buffer_hours, state_at_approval, estimate_source, reason_category, justification,
    approved_by, approved_by_name, is_fixture)
  VALUES (_kind, _property, _worker, ref, _breezeway_task_id, on_date, (ev->>'year')::int, (ev->>'current_hours')::numeric,
    (ev->>'projected_clean_hours')::numeric, (ev->>'projected_total_hours')::numeric, (ev->>'owner_hours')::numeric, nullif(ev->>'buffer_hours','')::numeric,
    st, ev->>'estimate_source', _category, btrim(_justification), auth.uid(), private.cleaner_actor_name(auth.uid()), coalesce(fx,false))
  RETURNING id INTO oid_;
  UPDATE cleaner_review_items SET status='resolved', resolved_at=now(), resolved_by=auth.uid(), resolved_by_name=private.cleaner_actor_name(auth.uid()),
    resolution_note=initcap(_kind)||' override approved' WHERE dedupe_key='ovr:'||ref||':'||_worker AND status='open';
  PERFORM private.cleaner_alert('leadership',
    CASE WHEN _kind='emergency' THEN 'EMERGENCY safeguard override approved' ELSE 'Safeguard override approved' END,
    nm||' approved for one clean ('||ref||') by '||private.cleaner_actor_name(auth.uid())||'. Projected '||(ev->>'projected_total_hours')||' h Attributed Cleaner Time'
      ||CASE WHEN _kind='emergency' THEN '. Cleaner remains Hard Blocked for future standard assignments.' ELSE '.' END,
    CASE WHEN _kind='emergency' THEN 'urgent' ELSE 'high' END, oid_, NULL, coalesce(fx,false));
  RETURN oid_;
END $$;

CREATE OR REPLACE FUNCTION public.cleaner_safeguard_request_override(_property uuid, _worker uuid, _task_ref text, _scheduled date, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev jsonb; ref text := btrim(coalesce(_task_ref,'')); fx boolean; rid uuid; on_date date := coalesce(_scheduled, (now() AT TIME ZONE 'America/Chicago')::date);
BEGIN
  IF NOT (public.is_internal_staff(auth.uid()) OR public.is_director(auth.uid())) THEN RAISE EXCEPTION 'Not permitted.'; END IF;
  IF length(ref) < 1 THEN RAISE EXCEPTION 'Enter the Breezeway Task or work item.'; END IF;
  IF length(btrim(coalesce(_note,''))) < 10 THEN RAISE EXCEPTION 'Explain why this cleaner is needed (at least 10 characters).'; END IF;
  ev := private.cleaner_safeguard_eval(_property, _worker, on_date, NULL);
  IF ev->>'state' NOT IN ('restricted','hard_block') THEN RAISE EXCEPTION 'No override is needed in the % state.', ev->>'state'; END IF;
  SELECT is_fixture INTO fx FROM cleaner_hours_properties WHERE property_id=_property;
  INSERT INTO cleaner_review_items(kind, dedupe_key, property_id, detail, is_fixture)
  VALUES ('override_request', 'ovr:'||ref||':'||_worker, _property, ev || jsonb_build_object('task_ref', ref, 'worker_id', _worker, 'scheduled', on_date,
    'reason', btrim(_note), 'requested_by', private.cleaner_actor_name(auth.uid())), coalesce(fx,false))
  ON CONFLICT (dedupe_key) WHERE status='open' DO NOTHING RETURNING id INTO rid;
  INSERT INTO cleaner_dispatch_decisions(property_id, worker_id, task_ref, scheduled_date, state, action, evaluation, note, actor_id, actor_name, is_fixture)
  VALUES (_property, _worker, ref, on_date, ev->>'state', 'override_requested', ev, btrim(_note), auth.uid(), private.cleaner_actor_name(auth.uid()), coalesce(fx,false));
  IF rid IS NOT NULL THEN
    PERFORM private.cleaner_alert('leadership', 'Safeguard override requested',
      (ev->>'worker_name')||' ('||replace(initcap(ev->>'state'),'_',' ')||') requested for '||ref||'. Leadership review required.', 'urgent', rid, auth.uid(), coalesce(fx,false));
  END IF;
END $$;

-- Options for the dispatch check (PCs have no direct table access).
CREATE OR REPLACE FUNCTION public.cleaner_dispatch_options()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_internal_staff(auth.uid()) OR public.is_director(auth.uid())) THEN RAISE EXCEPTION 'Not permitted.'; END IF;
  RETURN jsonb_build_object(
    'homes', coalesce((SELECT jsonb_agg(jsonb_build_object('property_id', h.property_id, 'name', p.name, 'is_fixture', h.is_fixture) ORDER BY p.name)
       FROM cleaner_hours_properties h JOIN properties p ON p.id=h.property_id WHERE h.active), '[]'::jsonb),
    'workers', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', display_name, 'type', account_type) ORDER BY display_name)
       FROM cleaner_workers WHERE active AND account_type IN ('individual','company')), '[]'::jsonb),
    'tasks', coalesce((SELECT jsonb_agg(jsonb_build_object('task_id', s.breezeway_task_id, 'property_id', s.property_id, 'name', s.task_name,
        'scheduled_date', s.scheduled_date, 'assignees', s.assignees) ORDER BY s.scheduled_date)
       FROM cleaner_task_state t JOIN cleaner_task_snapshots s ON s.id=t.latest_snapshot_id
       JOIN cleaner_hours_properties h ON h.property_id=s.property_id AND h.active
       WHERE coalesce(s.status_stage,'') <> 'finished' AND (s.scheduled_date IS NULL OR s.scheduled_date >= (now() AT TIME ZONE 'America/Chicago')::date - 1)), '[]'::jsonb));
END $$;

-- Rotation aid: cleaners sorted by lowest exposure at this home.
CREATE OR REPLACE FUNCTION public.cleaner_rotation(_property uuid, _on date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d date := coalesce(_on, (now() AT TIME ZONE 'America/Chicago')::date); out jsonb;
BEGIN
  IF NOT (public.is_internal_staff(auth.uid()) OR public.is_director(auth.uid())) THEN RAISE EXCEPTION 'Not permitted.'; END IF;
  SELECT coalesce(jsonb_agg(e ORDER BY (e->>'projected_total_hours')::numeric, e->>'worker_name'), '[]'::jsonb) INTO out FROM (
    SELECT private.cleaner_safeguard_eval(_property, w.id, d, NULL) || jsonb_build_object('worker_id', w.id) e
      FROM cleaner_workers w WHERE w.active AND w.account_type='individual') x;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.cleaner_set_standard_duration(_property uuid, _minutes integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_supervisor(auth.uid()) THEN RAISE EXCEPTION 'Only Operations leadership can set the standard clean duration.'; END IF;
  UPDATE cleaner_hours_properties SET standard_clean_minutes = _minutes WHERE property_id=_property;
  IF NOT FOUND THEN RAISE EXCEPTION 'This home is not enrolled.'; END IF;
END $$;

-- Portfolio dashboard (leadership).
CREATE OR REPLACE FUNCTION public.cleaner_safeguard_portfolio(_year int, _include_fixture boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d date; props jsonb := '[]'::jsonb; h record; seg jsonb; cells jsonb; nxt record; own_m numeric; lowq int;
BEGIN
  IF NOT (public.is_supervisor(auth.uid()) OR public.is_director(auth.uid())) THEN RAISE EXCEPTION 'Not permitted.'; END IF;
  d := CASE WHEN _year = extract(year FROM (now() AT TIME ZONE 'America/Chicago'))::int THEN (now() AT TIME ZONE 'America/Chicago')::date ELSE make_date(_year,12,31) END;
  FOR h IN SELECT cp.*, p.name FROM cleaner_hours_properties cp JOIN properties p ON p.id=cp.property_id
            WHERE (cp.is_fixture = false OR _include_fixture) AND (cp.active OR extract(year FROM cp.tracking_from) <= _year) ORDER BY p.name LOOP
    seg := private.cleaner_owner_segment(h.property_id, _year);
    own_m := private.cleaner_owner_minutes(h.property_id, _year, (seg->>'segment_start')::date, nullif(seg->>'owner_user_id','')::uuid);
    SELECT coalesce(jsonb_agg(e ORDER BY (e->>'projected_total_hours')::numeric DESC), '[]'::jsonb) INTO cells FROM (
      SELECT private.cleaner_safeguard_eval(h.property_id, w, d, 0) || jsonb_build_object('worker_id', w) e
        FROM (SELECT DISTINCT l.worker_id w FROM cleaner_exposure_ledger l JOIN cleaner_workers cw ON cw.id=l.worker_id AND cw.account_type='individual'
               WHERE l.property_id=h.property_id AND l.superseded_at IS NULL AND extract(year FROM l.completion_date)::int=_year) ws) x;
    SELECT s.breezeway_task_id, s.scheduled_date, s.task_name INTO nxt FROM cleaner_task_state t JOIN cleaner_task_snapshots s ON s.id=t.latest_snapshot_id
      WHERE s.property_id=h.property_id AND coalesce(s.status_stage,'') <> 'finished' AND s.scheduled_date >= (now() AT TIME ZONE 'America/Chicago')::date
      ORDER BY s.scheduled_date LIMIT 1;
    SELECT count(*) INTO lowq FROM cleaner_exposure_ledger WHERE property_id=h.property_id AND superseded_at IS NULL AND review_state='needs_review'
      AND extract(year FROM completion_date)::int=_year;
    props := props || jsonb_build_object('property_id', h.property_id, 'name', h.name, 'active', h.active, 'tracking_from', h.tracking_from,
      'standard_clean_minutes', h.standard_clean_minutes, 'is_fixture', h.is_fixture, 'owner_name', seg->>'owner_name', 'segment_start', seg->>'segment_start',
      'owner_hours', round(own_m/60.0,2), 'owner_zero', own_m <= 0, 'cleaners', cells, 'needs_review_entries', lowq,
      'next_clean', CASE WHEN nxt.breezeway_task_id IS NULL THEN NULL ELSE jsonb_build_object('task_id', nxt.breezeway_task_id, 'date', nxt.scheduled_date, 'name', nxt.task_name) END);
  END LOOP;
  RETURN jsonb_build_object('year', _year, 'as_of', d, 'properties', props,
    'overrides', coalesce((SELECT jsonb_agg(to_jsonb(o) || jsonb_build_object('property_name', p.name, 'worker_name', w.display_name) ORDER BY o.created_at DESC)
      FROM (SELECT * FROM cleaner_safeguard_overrides WHERE (NOT is_fixture OR _include_fixture) AND year=_year ORDER BY created_at DESC LIMIT 50) o
      JOIN properties p ON p.id=o.property_id JOIN cleaner_workers w ON w.id=o.worker_id), '[]'::jsonb));
END $$;

-- 6. Manual cleans count only once approved -----------------------------------
CREATE OR REPLACE FUNCTION public.add_manual_cleaner_clean(_worker_id uuid, _property_id uuid, _date date, _minutes numeric, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w record; nid uuid := gen_random_uuid(); fx boolean;
BEGIN
  IF NOT public.is_supervisor(auth.uid()) THEN RAISE EXCEPTION 'Only Operations leadership can add cleaner time.'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'Explain where this clean is documented.'; END IF;
  IF _minutes IS NULL OR _minutes <= 0 OR _minutes > 1440 THEN RAISE EXCEPTION 'Minutes must be between 1 and 1,440.'; END IF;
  IF _date IS NULL OR _date > (now() AT TIME ZONE 'America/Chicago')::date THEN RAISE EXCEPTION 'The clean date cannot be in the future.'; END IF;
  SELECT * INTO w FROM cleaner_workers WHERE id=_worker_id;
  IF w IS NULL OR w.account_type <> 'individual' THEN RAISE EXCEPTION 'Choose an individual cleaner.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM properties WHERE id=_property_id) THEN RAISE EXCEPTION 'Property not found.'; END IF;
  SELECT is_fixture INTO fx FROM cleaner_hours_properties WHERE property_id=_property_id;
  INSERT INTO cleaner_exposure_ledger(id, entry_key, worker_id, property_id, completion_date, attributed_minutes, attribution_method,
    counted, review_state, confidence, reason, author_id, author_name, is_fixture)
  VALUES (nid, 'manual:'||nid, _worker_id, _property_id, _date, round(_minutes,2), 'manual_entry', false, 'needs_review', 'medium',
    btrim(_reason), auth.uid(), private.cleaner_actor_name(auth.uid()), coalesce(fx,false));
  PERFORM private.cleaner_open_review('manual_entry', 'manual:'||nid, NULL, NULL, NULL, _property_id, NULL,
    jsonb_build_object('worker', w.display_name, 'minutes', _minutes, 'date', _date, 'reason', btrim(_reason)), coalesce(fx,false));
  UPDATE cleaner_review_items SET ledger_entry_id = nid WHERE dedupe_key='manual:'||nid AND status='open';
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_cleaner_review(_id uuid, _status text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it record; e record;
BEGIN
  IF NOT public.is_supervisor(auth.uid()) THEN RAISE EXCEPTION 'Only Operations leadership can close review items.'; END IF;
  IF _status NOT IN ('resolved','dismissed') THEN RAISE EXCEPTION 'Unknown status.'; END IF;
  IF length(btrim(coalesce(_note,''))) < 5 THEN RAISE EXCEPTION 'Add a note explaining the decision.'; END IF;
  UPDATE cleaner_review_items SET status=_status, resolved_at=now(), resolved_by=auth.uid(),
    resolved_by_name=private.cleaner_actor_name(auth.uid()), resolution_note=btrim(_note)
   WHERE id=_id AND status='open' RETURNING * INTO it;
  IF it.id IS NULL THEN RAISE EXCEPTION 'This review item is already closed.'; END IF;
  IF it.kind = 'manual_entry' AND it.ledger_entry_id IS NOT NULL THEN
    SELECT * INTO e FROM cleaner_exposure_ledger WHERE id=it.ledger_entry_id AND superseded_at IS NULL;
    IF e.id IS NOT NULL AND NOT e.counted THEN
      UPDATE cleaner_exposure_ledger SET superseded_at=now(),
        superseded_reason = CASE WHEN _status='resolved' THEN 'Approved by '||private.cleaner_actor_name(auth.uid()) ELSE 'Not approved: '||btrim(_note) END
       WHERE id=e.id;
      IF _status = 'resolved' THEN
        INSERT INTO cleaner_exposure_ledger(entry_key, worker_id, property_id, completion_date, attributed_minutes, attribution_method,
          counted, review_state, confidence, reason, author_id, author_name, supersedes_id, is_fixture)
        VALUES (e.entry_key, e.worker_id, e.property_id, e.completion_date, e.attributed_minutes, 'manual_entry', true, 'reviewed', 'medium',
          e.reason, auth.uid(), private.cleaner_actor_name(auth.uid()), e.id, e.is_fixture);
        PERFORM private.cleaner_safeguard_thresholds(e.property_id, e.is_fixture);
      END IF;
    END IF;
  END IF;
END $$;

-- 7. Threshold and Breezeway-native assignment alerts ------------------------
CREATE OR REPLACE FUNCTION private.cleaner_safeguard_thresholds(_property uuid, _fixture boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d date := (now() AT TIME ZONE 'America/Chicago')::date; y int := extract(year FROM (now() AT TIME ZONE 'America/Chicago'))::int;
  w uuid; ev jsonb; st text; key text; rid uuid; nm text; pname text;
BEGIN
  IF private.cleaner_tracking_from(_property) IS NULL THEN RETURN; END IF;
  SELECT name INTO pname FROM properties WHERE id=_property;
  FOR w IN SELECT DISTINCT l.worker_id FROM cleaner_exposure_ledger l JOIN cleaner_workers cw ON cw.id=l.worker_id AND cw.account_type='individual'
            WHERE l.property_id=_property AND l.superseded_at IS NULL AND extract(year FROM l.completion_date)::int = y LOOP
    ev := private.cleaner_safeguard_eval(_property, w, d, 0);
    st := ev->>'state'; nm := ev->>'worker_name';
    IF st IN ('warning','restricted','hard_block') OR (ev->>'inversion')::boolean THEN
      key := 'thr:'||_property||':'||w||':'||y||':'||CASE WHEN (ev->>'inversion')::boolean AND st NOT IN ('hard_block') THEN 'inversion' ELSE st END;
      INSERT INTO cleaner_review_items(kind, dedupe_key, property_id, detail, is_fixture)
      VALUES ('threshold_reached', key, _property, ev || jsonb_build_object('worker_id', w), _fixture)
      ON CONFLICT (dedupe_key) WHERE status='open' DO NOTHING RETURNING id INTO rid;
      IF rid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cleaner_review_items WHERE dedupe_key=key AND id<>rid) THEN
        IF st = 'warning' AND NOT (ev->>'inversion')::boolean THEN
          PERFORM private.cleaner_alert('pc', 'Cleaner in Warning at '||coalesce(pname,'an STR home'),
            nm||' has '||(ev->>'current_hours')||' h Attributed Cleaner Time here. Consider rotating cleaner before the next clean.', 'high', rid, NULL, _fixture);
        ELSE
          PERFORM private.cleaner_alert('leadership',
            CASE WHEN (ev->>'inversion')::boolean AND st <> 'hard_block' THEN 'Hours inversion at ' ELSE replace(initcap(st),'_',' ')||' state at ' END||coalesce(pname,'an STR home'),
            nm||': '||(ev->>'current_hours')||' h Attributed Cleaner Time; owner hours '||(ev->>'owner_hours')||' h. Leadership review required.', 'urgent', rid, NULL, _fixture);
        END IF;
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.cleaner_safeguard_after_task(_task bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; a record; ev jsonb; st text; key text; rid uuid; pname text; d date;
BEGIN
  SELECT sn.* INTO s FROM cleaner_task_state t JOIN cleaner_task_snapshots sn ON sn.id=t.latest_snapshot_id WHERE t.breezeway_task_id=_task;
  IF s.id IS NULL OR s.property_id IS NULL OR private.cleaner_tracking_from(s.property_id) IS NULL THEN RETURN; END IF;
  SELECT name INTO pname FROM properties WHERE id=s.property_id;
  IF coalesce(s.status_stage,'') <> 'finished' THEN
    d := coalesce(s.scheduled_date, (now() AT TIME ZONE 'America/Chicago')::date);
    FOR a IN SELECT c.* FROM jsonb_array_elements(s.assignees) x
               JOIN cleaner_breezeway_accounts c ON c.breezeway_person_id = (x->>'assignee_id')::bigint
              WHERE (x->>'assignee_id') ~ '^\d+$' LOOP
      IF a.classification = 'company' THEN
        key := 'identity:'||_task||':'||a.worker_id;
        INSERT INTO cleaner_review_items(kind, dedupe_key, breezeway_task_id, breezeway_person_id, property_id, detail, is_fixture)
        VALUES ('company_identity_needed', key, _task, a.breezeway_person_id, s.property_id,
          jsonb_build_object('task_ref', _task::text, 'company', a.last_seen_name, 'scheduled', d, 'source', 'breezeway'), s.is_fixture)
        ON CONFLICT (dedupe_key) WHERE status='open' DO NOTHING;
      ELSIF a.classification IN ('individual','duplicate') AND a.worker_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM cleaner_dispatch_decisions dd WHERE dd.task_ref=_task::text AND dd.worker_id=a.worker_id
                              AND dd.action IN ('standard','acknowledged','manager_override','emergency_override')) THEN
        ev := private.cleaner_safeguard_eval(s.property_id, a.worker_id, d, NULL);
        st := ev->>'state';
        IF st IN ('warning','restricted','hard_block') THEN
          key := 'native:'||_task||':'||a.worker_id;
          INSERT INTO cleaner_review_items(kind, dedupe_key, breezeway_task_id, breezeway_person_id, property_id, detail, is_fixture)
          VALUES ('native_assignment_alert', key, _task, a.breezeway_person_id, s.property_id, ev || jsonb_build_object('worker_id', a.worker_id, 'scheduled', d), s.is_fixture)
          ON CONFLICT (dedupe_key) WHERE status='open' DO NOTHING RETURNING id INTO rid;
          IF rid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cleaner_review_items WHERE dedupe_key=key AND id<>rid) THEN
            INSERT INTO cleaner_dispatch_decisions(property_id, worker_id, task_ref, breezeway_task_id, scheduled_date, state, action, evaluation, note, is_fixture)
            VALUES (s.property_id, a.worker_id, _task::text, _task, d, st, 'native_assignment', ev, 'Assigned directly in Breezeway', s.is_fixture);
            PERFORM private.cleaner_alert('both', 'URGENT: Breezeway assignment outside the safeguard at '||coalesce(pname,'an STR home'),
              (ev->>'worker_name')||' was assigned in Breezeway (Task '||_task||') and would be '||replace(initcap(st),'_',' ')
              ||' in Resolve (projected '||(ev->>'projected_total_hours')||' h). Consider rotating cleaner.', 'urgent', rid, NULL, s.is_fixture);
          END IF;
        END IF;
      END IF;
    END LOOP;
  ELSE
    PERFORM private.cleaner_safeguard_thresholds(s.property_id, s.is_fixture);
  END IF;
END $$;

DO $$
DECLARE d text; old_t text := '  res := private.cleaner_recompute_task(task);';
BEGIN
  d := pg_get_functiondef('public.cleaner_ingest_task'::regproc);
  IF position(old_t in d) = 0 THEN RAISE EXCEPTION 'ingest hook point not found'; END IF;
  EXECUTE replace(d, old_t, old_t || E'\n  PERFORM private.cleaner_safeguard_after_task(task);');
END $$;

-- Weekly Operations digest (in-app, Director of Operations + Admins).
CREATE OR REPLACE FUNCTION public.cleaner_safeguard_weekly_digest()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE homes int; warn int; restr int; hard int; ovr int; open_items int; body text; r uuid;
BEGIN
  SELECT count(*) INTO homes FROM cleaner_hours_properties WHERE active AND NOT is_fixture;
  IF homes = 0 THEN RETURN; END IF;
  SELECT count(*) FILTER (WHERE detail->>'state'='warning'), count(*) FILTER (WHERE detail->>'state'='restricted'), count(*) FILTER (WHERE detail->>'state'='hard_block')
    INTO warn, restr, hard FROM cleaner_review_items WHERE kind='threshold_reached' AND status='open' AND NOT is_fixture;
  SELECT count(*) INTO ovr FROM cleaner_safeguard_overrides WHERE NOT is_fixture AND created_at > now() - interval '7 days';
  SELECT count(*) INTO open_items FROM cleaner_review_items WHERE status='open' AND NOT is_fixture;
  body := homes||' enrolled STR home(s). Open states — Warning: '||warn||', Restricted: '||restr||', Hard Block: '||hard
    ||'. Overrides this week: '||ovr||'. Open Attention Queue items: '||open_items||'.';
  FOR r IN SELECT * FROM private.cleaner_leadership_ids() LOOP
    PERFORM public.notify_staff(r, 'cleaner_safeguard_digest', 'Weekly STR cleaner time digest', body, 'cleaner_safeguard', NULL, '/cleaner-hours', 'normal', NULL, false, false);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.cleaner_safeguard_weekly_digest() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cleaner_safeguard_check(uuid,uuid,text,date,numeric), public.cleaner_record_dispatch(uuid,uuid,text,date,boolean,uuid[],bigint),
  public.cleaner_safeguard_override(text,uuid,uuid,text,date,text,text,bigint), public.cleaner_safeguard_request_override(uuid,uuid,text,date,text),
  public.cleaner_dispatch_options(), public.cleaner_rotation(uuid,date), public.cleaner_set_standard_duration(uuid,integer),
  public.cleaner_safeguard_portfolio(int,boolean) TO authenticated;