
ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS source text CHECK (source IN ('arha','rai')),
  ADD COLUMN IF NOT EXISTS source_department text CHECK (source_department IN ('onboarding','operations')),
  ADD COLUMN IF NOT EXISTS source_project_id uuid,
  ADD COLUMN IF NOT EXISTS source_task_id uuid,
  ADD COLUMN IF NOT EXISTS response_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_response jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS work_items_source_task_idx ON public.work_items(source_task_id) WHERE source_task_id IS NOT NULL;

CREATE TABLE public.work_item_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('file','link')),
  document_id uuid REFERENCES public.documents(id),
  label text,
  url text,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  CHECK ((kind='file' AND document_id IS NOT NULL) OR (kind='link' AND url IS NOT NULL AND label IS NOT NULL))
);
CREATE INDEX work_item_resources_item_idx ON public.work_item_resources(work_item_id) WHERE removed_at IS NULL;
GRANT SELECT ON public.work_item_resources TO authenticated;
GRANT ALL ON public.work_item_resources TO service_role;
ALTER TABLE public.work_item_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read opportunity resources" ON public.work_item_resources FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid()));
CREATE POLICY "Owners read resources on their sent Opportunities" ON public.work_item_resources FOR SELECT TO authenticated
  USING (removed_at IS NULL AND EXISTS (SELECT 1 FROM public.work_items w WHERE w.id = work_item_id
    AND w.kind='opportunity' AND w.status <> 'draft' AND public.owner_owns_program(w.program_id)));

-- Staff notification for owner collaboration events (responded / completed).
CREATE OR REPLACE FUNCTION private.notify_opportunity_staff(_id uuid, _verb text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w record; _to uuid; _owner text; _home text; _link text;
BEGIN
  SELECT * INTO w FROM work_items WHERE id=_id;
  IF w IS NULL OR w.source IS DISTINCT FROM 'arha' THEN RETURN; END IF;
  IF w.source_task_id IS NOT NULL THEN SELECT assigned_to INTO _to FROM onboarding_tasks WHERE id=w.source_task_id; END IF;
  IF _to IS NULL AND w.source_project_id IS NOT NULL THEN
    SELECT coalesce(project_manager, director, public.seat_holder('onboarding_director')) INTO _to FROM onboarding_projects WHERE id=w.source_project_id;
  END IF;
  IF _to IS NULL THEN RETURN; END IF;
  SELECT coalesce(pr.full_name, 'The homeowner') INTO _owner FROM owner_programs p LEFT JOIN profiles pr ON pr.id=p.owner_user_id WHERE p.id=w.program_id;
  SELECT coalesce(nickname, name, address_line1, 'the home') INTO _home FROM properties WHERE id=w.property_id;
  _link := '/onboarding/'||w.property_id||'?tab=work'||CASE WHEN w.source_task_id IS NOT NULL THEN '&task='||w.source_task_id ELSE '' END;
  INSERT INTO staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority, actor_id, is_demo, email_status)
  VALUES (_to, 'owner_collaboration', coalesce(_owner,'The homeowner')||' '||_verb, w.title||' · '||_home, 'work_item', w.id, _link, 'normal', auth.uid(), w.is_demo, 'none');
END $$;

CREATE OR REPLACE FUNCTION public.save_arha_opportunity(_id uuid, _property_id uuid, _source_task_id uuid, _title text,
  _content jsonb, _response_types text[], _resources jsonb, _send boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _program uuid; _owner uuid; _demo boolean; _project uuid; _mirror uuid; _wid uuid; _was text; _sent boolean := false;
  r jsonb; _i int := 0; _home text;
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
    VALUES (_wid, 'onboarding', 'opportunity', _property_id, 'staff_opportunity', _wid, _mirror, _program, _title, _content,
      CASE WHEN _send THEN 'open' ELSE 'draft' END, 'owner', false, false, coalesce(_demo,false), 'arha', 'onboarding', _project,
      _source_task_id, _response_types, CASE WHEN _send THEN now() END);
    _sent := _send;
  ELSE
    SELECT status INTO _was FROM work_items WHERE id=_id AND kind='opportunity' AND property_id=_property_id;
    IF _was IS NULL OR _was IN ('complete','archived') THEN RAISE EXCEPTION 'This Opportunity can no longer be edited.'; END IF;
    UPDATE work_items SET title=_title, owner_content=_content, linked_task_id=coalesce(_mirror, linked_task_id),
      source='arha', source_department='onboarding', source_project_id=coalesce(_project, source_project_id),
      source_task_id=coalesce(_source_task_id, source_task_id), response_types=_response_types,
      status=CASE WHEN _send AND status='draft' THEN 'open' ELSE status END,
      sent_at=CASE WHEN _send AND status='draft' THEN now() ELSE sent_at END
     WHERE id=_id;
    _wid := _id;
    _sent := _send AND _was='draft';
  END IF;

  -- Resources: keep matching rows, detach the rest (the property file itself is untouched).
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
      IF coalesce(trim(r->>'label'),'')='' OR (r->>'url') !~* '^https?://' THEN RAISE EXCEPTION 'Each link needs a label and a web address starting with https://'; END IF;
      IF EXISTS (SELECT 1 FROM work_item_resources WHERE work_item_id=_wid AND removed_at IS NULL AND kind='link' AND url=r->>'url' AND label=r->>'label') THEN
        UPDATE work_item_resources SET sort_order=_i WHERE work_item_id=_wid AND removed_at IS NULL AND kind='link' AND url=r->>'url' AND label=r->>'label';
      ELSE INSERT INTO work_item_resources(work_item_id, kind, label, url, sort_order) VALUES (_wid,'link',trim(r->>'label'),r->>'url',_i); END IF;
    END IF;
  END LOOP;

  IF _sent THEN
    SELECT coalesce(nickname, name, address_line1, 'your home') INTO _home FROM properties WHERE id=_property_id;
    INSERT INTO owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, is_demo)
    VALUES (_program, _owner, 'opportunity_sent', 'p3', 'New Opportunity from Your ARHA Team', _title||' · '||_home,
      '/owner?home='||_property_id||'&opportunity='||_wid, 'skipped', coalesce(_demo,false));
  END IF;
  RETURN _wid;
