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

-- ---------------------------------------------------------------- Item 6 undo
-- Removes exactly the demo labels file 06 added (from its receipts), then puts back the live text of the eight rules
-- and removes the staff notice guard. Demo plans, items and notices written while 06 was on stay as they are.
DO $$
DECLARE r record; lbl public.property_labels;
BEGIN
  SELECT * INTO lbl FROM public.property_labels WHERE system_key = 'active_owner';
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM set_config('app.system_label', 'on', true);
  FOR r IN SELECT DISTINCT a.entity_id AS property_id FROM public.audit_log a WHERE a.action = 'ao_fix06_demo_label' LOOP
    IF EXISTS (SELECT 1 FROM public.property_label_assignments x WHERE x.property_id = r.property_id AND x.label_id = lbl.id AND x.removed_at IS NULL) THEN
      UPDATE public.property_label_assignments SET removed_at = now(), removed_by = NULL
       WHERE property_id = r.property_id AND label_id = lbl.id AND removed_at IS NULL;
      INSERT INTO public.property_label_events(label_id, property_id, action, from_name, actor_id, actor_label)
        VALUES (lbl.id, r.property_id, 'removed', lbl.name, NULL, 'Resolve');
      INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_id, entity_label, reason)
        VALUES (NULL, 'Resolve', 'label_removed', 'property', r.property_id, lbl.name, 'Undo of file 06 item 6');
    END IF;
  END LOOP;
  PERFORM set_config('app.system_label', '', true);
END $$;
DROP TRIGGER IF EXISTS ao_demo_staff_notice ON public.staff_notifications;
DROP FUNCTION IF EXISTS private.ao_demo_staff_notice();

CREATE OR REPLACE FUNCTION private.ao_home_program(_property uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ids uuid[];
BEGIN
  SELECT array_agg(DISTINCT p.id ORDER BY p.id) INTO ids FROM public.owner_programs p
   WHERE p.status = 'active' AND p.archived_at IS NULL AND NOT p.is_demo
     AND (p.property_id = _property OR EXISTS (
           SELECT 1 FROM public.owner_program_properties e
            WHERE e.program_id = p.id AND e.property_id = _property
              AND e.inclusion_status = 'included' AND e.archived_at IS NULL));
  IF coalesce(array_length(ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('reason', 'This home has no active Active Owner program');
  ELSIF array_length(ids, 1) > 1 THEN
    RETURN jsonb_build_object('reason', 'This home is in more than one homeowner program. Ask an Admin to fix it first.');
  END IF;
  RETURN jsonb_build_object('program_id', ids[1]);
END $function$
;

CREATE OR REPLACE FUNCTION private.ao_label_sync(_property uuid, _actor uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE lbl public.property_labels; should boolean; live uuid; who text;
BEGIN
  SELECT * INTO lbl FROM public.property_labels WHERE system_key = 'active_owner' AND retired_at IS NULL;
  IF NOT FOUND THEN RETURN 'no_label'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.owner_program_properties e JOIN public.owner_programs p ON p.id = e.program_id
                  JOIN public.properties h ON h.id = e.property_id
                 WHERE e.property_id = _property AND e.inclusion_status = 'included' AND e.archived_at IS NULL
                   AND p.status = 'active' AND p.archived_at IS NULL AND NOT p.is_demo AND NOT h.is_demo) INTO should;
  SELECT id INTO live FROM public.property_label_assignments WHERE property_id = _property AND label_id = lbl.id AND removed_at IS NULL;
  who := CASE WHEN _actor IS NULL THEN 'Resolve' ELSE coalesce(private.actor_label(_actor), 'Resolve') END;
  PERFORM set_config('app.system_label', 'on', true);
  IF should AND live IS NULL THEN
    INSERT INTO public.property_label_assignments(property_id, label_id, added_by) VALUES (_property, lbl.id, _actor);
    INSERT INTO public.property_label_events(label_id, property_id, action, to_name, actor_id, actor_label)
      VALUES (lbl.id, _property, 'added', lbl.name, _actor, who);
    INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_id, entity_label, reason)
      VALUES (_actor, who, 'label_added', 'property', _property, lbl.name, 'Active Owner enrollment');
    PERFORM set_config('app.system_label', '', true);
    RETURN 'added';
  ELSIF NOT should AND live IS NOT NULL THEN
    UPDATE public.property_label_assignments SET removed_at = now(), removed_by = _actor WHERE id = live;
    INSERT INTO public.property_label_events(label_id, property_id, action, from_name, actor_id, actor_label)
      VALUES (lbl.id, _property, 'removed', lbl.name, _actor, who);
    INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_id, entity_label, reason)
      VALUES (_actor, who, 'label_removed', 'property', _property, lbl.name, 'Left the Active Owner program');
    PERFORM set_config('app.system_label', '', true);
    RETURN 'removed';
  END IF;
  PERFORM set_config('app.system_label', '', true);
  RETURN 'unchanged';
END $function$
;

CREATE OR REPLACE FUNCTION private.ao_start_on_enrollment(_property uuid, _actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE hp jsonb; r jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ao_home_plan_settings WHERE property_id = _property) THEN RETURN NULL; END IF;
  IF coalesce((SELECT is_demo FROM public.properties WHERE id = _property), true) THEN RETURN NULL; END IF;
  hp := private.ao_home_program(_property);
  IF hp ? 'reason' THEN
    INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, reason)
      VALUES (_actor, 'ao_plan_not_started', 'property', _property, 'Automated homeowner plan', hp ->> 'reason');
    RETURN hp;
  END IF;
  r := private.ao_start_home_plan(_property, _actor);
  PERFORM private.ao_plan_ready_notice((r ->> 'program_id')::uuid, ARRAY[_property], (r ->> 'open')::int);
  RETURN r;
