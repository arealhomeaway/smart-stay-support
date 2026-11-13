-- Apply only with the Admin's approval. Run 00_preflight.sql first.
-- Property page Part 2 of 3 (approved Nov 12): Owner tab, project chat, owner communication,
-- weekly owner updates, automatic owner reminders and email safety. Staged, not applied.
-- Additive only: new tables, new columns with defaults, new functions, one replaced function
-- (ao_owner_email_run, live copy in live-capture/) and one new trigger on staff_notifications.

-- ---------------------------------------------------------------------------------------------
-- 1. Who is who on a home (helpers shared by every rule below)
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.home_chat_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
  -- Staff who can open an onboarding home: Admin, managers (Supervisors and Directors) and onboarding accounts.
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role::text IN ('admin','manager','onboarding'))
$$;

CREATE OR REPLACE FUNCTION public.home_team_member(_property uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.onboarding_projects p
     WHERE p.property_id = _property AND p.status <> 'cancelled'
       AND (_uid IN (p.project_manager, p.director, p.utility_manager)
            OR coalesce(p.role_assignments->>'lead_designer','') = _uid::text
            OR coalesce(p.role_assignments->>'designer','') = _uid::text
            OR coalesce(p.role_assignments->>'design_staging','') = _uid::text
            OR coalesce(p.role_assignments->>'utilities','') = _uid::text))
$$;

CREATE OR REPLACE FUNCTION public.home_pm(_property uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.onboarding_projects p
     WHERE p.property_id = _property AND p.status <> 'cancelled' AND p.project_manager = _uid)
$$;

CREATE OR REPLACE FUNCTION public.home_lead(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  -- Admin or the Director of Onboarding.
  SELECT _uid IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role::text = 'admin')
    OR public.is_onboarding_director(_uid))
$$;

CREATE OR REPLACE FUNCTION public.home_owner_member(_property uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.owner_program_properties opp
     WHERE opp.property_id = _property AND opp.archived_at IS NULL
       AND private.is_program_member(opp.program_id, _uid))
$$;

-- Owner chat writers: Admin, Director of Onboarding, the home's PM, Designer and Utilities, and the owner.
CREATE OR REPLACE FUNCTION public.home_owner_contact_writer(_property uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.home_lead(_uid) OR public.home_team_member(_property, _uid)
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. Project chat (two chats per home: owner and team)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE public.home_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  kind text NOT NULL CHECK (kind IN ('owner','team')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, kind)
);
CREATE TABLE public.home_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.home_chats(id),
  author_id uuid NOT NULL,
  author_type text NOT NULL CHECK (author_type IN ('staff','owner')),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 4000),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(attachments) = 'array'),
  mentions uuid[] NOT NULL DEFAULT '{}',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(btrim(body)) > 0 OR jsonb_array_length(attachments) > 0)
);
CREATE INDEX home_chat_messages_chat_created ON public.home_chat_messages(chat_id, created_at);
CREATE TABLE public.home_chat_reads (
  chat_id uuid NOT NULL REFERENCES public.home_chats(id),
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);
CREATE TABLE public.home_chat_message_tasks (
  message_id uuid NOT NULL REFERENCES public.home_chat_messages(id),
  task_id uuid NOT NULL REFERENCES public.onboarding_tasks(id),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, task_id)
);
-- One row per alert sent about unread chat messages (owner email after 15 minutes, staff alert after 15 minutes).
CREATE TABLE public.home_chat_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.home_chats(id),
  message_id uuid NOT NULL REFERENCES public.home_chat_messages(id),
  audience text NOT NULL CHECK (audience IN ('owner','staff')),
  notification_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, audience)
);

GRANT SELECT ON public.home_chats, public.home_chat_messages, public.home_chat_reads, public.home_chat_message_tasks TO authenticated;
GRANT ALL ON public.home_chats, public.home_chat_messages, public.home_chat_reads, public.home_chat_message_tasks, public.home_chat_alerts TO service_role;

CREATE OR REPLACE FUNCTION public.home_chat_can_read(_chat uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.home_chats c
     WHERE c.id = _chat
       AND (public.home_chat_staff(_uid)
            OR (c.kind = 'owner' AND public.home_owner_member(c.property_id, _uid))))
$$;

ALTER TABLE public.home_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_chat_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_chat_message_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_chat_alerts ENABLE ROW LEVEL SECURITY;
-- The team chat is staff only; an owner reads only the owner chat of a home in their program.
CREATE POLICY "Chat readers see the chat" ON public.home_chats FOR SELECT TO authenticated
  USING (public.home_chat_can_read(id, auth.uid()));
CREATE POLICY "Chat readers see messages" ON public.home_chat_messages FOR SELECT TO authenticated
  USING (public.home_chat_can_read(chat_id, auth.uid()));
CREATE POLICY "Read marks for chat readers" ON public.home_chat_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (public.home_chat_staff(auth.uid()) AND public.home_chat_can_read(chat_id, auth.uid())));
CREATE POLICY "Staff see Tasks made from messages" ON public.home_chat_message_tasks FOR SELECT TO authenticated
  USING (public.home_chat_staff(auth.uid()));
