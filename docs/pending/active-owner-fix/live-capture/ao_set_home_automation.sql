CREATE OR REPLACE FUNCTION public.ao_set_home_automation(_property uuid, _on boolean, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); prog public.owner_programs; stage text; c public.ao_library_cards;
  outcome text; task_id uuid; task_done boolean; rid uuid; pcid uuid; demo boolean; counts jsonb := '{}'::jsonb;
  cov jsonb; review_task uuid;
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
  PERFORM set_config('app.ao_engine', 'on', true); -- the plan's own card items pass the duplicate guard

  FOR c IN SELECT * FROM public.ao_library_cards WHERE status = 'released' ORDER BY code LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.ao_home_plan_cards WHERE property_id = _property AND card_id = c.id);
    task_id := NULL; task_done := NULL; cov := NULL;
    SELECT t.id, t.status = 'complete' INTO task_id, task_done FROM public.onboarding_tasks t
      WHERE t.property_id = _property AND t.archived_at IS NULL AND t.template_task_id = ANY (c.linked_template_task_ids)
      ORDER BY t.created_at LIMIT 1;
    IF c.id = ANY (_covered_card_ids) THEN cov := jsonb_build_object('reason','staff_marked');
    ELSE cov := private.ao_card_coverage(_property, c.code, task_id); END IF;
    outcome := CASE
      WHEN c.stage_window <> 'anytime' AND
           (CASE c.stage_window WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) <
           (CASE stage WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) THEN 'skipped_passed'
      WHEN cov IS NOT NULL THEN 'already_covered'
      WHEN c.lock_rule = 'until_linked_step_done' AND NOT coalesce(task_done, false) THEN 'locked'
      ELSE 'open' END;
    rid := NULL;
    IF outcome IN ('locked','open') THEN
      -- A withdrawn item can still hold the Task's one owner-item slot; the card item then carries no Task pointer.
      review_task := CASE WHEN task_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.owner_reviews o WHERE o.onboarding_task_id = task_id)
                          THEN NULL ELSE task_id END;
      INSERT INTO public.owner_reviews(program_id, property_id, phase, stage, title, recommendation, status, source_type,
        owner_action_type, onboarding_task_id, is_demo, created_by, task_type)
      VALUES (prog.id, _property, 'onboarding', c.stage_window, c.title,
        CASE WHEN outcome = 'locked' THEN 'Coming soon: waiting on ARHA to ' || coalesce(nullif(c.opens_text,''), 'finish the step before this') ELSE c.why_text END,
        CASE WHEN outcome = 'locked' THEN 'prepared' ELSE 'awaiting_owner' END,
        'onboarding', 'participate', review_task, demo, uid, 'property')
      RETURNING id INTO rid;
    END IF;
    INSERT INTO public.ao_home_plan_cards(property_id, program_id, card_id, card_version, join_outcome, owner_review_id, linked_task_id,
        covered_reason, covered_source, covered_item_id)
      VALUES (_property, prog.id, c.id, c.version, outcome, rid, task_id,
        CASE WHEN outcome = 'already_covered' THEN cov->>'reason' END,
        CASE WHEN outcome = 'already_covered' THEN cov->>'source' END,
        CASE WHEN outcome = 'already_covered' THEN (cov->>'item_id')::uuid END)
      RETURNING id INTO pcid;
    IF outcome = 'open' THEN
      -- open cards start their clock now (same rule as unlock)
      UPDATE public.ao_home_plan_cards SET join_outcome = 'locked' WHERE id = pcid;
      PERFORM private.ao_unlock(pcid, uid);
      UPDATE public.ao_home_plan_cards SET join_outcome = 'open' WHERE id = pcid;
    END IF;
    counts := jsonb_set(counts, ARRAY[outcome], to_jsonb(coalesce((counts->>outcome)::int, 0) + 1));
  END LOOP;
  PERFORM set_config('app.ao_engine', '', true);
  RETURN jsonb_build_object('automated', true, 'stage', stage, 'outcomes', counts);
END $function$
;
