-- Prerequisite: 0168 from docs/pending/onboarding-cleanup (stable duplicate identity and completion).
-- Extend the current two-step path; retain ordinary tickets table insert triggers and lifecycle.
CREATE FUNCTION public.handoff_open_items(_property_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 WITH req AS(SELECT 'requirement:'||r.id item_key,r.id requirement_id,r.name,r.category,coalesce((SELECT array_agg(t.id) FROM public.onboarding_tasks t WHERE t.id=ANY(s.task_ids) AND t.status NOT IN('complete','done')),'{}'::uuid[]) task_ids FROM public.home_handoff_requirement_states(_property_id) s JOIN public.handoff_requirements r ON r.id=s.requirement_id WHERE s.state IN('open','unlinked')),
 other AS(SELECT 'task:'||t.id item_key,NULL::uuid requirement_id,t.title name,'Other outstanding work' category,ARRAY[t.id] task_ids FROM public.onboarding_tasks t WHERE t.property_id=_property_id AND t.archived_at IS NULL AND t.status NOT IN('complete','done') AND public.handoff_step_for_task(t.id) IS NULL AND NOT EXISTS(SELECT 1 FROM req WHERE t.id=ANY(req.task_ids)))
 SELECT coalesce(jsonb_agg(x),'[]') FROM(SELECT * FROM req UNION ALL SELECT * FROM other)x
$$;
REVOKE ALL ON FUNCTION public.handoff_open_items(uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.handoff_open_items(uuid) TO service_role;
CREATE FUNCTION public.perform_handoff_step(_project_id uuid,_step text,_items jsonb,_booking_block boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pr public.onboarding_projects; expected jsonb;e jsonb;v jsonb;_demo boolean;_ticket uuid;_carry public.handoff_carryovers;_role text;_due date;_task_ids uuid[];_safety boolean;
BEGIN
 SELECT * INTO pr FROM public.onboarding_projects WHERE id=_project_id FOR UPDATE;
 IF auth.uid() IS NULL OR pr.id IS NULL THEN RAISE EXCEPTION 'Project not available.'; END IF;
 SELECT is_demo INTO _demo FROM public.properties WHERE id=pr.property_id;
 IF coalesce(private.is_synthetic_account(),false) AND NOT coalesce(_demo,false) THEN RAISE EXCEPTION 'Home not available.'; END IF;
 IF _step='ready' THEN
 IF NOT coalesce(auth.uid()=public.seat_holder('onboarding_director') OR auth.uid()=pr.director OR public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Only the Onboarding Director can mark a home ready.'; END IF;
 IF pr.handoff_state IN('ready','accepted') THEN RETURN; END IF;
 ELSIF _step='accepted' THEN
 IF NOT coalesce(auth.uid()=public.seat_holder('director_ops') OR public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Only the Operations Director can accept a home.'; END IF;
 IF pr.handoff_state='accepted' THEN RETURN; END IF;
 IF pr.handoff_state<>'ready' THEN RAISE EXCEPTION 'Mark this home ready first.'; END IF;
 ELSE RAISE EXCEPTION 'Choose a handoff step.'; END IF;
 -- Serialize the living definition and home decisions for a truthful confirmation.
 PERFORM id FROM public.handoff_requirements FOR SHARE;
 expected:=public.handoff_open_items(pr.property_id);
 IF jsonb_typeof(_items)<>'array' THEN RAISE EXCEPTION 'Review all carry-over items.'; END IF;
 IF jsonb_array_length(_items)<>jsonb_array_length(expected) OR EXISTS(SELECT 1 FROM jsonb_array_elements(expected)e WHERE (SELECT count(*) FROM jsonb_array_elements(_items)v WHERE v->>'key'=e->>'item_key')<>1) THEN RAISE EXCEPTION 'Outstanding items changed. Review the carry-over list again.'; END IF;
 SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(expected)e WHERE e->>'category' IN('Safety','Access','Water')) INTO _safety;
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
 INSERT INTO public.tickets(property_id,title,description,status,priority,category,entry_kind,record_type,functional_role_code,due_at,source_channel,source_reference,created_by,record_owner,accountable_owner,reported_at,is_demo)
 VALUES(pr.property_id,'Carry-over: '||_carry.title,coalesce(_carry.note,'')||E'\nSource: Onboarding handoff\nRequirement: '||coalesce(_carry.requirement_id::text,'none')||E'\nTasks: '||array_to_string(_carry.task_ids,','),'open','p3','other','ops_ticket','active_task',_carry.owner_role,_carry.due_on::timestamp AT TIME ZONE 'America/Chicago','other','Onboarding handoff: '||_carry.id,auth.uid(),auth.uid(),auth.uid(),now(),coalesce(_demo,false)) RETURNING id INTO _ticket;
 INSERT INTO public.ticket_activity(ticket_id,actor_id,event_type,note) VALUES(_ticket,auth.uid(),'created','Carry-over accepted from Onboarding.');
 UPDATE public.handoff_carryovers SET ticket_id=_ticket,accepted_at=now(),accepted_by=auth.uid() WHERE id=_carry.id;
 END IF;
 END LOOP;
 INSERT INTO public.handoff_step_history(project_id,actor_id,step,items,booking_block,booking_block_at,is_demo) VALUES(pr.id,auth.uid(),_step,_items,_step='accepted' AND _safety AND _booking_block,CASE WHEN _step='accepted' AND _safety AND _booking_block THEN now() END,coalesce(_demo,false));
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,entity_label,before_value,after_value) VALUES(auth.uid(),'onboarding_handoff_'||_step,'onboarding_project',pr.id,'Onboarding handoff',jsonb_build_object('state',pr.handoff_state),jsonb_build_object('state',_step,'carryovers',jsonb_array_length(expected),'booking_block',_step='accepted' AND _safety AND _booking_block));
 UPDATE public.onboarding_projects SET handoff_state=CASE WHEN _step='ready' THEN 'ready' ELSE 'accepted' END,ready_for_ops_at=CASE WHEN _step='ready' THEN now() ELSE ready_for_ops_at END,ready_for_ops_by=CASE WHEN _step='ready' THEN auth.uid() ELSE ready_for_ops_by END,ops_accepted_at=CASE WHEN _step='accepted' THEN now() ELSE ops_accepted_at END,ops_accepted_by=CASE WHEN _step='accepted' THEN auth.uid() ELSE ops_accepted_by END WHERE id=pr.id;
 PERFORM public.complete_handoff_step_tasks(pr.id,_step);
 IF _step='accepted' THEN UPDATE public.onboarding_projects SET status='complete',completed_at=now() WHERE id=pr.id; UPDATE public.properties SET lifecycle_status='active' WHERE id=pr.property_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.perform_handoff_step(uuid,text,jsonb,boolean) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.perform_handoff_step(uuid,text,jsonb,boolean) TO authenticated,service_role;
-- Legacy callers remain working, but cannot silently skip confirmation or the safety acknowledgment.
CREATE OR REPLACE FUNCTION public.mark_ready_for_operations(_project_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p uuid;v jsonb;
BEGIN SELECT property_id INTO p FROM public.onboarding_projects WHERE id=_project_id;v:=public.handoff_open_items(p);IF jsonb_array_length(v)>0 THEN RAISE EXCEPTION 'Review the carry-over confirmation in the Handoff tab.';END IF;PERFORM public.perform_handoff_step(_project_id,'ready','[]',false);END $$;
CREATE OR REPLACE FUNCTION public.accept_into_operations(_project_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p uuid;v jsonb;
BEGIN SELECT property_id INTO p FROM public.onboarding_projects WHERE id=_project_id;v:=public.handoff_open_items(p);IF jsonb_array_length(v)>0 THEN RAISE EXCEPTION 'Review the carry-over confirmation in the Handoff tab.';END IF;PERFORM public.perform_handoff_step(_project_id,'accepted','[]',false);END $$;
CREATE FUNCTION public.complete_handoff_carryover_tasks() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.handoff_carryovers;t public.onboarding_tasks;
BEGIN
 IF NEW.status NOT IN('resolved','closed') OR OLD.status IN('resolved','closed') THEN RETURN NEW; END IF;
 FOR c IN SELECT * FROM public.handoff_carryovers WHERE ticket_id=NEW.id LOOP
 FOR t IN SELECT * FROM public.onboarding_tasks WHERE id=ANY(c.task_ids) AND property_id=c.property_id AND archived_at IS NULL AND status NOT IN('complete','done') FOR UPDATE LOOP
 -- A Task linked to multiple requirement Tickets completes only after every one is done.
 IF EXISTS(SELECT 1 FROM public.handoff_carryovers other JOIN public.tickets ot ON ot.id=other.ticket_id WHERE t.id=ANY(other.task_ids) AND other.ticket_id<>NEW.id AND ot.status NOT IN('resolved','closed')) THEN CONTINUE; END IF;
 UPDATE public.onboarding_tasks SET status='complete',completed_at=now(),completed_by=auth.uid() WHERE id=t.id;
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,entity_label,before_value,after_value) VALUES(auth.uid(),'onboarding_task_completed_by_carryover','onboarding_task',t.id,t.title,jsonb_build_object('status',t.status),jsonb_build_object('status','complete','ticket_id',NEW.id));
 END LOOP; END LOOP;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.complete_handoff_carryover_tasks() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.complete_handoff_carryover_tasks() TO service_role;
CREATE TRIGGER handoff_carryover_ticket_completed AFTER UPDATE OF status ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.complete_handoff_carryover_tasks();
