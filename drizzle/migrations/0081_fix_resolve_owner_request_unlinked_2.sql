CREATE OR REPLACE FUNCTION public.resolve_owner_request(_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE w record; _tid uuid; _tstatus text; _ttitle text; _treq boolean; _tappr text; _name text;
BEGIN
  IF NOT (public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid())) THEN RAISE EXCEPTION 'Only ARHA staff can resolve homeowner requests.'; END IF;
  SELECT * INTO w FROM work_items WHERE id=_id AND kind='opportunity' AND status NOT IN ('draft','archived') FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'This request is not available.'; END IF;
  IF w.status='complete' THEN RAISE EXCEPTION 'This request is already resolved.'; END IF;
  IF w.source_task_id IS NOT NULL THEN
    SELECT id, status, title, coalesce(requires_owner_approval,false), owner_approval_status
      INTO _tid, _tstatus, _ttitle, _treq, _tappr
      FROM onboarding_tasks WHERE id=w.source_task_id AND property_id=w.property_id AND archived_at IS NULL FOR UPDATE;
    IF _tid IS NOT NULL AND _treq AND _tappr NOT IN ('approved','not_required') THEN
      RAISE EXCEPTION 'The linked Task is waiting on a homeowner business decision, so it cannot be completed here.'; END IF;
  END IF;
  SELECT coalesce(full_name,'ARHA staff') INTO _name FROM profiles WHERE id=auth.uid();
  UPDATE work_items SET status='complete', completed_at=now() WHERE id=w.id;
  IF _tid IS NOT NULL AND _tstatus <> 'complete' THEN
    UPDATE onboarding_tasks SET status='complete', completed_at=now(), completed_by=auth.uid(), owner_dependency='none' WHERE id=_tid;
    INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
    VALUES (auth.uid(), 'onboarding_task_updated', 'onboarding_task', _tid, _ttitle, jsonb_build_object('status','complete','owner_dependency','none','via','resolve_owner_request','work_item_id',w.id));
  ELSIF _tid IS NOT NULL THEN
    UPDATE onboarding_tasks SET owner_dependency='none' WHERE id=_tid AND owner_dependency IS DISTINCT FROM 'none';
  END IF;
  INSERT INTO owner_request_messages(work_item_id, property_id, program_id, task_id, author_id, author_type, author_name, event, body, is_demo)
  VALUES (w.id, w.property_id, w.program_id, w.source_task_id, auth.uid(), 'system', coalesce(_name,'ARHA staff'), 'resolved', 'Marked resolved by ARHA', coalesce(w.is_demo,false));
  INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
  VALUES (auth.uid(), 'owner_request_resolved', 'work_item', w.id, w.title, jsonb_build_object('task_id', w.source_task_id));
END $function$;