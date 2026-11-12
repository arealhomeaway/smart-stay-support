-- Undo 02: owner_item_reply back to the live text read Nov 12 (live-capture/owner_item_reply.sql);
-- drops the approve action, the status trigger and the two helpers. Messages, approvals and history stay.
DROP FUNCTION IF EXISTS public.owner_item_approve(uuid);
DROP TRIGGER IF EXISTS owner_item_status_follow ON public.owner_request_messages;
DROP FUNCTION IF EXISTS private.owner_item_status_follow();
CREATE OR REPLACE FUNCTION public.owner_item_reply(_review_id uuid, _body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE uid uuid := auth.uid(); r public.owner_reviews; prog public.owner_programs; mid uuid; last_event text; who uuid;
  name text; task uuid;
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
  who := private.owner_item_answerer(r.id);
  SELECT task_id INTO task FROM public.owner_item_task_sends WHERE review_id = r.id;
  task := coalesce(task, r.onboarding_task_id);
  IF who IS NOT NULL THEN
    INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority, email_status, is_demo)
      VALUES (who, 'owner_item_message', 'The homeowner wrote back: ' || left(r.title, 150), left(btrim(_body), 500), 'owner_review', r.id,
              '/onboarding/' || r.property_id || CASE WHEN task IS NULL THEN '' ELSE '?tab=plan&task=' || task END,
              'normal', CASE WHEN coalesce(r.is_demo, false) THEN 'none' ELSE 'pending' END, coalesce(r.is_demo, false));
  END IF;
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
    VALUES (uid, 'owner_activity_conversation', 'owner_review', r.id, r.title, jsonb_build_object('author', 'homeowner', 'reopened', last_event = 'resolved'));
  RETURN mid;
END $function$
;
DROP FUNCTION IF EXISTS private.owner_item_notify(public.owner_reviews, text, text);
DROP FUNCTION IF EXISTS private.owner_item_recipients(uuid);
