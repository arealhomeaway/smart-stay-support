CREATE OR REPLACE FUNCTION private.ao_on_handoff(_property uuid, _actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE hp jsonb; prog uuid; pc public.ao_home_plan_cards; c public.ao_library_cards; r record; opened int := 0; added int := 0; cov jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ao_home_plan_settings WHERE property_id = _property AND automated) THEN RETURN NULL; END IF;
  hp := private.ao_home_program(_property);
  IF hp ? 'reason' THEN RETURN hp; END IF;
  prog := (hp ->> 'program_id')::uuid;
  PERFORM set_config('app.ao_engine', 'on', true);
  PERFORM set_config('resolve.owner_release_batch', 'on', true);
  FOR c IN SELECT * FROM public.ao_library_cards WHERE status = 'released' AND code IN ('A33', 'N10') ORDER BY code LOOP
    SELECT * INTO pc FROM public.ao_home_plan_cards WHERE property_id = _property AND card_id = c.id;
    IF FOUND THEN
      IF pc.join_outcome = 'locked' AND pc.unlocked_at IS NULL AND private.ao_unlock(pc.id, _actor) THEN opened := opened + 1; END IF;
    ELSE
      cov := private.ao_card_coverage(_property, c.code, NULL);
      PERFORM private.ao_add_plan_card(_property, prog, c.id, CASE WHEN cov IS NULL THEN 'open' ELSE 'already_covered' END, NULL, cov, _actor);
      IF cov IS NULL THEN opened := opened + 1; END IF;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM private.ao_plan_outcomes(_property) o
            WHERE o.stage_window = 'operations' AND o.code NOT IN ('A35', 'A14', 'A33', 'N10') AND o.outcome <> 'already_on_plan' LOOP
    PERFORM private.ao_add_plan_card(_property, prog, r.card_id, r.outcome, r.task_id, r.coverage, _actor);
    IF r.outcome = 'open' THEN added := added + 1; END IF;
  END LOOP;
  PERFORM set_config('resolve.owner_release_batch', 'off', true);
  PERFORM set_config('app.ao_engine', '', true);
  IF opened + added > 0 THEN
    PERFORM private.ao_owner_email_now(prog, 'ao_home_live', 'Your home is live: new activities are in your portal.',
      'Open your portal to see what''s next.');
  END IF;
  RETURN jsonb_build_object('opened', opened, 'added', added);
END $function$
;