END $function$
;

CREATE OR REPLACE FUNCTION private.ao_enrollment_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE prog public.owner_programs; h uuid;
BEGIN
  IF TG_TABLE_NAME = 'owner_program_properties' THEN
    PERFORM private.ao_label_sync(NEW.property_id, auth.uid());
    IF NEW.inclusion_status = 'included' AND NEW.archived_at IS NULL AND NOT NEW.is_demo
       AND (TG_OP = 'INSERT' OR OLD.inclusion_status IS DISTINCT FROM 'included' OR OLD.archived_at IS NOT NULL) THEN
      SELECT * INTO prog FROM public.owner_programs WHERE id = NEW.program_id;
      IF prog.status = 'active' AND prog.archived_at IS NULL AND NOT prog.is_demo THEN
        PERFORM private.ao_start_on_enrollment(NEW.property_id, auth.uid());
      END IF;
    END IF;
  ELSE
    FOR h IN SELECT DISTINCT property_id FROM public.owner_program_properties WHERE program_id = NEW.id LOOP
      PERFORM private.ao_label_sync(h, auth.uid());
    END LOOP;
    IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' AND OLD.status IS DISTINCT FROM 'closed'
       AND NEW.archived_at IS NULL AND NOT NEW.is_demo THEN
      FOR h IN SELECT property_id FROM public.owner_program_properties
                WHERE program_id = NEW.id AND inclusion_status = 'included' AND archived_at IS NULL ORDER BY property_id LOOP
        PERFORM private.ao_start_on_enrollment(h, auth.uid());
      END LOOP;
    END IF;
  END IF;
  RETURN NULL;
END $function$
;

CREATE OR REPLACE FUNCTION private.ao_plan_ready_notice(_program uuid, _property_ids uuid[], _open integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE prog public.owner_programs; nid uuid; homes uuid[]; total int; names text[]; label text;
BEGIN
  IF coalesce(_open, 0) <= 0 THEN RETURN NULL; END IF;
  SELECT * INTO prog FROM public.owner_programs WHERE id = _program;
  IF NOT FOUND OR prog.is_demo OR prog.owner_user_id IS NULL THEN RETURN NULL; END IF;
  SELECT n.id, x.property_ids, x.open_count INTO nid, homes, total
    FROM public.owner_notifications n JOIN public.ao_plan_ready_notices x ON x.notification_id = n.id
   WHERE n.program_id = _program AND n.kind = 'ao_plan_ready' AND n.email_status IN ('held', 'skipped') AND n.delivered_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.ao_owner_email_days d WHERE d.notification_id = n.id)
   ORDER BY n.created_at DESC LIMIT 1 FOR UPDATE OF n;
  homes := (SELECT array_agg(DISTINCT h ORDER BY h) FROM unnest(coalesce(homes, ARRAY[]::uuid[]) || _property_ids) h);
  total := coalesce(total, 0) + _open;
  SELECT array_agg(public.format_property_label(to_jsonb(h)) ->> 'primary' ORDER BY h.name) INTO names
    FROM public.properties h WHERE h.id = ANY (homes);
  label := CASE WHEN coalesce(array_length(names, 1), 0) = 0 THEN 'your home'
                WHEN array_length(names, 1) = 1 THEN names[1]
                ELSE array_to_string(names[1:array_length(names, 1) - 1], ', ') || ' and ' || names[array_length(names, 1)] END;
  IF nid IS NULL THEN
    INSERT INTO public.owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, sms_status)
    VALUES (prog.id, prog.owner_user_id, 'ao_plan_ready', 'p3', 'Your homeowner plan is ready',
      format('We added %s %s to your portal for %s. Open your portal to see what''s next.', total, CASE WHEN total = 1 THEN 'activity' ELSE 'activities' END, label),
      '/owner', CASE WHEN prog.notify_email THEN 'held' ELSE 'skipped' END, 'skipped')
    RETURNING id INTO nid;
    INSERT INTO public.ao_plan_ready_notices(notification_id, program_id, property_ids, open_count) VALUES (nid, prog.id, homes, total);
  ELSE
    UPDATE public.owner_notifications SET
      body = format('We added %s %s to your portal for %s. Open your portal to see what''s next.', total, CASE WHEN total = 1 THEN 'activity' ELSE 'activities' END, label)
     WHERE id = nid;
    UPDATE public.ao_plan_ready_notices SET property_ids = homes, open_count = total WHERE notification_id = nid;
  END IF;
  RETURN nid;
