-- Nov 12 build, Part C fixes 24, 25 and 26. NOT APPLIED by Lovable.
-- 24: owner_item_approve, the owner's Approve on an item sent as an approval (the step needs the owner's
--     approval or a business decision). Records it on the Task and the owner item with the time, posts
--     "Approved" in the conversation, and notifies like a reply.
-- 25: an owner reply or approval moves the owner item to answered ("With ARHA"); a staff reply moves it
--     back to awaiting_owner.
-- 26: an owner reply notifies the Task's assigned person; when unassigned, the home's Project Manager
--     and the Director of Onboarding; and everyone following the home. Never the writer.

-- Who hears about an owner answer. Pure read; no new notification kind.
CREATE OR REPLACE FUNCTION private.owner_item_recipients(_review_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  WITH r AS (SELECT id, property_id, onboarding_task_id FROM public.owner_reviews WHERE id = _review_id),
  t AS (
    SELECT tk.assigned_to FROM r
      LEFT JOIN public.owner_item_task_sends s ON s.review_id = r.id
      JOIN public.onboarding_tasks tk ON tk.id = coalesce(s.task_id, r.onboarding_task_id)
  ),
  assigned AS (SELECT assigned_to AS uid FROM t WHERE assigned_to IS NOT NULL),
  leads AS (
    SELECT p.project_manager AS uid FROM r JOIN public.onboarding_projects p ON p.property_id = r.property_id AND p.status <> 'cancelled'
     WHERE NOT EXISTS (SELECT 1 FROM assigned)
    UNION SELECT public.seat_holder('onboarding_director') WHERE NOT EXISTS (SELECT 1 FROM assigned)
  ),
  followers AS (SELECT f.user_id AS uid FROM r JOIN public.onboarding_follows f ON f.property_id = r.property_id)
  SELECT DISTINCT uid FROM (SELECT uid FROM assigned UNION SELECT uid FROM leads UNION SELECT uid FROM followers) x
   WHERE uid IS NOT NULL AND uid IS DISTINCT FROM auth.uid()
$$;
REVOKE ALL ON FUNCTION private.owner_item_recipients(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.owner_item_notify(_review public.owner_reviews, _title text, _body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE task uuid;
BEGIN
  SELECT task_id INTO task FROM public.owner_item_task_sends WHERE review_id = _review.id;
  task := coalesce(task, _review.onboarding_task_id);
  INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority, email_status, is_demo)
  SELECT uid, 'owner_item_message', left(_title, 200), left(btrim(_body), 500), 'owner_review', _review.id,
         '/onboarding/' || _review.property_id || CASE WHEN task IS NULL THEN '' ELSE '?tab=plan&task=' || task END,
         'normal', CASE WHEN coalesce(_review.is_demo, false) THEN 'none' ELSE 'pending' END, coalesce(_review.is_demo, false)
    FROM private.owner_item_recipients(_review.id) uid;
END $$;
REVOKE ALL ON FUNCTION private.owner_item_notify(public.owner_reviews, text, text) FROM PUBLIC;

-- Status follows the last speaker on sent owner items (fix 25).
CREATE OR REPLACE FUNCTION private.owner_item_status_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NEW.review_id IS NULL OR NEW.event IS NOT NULL OR NEW.author_type NOT IN ('homeowner', 'staff') THEN RETURN NULL; END IF;
  PERFORM set_config('resolve.owner_release_batch', 'on', true);
  UPDATE public.owner_reviews
     SET status = CASE WHEN NEW.author_type = 'homeowner' THEN 'answered' ELSE 'awaiting_owner' END,
         responded_at = CASE WHEN NEW.author_type = 'homeowner' THEN NEW.created_at ELSE responded_at END,
         updated_at = clock_timestamp()
   WHERE id = NEW.review_id
     AND ((NEW.author_type = 'homeowner' AND status = 'awaiting_owner') OR (NEW.author_type = 'staff' AND status = 'answered'));
  PERFORM set_config('resolve.owner_release_batch', 'off', true);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.owner_item_status_follow() FROM PUBLIC;
DROP TRIGGER IF EXISTS owner_item_status_follow ON public.owner_request_messages;
CREATE TRIGGER owner_item_status_follow AFTER INSERT ON public.owner_request_messages
  FOR EACH ROW EXECUTE FUNCTION private.owner_item_status_follow();

-- owner_item_reply: live text with one change, the notice goes to private.owner_item_recipients (fix 26).
CREATE OR REPLACE FUNCTION public.owner_item_reply(_review_id uuid, _body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE uid uuid := auth.uid(); r public.owner_reviews; prog public.owner_programs; mid uuid; last_event text;
  name text;
BEGIN
  SELECT * INTO r FROM public.owner_reviews WHERE id = _review_id AND archived_at IS NULL FOR UPDATE;
  SELECT * INTO prog FROM public.owner_programs WHERE id = r.program_id;
  IF uid IS NULL OR r.id IS NULL OR r.status = 'prepared' OR NOT coalesce(private.is_program_member(r.program_id, uid), false)
     OR coalesce(private.is_staff(uid), false) OR prog.archived_at IS NOT NULL OR prog.status = 'closed' THEN
    RAISE EXCEPTION 'This activity is not available.';
  END IF;
  IF length(btrim(coalesce(_body, ''))) < 1 OR length(_body) > 5000 THEN RAISE EXCEPTION 'Type a message of up to 5,000 characters.'; END IF;
  SELECT coalesce(nullif(btrim(full_name), ''), 'Homeowner') INTO name FROM public.profiles WHERE id = uid;
  SELECT m.event INTO last_event FROM public.owner_request_messages m WHERE m.review_id = r.id AND m.event IS NOT NULL
   ORDER BY m.created_at DESC, m.id DESC LIMIT 1;
  IF last_event = 'resolved' OR r.status = 'closed' THEN
    INSERT INTO public.owner_request_messages(review_id, property_id, program_id, task_id, author_id, author_type, author_name, event, body, is_demo)
      VALUES (r.id, r.property_id, r.program_id, r.onboarding_task_id, uid, 'system', coalesce(name, 'Homeowner'), 'reopened',
              'Conversation reopened by a new homeowner message', coalesce(r.is_demo, false));
  END IF;
  INSERT INTO public.owner_request_messages(review_id, property_id, program_id, task_id, author_id, author_type, author_name, body, is_demo)
    VALUES (r.id, r.property_id, r.program_id, r.onboarding_task_id, uid, 'homeowner', coalesce(name, 'Homeowner'), btrim(_body), coalesce(r.is_demo, false))
    RETURNING id INTO mid;
  PERFORM private.owner_item_notify(r, 'The homeowner wrote back: ' || left(r.title, 150), _body);
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
    VALUES (uid, 'owner_activity_conversation', 'owner_review', r.id, r.title, jsonb_build_object('author', 'homeowner', 'reopened', last_event = 'resolved'));
  RETURN mid;
END $function$;

-- Approve (fix 24).
CREATE OR REPLACE FUNCTION public.owner_item_approve(_review_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE uid uuid := auth.uid(); r public.owner_reviews; prog public.owner_programs; t public.onboarding_tasks; tid uuid;
  name text; at timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO r FROM public.owner_reviews WHERE id = _review_id AND archived_at IS NULL FOR UPDATE;
  SELECT * INTO prog FROM public.owner_programs WHERE id = r.program_id;
  IF uid IS NULL OR r.id IS NULL OR r.status = 'prepared' OR NOT coalesce(private.is_program_member(r.program_id, uid), false)
     OR coalesce(private.is_staff(uid), false) OR prog.archived_at IS NOT NULL OR prog.status = 'closed' THEN
    RAISE EXCEPTION 'This activity is not available.';
  END IF;
  SELECT task_id INTO tid FROM public.owner_item_task_sends WHERE review_id = r.id;
  SELECT * INTO t FROM public.onboarding_tasks WHERE id = coalesce(tid, r.onboarding_task_id) FOR UPDATE;
  IF t.id IS NULL OR NOT (coalesce(t.requires_owner_approval, false) OR t.owner_dependency = 'business_decision') THEN
    RAISE EXCEPTION 'This item does not ask for an approval.';
  END IF;
  IF t.owner_approval_status = 'approved' THEN RETURN jsonb_build_object('approved', true, 'already', true); END IF;
  SELECT coalesce(nullif(btrim(full_name), ''), 'Homeowner') INTO name FROM public.profiles WHERE id = uid;
  UPDATE public.onboarding_tasks SET owner_approval_status = 'approved' WHERE id = t.id;
  UPDATE public.approvals SET status = 'approved', decided_at = at, responded_at = at,
         decision_note = coalesce(decision_note, 'Approved in the homeowner portal')
   WHERE entity_type = 'onboarding_task' AND entity_id = t.id AND status IN ('pending', 'awaiting_owner');
  PERFORM set_config('resolve.owner_release_batch', 'on', true);
  UPDATE public.owner_reviews SET owner_decision = 'approved', responded_at = at, updated_at = at WHERE id = r.id;
  PERFORM set_config('resolve.owner_release_batch', 'off', true);
  -- The message moves the item to answered (owner_item_status_follow).
  INSERT INTO public.owner_request_messages(review_id, property_id, program_id, task_id, author_id, author_type, author_name, body, is_demo)
    VALUES (r.id, r.property_id, r.program_id, r.onboarding_task_id, uid, 'homeowner', name, 'Approved', coalesce(r.is_demo, false));
  PERFORM private.owner_item_notify(r, 'The homeowner approved: ' || left(r.title, 150), 'Approved');
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
    VALUES (uid, 'owner_item_approved', 'onboarding_task', t.id, t.title, jsonb_build_object('ownerItem', r.id, 'at', at));
  RETURN jsonb_build_object('approved', true, 'at', at);
END $$;
REVOKE ALL ON FUNCTION public.owner_item_approve(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_item_approve(uuid) TO authenticated;
