-- portal-marketing-release (Approved by the Admin, Nov 16): the 8 marketing and social cards
-- (P07 P08 P12 P13 P14 P15 P19 P20) open at handoff like the operations cards, with no deadline
-- (owner_needed stays false). Applied now to the three live handed-off homes with no email or notice.
-- Nothing else about card rules changes. Undo: docs/pending/portal-marketing-release/apply.undo.sql.

CREATE OR REPLACE FUNCTION private.ao_opens_at_handoff(_code text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT _code IN ('P07', 'P08', 'P12', 'P13', 'P14', 'P15', 'P19', 'P20')
$function$;
REVOKE ALL ON FUNCTION private.ao_opens_at_handoff(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.ao_plan_outcomes(_property uuid, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS TABLE(card_id uuid, code text, stage_window text, outcome text, task_id uuid, coverage jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE stage text := private.ao_home_stage(_property); c public.ao_library_cards; t_id uuid; t_done boolean;
  cov jsonb; claimed uuid[] := ARRAY[]::uuid[]; res text; ops text; gone_id uuid;
BEGIN
  FOR c IN SELECT l.* FROM public.ao_library_cards l WHERE l.status = 'released' ORDER BY l.code LOOP
    IF EXISTS (SELECT 1 FROM public.ao_home_plan_cards pc WHERE pc.property_id = _property AND pc.card_id = c.id) THEN
      card_id := c.id; code := c.code; stage_window := c.stage_window; outcome := 'already_on_plan'; task_id := NULL; coverage := NULL;
      RETURN NEXT; CONTINUE;
    END IF;
    t_id := NULL; t_done := NULL; cov := NULL;
    SELECT t.id, t.status = 'complete' INTO t_id, t_done FROM public.onboarding_tasks t
      WHERE t.property_id = _property AND t.archived_at IS NULL AND t.template_task_id = ANY (c.linked_template_task_ids)
      ORDER BY t.created_at LIMIT 1;
    IF c.id = ANY (_covered_card_ids) THEN cov := jsonb_build_object('reason', 'staff_marked');
    ELSIF t_id IS NOT NULL AND t_id = ANY (claimed) THEN cov := jsonb_build_object('reason', 'same_task_other_card');
    ELSE cov := private.ao_card_coverage(_property, c.code, t_id); END IF;
    -- ao-voided-task-covered: when the only matching Task was voided or archived before the plan started,
    -- the card is already covered, the same way Not needed covers a card.
    gone_id := NULL;
    IF cov IS NULL AND t_id IS NULL THEN
      SELECT t.id INTO gone_id FROM public.onboarding_tasks t
        WHERE t.property_id = _property AND t.archived_at IS NOT NULL AND t.archived_at <= now()
          AND t.template_task_id = ANY (c.linked_template_task_ids)
        ORDER BY t.archived_at DESC, t.created_at DESC LIMIT 1;
      IF gone_id IS NOT NULL THEN
        cov := jsonb_build_object('reason', 'task_not_needed', 'source', 'onboarding_task', 'item_id', gone_id);
      END IF;
    END IF;
    IF cov IS NULL AND coalesce(t_done, false) THEN cov := jsonb_build_object('reason', 'linked_task_done', 'source', 'onboarding_task', 'item_id', t_id); END IF;
    ops := CASE WHEN stage = 'operations' AND c.stage_window = 'operations' THEN private.ao_ops_card_rule(c.code) END;
    res := CASE
      WHEN ops = 'waits_for_bridge' THEN 'not_added'
      -- ao-owner-needed: A33 and N10 stay locked until staff press Unlock now.
      WHEN ops = 'stays_locked' THEN CASE WHEN cov IS NOT NULL THEN 'already_covered' ELSE 'locked' END
      WHEN stage = 'operations' AND c.stage_window = 'operations' AND c.lock_rule = 'until_linked_step_done' AND t_id IS NULL THEN 'not_added'
      -- portal-marketing-release: the 8 marketing and social cards open at handoff like the operations cards.
      WHEN stage = 'operations' AND private.ao_opens_at_handoff(c.code) THEN CASE WHEN cov IS NOT NULL THEN 'already_covered' ELSE 'open' END
      WHEN stage = 'operations' AND c.stage_window NOT IN ('operations', 'anytime') THEN 'skipped_passed'
      -- File 07: on a home still in onboarding, a card is never skipped because a date passed; it follows its step.
      WHEN cov IS NOT NULL THEN 'already_covered'
      WHEN c.lock_rule = 'until_linked_step_done' AND NOT coalesce(t_done, false) THEN 'locked'
      ELSE 'open' END;
    IF res IN ('locked', 'open') AND t_id IS NOT NULL THEN claimed := claimed || t_id; END IF;
    card_id := c.id; code := c.code; stage_window := c.stage_window; outcome := res; task_id := t_id; coverage := cov;
    RETURN NEXT;
  END LOOP;
END $function$;

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
  FOR r IN SELECT * FROM private.ao_plan_outcomes(_property) o
            WHERE (o.stage_window = 'operations' OR private.ao_opens_at_handoff(o.code)) AND private.ao_ops_card_rule(o.code) IS DISTINCT FROM 'waits_for_bridge'
              AND o.outcome NOT IN ('already_on_plan', 'not_added') LOOP
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
END $function$;

DO $repair$
DECLARE r record; c public.ao_library_cards; rid uuid; demo boolean; opened int := 0; per jsonb := '{}'::jsonb; ids jsonb := '[]'::jsonb;
BEGIN
  PERFORM set_config('app.ao_engine', 'on', true);
  PERFORM set_config('resolve.owner_release_batch', 'on', true);
  FOR r IN SELECT pc.*, l.code AS card_code, pr.name AS home
             FROM public.ao_home_plan_cards pc
             JOIN public.ao_library_cards l ON l.id = pc.card_id
             JOIN public.properties pr ON pr.id = pc.property_id
            WHERE pc.property_id IN ('bacd3693-5a52-4ec0-a560-1281aadac37e', '9de75678-9e34-4219-a186-ed0da15f0092', '79319968-80c9-4f00-b6c9-608c0b1881dc')
              AND private.ao_opens_at_handoff(l.code) AND pc.join_outcome = 'skipped_passed'
              AND pc.owner_review_id IS NULL AND pc.unlocked_at IS NULL
            ORDER BY pr.name, l.code FOR UPDATE OF pc LOOP
    SELECT * INTO c FROM public.ao_library_cards WHERE id = r.card_id;
    -- Same coverage check the plan start uses; a covered card is left as it is.
    CONTINUE WHEN private.ao_card_coverage(r.property_id, r.card_code, NULL) IS NOT NULL;
    SELECT p.is_demo OR coalesce((SELECT is_demo FROM public.properties WHERE id = r.property_id), false) INTO demo
      FROM public.owner_programs p WHERE p.id = r.program_id;
    -- The same owner item ao_add_plan_card makes for an opening card.
    INSERT INTO public.owner_reviews(program_id, property_id, phase, stage, title, recommendation, status, source_type,
      owner_action_type, onboarding_task_id, is_demo, created_by, task_type)
    VALUES (r.program_id, r.property_id, 'onboarding', c.stage_window, c.title, c.why_text, 'prepared',
      'onboarding', 'participate', NULL, coalesce(demo, false), NULL, 'property')
    RETURNING id INTO rid;
    UPDATE public.ao_home_plan_cards SET join_outcome = 'locked', owner_review_id = rid WHERE id = r.id;
    PERFORM private.ao_unlock(r.id, NULL);
    UPDATE public.ao_home_plan_cards SET join_outcome = 'open' WHERE id = r.id;
    opened := opened + 1;
    per := jsonb_set(per, ARRAY[r.home], to_jsonb(coalesce((per ->> r.home)::int, 0) + 1));
    ids := ids || jsonb_build_object('plan_card_id', r.id, 'owner_review_id', rid, 'code', r.card_code, 'home', r.home);
  END LOOP;
  PERFORM set_config('resolve.owner_release_batch', 'off', true);
  PERFORM set_config('app.ao_engine', '', true);
  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, before_value, after_value)
  VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'portal_marketing_release_applied', 'function',
    'Homeowner plan: marketing and social cards open at handoff',
    'Approved by the Admin, Nov 16: P07 P08 P12 P13 P14 P15 P19 P20 open at handoff like the operations cards, no deadline. '
    || 'Opened now on 1399 Foxtail Ln, 3915 W 104th St S and 9211 Fitzgerald Dr with no email or notice. '
    || 'Undo: docs/pending/portal-marketing-release/apply.undo.sql.',
    jsonb_build_object('ao_plan_outcomes_md5', '6b033289a1d47ec0c14dcbe9484896f8', 'ao_on_handoff_md5', '541095fe05a55c378d2d2e22c36c6e69', 'join_outcome', 'skipped_passed'),
    jsonb_build_object('opened', opened, 'per_home', per, 'cards', ids));
END $repair$;