END $function$
;

CREATE OR REPLACE FUNCTION private.ao_owner_email_now(_program uuid, _kind text, _title text, _body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE prog public.owner_programs; nid uuid; got int; today date := (now() AT TIME ZONE 'America/Chicago')::date;
BEGIN
  SELECT * INTO prog FROM public.owner_programs WHERE id = _program;
  IF NOT FOUND OR prog.is_demo OR prog.owner_user_id IS NULL THEN RETURN NULL; END IF;
  nid := gen_random_uuid();
  got := 0;
  IF prog.notify_email THEN
    INSERT INTO public.ao_owner_email_days(owner_key, day, kind, notification_id)
      VALUES (prog.owner_user_id, today, CASE _kind WHEN 'ao_home_live' THEN 'home_live' WHEN 'ao_plan_ready' THEN 'plan_ready' ELSE 'daily' END, nid)
      ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS got = ROW_COUNT;
  END IF;
  INSERT INTO public.owner_notifications(id, program_id, owner_user_id, kind, priority, title, body, action_path, email_status, sms_status)
  VALUES (nid, prog.id, prog.owner_user_id, _kind, 'p3', _title, _body, '/owner',
          CASE WHEN NOT prog.notify_email THEN 'skipped' WHEN got = 1 THEN 'pending' ELSE 'held' END, 'skipped');
  RETURN nid;
END $function$
;

CREATE OR REPLACE FUNCTION public.notify_owner_of_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE prog record; home_id uuid;
BEGIN
 IF NEW.status<>'awaiting_owner' OR coalesce(NEW.is_demo,false) THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.status='awaiting_owner' THEN RETURN NEW; END IF;
 -- Batch release: the caller writes one summary via owner_release_summary().
 IF coalesce(current_setting('resolve.owner_release_batch', true),'')='on' THEN RETURN NEW; END IF;
 SELECT p.* INTO prog FROM public.owner_programs p JOIN public.property_owners o ON o.id=p.owner_record_id AND o.active
 WHERE p.id=NEW.program_id AND p.status IN ('pending','active') AND p.archived_at IS NULL AND NOT p.is_demo;
 IF NOT FOUND THEN RETURN NEW; END IF;
 home_id := NEW.property_id;
 IF NEW.ticket_id IS NOT NULL THEN
    SELECT property_id INTO home_id FROM public.tickets WHERE id=NEW.ticket_id AND NOT is_demo;
   IF NOT FOUND OR home_id IS NULL OR home_id IS DISTINCT FROM NEW.property_id THEN RETURN NEW; END IF;
 END IF;
 IF home_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.properties h JOIN public.owner_program_properties e ON e.property_id=h.id
   WHERE h.id=home_id AND h.owner_record_id=prog.owner_record_id AND NOT h.is_demo
     AND e.program_id=prog.id AND e.inclusion_status='included'
 ) THEN RETURN NEW; END IF;
 INSERT INTO public.owner_notifications(program_id,owner_user_id,review_id,ticket_id,kind,priority,title,body,action_path,email_status,sms_status)
 VALUES(prog.id,prog.owner_user_id,NEW.id,NEW.ticket_id,'review_ready','p3','Participation opportunity ready',
    'Open your owner portal to review the opportunity and whether an owner response is required.',
   '/owner',CASE WHEN prog.notify_email THEN 'pending' ELSE 'skipped' END,'skipped');
 RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.my_owner_item_needs()
 RETURNS TABLE(review_id uuid, property_id uuid, task_id uuid, title text, why text, since timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  WITH items AS (
    SELECT r.id, r.property_id, s.task_id, r.title, r.respond_by, s.sent_at,
      (SELECT m.author_type FROM public.owner_request_messages m WHERE m.review_id = r.id AND m.event IS NULL ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_author,
      (SELECT m.created_at FROM public.owner_request_messages m WHERE m.review_id = r.id AND m.event IS NULL ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_at,
      EXISTS (SELECT 1 FROM public.owner_request_messages m WHERE m.review_id = r.id AND m.author_type = 'homeowner') AS owner_spoke
    FROM public.owner_item_task_sends s JOIN public.owner_reviews r ON r.id = s.review_id
    WHERE r.archived_at IS NULL AND r.status <> 'closed' AND private.owner_item_answerer(r.id) = auth.uid()
      AND (NOT coalesce(private.is_synthetic_account(), false) OR r.is_demo)
  )
  SELECT id, property_id, task_id, title,
         CASE WHEN last_author = 'homeowner' THEN 'The homeowner wrote back' ELSE 'No answer from the homeowner yet' END,
         CASE WHEN last_author = 'homeowner' THEN last_at ELSE (respond_by + 1)::timestamp AT TIME ZONE 'America/Chicago' END
  FROM items
  WHERE last_author = 'homeowner'
     OR (NOT owner_spoke AND respond_by IS NOT NULL AND respond_by < (now() AT TIME ZONE 'America/Chicago')::date)
  ORDER BY 6
$function$
;

