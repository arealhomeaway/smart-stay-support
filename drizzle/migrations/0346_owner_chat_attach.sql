-- owner-chat-attach (Approved by the Admin, Nov 16): homeowners may attach a photo or file in their home's owner chat.
-- Only change: post_home_chat_message lets a homeowner attach, in the owner chat only, files they uploaded to this home
-- (shared with the owner). Staff checks, notices and every other rule are unchanged.
CREATE OR REPLACE FUNCTION public.post_home_chat_message(_property_id uuid, _kind text, _body text, _attachments jsonb DEFAULT '[]'::jsonb, _mentions uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); chat uuid; mid uuid; staff boolean; demo boolean; home text; who text;
  att jsonb := coalesce(_attachments, '[]'::jsonb); a jsonb; clean_mentions uuid[] := '{}'; link text; excerpt text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to post.'; END IF;
  IF _kind NOT IN ('owner','team') THEN RAISE EXCEPTION 'Choose a chat.'; END IF;
  IF char_length(coalesce(_body,'')) > 4000 THEN RAISE EXCEPTION 'Keep a message under 4,000 characters.'; END IF;
  IF jsonb_typeof(att) <> 'array' OR jsonb_array_length(att) > 10 THEN RAISE EXCEPTION 'Attach up to 10 files.'; END IF;
  IF char_length(btrim(coalesce(_body,''))) = 0 AND jsonb_array_length(att) = 0 THEN RAISE EXCEPTION 'Write a message or attach a file.'; END IF;
  staff := public.home_chat_staff(uid);
  IF _kind = 'team' AND NOT staff THEN RAISE EXCEPTION 'This chat is for the team only.'; END IF;
  IF _kind = 'owner' AND NOT (public.home_owner_contact_writer(_property_id, uid) OR (NOT staff AND public.home_owner_member(_property_id, uid))) THEN
    RAISE EXCEPTION 'You can read the owner chat on this home but not post in it.';
  END IF;
  FOR a IN SELECT * FROM jsonb_array_elements(att) LOOP
    -- Homeowners attach only in this home's owner chat, and only files they uploaded themselves to this home.
    IF NOT staff AND _kind <> 'owner' THEN RAISE EXCEPTION 'Attach files from the team side only for now.'; END IF;
    IF staff AND coalesce(a->>'folder','') NOT IN ('property_ownership','hoa_compliance','systems_manuals','onboarding','operations','media') THEN
      RAISE EXCEPTION 'Choose a folder for each file.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.id = (a->>'document_id')::uuid
                    AND (d.property_id = _property_id OR (d.entity_type = 'property' AND d.entity_id = _property_id))
                    AND d.deleted_at IS NULL
                    AND (staff OR (d.uploaded_by = uid AND d.visibility = 'owner_shared'))) THEN
      RAISE EXCEPTION 'A file is not in this home''s Files.';
    END IF;
  END LOOP;
  IF staff THEN
    SELECT coalesce(array_agg(DISTINCT m), '{}') INTO clean_mentions FROM unnest(coalesce(_mentions,'{}')) m
     WHERE m <> uid AND public.home_chat_staff(m);
  END IF;
  SELECT is_demo, public.format_property_label(to_jsonb(properties))->>'primary' INTO demo, home FROM public.properties WHERE id = _property_id;
  IF home IS NULL THEN RAISE EXCEPTION 'This home could not be found.'; END IF;
  INSERT INTO public.home_chats(property_id, kind) VALUES (_property_id, _kind)
    ON CONFLICT (property_id, kind) DO UPDATE SET kind = EXCLUDED.kind RETURNING id INTO chat;
  INSERT INTO public.home_chat_messages(chat_id, author_id, author_type, body, attachments, mentions, is_demo)
    VALUES (chat, uid, CASE WHEN staff THEN 'staff' ELSE 'owner' END, coalesce(_body,''), att, clean_mentions, coalesce(demo,false))
    RETURNING id INTO mid;
  INSERT INTO public.home_chat_reads(chat_id, user_id, last_read_at) VALUES (chat, uid, now())
    ON CONFLICT (chat_id, user_id) DO UPDATE SET last_read_at = greatest(public.home_chat_reads.last_read_at, now());
  SELECT coalesce(nullif(btrim(full_name),''), email, CASE WHEN staff THEN 'A teammate' ELSE 'The owner' END) INTO who FROM public.profiles WHERE id = uid;
  who := coalesce(who, CASE WHEN staff THEN 'A teammate' ELSE 'The owner' END);
  link := '/onboarding/' || _property_id || '?chat=' || _kind;
  excerpt := left(regexp_replace(coalesce(_body,''), '\s+', ' ', 'g'), 140);
  IF array_length(clean_mentions, 1) > 0 THEN
    PERFORM public.home_chat_notify(clean_mentions, uid, 'home_chat_mention', who || ' mentioned you', excerpt || ' · ' || home, mid, link, demo);
  END IF;
  IF NOT staff THEN
    PERFORM public.home_chat_notify(public.home_chat_team_recipients(_property_id), uid, 'owner_chat_message',
      who || ' sent a message', excerpt || ' · ' || home, mid, link, demo);
  END IF;
  RETURN mid;
END $function$;
GRANT EXECUTE ON FUNCTION public.post_home_chat_message(uuid, text, text, jsonb, uuid[]) TO authenticated, service_role;
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'owner_chat_attach_applied', 'function',
  'Home owner chat: homeowners may attach files', 'Approved by the Admin, Nov 16: homeowners attach a photo or file in the owner chat of their own home, using files they uploaded to that home. Undo: docs/pending/owner-chat-attach/apply.undo.sql.');