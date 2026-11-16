-- ao-voided-task-covered (Approved by the Admin, Nov 16, applied live, option A).
-- 1. Plan start: a card whose only matching Task was voided or archived before the plan started is marked
--    already covered, the same way Not needed covers a card. Nothing else in the plan start rule changes.
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
END $function$;

-- 2. Mark the 10 named locked cards already covered with their voided or archived Task, as Not needed does.
--    Card rows only: no email, no notice, owner items left as Not needed leaves them.
DO $repair$
DECLARE n int; before jsonb;
BEGIN
  CREATE TEMP TABLE ao_vtc_fix(pc uuid, task uuid, label text) ON COMMIT DROP;
  INSERT INTO ao_vtc_fix VALUES
    ('28d02acb-9a7c-42ae-8e4d-b51daa5d2030'::uuid, '45e712ae-9da2-4327-b82b-5698af5787da'::uuid, '1464 Buckland Ct. A25'),
    ('9b39071b-ed54-4c2f-a0d0-12d59b553479'::uuid, '03db17b0-87e1-4422-ad0a-4ac619721843'::uuid, '1464 Buckland Ct. A27'),
    ('392d1f5a-86a2-47f0-b7ef-fcd1210138dc'::uuid, '33c8007d-9926-4241-b82f-4c2fba067482'::uuid, '1464 Buckland Ct. A39'),
    ('47617ca3-5427-491a-9f55-63a57358bbec'::uuid, '60fa3e80-157a-4566-9f4e-b3586e5c5faf'::uuid, '3400 N Fern Avenue A52'),
    ('c36dabe1-dd78-4827-92d6-4e075d1dc15b'::uuid, '37be0cf9-0ae0-4f4f-be0e-02a17dc0cbee'::uuid, '624 Daniel Court A25'),
    ('c6f50aea-9f8f-498f-ab4f-cf01b8fc2d66'::uuid, '7f0ed27c-99f2-4694-8b2f-b4c5927ad355'::uuid, '624 Daniel Court A27'),
    ('9afa9d6d-aefa-437e-810f-90a62ab973a7'::uuid, 'd1bc76f9-f5e5-4572-9b53-103ab0f1cf94'::uuid, '8602 E. Galveston St. A25'),
    ('0d54c53c-b468-4145-8ee7-b070c4158b76'::uuid, 'a24048aa-32bd-4138-9508-e6c843c40b27'::uuid, '8602 E. Galveston St. A26'),
    ('58599868-3dba-454d-a425-586da5d05cbe'::uuid, 'f51ac00b-3784-4cd7-ab20-7030dd26d53e'::uuid, '8602 E. Galveston St. A27'),
    ('57bcd471-14d5-4a4a-9d0a-c30cbf1f0fef'::uuid, '3da0c6d9-e432-4480-a948-8b4850f89dce'::uuid, '8602 E. Galveston St. A39');
  SELECT jsonb_agg(jsonb_build_object('card', f.label, 'plan_card_id', pc.id, 'join_outcome', pc.join_outcome,
           'covered_reason', pc.covered_reason, 'covered_source', pc.covered_source, 'covered_item_id', pc.covered_item_id) ORDER BY f.label)
    INTO before FROM ao_vtc_fix f JOIN public.ao_home_plan_cards pc ON pc.id = f.pc;
  UPDATE public.ao_home_plan_cards pc SET join_outcome = 'already_covered', covered_reason = 'task_not_needed',
         covered_source = 'onboarding_task', covered_item_id = f.task
    FROM ao_vtc_fix f
   WHERE pc.id = f.pc AND pc.join_outcome = 'locked' AND pc.unlocked_at IS NULL AND pc.owner_completed_at IS NULL
     AND pc.expired_at IS NULL AND pc.linked_task_id IS NULL
     AND EXISTS (SELECT 1 FROM public.onboarding_tasks t WHERE t.id = f.task AND t.property_id = pc.property_id
                   AND t.archived_at IS NOT NULL AND t.archived_at < pc.created_at)
     AND NOT EXISTS (SELECT 1 FROM public.onboarding_tasks t JOIN public.ao_library_cards c ON c.id = pc.card_id
                   WHERE t.property_id = pc.property_id AND t.archived_at IS NULL AND t.template_task_id = ANY (c.linked_template_task_ids));
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 10 THEN RAISE EXCEPTION 'Expected 10 cards, matched %; nothing changed.', n; END IF;

  -- 3. Change log.
  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, before_value, after_value)
  VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'ao_voided_task_covered_applied', 'function',
    'Homeowner plan: cards whose Task was voided before plan start',
    'Approved by the Admin, Nov 16, applied live (option A): 10 locked cards whose only matching Task was voided or archived '
    || 'before the plan started are marked already covered, as Not needed does. Plan start now does the same for new homes. '
    || 'No emails or notices. Undo: docs/pending/ao-voided-task-covered/apply.undo.sql.',
    jsonb_build_object('ao_plan_outcomes_md5', '1d906073acf2a56f5bbad2c47a1c4110', 'cards', before),
    jsonb_build_object('cards_marked', n));
END $repair$;
