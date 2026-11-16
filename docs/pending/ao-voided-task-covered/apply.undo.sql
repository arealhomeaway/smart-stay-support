-- Undo ao-voided-task-covered: restore the plan start rule captured live and return the 10 cards to locked.
CREATE OR REPLACE FUNCTION private.ao_plan_outcomes(_property uuid, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS TABLE(card_id uuid, code text, stage_window text, outcome text, task_id uuid, coverage jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE stage text := private.ao_home_stage(_property); c public.ao_library_cards; t_id uuid; t_done boolean;
  cov jsonb; claimed uuid[] := ARRAY[]::uuid[]; res text; ops text;
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
END $function$;

UPDATE public.ao_home_plan_cards SET join_outcome = 'locked', covered_reason = NULL, covered_source = NULL, covered_item_id = NULL
 WHERE id IN (
    ('28d02acb-9a7c-42ae-8e4d-b51daa5d2030'::uuid),
    ('9b39071b-ed54-4c2f-a0d0-12d59b553479'::uuid),
    ('392d1f5a-86a2-47f0-b7ef-fcd1210138dc'::uuid),
    ('47617ca3-5427-491a-9f55-63a57358bbec'::uuid),
    ('c36dabe1-dd78-4827-92d6-4e075d1dc15b'::uuid),
    ('c6f50aea-9f8f-498f-ab4f-cf01b8fc2d66'::uuid),
    ('9afa9d6d-aefa-437e-810f-90a62ab973a7'::uuid),
    ('0d54c53c-b468-4145-8ee7-b070c4158b76'::uuid),
    ('58599868-3dba-454d-a425-586da5d05cbe'::uuid),
    ('57bcd471-14d5-4a4a-9d0a-c30cbf1f0fef'::uuid))
   AND join_outcome = 'already_covered' AND covered_reason = 'task_not_needed';

INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'ao_voided_task_covered_undone', 'function',
  'Homeowner plan: cards whose Task was voided before plan start', 'Undo of ao-voided-task-covered.');
