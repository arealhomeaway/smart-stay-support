-- Undo for 02_engine.sql. Run 04 undo first. Restores the live switch, preview and decision guard
-- exactly as captured on Nov 11 (inlined below, same text as live-capture/), removes the new triggers, functions and tables.
-- Held card emails are closed as skipped, never sent in a burst.
CREATE OR REPLACE FUNCTION public.ao_set_home_automation(_property uuid, _on boolean, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); prog public.owner_programs; stage text; c public.ao_library_cards;
  outcome text; task_id uuid; task_done boolean; rid uuid; pcid uuid; demo boolean; counts jsonb := '{}'::jsonb;
  cov jsonb; review_task uuid;
BEGIN
  IF NOT private.ao_is_editor(uid) THEN RAISE EXCEPTION 'Only Admin or Onboarding Director can change the automated plan' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.ao_home_plan_settings(property_id, automated, updated_by, updated_at) VALUES (_property, _on, uid, now())
    ON CONFLICT (property_id) DO UPDATE SET automated = EXCLUDED.automated, updated_by = uid, updated_at = now();
  INSERT INTO public.ao_home_plan_settings_history(property_id, automated, changed_by) VALUES (_property, _on, uid);
  IF NOT _on THEN RETURN jsonb_build_object('automated', false); END IF; -- OFF never edits or deletes existing items

  SELECT * INTO prog FROM public.owner_programs WHERE property_id = _property AND status = 'active' AND archived_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'This home has no active Active Owner program'; END IF;
  stage := private.ao_home_stage(_property);
  demo := prog.is_demo OR coalesce((SELECT is_demo FROM public.properties WHERE id = _property), false);
  PERFORM set_config('app.ao_engine', 'on', true); -- the plan's own card items pass the duplicate guard

  FOR c IN SELECT * FROM public.ao_library_cards WHERE status = 'released' ORDER BY code LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.ao_home_plan_cards WHERE property_id = _property AND card_id = c.id);
    task_id := NULL; task_done := NULL; cov := NULL;
    SELECT t.id, t.status = 'complete' INTO task_id, task_done FROM public.onboarding_tasks t
      WHERE t.property_id = _property AND t.archived_at IS NULL AND t.template_task_id = ANY (c.linked_template_task_ids)
      ORDER BY t.created_at LIMIT 1;
    IF c.id = ANY (_covered_card_ids) THEN cov := jsonb_build_object('reason','staff_marked');
    ELSE cov := private.ao_card_coverage(_property, c.code, task_id); END IF;
    outcome := CASE
      WHEN c.stage_window <> 'anytime' AND
           (CASE c.stage_window WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) <
           (CASE stage WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) THEN 'skipped_passed'
      WHEN cov IS NOT NULL THEN 'already_covered'
      WHEN c.lock_rule = 'until_linked_step_done' AND NOT coalesce(task_done, false) THEN 'locked'
      ELSE 'open' END;
    rid := NULL;
    IF outcome IN ('locked','open') THEN
      -- A withdrawn item can still hold the Task's one owner-item slot; the card item then carries no Task pointer.
      review_task := CASE WHEN task_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.owner_reviews o WHERE o.onboarding_task_id = task_id)
                          THEN NULL ELSE task_id END;
      INSERT INTO public.owner_reviews(program_id, property_id, phase, stage, title, recommendation, status, source_type,
        owner_action_type, onboarding_task_id, is_demo, created_by, task_type)
      VALUES (prog.id, _property, 'onboarding', c.stage_window, c.title,
        CASE WHEN outcome = 'locked' THEN 'Coming soon: waiting on ARHA to ' || coalesce(nullif(c.opens_text,''), 'finish the step before this') ELSE c.why_text END,
        CASE WHEN outcome = 'locked' THEN 'prepared' ELSE 'awaiting_owner' END,
        'onboarding', 'participate', review_task, demo, uid, 'property')
      RETURNING id INTO rid;
    END IF;
    INSERT INTO public.ao_home_plan_cards(property_id, program_id, card_id, card_version, join_outcome, owner_review_id, linked_task_id,
        covered_reason, covered_source, covered_item_id)
      VALUES (_property, prog.id, c.id, c.version, outcome, rid, task_id,
        CASE WHEN outcome = 'already_covered' THEN cov->>'reason' END,
        CASE WHEN outcome = 'already_covered' THEN cov->>'source' END,
        CASE WHEN outcome = 'already_covered' THEN (cov->>'item_id')::uuid END)
      RETURNING id INTO pcid;
    IF outcome = 'open' THEN
      -- open cards start their clock now (same rule as unlock)
      UPDATE public.ao_home_plan_cards SET join_outcome = 'locked' WHERE id = pcid;
      PERFORM private.ao_unlock(pcid, uid);
      UPDATE public.ao_home_plan_cards SET join_outcome = 'open' WHERE id = pcid;
    END IF;
    counts := jsonb_set(counts, ARRAY[outcome], to_jsonb(coalesce((counts->>outcome)::int, 0) + 1));
  END LOOP;
  PERFORM set_config('app.ao_engine', '', true);
  RETURN jsonb_build_object('automated', true, 'stage', stage, 'outcomes', counts);
