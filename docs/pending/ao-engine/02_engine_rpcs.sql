-- Active Owner plan engine, pass 2. STAGED ONLY. Not applied. Requires 01_engine_foundation.sql.
-- Adds new functions and one trigger only; replaces no live function, policy or trigger (undo is plain removal).
-- HARD RULE: never inserts, updates or deletes onboarding templates (Full Plan, Standard), versions, steps,
-- home plans or Tasks. The Task trigger below only READS the completed Task row.
--
-- Home stage rule (private.ao_home_stage):
--   operations        = onboarding project handoff_state 'accepted', or ops_accepted_at / completed_at set, or no project
--   onboarding_launch = handoff_state 'ready', or ready_for_ops_at set, or planned closing date reached
--   onboarding_early  = everything else

CREATE OR REPLACE FUNCTION private.ao_is_editor(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (public.has_role(_uid,'admin') OR public.is_onboarding_director(_uid))
$$;

CREATE OR REPLACE FUNCTION private.ao_add_business_days(_d date, _n int) RETURNS date
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE d date := _d; left_n int := abs(_n); step int := CASE WHEN _n >= 0 THEN 1 ELSE -1 END;
BEGIN
  WHILE left_n > 0 LOOP
    d := d + step;
    IF extract(isodow FROM d) < 6 AND NOT EXISTS (SELECT 1 FROM public.ao_business_holidays h WHERE h.day = d) THEN
      left_n := left_n - 1;
    END IF;
  END LOOP;
  RETURN d;
END $$;

CREATE OR REPLACE FUNCTION private.ao_central(_d date, _hh int) RETURNS timestamptz
LANGUAGE sql IMMUTABLE AS $$ SELECT ((_d::timestamp + make_interval(hours => _hh)) AT TIME ZONE 'America/Chicago') $$;

CREATE OR REPLACE FUNCTION private.ao_home_stage(_property uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT CASE
      WHEN p.handoff_state = 'accepted' OR p.ops_accepted_at IS NOT NULL OR p.completed_at IS NOT NULL THEN 'operations'
      WHEN p.handoff_state = 'ready' OR p.ready_for_ops_at IS NOT NULL
        OR (p.planned_closing_on IS NOT NULL AND p.planned_closing_on <= (now() AT TIME ZONE 'America/Chicago')::date) THEN 'onboarding_launch'
      ELSE 'onboarding_early' END
    FROM public.onboarding_projects p WHERE p.property_id = _property
    ORDER BY p.created_at DESC LIMIT 1), 'operations')
$$;

-- 1. LIBRARY EDITOR -------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ao_card_save(_card_id uuid, _patch jsonb) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.ao_library_cards; uid uuid := auth.uid();
BEGIN
  IF NOT private.ao_is_editor(uid) THEN RAISE EXCEPTION 'Only Admin or Onboarding Director can edit the card library' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM public.ao_library_cards WHERE id = _card_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Card not found'; END IF;
  IF _patch ?| ARRAY['id','code','status','version','created_at','retired_at','updated_by','updated_at'] THEN
    RAISE EXCEPTION 'These fields cannot be edited here';
  END IF;
  c := jsonb_populate_record(c, _patch);
  UPDATE public.ao_library_cards SET
    title = c.title, what_text = c.what_text, why_text = c.why_text, how_text = c.how_text,
    required_output = c.required_output, documentation_note = c.documentation_note,
    est_hours_min = c.est_hours_min, est_hours_max = c.est_hours_max, lane = c.lane, stage_window = c.stage_window,
    team_needs_this = c.team_needs_this, lock_rule = c.lock_rule, linked_template_task_ids = c.linked_template_task_ids,
    card_group = c.card_group, event_triggered = c.event_triggered, opens_text = c.opens_text,
    deadline_text = c.deadline_text, deadline_business_days = c.deadline_business_days,
    deadline_calendar_days = c.deadline_calendar_days, cutoff_rule = c.cutoff_rule,
    cutoff_business_days = c.cutoff_business_days, takeover_text = c.takeover_text, output_fields = c.output_fields,
    version = version + 1, updated_by = uid, updated_at = now()
  WHERE id = _card_id RETURNING * INTO c;
  INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (c.id, c.version, to_jsonb(c), uid);
  RETURN c.version;
