-- Staff: resolve the request and complete its internal Task (if any).
CREATE OR REPLACE FUNCTION public.resolve_owner_request(_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w record; t record; _name text;
BEGIN
  IF NOT (public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid())) THEN RAISE EXCEPTION 'Only ARHA staff can resolve homeowner requests.'; END IF;
  SELECT * INTO w FROM work_items WHERE id=_id AND kind='opportunity' AND status NOT IN ('draft','archived') FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'This request is not available.'; END IF;
  IF w.status='complete' THEN RAISE EXCEPTION 'This request is already resolved.'; END IF;
  IF w.source_task_id IS NOT NULL THEN
    SELECT * INTO t FROM onboarding_tasks WHERE id=w.source_task_id AND property_id=w.property_id AND archived_at IS NULL FOR UPDATE;
    IF t.id IS NOT NULL AND coalesce(t.requires_owner_approval,false) AND t.owner_approval_status NOT IN ('approved','not_required') THEN
      RAISE EXCEPTION 'The linked Task is waiting on a homeowner business decision, so it cannot be completed here.'; END IF;
  END IF;
  SELECT coalesce(full_name,'ARHA staff') INTO _name FROM profiles WHERE id=auth.uid();
  UPDATE work_items SET status='complete', completed_at=now() WHERE id=w.id;
  IF t.id IS NOT NULL AND t.status <> 'complete' THEN
    UPDATE onboarding_tasks SET status='complete', completed_at=now(), completed_by=auth.uid(), owner_dependency='none' WHERE id=t.id;
    INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
    VALUES (auth.uid(), 'onboarding_task_updated', 'onboarding_task', t.id, t.title, jsonb_build_object('status','complete','owner_dependency','none','via','resolve_owner_request','work_item_id',w.id));
  ELSIF t.id IS NOT NULL THEN
    UPDATE onboarding_tasks SET owner_dependency='none' WHERE id=t.id AND owner_dependency IS DISTINCT FROM 'none';
  END IF;
  INSERT INTO owner_request_messages(work_item_id, property_id, program_id, task_id, author_id, author_type, author_name, event, body, is_demo)
  VALUES (w.id, w.property_id, w.program_id, w.source_task_id, auth.uid(), 'system', coalesce(_name,'ARHA staff'), 'resolved', 'Marked resolved by ARHA', coalesce(w.is_demo,false));
  INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
  VALUES (auth.uid(), 'owner_request_resolved', 'work_item', w.id, w.title, jsonb_build_object('task_id', w.source_task_id));
END $$;

-- Staff: reopen the same request and thread (and its Task, if this flow completed it).
CREATE OR REPLACE FUNCTION public.reopen_owner_request(_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w record; _name text;
BEGIN
  IF NOT (public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid())) THEN RAISE EXCEPTION 'Only ARHA staff can reopen homeowner requests.'; END IF;
  SELECT * INTO w FROM work_items WHERE id=_id AND kind='opportunity' AND status='complete' FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Only a resolved request can be reopened.'; END IF;
  SELECT coalesce(full_name,'ARHA staff') INTO _name FROM profiles WHERE id=auth.uid();
  UPDATE work_items SET status='open', completed_at=NULL WHERE id=w.id;
  IF w.source_task_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET status='open', completed_at=NULL, completed_by=NULL
     WHERE id=w.source_task_id AND property_id=w.property_id AND archived_at IS NULL AND status='complete';
    IF FOUND THEN
      INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
      VALUES (auth.uid(), 'onboarding_task_updated', 'onboarding_task', w.source_task_id, w.title, jsonb_build_object('status','open','via','reopen_owner_request','work_item_id',w.id));
    END IF;
  END IF;
  INSERT INTO owner_request_messages(work_item_id, property_id, program_id, task_id, author_id, author_type, author_name, event, body, is_demo)
  VALUES (w.id, w.property_id, w.program_id, w.source_task_id, auth.uid(), 'system', coalesce(_name,'ARHA staff'), 'reopened', 'Reopened by ARHA', coalesce(w.is_demo,false));
  INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
  VALUES (auth.uid(), 'owner_request_reopened', 'work_item', w.id, w.title, jsonb_build_object('task_id', w.source_task_id));
END $$;