END $function$
;
CREATE OR REPLACE FUNCTION public.ao_preview_home_automation(_property uuid, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); prog_id uuid; stage text; c public.ao_library_cards;
  outcome text; task_done boolean; counts jsonb := '{}'::jsonb; already int := 0;
  task_id uuid; cov jsonb; claimed uuid[] := ARRAY[]::uuid[]; covered jsonb := '[]'::jsonb;
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
    task_id := NULL; task_done := NULL; cov := NULL;
    SELECT t.id, t.status = 'complete' INTO task_id, task_done FROM public.onboarding_tasks t
      WHERE t.property_id = _property AND t.archived_at IS NULL AND t.template_task_id = ANY (c.linked_template_task_ids)
      ORDER BY t.created_at LIMIT 1;
    IF c.id = ANY (_covered_card_ids) THEN cov := jsonb_build_object('reason','staff_marked');
    ELSIF task_id IS NOT NULL AND task_id = ANY (claimed) THEN cov := jsonb_build_object('reason','same_task_other_card');
    ELSE cov := private.ao_card_coverage(_property, c.code, task_id); END IF;
    outcome := CASE
      WHEN c.stage_window <> 'anytime' AND
           (CASE c.stage_window WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) <
           (CASE stage WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) THEN 'skipped_passed'
      WHEN cov IS NOT NULL THEN 'already_covered'
      WHEN c.lock_rule = 'until_linked_step_done' AND NOT coalesce(task_done, false) THEN 'locked'
      ELSE 'open' END;
    IF outcome = 'already_covered' THEN
      covered := covered || jsonb_build_array(cov || jsonb_build_object('code', c.code, 'title', c.title));
    ELSIF outcome IN ('locked','open') AND task_id IS NOT NULL THEN
      claimed := claimed || task_id;
    END IF;
    counts := jsonb_set(counts, ARRAY[outcome], to_jsonb(coalesce((counts->>outcome)::int, 0) + 1));
  END LOOP;
  RETURN jsonb_build_object('ready', true, 'stage', stage, 'outcomes', counts, 'already_on_plan', already, 'covered', covered);
END $function$
;
CREATE OR REPLACE FUNCTION public.owner_business_decision_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE approval_required boolean;
BEGIN
  approval_required:=NEW.owner_dependency='business_decision' OR coalesce(NEW.requires_owner_approval,false);
  IF TG_TABLE_NAME='onboarding_template_tasks' THEN
    -- Existing mismatches are not silently repaired by unrelated saves.
    IF NEW.owner_dependency='business_decision' AND NOT coalesce(NEW.requires_owner_approval,false) THEN
      IF TG_OP='INSERT' THEN
        RAISE EXCEPTION 'A business decision requires homeowner approval. Turn on Requires owner approval.';
      ELSIF NEW.owner_dependency IS DISTINCT FROM OLD.owner_dependency OR NEW.requires_owner_approval IS DISTINCT FROM OLD.requires_owner_approval THEN
        RAISE EXCEPTION 'A business decision requires homeowner approval. Turn on Requires owner approval.';
      END IF;
    END IF;
  ELSIF NEW.status IN ('complete','done') AND approval_required AND NEW.owner_approval_status IS DISTINCT FROM 'approved' THEN
    IF TG_OP='INSERT' THEN
      RAISE EXCEPTION 'A homeowner decision is required before this Task can be completed.';
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'A homeowner decision is required before this Task can be completed.';
    END IF;
  END IF;
  RETURN NEW;
