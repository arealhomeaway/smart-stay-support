-- ao-catch-up-opens (approved by the Admin, Nov 15 2026; applied live at the Admin's instruction).
-- Plan catch-up Mark done stops marking cards on the plan "already covered". Completing the Task fires the existing
-- ao_unlock_on_task_complete trigger, which opens linked locked cards exactly as the Task drawer does (private.ao_unlock).
-- Not needed keeps covering cards. Cards already covered stay as they are. Cards not yet on a plan are unchanged.

-- 0. Preflight: refuse if any step moved since the capture.
DO $pre$
DECLARE bad text;
BEGIN
  SELECT string_agg(s || '.' || f, ', ') INTO bad FROM (VALUES
      ('private', 'plan_catch_up_cards', '9da74be11a9be6220aa03962f67f29b2'),
      ('private', 'ao_unlock', '2e7e1411d0d8fda1475f97d12e5fcd1d'),
      ('private', 'ao_task_completed', '473d299347ee02b69d46727378c0e9e6')) v(s, f, h)
   WHERE NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                      WHERE n.nspname = v.s AND p.proname = v.f AND md5(p.prosrc) = v.h);
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'Changed since Nov 15 capture: %. Nothing was changed.', bad; END IF;
END $pre$;

-- 1. Plan catch-up card step: one added condition.
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
       -- ao-catch-up-opens: Mark done no longer covers cards on the plan; the Task-done trigger opens them as the drawer does.
       AND _reason <> 'done_outside_resolve'
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

-- 2. Change log.
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, before_value, after_value)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'ao_catch_up_opens_applied', 'function', 'Plan catch-up: linked homeowner cards open',
  'Approved by the Admin, Nov 15, applied live: Plan catch-up Mark done no longer marks cards on the plan as already covered; '
  || 'completing the Task opens its linked card the same way the Task drawer does. Not needed unchanged. Existing covered cards unchanged. '
  || 'Undo: docs/pending/ao-catch-up-opens/apply.undo.sql.',
  jsonb_build_object('plan_catch_up_cards_md5', '9da74be11a9be6220aa03962f67f29b2'), NULL);
