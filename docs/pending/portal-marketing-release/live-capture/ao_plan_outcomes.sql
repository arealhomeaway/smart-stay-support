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
      WHEN stage = 'operations' AND c.stage_window NOT IN ('operations', 'anytime') THEN 'skipped_passed'
      -- File 07: on a home still in onboarding, a card is never skipped because a date passed; it follows its step.
      WHEN cov IS NOT NULL THEN 'already_covered'
      WHEN c.lock_rule = 'until_linked_step_done' AND NOT coalesce(t_done, false) THEN 'locked'
      ELSE 'open' END;
    IF res IN ('locked', 'open') AND t_id IS NOT NULL THEN claimed := claimed || t_id; END IF;
    card_id := c.id; code := c.code; stage_window := c.stage_window; outcome := res; task_id := t_id; coverage := cov;
    RETURN NEXT;
  END LOOP;
END $function$

