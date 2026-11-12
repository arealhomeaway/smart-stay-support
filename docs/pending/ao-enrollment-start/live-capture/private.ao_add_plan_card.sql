CREATE OR REPLACE FUNCTION private.ao_add_plan_card(_property uuid, _program uuid, _card uuid, _outcome text, _task uuid, _cov jsonb, _actor uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c public.ao_library_cards; rid uuid; pcid uuid; review_task uuid; demo boolean;
BEGIN
  SELECT * INTO c FROM public.ao_library_cards WHERE id = _card;
  SELECT p.is_demo OR coalesce((SELECT is_demo FROM public.properties WHERE id = _property), false) INTO demo
    FROM public.owner_programs p WHERE p.id = _program;
  IF _outcome IN ('locked', 'open') THEN
    review_task := CASE WHEN _task IS NOT NULL AND EXISTS (SELECT 1 FROM public.owner_reviews o WHERE o.onboarding_task_id = _task)
                        THEN NULL ELSE _task END;
    INSERT INTO public.owner_reviews(program_id, property_id, phase, stage, title, recommendation, status, source_type,
      owner_action_type, onboarding_task_id, is_demo, created_by, task_type)
    VALUES (_program, _property, 'onboarding', c.stage_window, c.title,
      CASE WHEN _outcome = 'locked' THEN 'Coming soon: waiting on ARHA to ' || coalesce(nullif(c.opens_text, ''), 'finish the step before this') ELSE c.why_text END,
      CASE WHEN _outcome = 'locked' THEN 'prepared' ELSE 'awaiting_owner' END,
      'onboarding', 'participate', review_task, coalesce(demo, false), _actor, 'property')
    RETURNING id INTO rid;
  END IF;
  INSERT INTO public.ao_home_plan_cards(property_id, program_id, card_id, card_version, join_outcome, owner_review_id, linked_task_id,
      covered_reason, covered_source, covered_item_id)
    VALUES (_property, _program, c.id, c.version, _outcome, rid, _task,
      CASE WHEN _outcome = 'already_covered' THEN _cov ->> 'reason' END,
      CASE WHEN _outcome = 'already_covered' THEN _cov ->> 'source' END,
      CASE WHEN _outcome = 'already_covered' THEN (_cov ->> 'item_id')::uuid END)
    RETURNING id INTO pcid;
  IF _outcome = 'open' THEN
    UPDATE public.ao_home_plan_cards SET join_outcome = 'locked' WHERE id = pcid;
    PERFORM private.ao_unlock(pcid, _actor);
    UPDATE public.ao_home_plan_cards SET join_outcome = 'open' WHERE id = pcid;
  END IF;
  RETURN pcid;
END $function$
;

