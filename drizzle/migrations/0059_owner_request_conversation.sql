CREATE TABLE public.owner_request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id uuid NOT NULL REFERENCES public.work_items(id),
  property_id uuid,
  program_id uuid,
  task_id uuid,
  author_id uuid,
  author_type text NOT NULL CHECK (author_type IN ('homeowner','staff','system')),
  author_name text NOT NULL,
  event text CHECK (event IS NULL OR event IN ('resolved','reopened')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX owner_request_messages_item_idx ON public.owner_request_messages(work_item_id, created_at);
GRANT SELECT ON public.owner_request_messages TO authenticated;
GRANT ALL ON public.owner_request_messages TO service_role;
ALTER TABLE public.owner_request_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal staff read owner conversations" ON public.owner_request_messages
  FOR SELECT TO authenticated USING (public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid()));
CREATE POLICY "Homeowner reads own conversations" ON public.owner_request_messages
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.work_items w JOIN public.owner_programs p ON p.id=w.program_id
     WHERE w.id=owner_request_messages.work_item_id AND w.status NOT IN ('draft','archived') AND p.owner_user_id=auth.uid()));

CREATE OR REPLACE FUNCTION private.block_owner_message_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Conversation messages are permanent history and cannot be changed or removed.'; END $$;
CREATE TRIGGER owner_request_messages_append_only BEFORE UPDATE OR DELETE ON public.owner_request_messages
  FOR EACH ROW EXECUTE FUNCTION private.block_owner_message_mutation();

-- One entry point for both sides. Staff or the enrolled homeowner of THIS item only.
CREATE OR REPLACE FUNCTION public.post_owner_request_message(_id uuid, _body text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w record; _owner uuid; _staff boolean; _type text; _name text; _mid uuid; _home text;
BEGIN
  IF coalesce(trim(_body),'')='' THEN RAISE EXCEPTION 'Type a message before sending.'; END IF;
  IF length(_body) > 5000 THEN RAISE EXCEPTION 'Please keep your message under 5,000 characters.'; END IF;
  SELECT wi.*, p.owner_user_id AS prog_owner INTO w FROM work_items wi LEFT JOIN owner_programs p ON p.id=wi.program_id
   WHERE wi.id=_id AND wi.kind='opportunity' AND wi.status NOT IN ('draft','archived');
  IF w.id IS NULL THEN RAISE EXCEPTION 'This request is not available.'; END IF;
  _staff := public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid());
  IF w.prog_owner IS NOT NULL AND w.prog_owner = auth.uid() AND NOT _staff THEN
    IF w.status='complete' THEN RAISE EXCEPTION 'ARHA has resolved this request. Contact your ARHA team if something else is needed.'; END IF;
    _type := 'homeowner';
    SELECT coalesce(full_name,'The homeowner') INTO _name FROM profiles WHERE id=auth.uid();
  ELSIF _staff THEN
    IF w.status='complete' THEN RAISE EXCEPTION 'Reopen this request before sending another message.'; END IF;
    IF w.prog_owner IS NULL THEN RAISE EXCEPTION 'The homeowner does not have portal access yet, so this cannot be sent.'; END IF;
    _type := 'staff';
    SELECT coalesce(full_name,'Your ARHA team') INTO _name FROM profiles WHERE id=auth.uid();
  ELSE
    RAISE EXCEPTION 'This request is not available.';
  END IF;
  INSERT INTO owner_request_messages(work_item_id, property_id, program_id, task_id, author_id, author_type, author_name, body, is_demo)
  VALUES (w.id, w.property_id, w.program_id, w.source_task_id, auth.uid(), _type, coalesce(_name, CASE WHEN _type='staff' THEN 'Your ARHA team' ELSE 'The homeowner' END), trim(_body), coalesce(w.is_demo,false))
  RETURNING id INTO _mid;
  IF _type='homeowner' THEN
    UPDATE work_items SET responded_at=now(), viewed_at=coalesce(viewed_at, now()) WHERE id=w.id;
    PERFORM private.notify_opportunity_staff(w.id, 'replied');
  ELSE
    SELECT coalesce(nickname, name, address_line1, 'your home') INTO _home FROM properties WHERE id=w.property_id;
    INSERT INTO owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, is_demo)
    VALUES (w.program_id, w.prog_owner, 'opportunity_reply', 'p3', 'New message from Your ARHA Team', w.title||' · '||_home,
      '/owner?home='||w.property_id||'&opportunity='||w.id,
      CASE WHEN coalesce(w.is_demo,false) THEN 'skipped' ELSE 'pending' END, coalesce(w.is_demo,false));
  END IF;
  RETURN _mid;
END $$;

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
    INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, after)
    VALUES (auth.uid(), 'onboarding_task_updated', 'onboarding_task', t.id, t.title, jsonb_build_object('status','complete','owner_dependency','none','via','resolve_owner_request','work_item_id',w.id));
  ELSIF t.id IS NOT NULL THEN
    UPDATE onboarding_tasks SET owner_dependency='none' WHERE id=t.id AND owner_dependency IS DISTINCT FROM 'none';
  END IF;
  INSERT INTO owner_request_messages(work_item_id, property_id, program_id, task_id, author_id, author_type, author_name, event, body, is_demo)
  VALUES (w.id, w.property_id, w.program_id, w.source_task_id, auth.uid(), 'system', coalesce(_name,'ARHA staff'), 'resolved', 'Marked resolved by ARHA', coalesce(w.is_demo,false));
  INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, after)
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
      INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, after)
      VALUES (auth.uid(), 'onboarding_task_updated', 'onboarding_task', w.source_task_id, w.title, jsonb_build_object('status','open','via','reopen_owner_request','work_item_id',w.id));
    END IF;
  END IF;
  INSERT INTO owner_request_messages(work_item_id, property_id, program_id, task_id, author_id, author_type, author_name, event, body, is_demo)
  VALUES (w.id, w.property_id, w.program_id, w.source_task_id, auth.uid(), 'system', coalesce(_name,'ARHA staff'), 'reopened', 'Reopened by ARHA', coalesce(w.is_demo,false));
  INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, after)
  VALUES (auth.uid(), 'owner_request_reopened', 'work_item', w.id, w.title, jsonb_build_object('task_id', w.source_task_id));
END $$;

REVOKE ALL ON FUNCTION public.post_owner_request_message(uuid,text), public.resolve_owner_request(uuid), public.reopen_owner_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_owner_request_message(uuid,text), public.resolve_owner_request(uuid), public.reopen_owner_request(uuid) TO authenticated;