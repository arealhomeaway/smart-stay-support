-- Undo for ao-catch-up-opens: puts back the Nov 15 capture of private.plan_catch_up_cards exactly.
-- Cards opened by catch-up saves after the change stay open (same as cards opened from the Task drawer).

CREATE OR REPLACE FUNCTION private.plan_catch_up_cards(_actor uuid, _property uuid, _task_ids uuid[], _reason text, _apply boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE out jsonb := '[]'::jsonb; r record; hp jsonb;
BEGIN
  IF _actor IS NULL OR _actor IS DISTINCT FROM auth.uid() OR NOT private.plan_catch_up_gate(_actor) THEN
    RAISE EXCEPTION 'A signed-in onboarding teammate is required.';
  END IF;
  IF _reason NOT IN ('done_outside_resolve', 'task_not_needed') THEN RAISE EXCEPTION 'Unknown cover reason.'; END IF;
  FOR r IN
    SELECT pc.id, coalesce(
             CASE WHEN pc.linked_task_id = ANY (_task_ids) THEN pc.linked_task_id END,
             (SELECT t.id FROM public.onboarding_tasks t
               WHERE t.property_id = _property AND t.id = ANY (_task_ids)
                 AND t.template_task_id = ANY (c.linked_template_task_ids)
               ORDER BY t.created_at LIMIT 1)) AS linked_task_id,
           pc.join_outcome, pc.covered_reason, pc.covered_source, pc.covered_item_id, c.code, c.title
      FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards c ON c.id = pc.card_id
     WHERE pc.property_id = _property
       AND (pc.linked_task_id = ANY (_task_ids)
            OR EXISTS (SELECT 1 FROM public.onboarding_tasks t
                        WHERE t.property_id = _property AND t.id = ANY (_task_ids)
                          AND t.template_task_id = ANY (c.linked_template_task_ids)))
       AND pc.join_outcome = 'locked' AND pc.unlocked_at IS NULL
       AND pc.owner_completed_at IS NULL AND pc.expired_at IS NULL
     ORDER BY c.code
  LOOP
    IF _apply THEN
      UPDATE public.ao_home_plan_cards SET join_outcome = 'already_covered', covered_reason = _reason,
        covered_source = 'onboarding_task', covered_item_id = r.linked_task_id
       WHERE id = r.id AND join_outcome = 'locked' AND unlocked_at IS NULL;
    END IF;
    out := out || jsonb_build_array(jsonb_build_object('planCardId', r.id, 'taskId', r.linked_task_id, 'code', r.code,
      'title', r.title, 'onPlan', true, 'before', jsonb_build_object('join_outcome', r.join_outcome,
      'covered_reason', r.covered_reason, 'covered_source', r.covered_source, 'covered_item_id', r.covered_item_id)));
  END LOOP;
  IF _reason = 'done_outside_resolve' AND NOT EXISTS (SELECT 1 FROM public.ao_home_plan_settings s WHERE s.property_id = _property) THEN
    hp := private.ao_home_program(_property);
    IF NOT (hp ? 'reason') THEN
      FOR r IN
        SELECT o.card_id, o.code, o.task_id, c.title FROM private.ao_plan_outcomes(_property) o
          JOIN public.ao_library_cards c ON c.id = o.card_id
         WHERE o.task_id = ANY (_task_ids) AND o.outcome IN ('locked', 'open') ORDER BY o.code
      LOOP
        out := out || jsonb_build_array(jsonb_build_object('planCardId', NULL, 'cardId', r.card_id, 'taskId', r.task_id,
          'code', r.code, 'title', r.title, 'onPlan', false));
      END LOOP;
    END IF;
  END IF;
  RETURN out;
END $function$;

INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'ao_catch_up_opens_undone', 'function', 'Plan catch-up: linked homeowner cards open',
  'Undo of ao-catch-up-opens: Plan catch-up Mark done marks cards on the plan as already covered again.');