END $function$
;
UPDATE public.owner_notifications SET email_status = 'skipped', delivery_error = 'Daily homeowner email removed.'
 WHERE email_status = 'held';
DROP TRIGGER IF EXISTS ao_hold_card_email ON public.owner_notifications;
DROP TRIGGER IF EXISTS guard_system_label ON public.property_label_assignments;
DROP TRIGGER IF EXISTS guard_system_label ON public.property_labels;
DROP TRIGGER IF EXISTS ao_enrollment_changed ON public.owner_program_properties;
DROP TRIGGER IF EXISTS ao_program_changed ON public.owner_programs;
DROP TRIGGER IF EXISTS ao_handoff_accepted ON public.onboarding_projects;
DROP TRIGGER IF EXISTS owner_item_event_sync ON public.owner_request_messages;
DROP FUNCTION IF EXISTS public.my_owner_item_needs();
DROP FUNCTION IF EXISTS public.owner_item_reply(uuid, text);
DROP FUNCTION IF EXISTS public.owner_item_thread(uuid);
DROP FUNCTION IF EXISTS public.send_task_to_owner_item(uuid, text, date);
DROP FUNCTION IF EXISTS private.owner_item_event_sync();
DROP FUNCTION IF EXISTS private.owner_item_answerer(uuid);
DROP FUNCTION IF EXISTS private.task_sent_to_owner(uuid);
DROP FUNCTION IF EXISTS private.ao_handoff_accepted();
DROP FUNCTION IF EXISTS private.ao_on_handoff(uuid, uuid);
DROP FUNCTION IF EXISTS public.ao_start_enrolled_homes(text);
DROP FUNCTION IF EXISTS public.ao_preview_enrolled_homes();
DROP FUNCTION IF EXISTS private.ao_enrolled_rows();
DROP FUNCTION IF EXISTS private.ao_enrollment_changed();
DROP FUNCTION IF EXISTS private.ao_start_on_enrollment(uuid, uuid);
DROP FUNCTION IF EXISTS private.guard_system_label();
DROP FUNCTION IF EXISTS private.ao_label_sync(uuid, uuid);
DROP FUNCTION IF EXISTS public.ao_owner_email_run(timestamptz);
DROP FUNCTION IF EXISTS private.ao_owner_email_now(uuid, text, text, text);
DROP FUNCTION IF EXISTS private.ao_plan_ready_notice(uuid, uuid[], integer);
DROP FUNCTION IF EXISTS public.set_owner_digest_time(text);
DROP FUNCTION IF EXISTS private.ao_digest_time();
DROP FUNCTION IF EXISTS private.ao_hold_card_email();
DROP FUNCTION IF EXISTS private.ao_start_home_plan(uuid, uuid, uuid[]);
DROP FUNCTION IF EXISTS private.ao_add_plan_card(uuid, uuid, uuid, text, uuid, jsonb, uuid);
DROP FUNCTION IF EXISTS private.ao_plan_outcomes(uuid, uuid[]);
DROP FUNCTION IF EXISTS private.ao_home_program(uuid);
-- Sent-item records are kept as a table snapshot comment-free; drop only if no Task relies on them.
DROP TABLE IF EXISTS public.owner_item_task_sends;
DROP TABLE IF EXISTS public.ao_daily_email_items;
DROP TABLE IF EXISTS public.ao_plan_ready_notices;
DROP TABLE IF EXISTS public.ao_owner_email_days;
DROP INDEX IF EXISTS public.property_labels_system_key;
ALTER TABLE public.property_labels DROP COLUMN IF EXISTS system_key;
DELETE FROM public.app_settings WHERE key = 'owner_digest_time';
