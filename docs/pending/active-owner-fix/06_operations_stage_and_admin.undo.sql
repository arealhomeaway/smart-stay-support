-- Undo for 06_operations_stage_and_admin.sql: puts back the exact live text captured Nov 11 (live-capture/06/),
-- then removes the two added functions. Plan cards, owner items and history written while 06 was on stay as they are.

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

CREATE OR REPLACE FUNCTION private.ao_plan_outcomes(_property uuid, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS TABLE(card_id uuid, code text, stage_window text, outcome text, task_id uuid, coverage jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE stage text := private.ao_home_stage(_property); c public.ao_library_cards; t_id uuid; t_done boolean;
  cov jsonb; claimed uuid[] := ARRAY[]::uuid[]; res text;
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
    res := CASE
      WHEN stage = 'operations' AND c.stage_window <> 'operations' THEN 'skipped_passed'
      WHEN c.stage_window <> 'anytime' AND
           (CASE c.stage_window WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) <
           (CASE stage WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) THEN 'skipped_passed'
      WHEN cov IS NOT NULL THEN 'already_covered'
      WHEN c.lock_rule = 'until_linked_step_done' AND NOT coalesce(t_done, false) THEN 'locked'
      ELSE 'open' END;
    IF res IN ('locked', 'open') AND t_id IS NOT NULL THEN claimed := claimed || t_id; END IF;
    card_id := c.id; code := c.code; stage_window := c.stage_window; outcome := res; task_id := t_id; coverage := cov;
    RETURN NEXT;
  END LOOP;
END $function$
;

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

CREATE OR REPLACE FUNCTION public.perform_handoff_step(_project_id uuid, _step text, _items jsonb, _booking_block boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pr public.onboarding_projects; expected jsonb;e jsonb;v jsonb;_demo boolean;_ticket uuid;_carry public.handoff_carryovers;_role text;_due date;_task_ids uuid[];_safety boolean;
BEGIN
 SELECT * INTO pr FROM public.onboarding_projects WHERE id=_project_id FOR UPDATE;
 IF auth.uid() IS NULL OR pr.id IS NULL THEN RAISE EXCEPTION 'Project not available.'; END IF;
 SELECT is_demo INTO _demo FROM public.properties WHERE id=pr.property_id;
 IF coalesce(private.is_synthetic_account(),false) AND NOT coalesce(_demo,false) THEN RAISE EXCEPTION 'Home not available.'; END IF;
 IF _step='ready' THEN
 IF NOT coalesce(auth.uid()=public.seat_holder('onboarding_director'),false) THEN RAISE EXCEPTION 'Only the Director of Onboarding can mark a home ready.'; END IF;
 IF pr.handoff_state IN('ready','accepted') THEN RETURN; END IF;
 ELSIF _step='accepted' THEN
 IF NOT coalesce(auth.uid()=public.seat_holder('director_ops') OR public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.seat_override_at('director_ops',now()) o WHERE o.kind='cover' AND o.user_id=auth.uid()),false) THEN RAISE EXCEPTION 'Only the Operations Director can accept a home.'; END IF;
 IF pr.handoff_state='accepted' THEN RETURN; END IF;
 IF pr.handoff_state<>'ready' THEN RAISE EXCEPTION 'Mark this home ready first.'; END IF;
 ELSE RAISE EXCEPTION 'Choose a handoff step.'; END IF;
 -- Serialize the living definition and home decisions for a truthful confirmation.
 PERFORM id FROM public.handoff_requirements FOR SHARE;
 PERFORM id FROM public.onboarding_tasks WHERE property_id=pr.property_id FOR SHARE;
 expected:=public.handoff_open_items(pr.property_id);
 IF jsonb_typeof(_items)<>'array' THEN RAISE EXCEPTION 'Review all carry-over items.'; END IF;
 IF jsonb_array_length(_items)<>jsonb_array_length(expected) OR EXISTS(SELECT 1 FROM jsonb_array_elements(expected) ex WHERE (SELECT count(*) FROM jsonb_array_elements(_items) supplied WHERE supplied->>'key'=ex->>'item_key')<>1) THEN RAISE EXCEPTION 'Outstanding items changed. Review the carry-over list again.'; END IF;
 SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(expected) ex WHERE ex->>'category' IN('Safety','Access','Water')) INTO _safety;
 IF _step='accepted' AND _safety AND NOT coalesce(_booking_block,false) THEN RAISE EXCEPTION 'Confirm that you have placed or will place a booking block.'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(expected) LOOP
 SELECT value INTO v FROM jsonb_array_elements(_items) WHERE value->>'key'=e->>'item_key';
 _role:=coalesce(nullif(v->>'ownerRole',''),'ops_supervisor');_due:=coalesce(nullif(v->>'dueOn','')::date,(now() AT TIME ZONE 'America/Chicago')::date+7);
 IF NOT EXISTS(SELECT 1 FROM public.functional_roles WHERE code=_role AND active) THEN RAISE EXCEPTION 'Choose an active owner role.'; END IF;
 SELECT coalesce(array_agg(value::uuid),'{}'::uuid[]) INTO _task_ids FROM jsonb_array_elements_text(e->'task_ids');
 INSERT INTO public.handoff_carryovers(project_id,property_id,item_key,requirement_id,task_ids,title,category,owner_role,due_on,note,is_demo) VALUES(pr.id,pr.property_id,e->>'item_key',(e->>'requirement_id')::uuid,_task_ids,e->>'name',e->>'category',_role,_due,coalesce(v->>'note',''),coalesce(_demo,false))
 ON CONFLICT(project_id,item_key) DO UPDATE SET task_ids=excluded.task_ids,title=excluded.title,category=excluded.category,owner_role=excluded.owner_role,due_on=excluded.due_on,note=excluded.note RETURNING * INTO _carry;
 IF _step='accepted' AND _carry.ticket_id IS NULL THEN
 -- Same ordinary insert path as NewTicketForm. Auto-assignment, notifications, work-item sync and closure guards remain attached.
 INSERT INTO public.tickets(property_id,title,description,status,priority,category,entry_kind,record_type,functional_role_code,due_at,source_channel,source_reference,created_by,record_owner,accountable_owner,reported_at,guest_in_residence,initiator_type,is_demo)
 VALUES(pr.property_id,'Carry-over: '||_carry.title,coalesce(_carry.note,'')||E'\nSource: Onboarding handoff\nRequirement: '||coalesce(_carry.requirement_id::text,'none')||E'\nTasks: '||array_to_string(_carry.task_ids,','),'open','p3','other','ops','active_task',_carry.owner_role,_carry.due_on::timestamp AT TIME ZONE 'America/Chicago','other','Onboarding handoff: '||_carry.id,auth.uid(),auth.uid(),auth.uid(),now(),false,'staff',coalesce(_demo,false)) RETURNING id INTO _ticket;
 INSERT INTO public.ticket_activity(ticket_id,author_id,kind,event_type,body,internal,is_demo) VALUES(_ticket,auth.uid(),'status','created','Carry-over accepted from Onboarding.',true,coalesce(_demo,false));
 UPDATE public.handoff_carryovers SET ticket_id=_ticket,accepted_at=now(),accepted_by=auth.uid() WHERE id=_carry.id;
 END IF;
 END LOOP;
 INSERT INTO public.handoff_step_history(project_id,actor_id,step,items,booking_block,booking_block_at,is_demo) VALUES(pr.id,auth.uid(),_step,_items,_step='accepted' AND _safety AND _booking_block,CASE WHEN _step='accepted' AND _safety AND _booking_block THEN now() END,coalesce(_demo,false));
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,entity_label,before_value,after_value) VALUES(auth.uid(),'onboarding_handoff_'||_step,'onboarding_project',pr.id,'Onboarding handoff',jsonb_build_object('state',pr.handoff_state),jsonb_build_object('state',_step,'carryovers',jsonb_array_length(expected),'booking_block',_step='accepted' AND _safety AND _booking_block));
 UPDATE public.onboarding_projects SET handoff_state=CASE WHEN _step='ready' THEN 'ready' ELSE 'accepted' END,ready_for_ops_at=CASE WHEN _step='ready' THEN now() ELSE ready_for_ops_at END,ready_for_ops_by=CASE WHEN _step='ready' THEN auth.uid() ELSE ready_for_ops_by END,ops_accepted_at=CASE WHEN _step='accepted' THEN now() ELSE ops_accepted_at END,ops_accepted_by=CASE WHEN _step='accepted' THEN auth.uid() ELSE ops_accepted_by END WHERE id=pr.id;
 PERFORM public.complete_handoff_step_tasks(pr.id,_step);
 IF _step='accepted' THEN UPDATE public.onboarding_projects SET status='complete',completed_at=now() WHERE id=pr.id; UPDATE public.properties SET lifecycle_status='active' WHERE id=pr.property_id; PERFORM private.schedule_after_handoff(pr.id,pr.property_id); END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.decide_onboarding_task_review(_review_id uuid, _decision text, _note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _actor uuid := auth.uid(); rv public.onboarding_task_reviews; t public.onboarding_tasks; mine text[]; r text; remaining integer;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Sign in to review.'; END IF;
  IF _decision NOT IN ('approved','sent_back') THEN RAISE EXCEPTION 'Choose Approve or Send back.'; END IF;
  SELECT * INTO rv FROM public.onboarding_task_reviews WHERE id = _review_id FOR UPDATE;
  IF NOT FOUND OR rv.status <> 'pending' THEN RAISE EXCEPTION 'This review is no longer waiting.'; END IF;
  SELECT coalesce(array_agg(x), '{}') INTO mine FROM unnest(rv.reviewer_roles) x
    WHERE private.review_role_person(rv.project_id, x) = _actor
      AND NOT EXISTS (SELECT 1 FROM public.onboarding_task_review_decisions d WHERE d.review_id = rv.id AND d.role_code = x);
  IF cardinality(mine) = 0 THEN RAISE EXCEPTION 'Only the assigned reviewer can do this.'; END IF;
  IF _decision = 'sent_back' AND length(trim(coalesce(_note,''))) < 3 THEN RAISE EXCEPTION 'Add a note saying what needs to change.'; END IF;
  SELECT * INTO t FROM public.onboarding_tasks WHERE id = rv.task_id FOR UPDATE;
  FOREACH r IN ARRAY mine LOOP
    INSERT INTO public.onboarding_task_review_decisions(review_id, role_code, reviewer_id, decision, note)
    VALUES (rv.id, r, _actor, _decision, nullif(trim(coalesce(_note,'')),''));
    INSERT INTO public.onboarding_task_review_events(task_id, review_id, kind, actor_id, role_code, note)
    VALUES (rv.task_id, rv.id, _decision, _actor, r, nullif(trim(coalesce(_note,'')),''));
  END LOOP;
  IF _decision = 'sent_back' THEN
    UPDATE public.onboarding_task_reviews SET status = 'changes_requested', closed_at = now() WHERE id = rv.id;
    PERFORM private.review_notify(ARRAY[coalesce(t.assigned_to, rv.submitted_by)], _actor, 'onboarding_review_changes', 'Changes requested: '||t.title,
      trim(_note), t.id, t.property_id, t.is_demo);
    RETURN jsonb_build_object('status', 'changes_requested');
  END IF;
  SELECT count(*) INTO remaining FROM unnest(rv.reviewer_roles) x
    WHERE NOT EXISTS (SELECT 1 FROM public.onboarding_task_review_decisions d WHERE d.review_id = rv.id AND d.role_code = x AND d.decision = 'approved');
  IF remaining > 0 THEN RETURN jsonb_build_object('status', 'pending', 'remaining', remaining); END IF;
  UPDATE public.onboarding_task_reviews SET status = 'approved', closed_at = now() WHERE id = rv.id;
  INSERT INTO public.onboarding_task_review_events(task_id, review_id, kind, actor_id) VALUES (rv.task_id, rv.id, 'review_complete', _actor);
  IF t.status <> 'complete' THEN
    UPDATE public.onboarding_tasks SET status = 'complete', completed_at = now(), completed_by = coalesce(rv.submitted_by, _actor), blocker = NULL WHERE id = t.id;
  END IF;
  RETURN jsonb_build_object('status', 'approved');
END $function$
;

CREATE OR REPLACE FUNCTION public.record_onboarding_review_edit(_review_id uuid, _note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _actor uuid := auth.uid(); rv public.onboarding_task_reviews;
BEGIN
  SELECT * INTO rv FROM public.onboarding_task_reviews WHERE id = _review_id;
  IF _actor IS NULL OR NOT FOUND OR rv.status <> 'pending' THEN RAISE EXCEPTION 'This review is no longer waiting.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(rv.reviewer_roles) x WHERE private.review_role_person(rv.project_id, x) = _actor) THEN
    RAISE EXCEPTION 'Only the assigned reviewer can do this.';
  END IF;
  IF length(trim(coalesce(_note,''))) < 3 THEN RAISE EXCEPTION 'Say what you changed.'; END IF;
  INSERT INTO public.onboarding_task_review_events(task_id, review_id, kind, actor_id, note) VALUES (rv.task_id, rv.id, 'edited', _actor, trim(_note));
END $function$
;

REVOKE ALL ON FUNCTION private.ao_on_handoff(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.ao_plan_outcomes(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.ao_start_home_plan(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.admin_passes_role_checks();
DROP FUNCTION IF EXISTS private.ao_ops_card_rule(text);
