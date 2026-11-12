CREATE OR REPLACE FUNCTION private.ao_start_home_plan(_property uuid, _actor uuid, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE hp jsonb := private.ao_home_program(_property); prog uuid; r record; counts jsonb := '{}'::jsonb; opened int := 0;
BEGIN
  IF hp ? 'reason' THEN RAISE EXCEPTION '%', hp ->> 'reason'; END IF;
  prog := (hp ->> 'program_id')::uuid;
  INSERT INTO public.ao_home_plan_settings(property_id, automated, updated_by, updated_at) VALUES (_property, true, _actor, now())
    ON CONFLICT (property_id) DO UPDATE SET automated = true, updated_by = _actor, updated_at = now();
  INSERT INTO public.ao_home_plan_settings_history(property_id, automated, changed_by) VALUES (_property, true, _actor);
  PERFORM set_config('app.ao_engine', 'on', true);
  PERFORM set_config('resolve.owner_release_batch', 'on', true);
  FOR r IN SELECT * FROM private.ao_plan_outcomes(_property, _covered_card_ids) LOOP
    CONTINUE WHEN r.outcome = 'already_on_plan';
    PERFORM private.ao_add_plan_card(_property, prog, r.card_id, r.outcome, r.task_id, r.coverage, _actor);
    IF r.outcome = 'open' THEN opened := opened + 1; END IF;
    counts := jsonb_set(counts, ARRAY[r.outcome], to_jsonb(coalesce((counts ->> r.outcome)::int, 0) + 1));
  END LOOP;
  PERFORM set_config('resolve.owner_release_batch', 'off', true);
  PERFORM set_config('app.ao_engine', '', true);
  RETURN jsonb_build_object('program_id', prog, 'stage', private.ao_home_stage(_property), 'outcomes', counts, 'open', opened);
END $function$
;
