-- onboarding-notify-escalate: who hears about onboarding work, escalations on owner cards, the 8 AM
-- reminder's time zone and dedupe, and the test inbox. One transaction. Additive; nothing deleted.

-- 0. Stop if anything differs from what was read live on Nov 22.
DO $guard$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'private.notify_onboarding_recipients(uuid[],uuid,text,text,text,text,uuid,text,boolean)'::regprocedure) <> '734de847bab6f0878c0a8a15c4dfca3c'
  OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'private.notify_opportunity_staff(uuid,text)'::regprocedure) <> '6bc5bffbb6a0c63bd0fdadb9d57fc99c'
  OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'private.owner_item_notify(public.owner_reviews,text,text)'::regprocedure) <> 'e6d793c456760cfe395e4d604fb94fac'
  OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'private.owner_item_recipients(uuid)'::regprocedure) <> 'f2fbc2ab8ec93172d896cc0eef57eb73' THEN
    RAISE EXCEPTION 'onboarding-notify-escalate: a notice rule changed since it was staged';
  END IF;
  IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'staff_notifications_email_status_check' AND conrelid = 'public.staff_notifications'::regclass)
     <> 'CHECK ((email_status = ANY (ARRAY[''none''::text, ''pending''::text, ''sent''::text, ''skipped''::text, ''failed''::text])))'
  OR (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'escalations_role_ck' AND conrelid = 'public.escalations'::regclass)
     <> 'CHECK ((escalated_to_role = ANY (ARRAY[''supervisor''::text, ''director''::text])))' THEN
    RAISE EXCEPTION 'onboarding-notify-escalate: a table rule changed since it was staged';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'escalations' AND column_name IN ('onboarding_task_id','work_item_id'))
  OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'time_zone')
  OR to_regclass('public.onboarding_daily_reminders') IS NOT NULL
  OR EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'onboarding_email_test_inbox') THEN
    RAISE EXCEPTION 'onboarding-notify-escalate: already applied';
  END IF;
END $guard$;

-- 1. Each person's time zone for the 8 AM reminder. Central until the person changes it.
ALTER TABLE public.profiles ADD COLUMN time_zone text NOT NULL DEFAULT 'America/Chicago';

CREATE OR REPLACE FUNCTION public.set_my_time_zone(_tz text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid) THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  IF _tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = _tz) THEN RAISE EXCEPTION 'Pick a time zone from the list.'; END IF;
  UPDATE public.profiles SET time_zone = _tz WHERE id = uid;
  RETURN _tz;
END $$;
REVOKE ALL ON FUNCTION public.set_my_time_zone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_time_zone(text) TO authenticated;

-- 2. Test inbox: while this setting has an address, onboarding notice emails are held, and only
--    the preview build sends them, to this address. Removing the setting sends them normally again.
INSERT INTO public.app_settings(key, value, updated_at)
VALUES ('onboarding_email_test_inbox', jsonb_build_object('email', 'emily.jimenez@arealhomeaway.com'), now());

ALTER TABLE public.staff_notifications DROP CONSTRAINT staff_notifications_email_status_check;
ALTER TABLE public.staff_notifications ADD CONSTRAINT staff_notifications_email_status_check
  CHECK (email_status = ANY (ARRAY['none','pending','sent','skipped','failed','held']));

CREATE OR REPLACE FUNCTION private.onboarding_email_status(_is_demo boolean)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN coalesce(_is_demo, false) THEN 'none'
    WHEN EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'onboarding_email_test_inbox'
                  AND nullif(btrim(value->>'email'), '') IS NOT NULL) THEN 'held'
    ELSE 'pending' END
$$;

CREATE OR REPLACE FUNCTION private.onboarding_director()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(public.seat_holder('onboarding_director'), public.seat_holder('director_onboarding'))
$$;