END $$;

CREATE OR REPLACE FUNCTION public.ao_card_set_status(_card_id uuid, _status text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.ao_library_cards; uid uuid := auth.uid();
BEGIN
  IF NOT private.ao_is_editor(uid) THEN RAISE EXCEPTION 'Only Admin or Onboarding Director can change card status' USING ERRCODE = '42501'; END IF;
  IF _status NOT IN ('draft','released','retired') THEN RAISE EXCEPTION 'Unknown status'; END IF;
  UPDATE public.ao_library_cards SET status = _status, version = version + 1, updated_by = uid, updated_at = now(),
    retired_at = CASE WHEN _status = 'retired' THEN now() ELSE NULL END
  WHERE id = _card_id RETURNING * INTO c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Card not found'; END IF;
  INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (c.id, c.version, to_jsonb(c), uid);
  RETURN c.version;
END $$;

-- 3. UNLOCK (shared by Task completion and staff backup) ---------------------------------------------
CREATE OR REPLACE FUNCTION private.ao_unlock(_plan_card uuid, _actor uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pc public.ao_home_plan_cards; c public.ao_library_cards; start_d date; dl date; flex boolean;
BEGIN
  SELECT * INTO pc FROM public.ao_home_plan_cards WHERE id = _plan_card FOR UPDATE;
  IF NOT FOUND OR pc.join_outcome <> 'locked' OR pc.unlocked_at IS NOT NULL THEN RETURN false; END IF;
  SELECT * INTO c FROM public.ao_library_cards WHERE id = pc.card_id;
  start_d := (now() AT TIME ZONE 'America/Chicago')::date;
  flex := c.lane = 'flexible' OR c.cutoff_rule = 'none';
  dl := CASE WHEN c.deadline_business_days IS NOT NULL THEN private.ao_add_business_days(start_d, c.deadline_business_days)
             WHEN c.deadline_calendar_days IS NOT NULL THEN start_d + c.deadline_calendar_days END;
  UPDATE public.ao_home_plan_cards SET unlocked_at = now(), unlocked_by = _actor,
    deadline_at = CASE WHEN dl IS NOT NULL THEN private.ao_central(dl, 17) END,
    reminder_at = CASE WHEN dl IS NOT NULL AND NOT flex THEN private.ao_central(private.ao_add_business_days(dl, -1), 17) END,
    cutoff_at = CASE WHEN dl IS NOT NULL AND NOT flex THEN private.ao_central(private.ao_add_business_days(dl, greatest(1, c.cutoff_business_days)), 9) END
  WHERE id = pc.id;
  UPDATE public.owner_reviews SET status = 'awaiting_owner', available_from = now(), respond_by = dl,
    recommendation = c.why_text, updated_at = now()
  WHERE id = pc.owner_review_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.ao_unlock_now(_plan_card uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  ok := private.ao_unlock(_plan_card, auth.uid());
  IF ok THEN
    INSERT INTO public.ao_home_plan_settings_history(property_id, automated, changed_by)
    SELECT property_id, true, auth.uid() FROM public.ao_home_plan_cards WHERE id = _plan_card;
  END IF;
  RETURN ok;
END $$;

CREATE OR REPLACE FUNCTION private.ao_task_completed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NEW.status = 'complete' AND OLD.status IS DISTINCT FROM 'complete' THEN
    FOR r IN SELECT pc.id FROM public.ao_home_plan_cards pc
      JOIN public.ao_home_plan_settings s ON s.property_id = pc.property_id AND s.automated
      WHERE pc.linked_task_id = NEW.id AND pc.join_outcome = 'locked' AND pc.unlocked_at IS NULL
    LOOP PERFORM private.ao_unlock(r.id, NEW.completed_by); END LOOP;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER ao_unlock_on_task_complete AFTER UPDATE OF status ON public.onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION private.ao_task_completed();

-- 2. PER-HOME SWITCH + JOIN AT CURRENT STAGE ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ao_set_home_automation(_property uuid, _on boolean, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); prog public.owner_programs; stage text; c public.ao_library_cards;
  outcome text; task_id uuid; task_done boolean; rid uuid; pcid uuid; demo boolean; counts jsonb := '{}'::jsonb;
BEGIN
  IF NOT private.ao_is_editor(uid) THEN RAISE EXCEPTION 'Only Admin or Onboarding Director can change the automated plan' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.ao_home_plan_settings(property_id, automated, updated_by, updated_at) VALUES (_property, _on, uid, now())
    ON CONFLICT (property_id) DO UPDATE SET automated = EXCLUDED.automated, updated_by = uid, updated_at = now();
  INSERT INTO public.ao_home_plan_settings_history(property_id, automated, changed_by) VALUES (_property, _on, uid);
  IF NOT _on THEN RETURN jsonb_build_object('automated', false); END IF; -- OFF never edits or deletes existing items

  SELECT * INTO prog FROM public.owner_programs WHERE property_id = _property AND status = 'active' AND archived_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'This home has no active Active Owner program'; END IF;
  stage := private.ao_home_stage(_property);
  demo := prog.is_demo OR coalesce((SELECT is_demo FROM public.properties WHERE id = _property), false);

  FOR c IN SELECT * FROM public.ao_library_cards WHERE status = 'released' ORDER BY code LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.ao_home_plan_cards WHERE property_id = _property AND card_id = c.id);
    SELECT t.id, t.status = 'complete' INTO task_id, task_done FROM public.onboarding_tasks t
      WHERE t.property_id = _property AND t.archived_at IS NULL AND t.template_task_id = ANY (c.linked_template_task_ids)
      ORDER BY t.created_at LIMIT 1;
    outcome := CASE
      WHEN c.stage_window <> 'anytime' AND
           (CASE c.stage_window WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) <
           (CASE stage WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) THEN 'skipped_passed'
      WHEN c.id = ANY (_covered_card_ids) THEN 'already_covered'
      WHEN c.lock_rule = 'until_linked_step_done' AND NOT coalesce(task_done, false) THEN 'locked'
      ELSE 'open' END;
    rid := NULL;
    IF outcome IN ('locked','open') THEN
      INSERT INTO public.owner_reviews(program_id, property_id, phase, stage, title, recommendation, status, source_type,
        owner_action_type, onboarding_task_id, is_demo, created_by, task_type)
      VALUES (prog.id, _property, 'onboarding', c.stage_window, c.title,
        CASE WHEN outcome = 'locked' THEN 'Coming soon: waiting on ARHA to ' || coalesce(nullif(c.opens_text,''), 'finish the step before this') ELSE c.why_text END,
        CASE WHEN outcome = 'locked' THEN 'prepared' ELSE 'awaiting_owner' END,
        'onboarding', 'participate', task_id, demo, uid, 'property')
      RETURNING id INTO rid;
    END IF;
    INSERT INTO public.ao_home_plan_cards(property_id, program_id, card_id, card_version, join_outcome, owner_review_id, linked_task_id)
      VALUES (_property, prog.id, c.id, c.version, outcome, rid, task_id) RETURNING id INTO pcid;
    IF outcome = 'open' THEN
      -- open cards start their clock now (same rule as unlock)
      UPDATE public.ao_home_plan_cards SET join_outcome = 'locked' WHERE id = pcid;
      PERFORM private.ao_unlock(pcid, uid);
      UPDATE public.ao_home_plan_cards SET join_outcome = 'open' WHERE id = pcid;
    END IF;
    counts := jsonb_set(counts, ARRAY[outcome], to_jsonb(coalesce((counts->>outcome)::int, 0) + 1));
  END LOOP;
  RETURN jsonb_build_object('automated', true, 'stage', stage, 'outcomes', counts);
END $$;

-- 6. CONTRIBUTIONS (owner submit; first answer counts) ------------------------------------------------
CREATE OR REPLACE FUNCTION public.ao_submit_card(_plan_card uuid, _values jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pc public.ao_home_plan_cards; cid uuid; uid uuid := auth.uid();
BEGIN
  SELECT * INTO pc FROM public.ao_home_plan_cards WHERE id = _plan_card FOR UPDATE;
  IF NOT FOUND OR uid IS NULL OR NOT private.is_program_member(pc.program_id, uid) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF pc.unlocked_at IS NULL THEN RAISE EXCEPTION 'This item is not open yet'; END IF;
  IF pc.expired_at IS NOT NULL THEN RAISE EXCEPTION 'This item has closed'; END IF;
  IF pc.owner_completed_at IS NOT NULL THEN RAISE EXCEPTION 'Another homeowner already answered this item'; END IF;
  INSERT INTO public.ao_contributions(plan_card_id, property_id, program_id, card_id, submitted_by, field_values)
    VALUES (pc.id, pc.property_id, pc.program_id, pc.card_id, uid, coalesce(_values, '{}'::jsonb)) RETURNING id INTO cid;
  UPDATE public.ao_home_plan_cards SET owner_completed_at = now() WHERE id = pc.id;
  UPDATE public.owner_reviews SET status = 'answered', responded_at = now(), updated_at = now() WHERE id = pc.owner_review_id;
  RETURN cid;
END $$;

-- 4. TIMED PROCESSING (one reminder, one expiry). Idempotent. Demo/practice homes never email. ----------
CREATE OR REPLACE FUNCTION public.ao_process_clocks(_now timestamptz DEFAULT now()) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; reminders int := 0; expiries int := 0; demo boolean;
BEGIN
  FOR r IN SELECT pc.*, c.title, c.lane, p.owner_user_id, p.is_demo prog_demo, coalesce(pr.is_demo,false) prop_demo
    FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards c ON c.id = pc.card_id
    JOIN public.owner_programs p ON p.id = pc.program_id JOIN public.ao_home_plan_settings s ON s.property_id = pc.property_id AND s.automated
    LEFT JOIN public.properties pr ON pr.id = pc.property_id
    WHERE pc.unlocked_at IS NOT NULL AND pc.owner_completed_at IS NULL AND pc.expired_at IS NULL
      AND c.lane <> 'flexible' AND pc.cutoff_at IS NOT NULL
    FOR UPDATE OF pc SKIP LOCKED
  LOOP
    demo := r.prog_demo OR r.prop_demo;
    IF _now >= r.cutoff_at THEN
      UPDATE public.ao_home_plan_cards SET expired_at = _now WHERE id = r.id;
      UPDATE public.owner_reviews SET status = 'closed', closed_at = _now, outcome = 'Owner opportunity expired, ARHA completed', updated_at = _now
        WHERE id = r.owner_review_id;
      INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, email_status, is_demo)
        SELECT t.assigned_to, 'ao_card_expired', 'Homeowner did not complete ' || r.title || '; proceed as normal', '',
               'onboarding_task', t.id, 'none', demo
        FROM public.onboarding_tasks t WHERE t.id = r.linked_task_id AND t.assigned_to IS NOT NULL;
      expiries := expiries + 1;
    ELSIF _now >= r.reminder_at AND r.reminder_sent_at IS NULL THEN
      UPDATE public.ao_home_plan_cards SET reminder_sent_at = _now WHERE id = r.id;
      -- existing owner alert path: in-app for every member, email to the main homeowner via existing delivery rules
      INSERT INTO public.owner_notifications(program_id, owner_user_id, review_id, kind, priority, title, body, email_status, is_demo)
        VALUES (r.program_id, r.owner_user_id, r.owner_review_id, 'review_ready', 'p3', 'Reminder: ' || r.title,
                'This item closes soon.', CASE WHEN demo THEN 'skipped' ELSE 'pending' END, demo);
      reminders := reminders + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('reminders', reminders, 'expired', expiries);
END $$;

-- Grants: no anon or PUBLIC execute on anything new.
REVOKE ALL ON FUNCTION private.ao_is_editor(uuid), private.ao_add_business_days(date,int), private.ao_central(date,int),
  private.ao_home_stage(uuid), private.ao_unlock(uuid,uuid), private.ao_task_completed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ao_card_save(uuid,jsonb), public.ao_card_set_status(uuid,text), public.ao_unlock_now(uuid),
  public.ao_set_home_automation(uuid,boolean,uuid[]), public.ao_submit_card(uuid,jsonb), public.ao_process_clocks(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ao_card_save(uuid,jsonb), public.ao_card_set_status(uuid,text), public.ao_unlock_now(uuid),
  public.ao_set_home_automation(uuid,boolean,uuid[]), public.ao_submit_card(uuid,jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ao_process_clocks(timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ao_process_clocks(timestamptz) TO service_role;
