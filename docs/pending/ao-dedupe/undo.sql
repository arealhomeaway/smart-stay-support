-- Undo for 01_dedupe.sql. Restores the three replaced functions from live-capture/ byte for byte
-- (CREATE OR REPLACE keeps their ACLs), then removes every object 01_dedupe.sql added.
DROP TRIGGER IF EXISTS ao_guard_owner_item ON public.owner_reviews;
DROP TRIGGER IF EXISTS ao_guard_owner_item ON public.work_items;
CREATE OR REPLACE FUNCTION public.ao_preview_home_automation(_property uuid, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); prog_id uuid; stage text; c public.ao_library_cards;
  outcome text; task_done boolean; counts jsonb := '{}'::jsonb; already int := 0;
BEGIN
  IF NOT private.ao_is_editor(uid) THEN RAISE EXCEPTION 'Only Admin or Onboarding Director can preview the automated plan' USING ERRCODE = '42501'; END IF;
  SELECT id INTO prog_id FROM public.owner_programs WHERE property_id = _property AND status = 'active' AND archived_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF prog_id IS NULL THEN RETURN jsonb_build_object('ready', false, 'reason', 'This home has no active Active Owner program'); END IF;
  stage := private.ao_home_stage(_property);
  FOR c IN SELECT * FROM public.ao_library_cards WHERE status = 'released' ORDER BY code LOOP
    IF EXISTS (SELECT 1 FROM public.ao_home_plan_cards WHERE property_id = _property AND card_id = c.id) THEN
      already := already + 1; CONTINUE;
    END IF;
    SELECT t.status = 'complete' INTO task_done FROM public.onboarding_tasks t
      WHERE t.property_id = _property AND t.archived_at IS NULL AND t.template_task_id = ANY (c.linked_template_task_ids)
      ORDER BY t.created_at LIMIT 1;
    outcome := CASE
      WHEN c.stage_window <> 'anytime' AND
           (CASE c.stage_window WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) <
           (CASE stage WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) THEN 'skipped_passed'
      WHEN c.id = ANY (_covered_card_ids) THEN 'already_covered'
      WHEN c.lock_rule = 'until_linked_step_done' AND NOT coalesce(task_done, false) THEN 'locked'
      ELSE 'open' END;
    task_done := NULL;
    counts := jsonb_set(counts, ARRAY[outcome], to_jsonb(coalesce((counts->>outcome)::int, 0) + 1));
  END LOOP;
  RETURN jsonb_build_object('ready', true, 'stage', stage, 'outcomes', counts, 'already_on_plan', already);
END $function$
;
CREATE OR REPLACE FUNCTION public.ao_set_home_automation(_property uuid, _on boolean, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION private.schedule_after_handoff(_project_id uuid, _property_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _program uuid; _demo boolean; _accept_day date; _n integer;
BEGIN
  SELECT coalesce(is_demo,false) INTO _demo FROM public.properties WHERE id=_property_id;
  IF coalesce(_demo,false) THEN RETURN 0; END IF;
  SELECT op.id INTO _program FROM public.owner_programs op
  WHERE op.status='active' AND NOT op.is_demo AND op.archived_at IS NULL
    AND (op.property_id=_property_id OR EXISTS (SELECT 1 FROM public.owner_program_properties pp
         WHERE pp.program_id=op.id AND pp.property_id=_property_id AND pp.archived_at IS NULL AND NOT pp.is_demo))
  ORDER BY op.created_at DESC LIMIT 1;
  IF _program IS NULL THEN
    INSERT INTO public.after_handoff_schedule_events(property_id,project_id,actor_id,action,note)
    VALUES (_property_id,_project_id,auth.uid(),'no_program','No Active Owner program at handoff; nothing scheduled');
    RETURN 0;
  END IF;
  _accept_day := (now() AT TIME ZONE 'America/Chicago')::date;
  WITH ins AS (
    INSERT INTO public.after_handoff_schedule(program_id,property_id,project_id,plan_item_id,title,source_kind,template_id,library_id,send_on,last_changed_by)
    SELECT _program,_property_id,_project_id,p.id,p.title,p.source_kind,p.template_id,p.library_id,_accept_day+p.send_after_days,auth.uid()
    FROM public.after_handoff_plan_items p WHERE p.active
    ORDER BY p.send_after_days, p.sort_order
    ON CONFLICT (property_id, plan_item_id) DO NOTHING
    RETURNING *
  ), ev AS (
    INSERT INTO public.after_handoff_schedule_events(schedule_id,property_id,project_id,actor_id,action,new_value,note)
    SELECT ins.id,_property_id,_project_id,auth.uid(),'scheduled',jsonb_build_object('send_on',ins.send_on,'status','scheduled'),'Scheduled at handoff acceptance'
    FROM ins RETURNING 1
  ) SELECT count(*) INTO _n FROM ev;
  RETURN _n;
END $function$
;
DROP FUNCTION IF EXISTS public.after_handoff_plan_set_coverage(uuid,text,text);
DROP FUNCTION IF EXISTS public.ao_step_link_decide(uuid,boolean);
DROP FUNCTION IF EXISTS public.ao_card_item_map_decide(uuid,text);
DROP FUNCTION IF EXISTS public.ao_confirm_one_off(uuid,uuid,text);
DROP FUNCTION IF EXISTS private.ao_guard_owner_item();
DROP FUNCTION IF EXISTS private.ao_live_card_match(uuid,uuid,uuid,text);
DROP FUNCTION IF EXISTS private.ao_card_coverage(uuid,text,uuid);
DROP FUNCTION IF EXISTS private.ao_title_key(text);
ALTER TABLE public.after_handoff_plan_items DROP CONSTRAINT IF EXISTS after_handoff_plan_items_coverage_chk, DROP COLUMN IF EXISTS covered_card_code, DROP COLUMN IF EXISTS coverage;
ALTER TABLE public.ao_home_plan_cards DROP COLUMN IF EXISTS covered_item_id, DROP COLUMN IF EXISTS covered_source, DROP COLUMN IF EXISTS covered_reason;
DROP TABLE IF EXISTS public.ao_dedupe_events, public.ao_one_off_confirmations, public.ao_card_step_link_suggestions, public.ao_card_item_map;