CREATE OR REPLACE FUNCTION private.home_project_manager(_property uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT project_manager FROM public.onboarding_projects
   WHERE property_id = _property AND status <> 'cancelled' AND project_manager IS NOT NULL
   ORDER BY created_at DESC LIMIT 1
$$;

-- 3. The shared onboarding notice writer. Unchanged except:
--    the Director of Onboarding is told only about escalations, Tasks a Project Manager adds by hand,
--    Tasks the Director created (sent directly), and owner tasks on a home with no Project Manager;
--    emails follow the test inbox rule.
CREATE OR REPLACE FUNCTION private.notify_onboarding_recipients(
  _recipients uuid[], _actor uuid, _kind text, _title text, _body text,
  _entity_type text, _entity_id uuid, _link text, _is_demo boolean)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE r uuid; n integer := 0; _prop uuid; _dir uuid := private.onboarding_director(); _dir_ok boolean;
BEGIN
  _prop := nullif(split_part(split_part(_link, '/onboarding/', 2), '?', 1), '')::uuid;
  _dir_ok := _kind IN ('onboarding_escalation', 'onboarding_task_added_by_pm')
    OR (_entity_type = 'onboarding_task' AND EXISTS (SELECT 1 FROM onboarding_tasks WHERE id = _entity_id AND created_by = _dir))
    OR (_kind IN ('owner_collaboration', 'owner_item_message') AND private.home_project_manager(_prop) IS NULL);
  FOR r IN SELECT DISTINCT x FROM unnest(_recipients) x WHERE x IS NOT NULL LOOP
    CONTINUE WHEN r = _actor;
    CONTINUE WHEN r = _dir AND NOT _dir_ok;
    CONTINUE WHEN NOT private.onboarding_scope_ok(r, _prop);
    INSERT INTO staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority, actor_id, is_demo, email_status)
    VALUES (r, _kind, _title, _body, _entity_type, _entity_id, _link, 'normal', _actor, coalesce(_is_demo,false),
            private.onboarding_email_status(_is_demo));
    n := n + 1;
  END LOOP;
  RETURN n;
END $function$;

