CREATE OR REPLACE FUNCTION public.ao_preview_home_automation(_property uuid, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); prog_id uuid; stage text; c public.ao_library_cards;
  outcome text; task_done boolean; counts jsonb := '{}'::jsonb; already int := 0;
  task_id uuid; cov jsonb; claimed uuid[] := ARRAY[]::uuid[]; covered jsonb := '[]'::jsonb;
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
    task_id := NULL; task_done := NULL; cov := NULL;
    SELECT t.id, t.status = 'complete' INTO task_id, task_done FROM public.onboarding_tasks t
      WHERE t.property_id = _property AND t.archived_at IS NULL AND t.template_task_id = ANY (c.linked_template_task_ids)
      ORDER BY t.created_at LIMIT 1;
    IF c.id = ANY (_covered_card_ids) THEN cov := jsonb_build_object('reason','staff_marked');
    ELSIF task_id IS NOT NULL AND task_id = ANY (claimed) THEN cov := jsonb_build_object('reason','same_task_other_card');
    ELSE cov := private.ao_card_coverage(_property, c.code, task_id); END IF;
    outcome := CASE
      WHEN c.stage_window <> 'anytime' AND
           (CASE c.stage_window WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) <
           (CASE stage WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) THEN 'skipped_passed'
      WHEN cov IS NOT NULL THEN 'already_covered'
      WHEN c.lock_rule = 'until_linked_step_done' AND NOT coalesce(task_done, false) THEN 'locked'
      ELSE 'open' END;
    IF outcome = 'already_covered' THEN
      covered := covered || jsonb_build_array(cov || jsonb_build_object('code', c.code, 'title', c.title));
    ELSIF outcome IN ('locked','open') AND task_id IS NOT NULL THEN
      claimed := claimed || task_id;
    END IF;
    counts := jsonb_set(counts, ARRAY[outcome], to_jsonb(coalesce((counts->>outcome)::int, 0) + 1));
  END LOOP;
  RETURN jsonb_build_object('ready', true, 'stage', stage, 'outcomes', counts, 'already_on_plan', already, 'covered', covered);
END $function$
;
