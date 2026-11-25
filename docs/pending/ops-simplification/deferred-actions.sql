-- NOT APPLIED in part 1; needs canonical close/archive/date-reset review in later parts.
CREATE OR REPLACE FUNCTION public.ops_backlog_action(_items jsonb,_action text,_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE item jsonb; ty text; eid uuid; before_row jsonb; after_row jsonb; r record; s public.guest_ready_standards; t public.tickets; rc public.routine_controls; l public.leads; _today date := (now() AT TIME ZONE 'America/Chicago')::date; _due date; n int:=0;
BEGIN
 IF NOT public.ops_backlog_manager() THEN RAISE EXCEPTION 'Only Operations leadership can change Old backlog.'; END IF;
 IF _action NOT IN ('close','live','archive') OR jsonb_typeof(_items)<>'array' OR jsonb_array_length(_items)<1 OR jsonb_array_length(_items)>1000 THEN RAISE EXCEPTION 'Choose items and an action.'; END IF;
 IF length(btrim(coalesce(_reason,'')))<3 THEN RAISE EXCEPTION 'Give a short reason.'; END IF;
 PERFORM set_config('resolve.ops_transition','on',true);
 PERFORM set_config('resolve.due_lock_reason_ok','on',true);
 FOR item IN SELECT value FROM jsonb_array_elements(_items) ORDER BY value->>'type',value->>'id' LOOP
  ty:=item->>'type';eid:=(item->>'id')::uuid;
  IF EXISTS(SELECT 1 FROM public.ops_backlog_history WHERE entity_type=ty AND entity_id=eid AND action=_action AND created_at>now()-interval '1 second') THEN CONTINUE; END IF;
  IF ty='ticket' THEN
   SELECT * INTO t FROM public.tickets WHERE id=eid FOR UPDATE;
   IF NOT FOUND OR t.ops_backlog_at IS NULL OR t.archived_at IS NOT NULL OR t.status IN ('resolved','closed') THEN RAISE EXCEPTION 'This backlog item changed. Refresh the list.'; END IF;
   before_row:=to_jsonb(t);
   IF _action='live' THEN
    s:=private.guest_ready_row(t.work_type_id,t.priority);
    _due:=CASE s.rule WHEN 'same_day' THEN _today WHEN 'clean_day_4pm' THEN _today WHEN 'days' THEN _today+coalesce(s.rule_days,7) ELSE CASE WHEN t.priority IN ('p1','p2') THEN _today ELSE _today+7 END END;
    SELECT * INTO r FROM public.ticket_route_at(CASE WHEN t.functional_role_code LIKE 'ge\_%' OR EXISTS(SELECT 1 FROM public.work_types WHERE id=t.work_type_id AND name='Arrival check') THEN 'ge_day' ELSE 'po_day' END,NULL,now());
    UPDATE public.tickets SET ops_backlog_at=NULL,ops_live_at=now(),ops_assigned_at=now(),due_on=_due,due_locked=coalesce(s.locked,false),response_due_at=now()+make_interval(mins=>coalesce((SELECT response_minutes FROM public.work_types WHERE id=t.work_type_id),CASE WHEN t.priority='p1' THEN 3 WHEN t.priority='p2' THEN 30 ELSE 1440 END)),action_due_at=now()+make_interval(mins=>coalesce((SELECT action_start_minutes FROM public.work_types WHERE id=t.work_type_id),CASE WHEN t.priority='p1' THEN 5 WHEN t.priority='p2' THEN 60 ELSE 2880 END)),due_at=(_due+time '17:00') AT TIME ZONE 'America/Chicago',next_action_due_at=(_due+time '17:00') AT TIME ZONE 'America/Chicago',acknowledged_at=NULL,action_started_at=NULL,next_review_at=NULL,promised_update_due_at=NULL,status='open',waiting_on=NULL,waiting_reason=NULL,assigned_to=r.user_id,current_action_owner=r.user_id,assignment_source=r.source,assignment_note=r.note,escalated_at=NULL,escalation_level='none',unowned_since=CASE WHEN r.user_id IS NULL THEN now() ELSE NULL END,external_status=CASE WHEN external_source='notion' THEN 'reopened_in_resolve' ELSE external_status END,import_hold=NULL WHERE id=eid;
   ELSIF _action='close' THEN
    UPDATE public.tickets SET status='closed',resolved_at=now(),resolution_notes=_reason,closure_exception_reason=_reason,closure_exception_by=auth.uid(),closure_exception_at=now() WHERE id=eid;
   ELSE
    UPDATE public.tickets SET archived_at=now(),archive_reason=_reason,archived_by=auth.uid() WHERE id=eid;
   END IF;
   SELECT to_jsonb(x) INTO after_row FROM public.tickets x WHERE id=eid;
   INSERT INTO public.ticket_activity(ticket_id,author_id,kind,event_type,body,internal,is_demo) VALUES(eid,auth.uid(),'status','old_backlog_'||_action,CASE _action WHEN 'live' THEN 'Moved to live work. ' WHEN 'close' THEN 'Closed. ' ELSE 'Archived. ' END||_reason,true,t.is_demo);
  ELSIF ty='routine' THEN
   SELECT * INTO rc FROM public.routine_controls WHERE id=eid FOR UPDATE;
   IF NOT FOUND OR rc.ops_backlog_at IS NULL OR rc.ops_archived_at IS NOT NULL OR rc.status NOT IN ('due','in_progress') THEN RAISE EXCEPTION 'This backlog item changed. Refresh the list.'; END IF;
   before_row:=to_jsonb(rc);
   IF _action='live' THEN
    SELECT * INTO r FROM public.ticket_route_at('po_day',NULL,now());
    SELECT * INTO s FROM public.guest_ready_standards WHERE label ILIKE CASE WHEN rc.title ~* '(lawn|landscap|yard|mow|irrigation|sprinkler)' THEN '%lawn%' ELSE '%maintenance%' END ORDER BY sort_order LIMIT 1;
    _due:=CASE s.rule WHEN 'days' THEN _today+coalesce(s.rule_days,7) WHEN 'same_day' THEN _today ELSE _today+1 END;
    UPDATE public.routine_controls SET ops_backlog_at=NULL,ops_live_at=now(),ops_assigned_at=now(),due_at=(_due+time '17:00') AT TIME ZONE 'America/Chicago',assigned_to=r.user_id,assigned_role_code=r.role_code WHERE id=eid;
   ELSIF _action='close' THEN UPDATE public.routine_controls SET status='completed',notes=concat_ws(E'\n',notes,_reason),completed_by=auth.uid() WHERE id=eid;
   ELSE UPDATE public.routine_controls SET ops_archived_at=now(),notes=concat_ws(E'\n',notes,_reason) WHERE id=eid;
   END IF;
   SELECT to_jsonb(x) INTO after_row FROM public.routine_controls x WHERE id=eid;
  ELSIF ty='lead' THEN
   SELECT * INTO l FROM public.leads WHERE id=eid FOR UPDATE;
   IF NOT FOUND OR l.ops_backlog_at IS NULL OR l.ops_archived_at IS NOT NULL OR l.outcome IS NOT NULL OR l.stage IN ('converted','lost') THEN RAISE EXCEPTION 'This backlog item changed. Refresh the list.'; END IF;
   before_row:=to_jsonb(l);
   IF _action='live' THEN
    SELECT * INTO r FROM public.ticket_route_at('ge_day',NULL,now());
    UPDATE public.leads SET ops_backlog_at=NULL,ops_live_at=now(),assigned_to=r.user_id,owned_by=r.user_id,started_at=now(),follow_up_due_at=now()+interval '48 hours',overnight_until=NULL WHERE id=eid;
   ELSIF _action='close' THEN UPDATE public.leads SET stage='lost',outcome='not_booked',outcome_at=now(),outcome_by=auth.uid(),not_booked_reason='other',not_booked_note=_reason,lost_note=_reason WHERE id=eid;
   ELSE UPDATE public.leads SET ops_archived_at=now(),notes=concat_ws(E'\n',notes,_reason) WHERE id=eid;
   END IF;
   SELECT to_jsonb(x) INTO after_row FROM public.leads x WHERE id=eid;
  ELSE RAISE EXCEPTION 'Unknown backlog item.';
  END IF;
  INSERT INTO public.ops_backlog_history(entity_type,entity_id,action,reason,actor_id,before_value,after_value) VALUES(ty,eid,_action,_reason,auth.uid(),before_row,after_row);
  INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,reason,before_value,after_value) VALUES(auth.uid(),'ops_backlog_'||_action,ty,eid,_reason,before_row,after_row);
  n:=n+1;
 END LOOP;
 PERFORM set_config('resolve.ops_transition','',true);
 PERFORM set_config('resolve.due_lock_reason_ok','',true);
 RETURN jsonb_build_object('changed',n);
END $$;
REVOKE ALL ON FUNCTION public.ops_backlog_action(jsonb,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_backlog_action(jsonb,text,text) TO authenticated,service_role;

