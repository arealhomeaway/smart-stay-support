-- Active Owner plan engine, pass 3. STAGED ONLY. Not applied. Requires 01, the card seed and 02.
-- Adds two READ-ONLY functions; replaces no live function, policy or trigger (undo is plain removal).
-- No INSERT/UPDATE/DELETE anywhere in this file. Never touches templates, versions, steps, home plans or Tasks.
-- The 5-minute job calls public.ao_process_clocks from app code (guarded); no cron change is needed.

-- 1. Preview what ao_set_home_automation(_property, true, _covered) would do, without writing.
CREATE OR REPLACE FUNCTION public.ao_preview_home_automation(_property uuid, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
END $$;

-- 2. Homeowner plan read: plan cards for one program with the card fields a member needs. Members and staff only.
CREATE OR REPLACE FUNCTION public.ao_owner_plan(_program uuid)
RETURNS TABLE (plan_card_id uuid, property_id uuid, code text, title text, what_text text, opens_text text,
  lane text, output_fields jsonb, join_outcome text, unlocked_at timestamptz, deadline_at timestamptz,
  expired_at timestamptz, owner_completed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pc.id, pc.property_id, c.code, c.title, c.what_text, c.opens_text, c.lane, c.output_fields, pc.join_outcome,
         pc.unlocked_at, pc.deadline_at, pc.expired_at, pc.owner_completed_at
  FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards c ON c.id = pc.card_id
  JOIN public.ao_home_plan_settings s ON s.property_id = pc.property_id AND s.automated
  WHERE pc.program_id = _program AND pc.join_outcome IN ('locked','open')
    AND auth.uid() IS NOT NULL
    AND (private.is_program_member(_program, auth.uid()) OR public.is_internal_staff(auth.uid()))
  ORDER BY c.code
$$;

REVOKE ALL ON FUNCTION public.ao_preview_home_automation(uuid,uuid[]), public.ao_owner_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ao_preview_home_automation(uuid,uuid[]), public.ao_owner_plan(uuid) TO authenticated;
