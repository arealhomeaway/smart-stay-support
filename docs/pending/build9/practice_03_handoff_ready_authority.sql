-- Practice run of 03_handoff_ready_authority.sql (Build 9 F3) with real accounts on one real home.
-- Cancelled at the end: nothing is kept. Each try runs inside its own cancelled block too.
CREATE TEMP TABLE practice_result(k text, v text);
GRANT ALL ON practice_result TO authenticated;
-- Build 9 F3 (APPLY): on a home's handoff tab only the Director of Onboarding marks ready;
-- only the Director of Operations (or whoever covers that role now) or Admin accepts (register O4).
-- One change to perform_handoff_step: the ready check drops the project director and Admin,
-- leaving the Director of Onboarding role holder. The accept check, the carry over items,
-- tickets, history, audit and schedule steps are byte for byte the live function.
-- Ticket handoffs (handoffs table) are not touched.
-- Undo: undo/03_handoff_ready_authority.sql (the exact live text before Build 9).
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.

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
END $function$;

CREATE TEMP TABLE practice_ids AS
SELECT p.id AS project_id, p.property_id, p.director AS project_director,
       public.seat_holder('onboarding_director') AS onb_dir,
       public.seat_holder('director_ops') AS ops_dir,
       public.seat_holder('po_day') AS coord,
       (SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
          AND ur.user_id IS DISTINCT FROM public.seat_holder('onboarding_director')
          AND ur.user_id IS DISTINCT FROM public.seat_holder('director_ops') ORDER BY ur.user_id LIMIT 1) AS admin_only,
       (SELECT coalesce(jsonb_agg(jsonb_build_object('key', ex->>'item_key')), '[]'::jsonb)
          FROM jsonb_array_elements(public.handoff_open_items(p.property_id)) ex) AS items
  FROM public.onboarding_projects p JOIN public.properties h ON h.id = p.property_id
 WHERE h.is_demo = false AND p.status = 'active' AND p.handoff_state = 'in_progress'
 ORDER BY p.created_at LIMIT 1;
GRANT SELECT ON practice_ids TO authenticated;
INSERT INTO practice_result SELECT 'admin_is_separate_person', (admin_only IS NOT NULL)::text FROM practice_ids;
INSERT INTO practice_result SELECT 'project_director_is_onboarding_director', (project_director = onb_dir)::text FROM practice_ids;

CREATE OR REPLACE FUNCTION pg_temp.try_step(_who uuid, _step text, _first_ready boolean) RETURNS text LANGUAGE plpgsql AS $t$
BEGIN
  BEGIN
    IF _first_ready THEN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT onb_dir FROM practice_ids), 'role', 'authenticated')::text, true);
      PERFORM public.perform_handoff_step((SELECT project_id FROM practice_ids), 'ready', (SELECT items FROM practice_ids), false);
    END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', _who, 'role', 'authenticated')::text, true);
    PERFORM public.perform_handoff_step((SELECT project_id FROM practice_ids), _step,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('key', ex->>'item_key')), '[]'::jsonb)
         FROM jsonb_array_elements(public.handoff_open_items((SELECT property_id FROM practice_ids))) ex), true);
    RAISE EXCEPTION 'ALLOWED';
  EXCEPTION WHEN others THEN RETURN CASE WHEN SQLERRM = 'ALLOWED' THEN 'allowed' ELSE 'refused: ' || SQLERRM END;
  END;
END $t$;
GRANT EXECUTE ON FUNCTION pg_temp.try_step(uuid, text, boolean) TO authenticated;

SET LOCAL ROLE authenticated;
INSERT INTO practice_result SELECT 'ready_by_director_of_onboarding', pg_temp.try_step(onb_dir, 'ready', false) FROM practice_ids;
INSERT INTO practice_result SELECT 'ready_by_admin', CASE WHEN admin_only IS NULL THEN 'no separate Admin' ELSE pg_temp.try_step(admin_only, 'ready', false) END FROM practice_ids;
INSERT INTO practice_result SELECT 'ready_by_director_of_operations', pg_temp.try_step(ops_dir, 'ready', false) FROM practice_ids;
INSERT INTO practice_result SELECT 'ready_by_coordinator', pg_temp.try_step(coord, 'ready', false) FROM practice_ids;
INSERT INTO practice_result SELECT 'accept_by_director_of_operations', pg_temp.try_step(ops_dir, 'accepted', true) FROM practice_ids;
INSERT INTO practice_result SELECT 'accept_by_admin', CASE WHEN admin_only IS NULL THEN 'no separate Admin' ELSE pg_temp.try_step(admin_only, 'accepted', true) END FROM practice_ids;
INSERT INTO practice_result SELECT 'accept_by_director_of_onboarding', pg_temp.try_step(onb_dir, 'accepted', true) FROM practice_ids;
INSERT INTO practice_result SELECT 'accept_by_coordinator', pg_temp.try_step(coord, 'accepted', true) FROM practice_ids;
RESET ROLE;
INSERT INTO practice_result SELECT 'home_state_after', handoff_state FROM public.onboarding_projects WHERE id = (SELECT project_id FROM practice_ids);
DO $practice$ BEGIN
  RAISE EXCEPTION 'PRACTICE CANCELLED %', (SELECT json_object_agg(k, v) FROM practice_result);
END $practice$;
