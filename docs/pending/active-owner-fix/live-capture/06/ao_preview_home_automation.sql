CREATE OR REPLACE FUNCTION public.ao_preview_home_automation(_property uuid, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); hp jsonb; r record; counts jsonb := '{}'::jsonb; already int := 0; covered jsonb := '[]'::jsonb;
BEGIN
  IF NOT private.ao_is_editor(uid) THEN RAISE EXCEPTION 'Only Admin or Onboarding Director can preview the automated plan' USING ERRCODE = '42501'; END IF;
  hp := private.ao_home_program(_property);
  IF hp ? 'reason' THEN RETURN jsonb_build_object('ready', false, 'reason', hp ->> 'reason'); END IF;
  FOR r IN SELECT o.*, c.title FROM private.ao_plan_outcomes(_property, _covered_card_ids) o JOIN public.ao_library_cards c ON c.id = o.card_id LOOP
    IF r.outcome = 'already_on_plan' THEN already := already + 1; CONTINUE; END IF;
    IF r.outcome = 'already_covered' THEN covered := covered || jsonb_build_array(r.coverage || jsonb_build_object('code', r.code, 'title', r.title)); END IF;
    counts := jsonb_set(counts, ARRAY[r.outcome], to_jsonb(coalesce((counts ->> r.outcome)::int, 0) + 1));
  END LOOP;
  RETURN jsonb_build_object('ready', true, 'stage', private.ao_home_stage(_property), 'outcomes', counts, 'already_on_plan', already, 'covered', covered);
END $function$
;