-- 4. Owner tasks (Opportunities from the plan or added by hand): only the home's Project Manager;
--    the Director only when the home has no Project Manager.
CREATE OR REPLACE FUNCTION private.notify_opportunity_staff(_id uuid, _verb text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE w record; _owner text; _home text; _link text; _pm uuid;
BEGIN
  SELECT * INTO w FROM work_items WHERE id=_id;
  IF w IS NULL OR w.property_id IS NULL THEN RETURN; END IF;
  _pm := private.home_project_manager(w.property_id);
  SELECT coalesce(pr.full_name, 'The homeowner') INTO _owner FROM owner_programs p LEFT JOIN profiles pr ON pr.id=p.owner_user_id WHERE p.id=w.program_id;
  SELECT public.format_property_label(to_jsonb(properties))->>'primary' INTO _home FROM properties WHERE id=w.property_id;
  _link := '/onboarding/'||w.property_id||'?opp='||w.id;
  PERFORM private.notify_onboarding_recipients(ARRAY[coalesce(_pm, private.onboarding_director())], auth.uid(), 'owner_collaboration',
    coalesce(_owner,'The homeowner')||' '||_verb, w.title||' · '||_home, 'work_item', w.id, _link, w.is_demo);
END $function$;

-- 5. Owner items (homeowner replies): only the home's Project Manager; the Director when there is none.
CREATE OR REPLACE FUNCTION private.owner_item_recipients(_review_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'private' AS $function$
  SELECT uid FROM (
    SELECT coalesce(private.home_project_manager(r.property_id), private.onboarding_director()) AS uid
      FROM public.owner_reviews r WHERE r.id = _review_id) x
   WHERE uid IS NOT NULL AND uid IS DISTINCT FROM auth.uid()
$function$;

CREATE OR REPLACE FUNCTION private.owner_item_notify(_review owner_reviews, _title text, _body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $function$
DECLARE task uuid;
BEGIN
  SELECT task_id INTO task FROM public.owner_item_task_sends WHERE review_id = _review.id;
  task := coalesce(task, _review.onboarding_task_id);
  INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority, email_status, is_demo)
  SELECT uid, 'owner_item_message', left(_title, 200), left(btrim(_body), 500), 'owner_review', _review.id,
         '/onboarding/' || _review.property_id || CASE WHEN task IS NULL THEN '' ELSE '?tab=plan&task=' || task END,
         'normal', private.onboarding_email_status(_review.is_demo), coalesce(_review.is_demo, false)
    FROM private.owner_item_recipients(_review.id) uid;
END $function$;

-- 6. A Project Manager adds a Task by hand (not from the plan): the Director of Onboarding is told.
CREATE OR REPLACE FUNCTION private.notify_director_pm_added_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _dir uuid := private.onboarding_director(); _who text; _home text;
BEGIN
  IF NEW.template_task_id IS NOT NULL OR NEW.follow_up_of IS NOT NULL OR NEW.created_by IS NULL
     OR NEW.created_by IS DISTINCT FROM auth.uid() OR NEW.created_by = _dir THEN
    RETURN NEW;
  END IF;
  IF NOT (private.home_project_manager(NEW.property_id) = NEW.created_by
          OR EXISTS (SELECT 1 FROM functional_role_members WHERE user_id = NEW.created_by
                      AND role_code IN ('onboarding_project_manager', 'project_manager'))) THEN
    RETURN NEW;
  END IF;
  SELECT coalesce(full_name, email, 'A Project Manager') INTO _who FROM profiles WHERE id = NEW.created_by;
  SELECT public.format_property_label(to_jsonb(properties))->>'primary' INTO _home FROM properties WHERE id = NEW.property_id;
  PERFORM private.notify_onboarding_recipients(ARRAY[_dir], NEW.created_by, 'onboarding_task_added_by_pm',
    coalesce(_who, 'A Project Manager') || ' added a Task that is not in the plan',
    NEW.title || ' · ' || coalesce(_home, 'the home'), 'onboarding_task', NEW.id,
    '/onboarding/' || NEW.property_id || '?tab=work&task=' || NEW.id, NEW.is_demo);
  RETURN NEW;
END $function$;
CREATE TRIGGER notify_director_pm_added_task AFTER INSERT ON public.onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION private.notify_director_pm_added_task();

-- 7. Escalations reuse the Operations escalations table. An onboarding escalation names the owner
--    card (work item) and its Task, goes to the Director of Onboarding, never carries a ticket.
ALTER TABLE public.escalations
  ADD COLUMN onboarding_task_id uuid REFERENCES public.onboarding_tasks(id) ON DELETE SET NULL,
  ADD COLUMN work_item_id uuid REFERENCES public.work_items(id) ON DELETE SET NULL;
ALTER TABLE public.escalations DROP CONSTRAINT escalations_role_ck;
ALTER TABLE public.escalations ADD CONSTRAINT escalations_role_ck
  CHECK (escalated_to_role = ANY (ARRAY['supervisor','director','onboarding_director']));
ALTER TABLE public.escalations ADD CONSTRAINT escalations_onboarding_shape_ck
  CHECK (escalated_to_role <> 'onboarding_director' OR (ticket_id IS NULL AND property_id IS NOT NULL
         AND (onboarding_task_id IS NOT NULL OR work_item_id IS NOT NULL)));
CREATE INDEX escalations_onboarding_open_idx ON public.escalations(property_id)
  WHERE escalated_to_role = 'onboarding_director' AND status = 'open';

CREATE OR REPLACE FUNCTION public.raise_onboarding_escalation(_work_item_id uuid, _task_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE uid uuid := auth.uid(); w record; t record; _prop uuid; _task uuid; _demo boolean; _id uuid;
  _who text; _home text; _title text; _dir uuid := private.onboarding_director(); _link text;
BEGIN
  IF uid IS NULL OR NOT (public.is_onboarding_staff(uid) OR public.has_role(uid, 'admin')) THEN
    RAISE EXCEPTION 'Only the onboarding team can escalate.';
  END IF;
  IF length(btrim(coalesce(_reason, ''))) < 3 OR length(_reason) > 2000 THEN
    RAISE EXCEPTION 'Say what you need, in 3 to 2,000 characters.';
  END IF;
  IF _work_item_id IS NOT NULL THEN
    SELECT id, property_id, title, is_demo, coalesce(source_task_id, linked_task_id) AS task INTO w
      FROM work_items WHERE id = _work_item_id;
    IF w.id IS NULL THEN RAISE EXCEPTION 'This owner item is not available.'; END IF;
    _prop := w.property_id; _task := coalesce(_task_id, w.task); _title := w.title; _demo := w.is_demo;
  ELSE
    _task := _task_id;
  END IF;
  IF _task IS NOT NULL THEN
    SELECT id, property_id, title, is_demo INTO t FROM onboarding_tasks WHERE id = _task AND archived_at IS NULL;
    IF t.id IS NULL OR (_prop IS NOT NULL AND t.property_id <> _prop) THEN
      -- An owner card whose own Task is gone still escalates; it links to the card.
      IF _work_item_id IS NOT NULL AND _task_id IS NULL THEN _task := NULL;
      ELSE RAISE EXCEPTION 'This Task is not available.'; END IF;
    ELSE
      _prop := t.property_id; _title := coalesce(_title, t.title); _demo := coalesce(_demo, t.is_demo);
    END IF;
  END IF;
  IF _prop IS NULL THEN RAISE EXCEPTION 'Pick an owner item or a Task to escalate.'; END IF;
  IF NOT private.onboarding_scope_ok(uid, _prop) THEN RAISE EXCEPTION 'This home is outside your onboarding scope.'; END IF;
  SELECT id INTO _id FROM escalations
   WHERE escalated_to_role = 'onboarding_director' AND status = 'open' AND property_id = _prop
     AND ((_work_item_id IS NOT NULL AND work_item_id = _work_item_id) OR (_work_item_id IS NULL AND onboarding_task_id = _task))
   LIMIT 1;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  INSERT INTO escalations(property_id, onboarding_task_id, work_item_id, escalated_by, escalated_to_role, escalated_to, reason, urgency, status, is_demo)
  VALUES (_prop, _task, _work_item_id, uid, 'onboarding_director', _dir, btrim(_reason), 'normal', 'open', coalesce(_demo, false))
  RETURNING id INTO _id;
  SELECT coalesce(full_name, email, 'A teammate') INTO _who FROM profiles WHERE id = uid;
  SELECT public.format_property_label(to_jsonb(properties))->>'primary' INTO _home FROM properties WHERE id = _prop;
  _link := '/onboarding/' || _prop || CASE WHEN _task IS NOT NULL THEN '?tab=work&task=' || _task ELSE '?opp=' || _work_item_id END;
  PERFORM private.notify_onboarding_recipients(ARRAY[_dir], uid, 'onboarding_escalation',
    coalesce(_who, 'A teammate') || ' escalated: ' || left(_title, 150),
    left(btrim(_reason), 400) || ' · ' || coalesce(_home, 'the home'), 'escalation', _id, _link, coalesce(_demo, false));
  INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
  VALUES (uid, 'onboarding_escalation.raise', 'escalation', _id, left(_title, 200),
          jsonb_build_object('property_id', _prop, 'task_id', _task, 'work_item_id', _work_item_id, 'reason', btrim(_reason)));
  RETURN _id;
END $function$;

CREATE OR REPLACE FUNCTION public.resolve_onboarding_escalation(_id uuid, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE uid uuid := auth.uid(); e record; _lead boolean; _status text; _home text;
BEGIN
  SELECT * INTO e FROM escalations WHERE id = _id AND escalated_to_role = 'onboarding_director' FOR UPDATE;
  IF e.id IS NULL OR e.status <> 'open' THEN RAISE EXCEPTION 'This escalation is already closed.'; END IF;
  _lead := uid = private.onboarding_director() OR public.has_role(uid, 'admin');
  IF NOT (_lead OR uid = e.escalated_by) THEN RAISE EXCEPTION 'Only the Director of Onboarding or Admin can close this.'; END IF;
  IF length(coalesce(_note, '')) > 2000 THEN RAISE EXCEPTION 'Keep the note under 2,000 characters.'; END IF;
  _status := CASE WHEN _lead THEN 'resolved' ELSE 'withdrawn' END;
  UPDATE escalations SET status = _status, outcome = CASE WHEN _lead THEN 'guidance' END,
         outcome_note = nullif(btrim(coalesce(_note, '')), ''), resolved_by = uid, resolved_at = now()
   WHERE id = _id;
  IF _lead THEN
    SELECT public.format_property_label(to_jsonb(properties))->>'primary' INTO _home FROM properties WHERE id = e.property_id;
    PERFORM private.notify_onboarding_recipients(ARRAY[e.escalated_by], uid, 'onboarding_escalation_answered',
      'Your escalation was answered', coalesce(nullif(btrim(coalesce(_note, '')), ''), 'Resolved') || ' · ' || coalesce(_home, 'the home'),
      'escalation', e.id,
      '/onboarding/' || e.property_id || CASE WHEN e.onboarding_task_id IS NOT NULL THEN '?tab=work&task=' || e.onboarding_task_id ELSE '?opp=' || e.work_item_id END,
      e.is_demo);
  END IF;
  INSERT INTO audit_log(actor_id, action, entity_type, entity_id, after_value)
  VALUES (uid, 'onboarding_escalation.' || _status, 'escalation', _id, jsonb_build_object('note', nullif(btrim(coalesce(_note, '')), '')));
  RETURN _id;
END $function$;
REVOKE ALL ON FUNCTION public.raise_onboarding_escalation(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_onboarding_escalation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.raise_onboarding_escalation(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_onboarding_escalation(uuid, text) TO authenticated;

-- 8. The 8 AM reminder: one row per person per local day, so it is sent once.
CREATE TABLE public.onboarding_daily_reminders (
  user_id uuid NOT NULL,
  local_day date NOT NULL,
  time_zone text NOT NULL,
  task_ids uuid[] NOT NULL DEFAULT '{}',
  notification_id uuid,
  emailed_to text,
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sent','skipped','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, local_day)
);
GRANT SELECT ON public.onboarding_daily_reminders TO authenticated;
GRANT ALL ON public.onboarding_daily_reminders TO service_role;
ALTER TABLE public.onboarding_daily_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "People read their own reminders" ON public.onboarding_daily_reminders
  FOR SELECT TO authenticated USING (user_id = auth.uid());

INSERT INTO public.audit_log(actor_id, action, entity_type, entity_label, after_value)
VALUES (NULL, 'onboarding_notify_escalate.apply', 'system', 'Onboarding notices and escalations',
        jsonb_build_object('package', 'onboarding-notify-escalate', 'test_inbox', 'on'));