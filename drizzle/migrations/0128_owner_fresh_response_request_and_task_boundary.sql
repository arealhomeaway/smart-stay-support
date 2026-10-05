ALTER TABLE public.owner_request_messages DROP CONSTRAINT owner_request_messages_event_check;
ALTER TABLE public.owner_request_messages ADD CONSTRAINT owner_request_messages_event_check CHECK (event IS NULL OR event = ANY (ARRAY['resolved','reopened','response_requested']));
ALTER TABLE public.owner_request_messages ADD COLUMN IF NOT EXISTS request_kind text;
ALTER TABLE public.owner_request_messages ADD CONSTRAINT owner_request_messages_request_kind_check CHECK ((event = 'response_requested' AND request_kind IN ('feedback','decision')) OR (event IS DISTINCT FROM 'response_requested' AND request_kind IS NULL));

-- Explicit staff request for a fresh owner response (feedback or decision). Informational messages stay on post_owner_request_message.
CREATE OR REPLACE FUNCTION public.request_owner_response(_id uuid, _body text, _kind text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE w record; _name text; _mid uuid; _home text;
BEGIN
  IF NOT (public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid())) THEN RAISE EXCEPTION 'Only ARHA staff can request a homeowner response.'; END IF;
  IF _kind NOT IN ('feedback','decision') THEN RAISE EXCEPTION 'Choose feedback or a decision.'; END IF;
  IF coalesce(trim(_body),'')='' THEN RAISE EXCEPTION 'Explain what you are asking the homeowner.'; END IF;
  IF length(_body) > 5000 THEN RAISE EXCEPTION 'Please keep your message under 5,000 characters.'; END IF;
  SELECT wi.*, p.owner_user_id AS prog_owner INTO w FROM work_items wi LEFT JOIN owner_programs p ON p.id=wi.program_id
   WHERE wi.id=_id AND wi.kind='opportunity' AND wi.status NOT IN ('draft','archived') FOR UPDATE OF wi;
  IF w.id IS NULL THEN RAISE EXCEPTION 'This request is not available.'; END IF;
  IF w.status='complete' THEN RAISE EXCEPTION 'Reopen this request before asking for another response.'; END IF;
  IF w.prog_owner IS NULL THEN RAISE EXCEPTION 'The homeowner does not have portal access yet, so this cannot be sent.'; END IF;
  -- Let the owner answer with the requested kind; earlier response types and answers are preserved.
  UPDATE work_items SET response_types = array_append(response_types, _kind)
   WHERE id=w.id AND NOT (_kind = ANY(coalesce(response_types,'{}')));
  SELECT coalesce(full_name,'Your ARHA team') INTO _name FROM profiles WHERE id=auth.uid();
  INSERT INTO owner_request_messages(work_item_id, property_id, program_id, task_id, author_id, author_type, author_name, event, request_kind, body, is_demo)
  VALUES (w.id, w.property_id, w.program_id, w.source_task_id, auth.uid(), 'staff', coalesce(_name,'Your ARHA team'), 'response_requested', _kind, trim(_body), coalesce(w.is_demo,false))
  RETURNING id INTO _mid;
  SELECT coalesce(nickname, name, address_line1, 'your home') INTO _home FROM properties WHERE id=w.property_id;
  INSERT INTO owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, is_demo)
  VALUES (w.program_id, w.prog_owner, 'opportunity_reply', 'p3',
    CASE WHEN _kind='decision' THEN 'Your ARHA Team needs your decision' ELSE 'Your ARHA Team is asking for your feedback' END,
    w.title||' · '||_home, '/owner?home='||w.property_id||'&opportunity='||w.id,
    CASE WHEN coalesce(w.is_demo,false) THEN 'skipped' ELSE 'pending' END, coalesce(w.is_demo,false));
  INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
  VALUES (auth.uid(), 'owner_response_requested', 'work_item', w.id, w.title, jsonb_build_object('kind', _kind, 'message_id', _mid));
  RETURN _mid;
END $function$;
REVOKE ALL ON FUNCTION public.request_owner_response(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_owner_response(uuid, text, text) TO authenticated;

-- Resolving an Opportunity closes the owner conversation only; it never completes or gates the internal Task.
CREATE OR REPLACE FUNCTION public.resolve_owner_request(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE w record; _name text;
BEGIN
  IF NOT (public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid())) THEN RAISE EXCEPTION 'Only ARHA staff can resolve homeowner requests.'; END IF;
  SELECT * INTO w FROM work_items WHERE id=_id AND kind='opportunity' AND status NOT IN ('draft','archived') FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'This request is not available.'; END IF;
  IF w.status='complete' THEN RAISE EXCEPTION 'This request is already resolved.'; END IF;
  SELECT coalesce(full_name,'ARHA staff') INTO _name FROM profiles WHERE id=auth.uid();
  UPDATE work_items SET status='complete', completed_at=now() WHERE id=w.id;
  INSERT INTO owner_request_messages(work_item_id, property_id, program_id, task_id, author_id, author_type, author_name, event, body, is_demo)
  VALUES (w.id, w.property_id, w.program_id, w.source_task_id, auth.uid(), 'system', coalesce(_name,'ARHA staff'), 'resolved', 'Marked resolved by ARHA', coalesce(w.is_demo,false));
  INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
  VALUES (auth.uid(), 'owner_request_resolved', 'work_item', w.id, w.title, jsonb_build_object('task_id', w.source_task_id, 'task_changed', false));
END $function$;

CREATE OR REPLACE FUNCTION public.reopen_owner_request(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE w record; _name text;
BEGIN
  IF NOT (public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid())) THEN RAISE EXCEPTION 'Only ARHA staff can reopen homeowner requests.'; END IF;
  SELECT * INTO w FROM work_items WHERE id=_id AND kind='opportunity' AND status='complete' FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Only a resolved request can be reopened.'; END IF;
  SELECT coalesce(full_name,'ARHA staff') INTO _name FROM profiles WHERE id=auth.uid();
  UPDATE work_items SET status='open', completed_at=NULL WHERE id=w.id;
  INSERT INTO owner_request_messages(work_item_id, property_id, program_id, task_id, author_id, author_type, author_name, event, body, is_demo)
  VALUES (w.id, w.property_id, w.program_id, w.source_task_id, auth.uid(), 'system', coalesce(_name,'ARHA staff'), 'reopened', 'Reopened by ARHA', coalesce(w.is_demo,false));
  INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
  VALUES (auth.uid(), 'owner_request_reopened', 'work_item', w.id, w.title, jsonb_build_object('task_id', w.source_task_id, 'task_changed', false));
END $function$;