-- home_chat_alerts: no policy; written and read only by the scheduled job.

CREATE OR REPLACE FUNCTION public.home_chat_notify(
  _to uuid[], _actor uuid, _kind text, _title text, _body text, _entity uuid, _link text, _demo boolean)
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r uuid; ids uuid[] := '{}'; nid uuid;
BEGIN
  FOR r IN SELECT DISTINCT x FROM unnest(_to) x WHERE x IS NOT NULL LOOP
    CONTINUE WHEN r = _actor;
    CONTINUE WHEN NOT public.home_chat_staff(r);
    INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority, actor_id, is_demo, email_status)
    VALUES (r, _kind, _title, _body, 'home_chat_message', _entity, _link, 'normal', _actor, coalesce(_demo,false),
            CASE WHEN coalesce(_demo,false) THEN 'none' ELSE 'pending' END)
    RETURNING id INTO nid;
    ids := ids || nid;
  END LOOP;
  RETURN ids;
END $$;

CREATE OR REPLACE FUNCTION public.home_chat_team_recipients(_property uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(array_agg(DISTINCT x) FILTER (WHERE x IS NOT NULL), '{}') FROM (
    SELECT unnest(ARRAY[p.project_manager, p.director, p.utility_manager,
             nullif(p.role_assignments->>'lead_designer','')::uuid,
             nullif(p.role_assignments->>'designer','')::uuid,
             nullif(p.role_assignments->>'design_staging','')::uuid]) AS x
      FROM public.onboarding_projects p WHERE p.property_id = _property AND p.status <> 'cancelled'
    UNION ALL SELECT public.seat_holder('onboarding_director')
    UNION ALL SELECT f.user_id FROM public.onboarding_follows f WHERE f.property_id = _property) s
$$;

CREATE OR REPLACE FUNCTION public.post_home_chat_message(
  _property_id uuid, _kind text, _body text, _attachments jsonb DEFAULT '[]'::jsonb, _mentions uuid[] DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
    IF NOT staff THEN RAISE EXCEPTION 'Attach files from the team side only for now.'; END IF;
    IF coalesce(a->>'folder','') NOT IN ('property_ownership','hoa_compliance','systems_manuals','onboarding','operations','media') THEN
      RAISE EXCEPTION 'Choose a folder for each file.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.id = (a->>'document_id')::uuid
                    AND (d.property_id = _property_id OR (d.entity_type = 'property' AND d.entity_id = _property_id))
                    AND d.deleted_at IS NULL) THEN
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
END $$;

CREATE OR REPLACE FUNCTION public.mark_home_chat_read(_chat_id uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); t timestamptz := now();
BEGIN
  IF NOT public.home_chat_can_read(_chat_id, uid) THEN RAISE EXCEPTION 'This chat is not available to you.'; END IF;
  INSERT INTO public.home_chat_reads(chat_id, user_id, last_read_at) VALUES (_chat_id, uid, t)
    ON CONFLICT (chat_id, user_id) DO UPDATE SET last_read_at = greatest(public.home_chat_reads.last_read_at, t);
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public.link_chat_message_task(_message_id uuid, _task_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); prop uuid;
BEGIN
  SELECT c.property_id INTO prop FROM public.home_chat_messages m JOIN public.home_chats c ON c.id = m.chat_id WHERE m.id = _message_id;
  IF prop IS NULL OR NOT public.home_chat_staff(uid) THEN RAISE EXCEPTION 'This message is not available to you.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.onboarding_tasks t WHERE t.id = _task_id AND t.property_id = prop) THEN
    RAISE EXCEPTION 'That Task is on another home.';
  END IF;
  INSERT INTO public.home_chat_message_tasks(message_id, task_id, created_by) VALUES (_message_id, _task_id, uid) ON CONFLICT DO NOTHING;
END $$;

-- The Chats inbox: homes with unread messages for the viewer, newest first.
-- Staff: homes they are on, follow (My homes), or every home for Admin and the Director of Onboarding.
-- Owner: the owner chat of each home in their program.
CREATE OR REPLACE FUNCTION public.my_home_chat_inbox()
RETURNS TABLE(property_id uuid, home text, kind text, unread integer, last_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH me AS (SELECT auth.uid() AS uid, public.home_chat_staff(auth.uid()) AS staff, public.home_lead(auth.uid()) AS lead)
  SELECT c.property_id,
         public.format_property_label(to_jsonb(h))->>'primary',
         c.kind,
         count(*)::int,
         max(m.created_at)
    FROM public.home_chats c
    JOIN me ON true
    JOIN public.properties h ON h.id = c.property_id
    JOIN public.home_chat_messages m ON m.chat_id = c.id AND m.author_id <> me.uid
    LEFT JOIN public.home_chat_reads r ON r.chat_id = c.id AND r.user_id = me.uid
   WHERE m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
     AND ((me.staff AND (me.lead OR public.home_team_member(c.property_id, me.uid)
                         OR EXISTS (SELECT 1 FROM public.onboarding_follows f WHERE f.property_id = c.property_id AND f.user_id = me.uid)))
          OR (NOT me.staff AND c.kind = 'owner' AND public.home_owner_member(c.property_id, me.uid)))
   GROUP BY c.property_id, h.id, c.kind
   ORDER BY max(m.created_at) DESC
$$;

-- Every 5 minutes: an owner who has not read a staff message in 15 minutes gets one email
-- (at most one per 15 minutes per home); staff get one alert when an owner message waits 15 minutes.
CREATE OR REPLACE FUNCTION public.home_chat_unread_alert_run(_now timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
DECLARE c record; m record; m2 record; prog record; nid uuid; ids uuid[]; home text; owners int := 0; staffn int := 0;
BEGIN
  FOR c IN SELECT ch.* FROM public.home_chats ch WHERE ch.kind = 'owner' LOOP
    -- Owner side: the newest staff message older than 15 minutes that no owner has read.
    SELECT msg.id, msg.created_at INTO m FROM public.home_chat_messages msg
     WHERE msg.chat_id = c.id AND msg.author_type = 'staff' AND NOT msg.is_demo
       AND msg.created_at <= _now - interval '15 minutes'
       AND NOT EXISTS (SELECT 1 FROM public.home_chat_reads r WHERE r.chat_id = c.id AND r.last_read_at >= msg.created_at
                        AND public.home_owner_member(c.property_id, r.user_id) AND NOT public.home_chat_staff(r.user_id))
     ORDER BY msg.created_at DESC LIMIT 1;
    IF FOUND
       AND NOT EXISTS (SELECT 1 FROM public.home_chat_alerts a WHERE a.chat_id = c.id AND a.audience = 'owner'
                        AND (a.created_at > _now - interval '15 minutes'
                             OR a.message_id IN (SELECT x.id FROM public.home_chat_messages x WHERE x.chat_id = c.id AND x.created_at >= m.created_at))) THEN
      SELECT p.id, p.owner_user_id, p.notify_email INTO prog FROM public.owner_program_properties opp
        JOIN public.owner_programs p ON p.id = opp.program_id
       WHERE opp.property_id = c.property_id AND opp.archived_at IS NULL ORDER BY opp.created_at LIMIT 1;
      IF FOUND THEN
        SELECT public.format_property_label(to_jsonb(h))->>'primary' INTO home FROM public.properties h WHERE h.id = c.property_id;
        INSERT INTO public.owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, sms_status)
        VALUES (prog.id, prog.owner_user_id, 'home_chat_message', 'p3',
                'You have a new message from ARHA about ' || coalesce(home,'your home'),
                'Open Messages with ARHA to read it and reply.',
                '/owner?home=' || c.property_id || '&messages=1',
                CASE WHEN coalesce(prog.notify_email,false) THEN 'pending' ELSE 'skipped' END, 'skipped')
        RETURNING id INTO nid;
        INSERT INTO public.home_chat_alerts(chat_id, message_id, audience, notification_ids) VALUES (c.id, m.id, 'owner', ARRAY[nid])
          ON CONFLICT DO NOTHING;
        owners := owners + 1;
      END IF;
    END IF;
    -- Staff side: each owner message no staff member has read in 15 minutes, alerted once.
    FOR m2 IN SELECT msg.* FROM public.home_chat_messages msg
              WHERE msg.chat_id = c.id AND msg.author_type = 'owner' AND NOT msg.is_demo
                AND msg.created_at <= _now - interval '15 minutes' AND msg.created_at > _now - interval '7 days'
                AND NOT EXISTS (SELECT 1 FROM public.home_chat_reads r WHERE r.chat_id = c.id AND r.last_read_at >= msg.created_at AND public.home_chat_staff(r.user_id))
                AND NOT EXISTS (SELECT 1 FROM public.home_chat_alerts a WHERE a.message_id = msg.id AND a.audience = 'staff') LOOP
      SELECT public.format_property_label(to_jsonb(h))->>'primary' INTO home FROM public.properties h WHERE h.id = c.property_id;
      ids := public.home_chat_notify(public.home_chat_team_recipients(c.property_id), NULL, 'owner_chat_unread',
               'An owner message is waiting', left(m2.body, 140) || ' · ' || coalesce(home,''), m2.id,
               '/onboarding/' || c.property_id || '?chat=owner', false);
      INSERT INTO public.home_chat_alerts(chat_id, message_id, audience, notification_ids) VALUES (c.id, m2.id, 'staff', ids) ON CONFLICT DO NOTHING;
      staffn := staffn + 1;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('owner_emails', owners, 'staff_alerts', staffn);
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.home_chat_messages;

-- ---------------------------------------------------------------------------------------------
-- 3. Good to know (team note on the owner record, with history)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.property_owners ADD COLUMN team_notes text;
ALTER TABLE public.property_owners ADD COLUMN team_notes_updated_at timestamptz;
ALTER TABLE public.property_owners ADD COLUMN team_notes_updated_by uuid;
CREATE TABLE public.property_owner_team_note_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.property_owners(id),
  before_text text,
  after_text text,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.property_owner_team_note_events TO authenticated;
GRANT ALL ON public.property_owner_team_note_events TO service_role;
ALTER TABLE public.property_owner_team_note_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read Good to know history" ON public.property_owner_team_note_events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_owner_team_notes()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF (NEW.team_notes IS DISTINCT FROM OLD.team_notes OR NEW.team_notes_updated_at IS DISTINCT FROM OLD.team_notes_updated_at
      OR NEW.team_notes_updated_by IS DISTINCT FROM OLD.team_notes_updated_by)
     AND coalesce(current_setting('resolve.owner_team_notes', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Good to know is changed only from the Owner tab.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_owner_team_notes BEFORE UPDATE ON public.property_owners
  FOR EACH ROW EXECUTE FUNCTION public.guard_owner_team_notes();

CREATE OR REPLACE FUNCTION public.set_owner_team_notes(_owner_id uuid, _notes text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); before_v text; clean text := nullif(btrim(coalesce(_notes,'')), ''); t timestamptz := now();
BEGIN
  IF NOT (public.home_lead(uid) OR EXISTS (
      SELECT 1 FROM public.properties h JOIN public.onboarding_projects p ON p.property_id = h.id AND p.status <> 'cancelled'
       WHERE h.owner_record_id = _owner_id AND p.project_manager = uid)) THEN
    RAISE EXCEPTION 'Only the Project Manager, the Director of Onboarding or an Admin can change Good to know.';
  END IF;
  IF char_length(coalesce(clean,'')) > 2000 THEN RAISE EXCEPTION 'Keep Good to know under 2,000 characters.'; END IF;
  SELECT team_notes INTO before_v FROM public.property_owners WHERE id = _owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This owner could not be found.'; END IF;
  IF before_v IS NOT DISTINCT FROM clean THEN RETURN NULL; END IF;
  PERFORM set_config('resolve.owner_team_notes', 'on', true);
  UPDATE public.property_owners SET team_notes = clean, team_notes_updated_at = t, team_notes_updated_by = uid WHERE id = _owner_id;
  PERFORM set_config('resolve.owner_team_notes', '', true);
  INSERT INTO public.property_owner_team_note_events(owner_id, before_text, after_text, actor_id, created_at) VALUES (_owner_id, before_v, clean, uid, t);
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, before_value, after_value)
    VALUES (uid, 'owner_good_to_know_changed', 'property_owner', _owner_id, jsonb_build_object('text', before_v), jsonb_build_object('text', clean));
  RETURN t;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 4. Logged calls and texts reuse onboarding_notes with a kind
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.onboarding_notes ADD COLUMN kind text NOT NULL DEFAULT 'note';
ALTER TABLE public.onboarding_notes ADD CONSTRAINT onboarding_notes_kind_check CHECK (kind IN ('note','call','text'));

CREATE OR REPLACE FUNCTION public.guard_onboarding_note_kind()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.kind IS DISTINCT FROM OLD.kind THEN RAISE EXCEPTION 'A note''s kind cannot change.'; END IF;
  IF TG_OP = 'INSERT' AND NEW.kind <> 'note' AND coalesce(current_setting('resolve.owner_contact_log', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Log a call or text from the Owner tab.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_onboarding_note_kind BEFORE INSERT OR UPDATE ON public.onboarding_notes
  FOR EACH ROW EXECUTE FUNCTION public.guard_onboarding_note_kind();

CREATE OR REPLACE FUNCTION public.log_owner_contact(_property_id uuid, _kind text, _body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); nid uuid; demo boolean;
BEGIN
  IF _kind NOT IN ('call','text') THEN RAISE EXCEPTION 'Choose call or text.'; END IF;
  IF char_length(btrim(coalesce(_body,''))) < 3 OR char_length(_body) > 4000 THEN RAISE EXCEPTION 'Write what happened (3 to 4,000 characters).'; END IF;
  IF NOT public.home_owner_contact_writer(_property_id, uid) THEN
    RAISE EXCEPTION 'Only the home''s team, the Director of Onboarding or an Admin can log a call or text.';
  END IF;
  SELECT is_demo INTO demo FROM public.properties WHERE id = _property_id;
  PERFORM set_config('resolve.owner_contact_log', 'on', true);
  INSERT INTO public.onboarding_notes(property_id, task_id, author_id, body, internal, kind, is_demo)
    VALUES (_property_id, NULL, uid, btrim(_body), true, _kind, coalesce(demo,false)) RETURNING id INTO nid;
  PERFORM set_config('resolve.owner_contact_log', '', true);
  RETURN nid;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Weekly owner updates and the per-home auto-send switch
-- ---------------------------------------------------------------------------------------------
CREATE TABLE public.owner_weekly_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  week_start date NOT NULL,
  draft_text text NOT NULL,
  edited_text text,
  edited_by uuid,
  edited_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','skipped')),
  sent_text text,
  sent_by uuid,
  sent_at timestamptz,
  sent_automatically boolean NOT NULL DEFAULT false,
  owner_notification_id uuid,
  email_log_id uuid,
  skipped_at timestamptz,
  skip_reason text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, week_start)
);
CREATE TABLE public.owner_weekly_update_settings (
  property_id uuid PRIMARY KEY REFERENCES public.properties(id),
  auto_send boolean NOT NULL DEFAULT false,
  paused boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.owner_weekly_update_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  update_id uuid REFERENCES public.owner_weekly_updates(id),
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.owner_weekly_updates, public.owner_weekly_update_settings, public.owner_weekly_update_events TO authenticated;
GRANT ALL ON public.owner_weekly_updates, public.owner_weekly_update_settings, public.owner_weekly_update_events TO service_role;
ALTER TABLE public.owner_weekly_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_weekly_update_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_weekly_update_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read weekly updates" ON public.owner_weekly_updates FOR SELECT TO authenticated USING (public.home_chat_staff(auth.uid()));
CREATE POLICY "Staff read weekly update settings" ON public.owner_weekly_update_settings FOR SELECT TO authenticated USING (public.home_chat_staff(auth.uid()));
CREATE POLICY "Staff read weekly update history" ON public.owner_weekly_update_events FOR SELECT TO authenticated USING (public.home_chat_staff(auth.uid()));

-- Friday 3 PM Central to Sunday: nobody sends; the draft waits until Monday.
CREATE OR REPLACE FUNCTION public.weekly_update_send_closed(_now timestamptz)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT CASE extract(isodow FROM (_now AT TIME ZONE 'America/Chicago'))
           WHEN 5 THEN (_now AT TIME ZONE 'America/Chicago')::time >= time '15:00'
           WHEN 6 THEN true WHEN 7 THEN true ELSE false END
$$;

CREATE OR REPLACE FUNCTION public.weekly_update_send_internal(_id uuid, _text text, _actor uuid, _auto boolean, _email_log_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE u public.owner_weekly_updates; prog record; nid uuid; home text; body text := btrim(coalesce(_text,''));
BEGIN
  SELECT * INTO u FROM public.owner_weekly_updates WHERE id = _id FOR UPDATE;
  IF u.id IS NULL THEN RAISE EXCEPTION 'This update could not be found.'; END IF;
  IF u.status <> 'draft' THEN RAISE EXCEPTION 'This update was already handled.'; END IF;
  IF char_length(body) < 10 OR char_length(body) > 8000 THEN RAISE EXCEPTION 'The update needs some text (up to 8,000 characters).'; END IF;
  SELECT p.id, p.owner_user_id INTO prog FROM public.owner_program_properties opp JOIN public.owner_programs p ON p.id = opp.program_id
   WHERE opp.property_id = u.property_id AND opp.archived_at IS NULL ORDER BY opp.created_at LIMIT 1;
  SELECT public.format_property_label(to_jsonb(h))->>'primary' INTO home FROM public.properties h WHERE h.id = u.property_id;
  IF prog.id IS NOT NULL THEN
    INSERT INTO public.owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, sms_status, is_demo)
    VALUES (prog.id, prog.owner_user_id, 'weekly_update', 'p3', 'This week at ' || coalesce(home,'your home'), body,
            '/owner?home=' || u.property_id, CASE WHEN u.is_demo THEN 'skipped' ELSE 'pending' END, 'skipped', u.is_demo)
    RETURNING id INTO nid;
  ELSIF _email_log_id IS NULL THEN
    RAISE EXCEPTION 'This owner has no portal; send it by email.';
  END IF;
  UPDATE public.owner_weekly_updates SET status = 'sent', sent_text = body, sent_by = _actor, sent_at = now(),
         sent_automatically = coalesce(_auto,false), owner_notification_id = nid, email_log_id = _email_log_id
   WHERE id = _id;
  INSERT INTO public.owner_weekly_update_events(property_id, update_id, action, detail, actor_id)
    VALUES (u.property_id, _id, CASE WHEN _auto THEN 'sent_automatically' ELSE 'sent' END,
            jsonb_build_object('notification_id', nid, 'email_log_id', _email_log_id), _actor);
  RETURN jsonb_build_object('notification_id', nid, 'email_log_id', _email_log_id);
END $$;
REVOKE ALL ON FUNCTION public.weekly_update_send_internal(uuid, text, uuid, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_update_send_internal(uuid, text, uuid, boolean, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.weekly_update_may_send(_property uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.home_lead(_uid) OR public.home_pm(_property, _uid)
$$;

CREATE OR REPLACE FUNCTION public.send_weekly_update(_id uuid, _text text, _email_log_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); prop uuid;
BEGIN
  SELECT property_id INTO prop FROM public.owner_weekly_updates WHERE id = _id;
  IF prop IS NULL OR NOT public.weekly_update_may_send(prop, uid) THEN
    RAISE EXCEPTION 'Only the Project Manager, the Director of Onboarding or an Admin can send the weekly update.';
  END IF;
  IF public.weekly_update_send_closed(now()) THEN
    RAISE EXCEPTION 'Weekly updates are not sent after 3 PM Friday. It waits until Monday.';
  END IF;
  RETURN public.weekly_update_send_internal(_id, _text, uid, false, _email_log_id);
END $$;

CREATE OR REPLACE FUNCTION public.save_weekly_update_text(_id uuid, _text text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); u public.owner_weekly_updates; t timestamptz := now();
BEGIN
  SELECT * INTO u FROM public.owner_weekly_updates WHERE id = _id FOR UPDATE;
  IF u.id IS NULL OR NOT public.weekly_update_may_send(u.property_id, uid) THEN
    RAISE EXCEPTION 'Only the Project Manager, the Director of Onboarding or an Admin can edit the weekly update.';
  END IF;
  IF u.status <> 'draft' THEN RAISE EXCEPTION 'This update was already handled.'; END IF;
  IF char_length(coalesce(_text,'')) > 8000 THEN RAISE EXCEPTION 'Keep the update under 8,000 characters.'; END IF;
  UPDATE public.owner_weekly_updates SET edited_text = _text, edited_by = uid, edited_at = t WHERE id = _id;
  INSERT INTO public.owner_weekly_update_events(property_id, update_id, action, detail, actor_id)
    VALUES (u.property_id, _id, 'edited', jsonb_build_object('length', char_length(coalesce(_text,''))), uid);
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public.set_weekly_update_switch(_property_id uuid, _auto_send boolean DEFAULT NULL, _paused boolean DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); before_v public.owner_weekly_update_settings;
BEGIN
  IF _auto_send IS NOT NULL AND NOT public.home_lead(uid) THEN
    RAISE EXCEPTION 'Only the Director of Onboarding or an Admin can change automatic weekly updates.';
  END IF;
  IF _paused IS NOT NULL AND NOT public.weekly_update_may_send(_property_id, uid) THEN
    RAISE EXCEPTION 'Only the Project Manager, the Director of Onboarding or an Admin can pause weekly updates.';
  END IF;
  SELECT * INTO before_v FROM public.owner_weekly_update_settings WHERE property_id = _property_id;
  INSERT INTO public.owner_weekly_update_settings(property_id, auto_send, paused, updated_by, updated_at)
    VALUES (_property_id, coalesce(_auto_send, false), coalesce(_paused, false), uid, now())
    ON CONFLICT (property_id) DO UPDATE SET
      auto_send = coalesce(_auto_send, public.owner_weekly_update_settings.auto_send),
      paused = coalesce(_paused, public.owner_weekly_update_settings.paused),
      updated_by = uid, updated_at = now();
  INSERT INTO public.owner_weekly_update_events(property_id, action, detail, actor_id)
    VALUES (_property_id, 'switch_changed', jsonb_build_object(
      'auto_send_before', before_v.auto_send, 'auto_send', _auto_send, 'paused_before', before_v.paused, 'paused', _paused), uid);
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, before_value, after_value)
    VALUES (uid, 'weekly_update_switch_changed', 'property', _property_id,
            jsonb_build_object('auto_send', before_v.auto_send, 'paused', before_v.paused),
            jsonb_build_object('auto_send', _auto_send, 'paused', _paused));
END $$;

-- ---------------------------------------------------------------------------------------------
-- 6. Automatic owner reminders (one per item, the business day before it is due)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE public.owner_decision_reminders (
  work_item_id uuid PRIMARY KEY REFERENCES public.work_items(id),
  notification_id uuid,
  due_on date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.owner_decision_reminders TO authenticated;
GRANT ALL ON public.owner_decision_reminders TO service_role;
ALTER TABLE public.owner_decision_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read owner reminders" ON public.owner_decision_reminders FOR SELECT TO authenticated USING (public.home_chat_staff(auth.uid()));

-- The last business day before _d: skips weekends and the business holidays table.
CREATE OR REPLACE FUNCTION public.prev_business_day(_d date)
RETURNS date LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE d date := _d - 1;
BEGIN
  IF _d IS NULL THEN RETURN NULL; END IF;
  WHILE extract(isodow FROM d) >= 6 OR EXISTS (SELECT 1 FROM public.ao_business_holidays h WHERE h.day = d) LOOP
    d := d - 1;
  END LOOP;
  RETURN d;
END $$;

CREATE OR REPLACE FUNCTION public.owner_decision_reminder_run(_now timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
DECLARE w record; nid uuid; got int; n int := 0;
  today date := (_now AT TIME ZONE 'America/Chicago')::date;
BEGIN
  -- Owner reminders go out with the Active Owner daily email time (9 AM Central by default).
  IF (_now AT TIME ZONE 'America/Chicago')::time < private.ao_digest_time() THEN RETURN jsonb_build_object('reminders', 0, 'waiting', 'before 9 AM'); END IF;
  IF extract(isodow FROM today) >= 6 OR EXISTS (SELECT 1 FROM public.ao_business_holidays h WHERE h.day = today) THEN
    RETURN jsonb_build_object('reminders', 0);
  END IF;
  FOR w IN SELECT x.* FROM public.work_items x
            WHERE x.kind = 'opportunity' AND x.program_id IS NOT NULL AND x.due_on IS NOT NULL
              AND 'decision' = ANY(x.response_types)
              AND x.status NOT IN ('draft','complete','closed','archived') AND x.retired_at IS NULL
              AND x.responded_at IS NULL AND x.sent_at IS NOT NULL AND NOT x.is_demo
              AND public.prev_business_day(x.due_on) = today
              AND NOT EXISTS (SELECT 1 FROM public.owner_decision_reminders r WHERE r.work_item_id = x.id) LOOP
    INSERT INTO public.owner_decision_reminders(work_item_id, due_on) VALUES (w.id, w.due_on) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS got = ROW_COUNT;
    CONTINUE WHEN got = 0;
    -- Held for the one daily email per owner (ao_owner_email_run); shows in the portal now.
    INSERT INTO public.owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, sms_status)
    SELECT w.program_id, p.owner_user_id, 'owner_decision_reminder', 'p3',
           'Reminder: ' || w.title || ' is due ' || to_char(w.due_on, 'FMMon FMDD') || '.',
           'Open it in your portal to answer.', '/owner?opportunity=' || w.id, 'held', 'skipped'
      FROM public.owner_programs p WHERE p.id = w.program_id
    RETURNING id INTO nid;
    UPDATE public.owner_decision_reminders SET notification_id = nid WHERE work_item_id = w.id;
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('reminders', n);
END $$;
REVOKE ALL ON FUNCTION public.owner_decision_reminder_run(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_decision_reminder_run(timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.home_chat_unread_alert_run(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_chat_unread_alert_run(timestamptz) TO service_role;

-- Ask the owner: the "answer by" date on an ARHA owner item.
CREATE OR REPLACE FUNCTION public.set_owner_item_due(_id uuid, _due_on date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); w public.work_items;
BEGIN
  SELECT * INTO w FROM public.work_items WHERE id = _id FOR UPDATE;
  IF w.id IS NULL OR w.kind <> 'opportunity' OR w.source <> 'arha' THEN RAISE EXCEPTION 'This owner item could not be found.'; END IF;
  IF NOT public.home_owner_contact_writer(w.property_id, uid) THEN
    RAISE EXCEPTION 'Only the home''s team, the Director of Onboarding or an Admin can set the answer by date.';
  END IF;
  IF _due_on IS NOT NULL AND _due_on < (now() AT TIME ZONE 'America/Chicago')::date THEN RAISE EXCEPTION 'Pick today or a later date.'; END IF;
  UPDATE public.work_items SET due_on = _due_on, updated_at = now() WHERE id = _id;
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
    VALUES (uid, 'owner_item_due_set', 'work_item', _id, w.title, jsonb_build_object('due_on', w.due_on), jsonb_build_object('due_on', _due_on));
END $$;

-- ---------------------------------------------------------------------------------------------
-- 7. Email safety: Task notices written together in one save are in-app only
-- ---------------------------------------------------------------------------------------------
-- A bulk action (Plan catch-up Mark done, Not needed, Assign, Change due date, bulk complete)
-- writes many Task notices in one transaction. The second one for a different Task by the same
-- person in the same transaction turns every notice of that kind in it to in-app only.
-- A single Task save writes one notice per Task and keeps today's email.
CREATE OR REPLACE FUNCTION public.bulk_task_notices_in_app_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.entity_type = 'onboarding_task' AND NEW.email_status = 'pending'
     AND EXISTS (SELECT 1 FROM public.staff_notifications s
                  WHERE s.kind = NEW.kind AND s.entity_type = 'onboarding_task'
                    AND s.actor_id IS NOT DISTINCT FROM NEW.actor_id
                    AND s.created_at = NEW.created_at
                    AND s.entity_id IS DISTINCT FROM NEW.entity_id) THEN
    NEW.email_status := 'none';
    UPDATE public.staff_notifications SET email_status = 'none'
     WHERE kind = NEW.kind AND entity_type = 'onboarding_task' AND actor_id IS NOT DISTINCT FROM NEW.actor_id
       AND created_at = NEW.created_at AND email_status = 'pending';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bulk_task_notices_in_app_only BEFORE INSERT ON public.staff_notifications
  FOR EACH ROW EXECUTE FUNCTION public.bulk_task_notices_in_app_only();

GRANT EXECUTE ON FUNCTION public.post_home_chat_message(uuid, text, text, jsonb, uuid[]), public.mark_home_chat_read(uuid),
  public.link_chat_message_task(uuid, uuid), public.my_home_chat_inbox(), public.set_owner_team_notes(uuid, text),
  public.log_owner_contact(uuid, text, text), public.send_weekly_update(uuid, text, uuid), public.save_weekly_update_text(uuid, text),
  public.set_weekly_update_switch(uuid, boolean, boolean), public.set_owner_item_due(uuid, date),
  public.home_chat_can_read(uuid, uuid), public.home_chat_staff(uuid), public.home_team_member(uuid, uuid),
  public.home_owner_member(uuid, uuid), public.home_owner_contact_writer(uuid, uuid), public.home_lead(uuid), public.home_pm(uuid, uuid),
  public.weekly_update_may_send(uuid, uuid), public.prev_business_day(date), public.weekly_update_send_closed(timestamptz)
  TO authenticated;
REVOKE ALL ON FUNCTION public.home_chat_notify(uuid[], uuid, text, text, text, uuid, text, boolean) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 8. Owner reminders join the one daily Active Owner email (two changes to the live function:
--    reminders made at or after the daily time still join today's email, and each reads
--    "Reminder: <title> is due <date>."). Live copy: live-capture/ao_owner_email_run.sql.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ao_owner_email_run(_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n record; o record; got int; ready int := 0; daily int := 0; waiting int := 0;
  today date := (_now AT TIME ZONE 'America/Chicago')::date;
  cutoff timestamptz := (today + private.ao_digest_time()) AT TIME ZONE 'America/Chicago';
  body text; nid uuid; prog public.owner_programs;
BEGIN
  FOR n IN SELECT x.* FROM public.owner_notifications x
            WHERE x.kind = 'ao_plan_ready' AND x.email_status = 'held' AND NOT x.is_demo
              AND NOT EXISTS (SELECT 1 FROM public.ao_daily_email_items i WHERE i.notification_id = x.id)
            ORDER BY x.created_at FOR UPDATE SKIP LOCKED LOOP
    INSERT INTO public.ao_owner_email_days(owner_key, day, kind, notification_id)
      VALUES (coalesce(n.owner_user_id, n.program_id), today, 'plan_ready', n.id) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS got = ROW_COUNT;
    IF got = 1 THEN
      UPDATE public.owner_notifications SET email_status = 'pending' WHERE id = n.id;
      ready := ready + 1;
    ELSE waiting := waiting + 1; END IF;
  END LOOP;
  IF _now >= cutoff THEN
    FOR o IN SELECT x.program_id, coalesce(x.owner_user_id, x.program_id) AS owner_key, min(x.owner_user_id::text)::uuid AS owner_user_id
              FROM public.owner_notifications x
             WHERE x.email_status = 'held' AND NOT x.is_demo AND (x.created_at < cutoff OR x.kind = 'owner_decision_reminder')
               AND NOT EXISTS (SELECT 1 FROM public.ao_daily_email_items i WHERE i.notification_id = x.id)
               AND NOT EXISTS (SELECT 1 FROM public.ao_owner_email_days d WHERE d.owner_key = coalesce(x.owner_user_id, x.program_id) AND d.day = today)
             GROUP BY 1, 2 LOOP
      SELECT * INTO prog FROM public.owner_programs WHERE id = o.program_id;
      IF NOT coalesce(prog.notify_email, false) THEN
        UPDATE public.owner_notifications SET email_status = 'skipped', delivery_error = 'Homeowner email is off for this program.'
         WHERE program_id = o.program_id AND email_status = 'held';
        CONTINUE;
      END IF;
      nid := gen_random_uuid();
      INSERT INTO public.ao_owner_email_days(owner_key, day, kind, notification_id) VALUES (o.owner_key, today, 'daily', nid)
        ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS got = ROW_COUNT;
      CONTINUE WHEN got = 0;
      SELECT 'Here is what is new in your portal.' || E'\n\n' || string_agg(home_block, E'\n\n' ORDER BY home_sort) INTO body FROM (
        SELECT coalesce(home_label, 'Your homes') AS home_sort,
               coalesce(home_label, 'Your homes') || E'\n' || string_agg('- ' || line, E'\n' ORDER BY created_at) AS home_block
          FROM (
            SELECT x.created_at,
                   (SELECT public.format_property_label(to_jsonb(h)) ->> 'primary' FROM public.properties h WHERE h.id = r.property_id) AS home_label,
                   CASE WHEN x.kind = 'ao_plan_ready' THEN 'Your homeowner plan is ready'
                        WHEN x.kind = 'ao_home_live' THEN 'Your home is live: new activities are in your portal'
                        WHEN x.kind = 'owner_decision_reminder' THEN x.title
                        WHEN x.title LIKE 'Reminder:%' THEN coalesce(r.title, 'An activity') || ' closes soon'
                        ELSE coalesce(r.title, 'An activity') || ' is ready' END AS line
              FROM public.owner_notifications x LEFT JOIN public.owner_reviews r ON r.id = x.review_id
             WHERE x.program_id = o.program_id AND x.email_status = 'held' AND NOT x.is_demo AND (x.created_at < cutoff OR x.kind = 'owner_decision_reminder')
          ) items GROUP BY 1) blocks;
      INSERT INTO public.owner_notifications(id, program_id, owner_user_id, kind, priority, title, body, action_path, email_status, sms_status, read_at)
      VALUES (nid, o.program_id, prog.owner_user_id, 'ao_daily', 'p3', 'Your homeowner plan today', body, '/owner', 'pending', 'skipped', now());
      INSERT INTO public.ao_daily_email_items(notification_id, daily_notification_id)
        SELECT x.id, nid FROM public.owner_notifications x
         WHERE x.program_id = o.program_id AND x.email_status = 'held' AND NOT x.is_demo AND (x.created_at < cutoff OR x.kind = 'owner_decision_reminder');
      UPDATE public.owner_notifications SET email_status = 'in_daily_email'
       WHERE id IN (SELECT notification_id FROM public.ao_daily_email_items WHERE daily_notification_id = nid);
      daily := daily + 1;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('plan_ready_sent', ready, 'plan_ready_waiting', waiting, 'daily_sent', daily);
END $function$;
