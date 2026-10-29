-- PENDING ONLY. Same creation path, no backfill, no new notification producer.
CREATE OR REPLACE FUNCTION public.save_arha_opportunity(_id uuid, _property_id uuid, _source_task_id uuid, _title text, _content jsonb, _response_types text[], _resources jsonb, _send boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _program uuid; _owner uuid; _demo boolean; _project uuid; _mirror uuid; _wid uuid; _was text; _sent boolean := false;
  r jsonb; _i int := 0; _home text; _department text; _ticket uuid; _item_kind text;
BEGIN
  IF NOT (is_onboarding_staff(auth.uid()) OR is_staff(auth.uid())) THEN RAISE EXCEPTION 'Only ARHA staff can manage Opportunities.'; END IF;
  IF _response_types IS NULL OR NOT (_response_types <@ ARRAY['acknowledge','feedback','documentation','decision']) THEN
    RAISE EXCEPTION 'Choose a valid owner response type.'; END IF;
  SELECT x.program_id, pr.owner_user_id, p.is_demo INTO _program, _owner, _demo
    FROM owner_program_properties x JOIN owner_programs pr ON pr.id=x.program_id JOIN properties p ON p.id=x.property_id
   WHERE x.property_id=_property_id AND x.inclusion_status='included' AND x.archived_at IS NULL
     AND pr.archived_at IS NULL AND pr.status NOT IN ('closed','completed','complete') LIMIT 1;
  IF _program IS NULL THEN RAISE EXCEPTION 'This home is not enrolled in an Active Owner program.'; END IF;
  IF _send AND _owner IS NULL THEN RAISE EXCEPTION 'The homeowner does not have portal access yet, so this cannot be sent. Save it as a draft.'; END IF;
  _department := CASE WHEN _content->>'source_department'='operations' THEN 'operations' ELSE 'onboarding' END;
  IF _id IS NOT NULL AND EXISTS(SELECT 1 FROM work_items WHERE id=_id AND property_id=_property_id AND source_department='operations') THEN
    _department:='operations';
    SELECT jsonb_build_object('source_department','operations','send_kind',owner_content->>'send_kind','ticket_id',owner_content->>'ticket_id','due_on',due_on::text) || _content INTO _content FROM work_items WHERE id=_id AND property_id=_property_id;
  END IF;
  _ticket := nullif(_content->>'ticket_id','')::uuid;
  _item_kind := coalesce(_content->>'send_kind','owner_task');
  IF _department='operations' THEN
    IF _source_task_id IS NOT NULL OR _item_kind NOT IN ('owner_task','review') THEN RAISE EXCEPTION 'Choose a valid Operations owner item.'; END IF;
    IF _item_kind='owner_task' AND _ticket IS NOT NULL THEN RAISE EXCEPTION 'A standalone owner task is not linked to a Ticket.'; END IF;
    IF _item_kind='review' AND _response_types IS DISTINCT FROM ARRAY['acknowledge']::text[] THEN RAISE EXCEPTION 'A review asks the homeowner to mark it reviewed.'; END IF;
    IF _ticket IS NOT NULL THEN
      IF NOT EXISTS(SELECT 1 FROM tickets WHERE id=_ticket AND property_id=_property_id AND is_demo IS NOT DISTINCT FROM _demo) THEN RAISE EXCEPTION 'The related Ticket must belong to this home.'; END IF;
      SELECT id INTO _mirror FROM work_items WHERE kind='task' AND source_table='tickets' AND source_id=_ticket AND property_id=_property_id;
      IF _mirror IS NULL THEN RAISE EXCEPTION 'The related Ticket is not available as internal work.'; END IF;
    END IF;
  END IF;
  IF _source_task_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM onboarding_tasks WHERE id=_source_task_id AND property_id=_property_id AND archived_at IS NULL) THEN
      RAISE EXCEPTION 'The related Task must belong to this home.'; END IF;
    SELECT id INTO _mirror FROM work_items WHERE kind='task' AND source_table='onboarding_tasks' AND source_id=_source_task_id LIMIT 1;
  END IF;
  SELECT id INTO _project FROM onboarding_projects WHERE property_id=_property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1;

  IF _id IS NULL THEN
    _wid := gen_random_uuid();
    INSERT INTO work_items (id, department, kind, property_id, source_table, source_id, linked_task_id, program_id, title, owner_content,
      status, functional_role, required, blocks_handoff, is_demo, source, source_department, source_project_id, source_task_id, response_types, sent_at)
    VALUES (_wid, _department, 'opportunity', _property_id, 'staff_opportunity', _wid, _mirror, _program, _title, _content,
      CASE WHEN _send THEN 'open' ELSE 'draft' END, 'owner', false, false, coalesce(_demo,false), 'arha', _department, CASE WHEN _department='onboarding' THEN _project END,
      _source_task_id, _response_types, CASE WHEN _send THEN now() END);
    _sent := _send;
  ELSE
    SELECT status INTO _was FROM work_items WHERE id=_id AND kind='opportunity' AND property_id=_property_id;
    IF _was IS NULL OR _was IN ('complete','archived') THEN RAISE EXCEPTION 'This Opportunity can no longer be edited.'; END IF;
    UPDATE work_items SET title=_title, owner_content=_content, linked_task_id=coalesce(_mirror, linked_task_id),
      source='arha', department=_department, source_department=_department, source_project_id=CASE WHEN _department='onboarding' THEN coalesce(_project, source_project_id) END,
      source_task_id=coalesce(_source_task_id, source_task_id), response_types=_response_types,
      status=CASE WHEN _send AND status='draft' THEN 'open' ELSE status END,
      sent_at=CASE WHEN _send AND status='draft' THEN now() ELSE sent_at END
     WHERE id=_id;
    _wid := _id;
    _sent := _send AND _was='draft';
  END IF;

  IF _content ? 'due_on' THEN UPDATE work_items SET due_on=nullif(_content->>'due_on','')::date WHERE id=_wid; END IF;

  UPDATE work_item_resources wr SET removed_at=now() WHERE wr.work_item_id=_wid AND wr.removed_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(_resources,'[]')) e WHERE
      (wr.kind='file' AND e->>'kind'='file' AND (e->>'document_id')::uuid=wr.document_id) OR
      (wr.kind='link' AND e->>'kind'='link' AND e->>'url'=wr.url AND e->>'label'=wr.label));
  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(_resources,'[]')) LOOP
    _i := _i + 1;
    IF r->>'kind'='file' THEN
      IF NOT EXISTS (SELECT 1 FROM documents d WHERE d.id=(r->>'document_id')::uuid AND d.property_id=_property_id AND d.deleted_at IS NULL) THEN
        RAISE EXCEPTION 'Resource files must be files on this home.'; END IF;
      IF EXISTS (SELECT 1 FROM work_item_resources WHERE work_item_id=_wid AND removed_at IS NULL AND kind='file' AND document_id=(r->>'document_id')::uuid) THEN
        UPDATE work_item_resources SET sort_order=_i WHERE work_item_id=_wid AND removed_at IS NULL AND kind='file' AND document_id=(r->>'document_id')::uuid;
      ELSE INSERT INTO work_item_resources(work_item_id, kind, document_id, sort_order) VALUES (_wid,'file',(r->>'document_id')::uuid,_i); END IF;
    ELSIF r->>'kind'='link' THEN
      IF coalesce(trim(r->>'label'),'')='' OR (r->>'url') !~* '^https://[^[:space:]]+$' THEN RAISE EXCEPTION 'Each link needs a display name and a secure web address starting with https://'; END IF;
      IF EXISTS (SELECT 1 FROM work_item_resources WHERE work_item_id=_wid AND removed_at IS NULL AND kind='link' AND url=r->>'url' AND label=r->>'label') THEN
        UPDATE work_item_resources SET sort_order=_i, note=nullif(trim(r->>'note'),''), resource_type=coalesce(nullif(r->>'resource_type',''),'other') WHERE work_item_id=_wid AND removed_at IS NULL AND kind='link' AND url=r->>'url' AND label=r->>'label';
      ELSE INSERT INTO work_item_resources(work_item_id, kind, label, url, sort_order, note, resource_type) VALUES (_wid,'link',trim(r->>'label'),r->>'url',_i,nullif(trim(r->>'note'),''),coalesce(nullif(r->>'resource_type',''),'other')); END IF;
    END IF;
  END LOOP;

  IF _sent THEN
    SELECT coalesce(nickname, name, address_line1, 'your home') INTO _home FROM properties WHERE id=_property_id;
    INSERT INTO owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, is_demo)
    VALUES (_program, _owner, 'opportunity_sent', 'p3', 'New Opportunity from Your ARHA Team', _title||' · '||_home,
      '/owner?home='||_property_id||'&opportunity='||_wid, 'pending', coalesce(_demo,false));
  END IF;
  RETURN _wid;
END $function$
;

CREATE OR REPLACE FUNCTION public.ops_send_owner_ready() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(public.is_staff(auth.uid()),false) OR coalesce(public.is_onboarding_staff(auth.uid()),false) $$;
REVOKE ALL ON FUNCTION public.ops_send_owner_ready() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_send_owner_ready() TO authenticated;