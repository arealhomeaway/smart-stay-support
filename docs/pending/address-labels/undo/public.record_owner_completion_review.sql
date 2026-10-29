CREATE OR REPLACE FUNCTION public.record_owner_completion_review(_id uuid, _status text, _internal_note text DEFAULT NULL::text, _follow_up_task_id uuid DEFAULT NULL::uuid, _owner_feedback text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE w record; _cur text; _rid uuid; _mid uuid; _home text; _name text; _pm uuid;
  t_creator uuid; t_assignee uuid; f_assignee uuid; _to uuid[];
  _note text := nullif(trim(coalesce(_internal_note,'')), '');
  _fb text := nullif(trim(coalesce(_owner_feedback,'')), '');
BEGIN
  IF NOT (private.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Only ARHA staff can review owner completions.';
  END IF;
  IF _status NOT IN ('needs_review','follow_up_needed','reviewed') THEN RAISE EXCEPTION 'Unknown review status.'; END IF;
  SELECT wi.*, p.owner_user_id AS prog_owner INTO w FROM work_items wi LEFT JOIN owner_programs p ON p.id = wi.program_id
   WHERE wi.id = _id AND wi.kind = 'opportunity';
  IF w.id IS NULL OR w.status <> 'complete' THEN RAISE EXCEPTION 'Only owner-completed Opportunities can be reviewed.'; END IF;
  IF NOT private.onboarding_scope_ok(auth.uid(), w.property_id) THEN RAISE EXCEPTION 'This home is outside your onboarding scope.'; END IF;
  IF length(coalesce(_note,'')) > 5000 OR length(coalesce(_fb,'')) > 5000 THEN RAISE EXCEPTION 'Please keep notes under 5,000 characters.'; END IF;
  IF _status = 'follow_up_needed' AND _note IS NULL AND _follow_up_task_id IS NULL THEN
    RAISE EXCEPTION 'Say what follow-up is needed, or link the Task that will handle it.';
  END IF;
  IF _follow_up_task_id IS NOT NULL THEN
    SELECT assigned_to INTO f_assignee FROM onboarding_tasks WHERE id = _follow_up_task_id AND property_id = w.property_id AND archived_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'The follow-up Task must belong to this home.'; END IF;
  END IF;
  SELECT status INTO _cur FROM owner_completion_reviews WHERE work_item_id = w.id ORDER BY created_at DESC LIMIT 1;
  IF coalesce(_cur,'needs_review') = _status AND _note IS NULL AND _fb IS NULL AND _follow_up_task_id IS NULL THEN
    RAISE EXCEPTION 'Nothing new to record.';
  END IF;
  IF _fb IS NOT NULL THEN
    IF w.prog_owner IS NULL THEN RAISE EXCEPTION 'The homeowner does not have portal access yet, so feedback cannot be shared.'; END IF;
    SELECT coalesce(full_name,'Your ARHA team') INTO _name FROM profiles WHERE id = auth.uid();
    INSERT INTO owner_request_messages(work_item_id, property_id, program_id, task_id, author_id, author_type, author_name, event, body, is_demo)
    VALUES (w.id, w.property_id, w.program_id, w.source_task_id, auth.uid(), 'staff', coalesce(_name,'Your ARHA team'), NULL, _fb, coalesce(w.is_demo,false))
    RETURNING id INTO _mid;
    SELECT coalesce(nickname, name, address_line1, 'your home') INTO _home FROM properties WHERE id = w.property_id;
    INSERT INTO owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, is_demo)
    VALUES (w.program_id, w.prog_owner, 'opportunity_reply', 'p3', 'Feedback from Your ARHA Team', w.title||' · '||_home,
      '/owner?home='||w.property_id||'&opportunity='||w.id, 'skipped', coalesce(w.is_demo,false));
  END IF;
  INSERT INTO owner_completion_reviews(work_item_id, status, internal_note, follow_up_task_id, owner_feedback_message_id, actor_id, is_demo)
  VALUES (w.id, _status, _note, _follow_up_task_id, _mid, auth.uid(), coalesce(w.is_demo,false))
  RETURNING id INTO _rid;
  IF w.source_task_id IS NOT NULL THEN
    SELECT created_by, assigned_to INTO t_creator, t_assignee FROM onboarding_tasks WHERE id = w.source_task_id;
  END IF;
  SELECT project_manager INTO _pm FROM onboarding_projects WHERE property_id = w.property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1;
  _to := ARRAY[_pm, t_creator, t_assignee, w.assigned_to, f_assignee]
      || coalesce((SELECT array_agg(user_id) FROM onboarding_follows WHERE property_id = w.property_id), '{}');
  IF _pm IS NULL THEN _to := _to || public.seat_holder('onboarding_director'); END IF;
  SELECT coalesce(nickname, name, address_line1, 'the home') INTO _home FROM properties WHERE id = w.property_id;
  PERFORM private.notify_onboarding_recipients(_to, auth.uid(), 'owner_completion_review',
    'Owner completion '||CASE _status WHEN 'reviewed' THEN 'reviewed' WHEN 'follow_up_needed' THEN 'needs follow-up' ELSE 'returned to review' END
      ||CASE WHEN _fb IS NOT NULL THEN ' · feedback shared with owner' ELSE '' END,
    w.title||' · '||_home, 'work_item', w.id,
    '/onboarding/'||w.property_id||'?tab=work'||CASE WHEN _follow_up_task_id IS NOT NULL THEN '&task='||_follow_up_task_id
      WHEN w.source_task_id IS NOT NULL THEN '&task='||w.source_task_id ELSE '' END,
    w.is_demo);
  RETURN _rid;
END $function$
;