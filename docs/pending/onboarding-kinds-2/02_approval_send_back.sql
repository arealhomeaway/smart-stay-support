-- Nov 12 completion build, item 9. NOT APPLIED. Additive only.
-- An Approval Task with no step review configured is reviewed by its assigned person.

-- The reviewer: the assigned person, else whoever holds the Task's role on this home.
CREATE OR REPLACE FUNCTION public.approval_task_reviewer(_task_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
DECLARE t public.onboarding_tasks; proj uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(private.is_onboarding_staff(auth.uid()), false) THEN RAISE EXCEPTION 'Not available.'; END IF;
  SELECT * INTO t FROM public.onboarding_tasks WHERE id = _task_id AND archived_at IS NULL;
  IF t.id IS NULL OR t.task_kind <> 'approval' THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.onboarding_step_review_settings s
              WHERE s.template_task_id = t.template_task_id AND cardinality(s.reviewer_roles) > 0) THEN RETURN NULL; END IF;
  SELECT id INTO proj FROM public.onboarding_projects WHERE property_id = t.property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1;
  RETURN coalesce(t.assigned_to, CASE WHEN t.assigned_seat IS NOT NULL AND proj IS NOT NULL THEN private.review_role_person(proj, t.assigned_seat) END);
END $$;
REVOKE ALL ON FUNCTION public.approval_task_reviewer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approval_task_reviewer(uuid) TO authenticated, service_role;

-- Send back: required note; reopens each completed step named in Show files from, notifies each
-- of those steps' person (reopened or still open), and logs the note on the Approval Task.
CREATE OR REPLACE FUNCTION public.approval_task_send_back(_task_id uuid, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
DECLARE uid uuid := auth.uid(); t public.onboarding_tasks; s record; proj uuid; person uuid; who text;
  note text := btrim(coalesce(_note, '')); reopened uuid[] := '{}'; notified int := 0; at timestamptz := clock_timestamp();
BEGIN
  IF uid IS NULL OR NOT coalesce(private.is_onboarding_staff(uid), false) THEN RAISE EXCEPTION 'Not available.'; END IF;
  IF length(note) < 5 THEN RAISE EXCEPTION 'Write what needs to change (5 characters or more).'; END IF;
  IF length(note) > 2000 THEN RAISE EXCEPTION 'Keep the note under 2,000 characters.'; END IF;
  SELECT * INTO t FROM public.onboarding_tasks WHERE id = _task_id AND archived_at IS NULL FOR UPDATE;
  IF t.id IS NULL OR t.task_kind <> 'approval' THEN RAISE EXCEPTION 'This Task is not an approval.'; END IF;
  IF t.status IN ('complete', 'carryover') THEN RAISE EXCEPTION 'This approval is already finished.'; END IF;
  IF public.approval_task_reviewer(t.id) IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Only the person reviewing this Task can send it back.'; END IF;
  SELECT id INTO proj FROM public.onboarding_projects WHERE property_id = t.property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1;
  SELECT coalesce(nullif(btrim(full_name), ''), nullif(btrim(email), ''), 'A teammate') INTO who FROM public.profiles WHERE id = uid;

  FOR s IN
    SELECT src.* FROM public.onboarding_task_file_links l JOIN public.onboarding_tasks src ON src.id = l.source_task_id
     WHERE l.receiving_task_id = t.id AND l.removed_at IS NULL AND src.archived_at IS NULL AND src.property_id = t.property_id
     ORDER BY src.sort_order, src.title
  LOOP
    IF s.status = 'complete' THEN
      UPDATE public.onboarding_tasks SET status = 'open' WHERE id = s.id AND status = 'complete';
      reopened := reopened || s.id;
      IF proj IS NOT NULL THEN
        INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
        VALUES (proj, t.property_id, 'task_reopened', 'Reopened "' || left(s.title, 150) || '"',
                'Sent back by ' || who || ' from "' || left(t.title, 150) || '": ' || note,
                CASE WHEN s.completed_at IS NOT NULL THEN 'Completed ' || to_char(s.completed_at, 'YYYY-MM-DD') ELSE 'Complete' END, 'Open', uid, coalesce(t.is_demo, false));
      END IF;
    END IF;
    person := coalesce(s.assigned_to, CASE WHEN s.assigned_seat IS NOT NULL AND proj IS NOT NULL THEN private.review_role_person(proj, s.assigned_seat) END);
    IF person IS NOT NULL AND person <> uid THEN
      INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, actor_id, is_demo)
      VALUES (person, 'onboarding_sent_back', 'Sent back: ' || left(s.title, 150), left(note, 1000), 'onboarding_task', s.id,
              '/onboarding/' || t.property_id || '?tab=plan&task=' || s.id, uid, coalesce(t.is_demo, false));
      notified := notified + 1;
    END IF;
  END LOOP;

  INSERT INTO public.onboarding_notes(property_id, task_id, body, author_id, is_demo)
  VALUES (t.property_id, t.id, 'Sent back: ' || note, uid, coalesce(t.is_demo, false));
  IF proj IS NOT NULL THEN
    INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, detail, new_value, actor, is_demo)
    VALUES (proj, t.property_id, 'approval_sent_back', 'Sent back "' || left(t.title, 150) || '"', note, t.id::text, uid, coalesce(t.is_demo, false));
  END IF;
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, reason, after_value)
  VALUES (uid, 'onboarding_approval_sent_back', 'onboarding_task', t.id, t.title, note,
          jsonb_build_object('reopened', to_jsonb(reopened), 'notified', notified, 'at', at));
  RETURN jsonb_build_object('reopened', to_jsonb(reopened), 'notified', notified);
END $$;
REVOKE ALL ON FUNCTION public.approval_task_send_back(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approval_task_send_back(uuid, text) TO authenticated, service_role;