END $$;
GRANT EXECUTE ON FUNCTION public.save_arha_opportunity(uuid,uuid,uuid,text,jsonb,text[],jsonb,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_owner_opportunity_viewed(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE work_items w SET viewed_at=now() WHERE w.id=_id AND w.kind='opportunity' AND w.status<>'draft' AND w.viewed_at IS NULL
    AND EXISTS (SELECT 1 FROM owner_programs p WHERE p.id=w.program_id AND p.owner_user_id=auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.mark_owner_opportunity_viewed(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_owner_opportunity(_id uuid, _kind text, _decision text, _text text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w record;
BEGIN
  SELECT wi.* INTO w FROM work_items wi JOIN owner_programs p ON p.id=wi.program_id
   WHERE wi.id=_id AND wi.kind='opportunity' AND wi.status NOT IN ('draft','archived') AND p.owner_user_id=auth.uid();
  IF w IS NULL THEN RAISE EXCEPTION 'This Opportunity is not available to you.'; END IF;
  IF _kind NOT IN ('acknowledge','feedback','decision') OR NOT (_kind = ANY (w.response_types)) THEN
    RAISE EXCEPTION 'This Opportunity does not take that kind of response.'; END IF;
  IF _kind='feedback' AND coalesce(trim(_text),'')='' THEN RAISE EXCEPTION 'Type your feedback before submitting.'; END IF;
  IF _kind='decision' AND coalesce(_decision,'') NOT IN ('authorize','changes') THEN RAISE EXCEPTION 'Choose a decision.'; END IF;
  IF length(coalesce(_text,'')) > 5000 THEN RAISE EXCEPTION 'Please keep your response under 5,000 characters.'; END IF;
  UPDATE work_items SET responded_at=now(), viewed_at=coalesce(viewed_at, now()),
    owner_response = owner_response || jsonb_build_array(jsonb_build_object('kind',_kind,'decision',_decision,'text',nullif(trim(coalesce(_text,'')),''),'at',now()))
   WHERE id=_id;
  PERFORM private.notify_opportunity_staff(_id, CASE WHEN _kind='decision' THEN 'sent a decision' ELSE 'responded' END);
END $$;
GRANT EXECUTE ON FUNCTION public.respond_owner_opportunity(uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_owner_opportunity(_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE work_items w SET status='complete', completed_at=now(), viewed_at=coalesce(viewed_at, now())
   WHERE w.id=_id AND w.kind='opportunity' AND w.status <> 'draft'
     AND EXISTS (SELECT 1 FROM owner_programs p WHERE p.id=w.program_id AND p.owner_user_id=auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'This Opportunity is not available to you.'; END IF;
  PERFORM private.notify_opportunity_staff(_id, 'completed');
END $function$;

-- Owner documentation tagged to an Opportunity counts as a response.
CREATE OR REPLACE FUNCTION private.opportunity_documentation_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.work_item_id IS NOT NULL AND NEW.work_item_id IS DISTINCT FROM (CASE WHEN TG_OP='UPDATE' THEN OLD.work_item_id END)
     AND EXISTS (SELECT 1 FROM work_items w JOIN owner_programs p ON p.id=w.program_id
                 WHERE w.id=NEW.work_item_id AND w.kind='opportunity' AND p.owner_user_id=NEW.uploaded_by) THEN
    UPDATE work_items SET responded_at=now(), viewed_at=coalesce(viewed_at, now()) WHERE id=NEW.work_item_id;
    PERFORM private.notify_opportunity_staff(NEW.work_item_id, 'added documentation');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER opportunity_documentation_response AFTER INSERT OR UPDATE OF work_item_id ON public.documents
  FOR EACH ROW EXECUTE FUNCTION private.opportunity_documentation_response();

-- Owner alert feed: show the real Opportunity title and deep link for sent Opportunities.
DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.read_owner_participation(text,uuid,boolean,uuid)'::regprocedure);
  d := replace(d, '''progress_milestone'',''progress_deadline'')', '''progress_milestone'',''progress_deadline'',''opportunity_sent'')');
  d := replace(d, 'WHEN ''progress_deadline'' THEN ''Your program closing date is approaching''',
                  'WHEN ''progress_deadline'' THEN ''Your program closing date is approaching'' WHEN ''opportunity_sent'' THEN ''New Opportunity from Your ARHA Team''');
  d := replace(d, '''body'',''Open your owner portal to review the current details and any action required. Record only time you actually spend participating.'')',
                  '''body'',CASE WHEN n.kind=''opportunity_sent'' THEN n.body ELSE ''Open your owner portal to review the current details and any action required. Record only time you actually spend participating.'' END,''action_path'',CASE WHEN n.kind=''opportunity_sent'' THEN n.action_path END)');
  IF position('opportunity_sent' in d) = 0 THEN RAISE EXCEPTION 'read_owner_participation rewrite failed'; END IF;
  EXECUTE d;
END $do$;
