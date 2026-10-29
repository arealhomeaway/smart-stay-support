CREATE OR REPLACE FUNCTION public.post_owner_request_message(_id uuid, _body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$
;