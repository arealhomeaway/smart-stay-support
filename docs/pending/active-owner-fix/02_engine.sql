-- Active Owner fix, Fixes 2, 3, 4, 6 and 7 (schema part). Nov 11. Apply after 01.
-- Additive: new tables, helpers and triggers. Replaced in place (live text saved in
-- live-capture/ and restored by 02_engine.undo.sql): ao_set_home_automation,
-- ao_preview_home_automation, owner_business_decision_guard.
-- Not changed: ao_process_clocks, ao_unlock, notify_owner_of_review, ao_owner_plan, perform_handoff_step,
-- the stage rule (private.ao_home_stage), deadlines, the one reminder and the ARHA takeover.

-- ---------------------------------------------------------------- Fix 2: the home's live program
-- A home's program is the live program (active, not archived, not demo) that has it as its primary
-- home or as an included, not archived home. Two live programs: refused, never guessed.
CREATE OR REPLACE FUNCTION private.ao_home_program(_property uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ids uuid[];
BEGIN
  SELECT array_agg(DISTINCT p.id ORDER BY p.id) INTO ids FROM public.owner_programs p
   WHERE p.status = 'active' AND p.archived_at IS NULL AND NOT p.is_demo
     AND (p.property_id = _property OR EXISTS (
           SELECT 1 FROM public.owner_program_properties e
            WHERE e.program_id = p.id AND e.property_id = _property
              AND e.inclusion_status = 'included' AND e.archived_at IS NULL));
  IF coalesce(array_length(ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('reason', 'This home has no active Active Owner program');
  ELSIF array_length(ids, 1) > 1 THEN
    RETURN jsonb_build_object('reason', 'This home is in more than one homeowner program. Ask an Admin to fix it first.');
  END IF;
  RETURN jsonb_build_object('program_id', ids[1]);
END $$;
REVOKE ALL ON FUNCTION private.ao_home_program(uuid) FROM PUBLIC, anon, authenticated;

-- One rule for what each released card would do on a home, used by the preview AND the turn on step,
-- so the two always count the same. A card whose Task another card already claimed is Already covered
-- (the preview's rule, now also the turn on rule). A handed off home gets operations cards only.
CREATE OR REPLACE FUNCTION private.ao_plan_outcomes(_property uuid, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
RETURNS TABLE(card_id uuid, code text, stage_window text, outcome text, task_id uuid, coverage jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE stage text := private.ao_home_stage(_property); c public.ao_library_cards; t_id uuid; t_done boolean;
  cov jsonb; claimed uuid[] := ARRAY[]::uuid[]; res text;
BEGIN
  FOR c IN SELECT l.* FROM public.ao_library_cards l WHERE l.status = 'released' ORDER BY l.code LOOP
    IF EXISTS (SELECT 1 FROM public.ao_home_plan_cards pc WHERE pc.property_id = _property AND pc.card_id = c.id) THEN
      card_id := c.id; code := c.code; stage_window := c.stage_window; outcome := 'already_on_plan'; task_id := NULL; coverage := NULL;
      RETURN NEXT; CONTINUE;
    END IF;
    t_id := NULL; t_done := NULL; cov := NULL;
    SELECT t.id, t.status = 'complete' INTO t_id, t_done FROM public.onboarding_tasks t
      WHERE t.property_id = _property AND t.archived_at IS NULL AND t.template_task_id = ANY (c.linked_template_task_ids)
      ORDER BY t.created_at LIMIT 1;
    IF c.id = ANY (_covered_card_ids) THEN cov := jsonb_build_object('reason', 'staff_marked');
    ELSIF t_id IS NOT NULL AND t_id = ANY (claimed) THEN cov := jsonb_build_object('reason', 'same_task_other_card');
    ELSE cov := private.ao_card_coverage(_property, c.code, t_id); END IF;
    -- A card whose linked Task is already completed when the plan starts is Already covered; the owner never gets it.
    IF cov IS NULL AND coalesce(t_done, false) THEN cov := jsonb_build_object('reason', 'linked_task_done', 'source', 'onboarding_task', 'item_id', t_id); END IF;
    res := CASE
      WHEN stage = 'operations' AND c.stage_window <> 'operations' THEN 'skipped_passed'
      WHEN c.stage_window <> 'anytime' AND
           (CASE c.stage_window WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) <
           (CASE stage WHEN 'onboarding_early' THEN 0 WHEN 'onboarding_launch' THEN 1 ELSE 2 END) THEN 'skipped_passed'
      WHEN cov IS NOT NULL THEN 'already_covered'
      WHEN c.lock_rule = 'until_linked_step_done' AND NOT coalesce(t_done, false) THEN 'locked'
      ELSE 'open' END;
    IF res IN ('locked', 'open') AND t_id IS NOT NULL THEN claimed := claimed || t_id; END IF;
    card_id := c.id; code := c.code; stage_window := c.stage_window; outcome := res; task_id := t_id; coverage := cov;
    RETURN NEXT;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.ao_plan_outcomes(uuid, uuid[]) FROM PUBLIC, anon, authenticated;

-- Adds one card to a home's plan (the turn on step's insert, unchanged). Open cards start their clock now.
CREATE OR REPLACE FUNCTION private.ao_add_plan_card(_property uuid, _program uuid, _card uuid, _outcome text,
  _task uuid, _cov jsonb, _actor uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.ao_library_cards; rid uuid; pcid uuid; review_task uuid; demo boolean;
BEGIN
  SELECT * INTO c FROM public.ao_library_cards WHERE id = _card;
  SELECT p.is_demo OR coalesce((SELECT is_demo FROM public.properties WHERE id = _property), false) INTO demo
    FROM public.owner_programs p WHERE p.id = _program;
  IF _outcome IN ('locked', 'open') THEN
    -- A withdrawn item can still hold the Task's one owner-item slot; the card item then carries no Task pointer.
    review_task := CASE WHEN _task IS NOT NULL AND EXISTS (SELECT 1 FROM public.owner_reviews o WHERE o.onboarding_task_id = _task)
                        THEN NULL ELSE _task END;
    INSERT INTO public.owner_reviews(program_id, property_id, phase, stage, title, recommendation, status, source_type,
      owner_action_type, onboarding_task_id, is_demo, created_by, task_type)
    VALUES (_program, _property, 'onboarding', c.stage_window, c.title,
      CASE WHEN _outcome = 'locked' THEN 'Coming soon: waiting on ARHA to ' || coalesce(nullif(c.opens_text, ''), 'finish the step before this') ELSE c.why_text END,
      CASE WHEN _outcome = 'locked' THEN 'prepared' ELSE 'awaiting_owner' END,
      'onboarding', 'participate', review_task, coalesce(demo, false), _actor, 'property')
    RETURNING id INTO rid;
  END IF;
  INSERT INTO public.ao_home_plan_cards(property_id, program_id, card_id, card_version, join_outcome, owner_review_id, linked_task_id,
      covered_reason, covered_source, covered_item_id)
    VALUES (_property, _program, c.id, c.version, _outcome, rid, _task,
      CASE WHEN _outcome = 'already_covered' THEN _cov ->> 'reason' END,
      CASE WHEN _outcome = 'already_covered' THEN _cov ->> 'source' END,
      CASE WHEN _outcome = 'already_covered' THEN (_cov ->> 'item_id')::uuid END)
    RETURNING id INTO pcid;
  IF _outcome = 'open' THEN
    UPDATE public.ao_home_plan_cards SET join_outcome = 'locked' WHERE id = pcid;
    PERFORM private.ao_unlock(pcid, _actor);
    UPDATE public.ao_home_plan_cards SET join_outcome = 'open' WHERE id = pcid;
  END IF;
  RETURN pcid;
END $$;
REVOKE ALL ON FUNCTION private.ao_add_plan_card(uuid, uuid, uuid, text, uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;

-- Starts one home's plan: records who and when, adds every card by the shared rule, queues no single
-- owner emails (the existing batch setting), and returns the counts. Raises when the home has no
-- single live program.
CREATE OR REPLACE FUNCTION private.ao_start_home_plan(_property uuid, _actor uuid, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hp jsonb := private.ao_home_program(_property); prog uuid; r record; counts jsonb := '{}'::jsonb; opened int := 0;
BEGIN
  IF hp ? 'reason' THEN RAISE EXCEPTION '%', hp ->> 'reason'; END IF;
  prog := (hp ->> 'program_id')::uuid;
  INSERT INTO public.ao_home_plan_settings(property_id, automated, updated_by, updated_at) VALUES (_property, true, _actor, now())
    ON CONFLICT (property_id) DO UPDATE SET automated = true, updated_by = _actor, updated_at = now();
  INSERT INTO public.ao_home_plan_settings_history(property_id, automated, changed_by) VALUES (_property, true, _actor);
  PERFORM set_config('app.ao_engine', 'on', true);               -- the plan's own card items pass the duplicate guard
  PERFORM set_config('resolve.owner_release_batch', 'on', true); -- no single owner email per card
  FOR r IN SELECT * FROM private.ao_plan_outcomes(_property, _covered_card_ids) LOOP
    CONTINUE WHEN r.outcome = 'already_on_plan';
    PERFORM private.ao_add_plan_card(_property, prog, r.card_id, r.outcome, r.task_id, r.coverage, _actor);
    IF r.outcome = 'open' THEN opened := opened + 1; END IF;
    counts := jsonb_set(counts, ARRAY[r.outcome], to_jsonb(coalesce((counts ->> r.outcome)::int, 0) + 1));
  END LOOP;
  PERFORM set_config('resolve.owner_release_batch', 'off', true);
  PERFORM set_config('app.ao_engine', '', true);
  RETURN jsonb_build_object('program_id', prog, 'stage', private.ao_home_stage(_property), 'outcomes', counts, 'open', opened);
END $$;
REVOKE ALL ON FUNCTION private.ao_start_home_plan(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- Fix 3: minimal email
-- Which owner got an Active Owner email on which Central day: at most one row, so at most one email.
CREATE TABLE public.ao_owner_email_days (
  owner_key uuid NOT NULL,
  day date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('plan_ready', 'daily', 'home_live')),
  notification_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_key, day)
);
GRANT SELECT ON public.ao_owner_email_days TO authenticated;
GRANT ALL ON public.ao_owner_email_days TO service_role;
ALTER TABLE public.ao_owner_email_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY ao_email_days_staff_read ON public.ao_owner_email_days FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

-- The count and homes behind one plan is ready notification (merged while it waits for the next run).
CREATE TABLE public.ao_plan_ready_notices (
  notification_id uuid PRIMARY KEY REFERENCES public.owner_notifications(id) ON DELETE CASCADE,
  program_id uuid NOT NULL,
  property_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  open_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ao_plan_ready_notices TO authenticated;
GRANT ALL ON public.ao_plan_ready_notices TO service_role;
ALTER TABLE public.ao_plan_ready_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY ao_ready_notices_staff_read ON public.ao_plan_ready_notices FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

-- Which held notifications went out inside which daily email.
CREATE TABLE public.ao_daily_email_items (
  notification_id uuid PRIMARY KEY REFERENCES public.owner_notifications(id) ON DELETE CASCADE,
  daily_notification_id uuid NOT NULL REFERENCES public.owner_notifications(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ao_daily_email_items TO authenticated;
GRANT ALL ON public.ao_daily_email_items TO service_role;
ALTER TABLE public.ao_daily_email_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY ao_daily_items_staff_read ON public.ao_daily_email_items FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

-- A card that opens later, and the one reminder, still show in the portal at once; their email is held
-- ('held') for the 9 AM email instead of going out alone. Runs before the demo guard, which still wins.
CREATE OR REPLACE FUNCTION private.ao_hold_card_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_status = 'pending' AND NEW.kind = 'review_ready' AND NEW.review_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.ao_home_plan_cards pc WHERE pc.owner_review_id = NEW.review_id) THEN
    NEW.email_status := CASE WHEN coalesce((SELECT notify_email FROM public.owner_programs WHERE id = NEW.program_id), false)
                             THEN 'held' ELSE 'skipped' END;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.ao_hold_card_email() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ao_hold_card_email BEFORE INSERT ON public.owner_notifications
  FOR EACH ROW EXECUTE FUNCTION private.ao_hold_card_email();

-- The 9 AM time (Central), a setting only Admin changes (app_settings is Admin write only).
CREATE OR REPLACE FUNCTION private.ao_digest_time()
RETURNS time LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT (value ->> 'time')::time FROM public.app_settings WHERE key = 'owner_digest_time'), time '09:00')
$$;
REVOKE ALL ON FUNCTION private.ao_digest_time() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_owner_digest_time(_time text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE before jsonb; t time;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can change the daily homeowner email time.' USING ERRCODE = '42501';
  END IF;
  BEGIN t := _time::time; EXCEPTION WHEN others THEN RAISE EXCEPTION 'Choose a time like 9:00.'; END;
  SELECT value INTO before FROM public.app_settings WHERE key = 'owner_digest_time';
  INSERT INTO public.app_settings(key, value) VALUES ('owner_digest_time', jsonb_build_object('time', to_char(t, 'HH24:MI'), 'timezone', 'America/Chicago'))
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_label, before_value, after_value)
    VALUES (auth.uid(), 'settings.updated', 'app_settings', 'owner_digest_time', before,
            jsonb_build_object('time', to_char(t, 'HH24:MI'), 'timezone', 'America/Chicago'));
  RETURN to_char(t, 'HH24:MI');
END $$;
REVOKE ALL ON FUNCTION public.set_owner_digest_time(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_owner_digest_time(text) TO authenticated, service_role;

-- One plan is ready notification per owner. Starting more homes before it goes out adds to the same one.
CREATE OR REPLACE FUNCTION private.ao_plan_ready_notice(_program uuid, _property_ids uuid[], _open integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prog public.owner_programs; nid uuid; homes uuid[]; total int; names text[]; label text;
BEGIN
  IF coalesce(_open, 0) <= 0 THEN RETURN NULL; END IF;
  SELECT * INTO prog FROM public.owner_programs WHERE id = _program;
  IF NOT FOUND OR prog.is_demo OR prog.owner_user_id IS NULL THEN RETURN NULL; END IF;
  SELECT n.id, x.property_ids, x.open_count INTO nid, homes, total
    FROM public.owner_notifications n JOIN public.ao_plan_ready_notices x ON x.notification_id = n.id
   WHERE n.program_id = _program AND n.kind = 'ao_plan_ready' AND n.email_status IN ('held', 'skipped') AND n.delivered_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.ao_owner_email_days d WHERE d.notification_id = n.id)
   ORDER BY n.created_at DESC LIMIT 1 FOR UPDATE OF n;
  homes := (SELECT array_agg(DISTINCT h ORDER BY h) FROM unnest(coalesce(homes, ARRAY[]::uuid[]) || _property_ids) h);
  total := coalesce(total, 0) + _open;
  SELECT array_agg(public.format_property_label(to_jsonb(h)) ->> 'primary' ORDER BY h.name) INTO names
    FROM public.properties h WHERE h.id = ANY (homes);
  label := CASE WHEN coalesce(array_length(names, 1), 0) = 0 THEN 'your home'
                WHEN array_length(names, 1) = 1 THEN names[1]
                ELSE array_to_string(names[1:array_length(names, 1) - 1], ', ') || ' and ' || names[array_length(names, 1)] END;
  IF nid IS NULL THEN
    INSERT INTO public.owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, sms_status)
    VALUES (prog.id, prog.owner_user_id, 'ao_plan_ready', 'p3', 'Your homeowner plan is ready',
      format('We added %s %s to your portal for %s. Open your portal to see what''s next.', total, CASE WHEN total = 1 THEN 'activity' ELSE 'activities' END, label),
      '/owner', CASE WHEN prog.notify_email THEN 'held' ELSE 'skipped' END, 'skipped')
    RETURNING id INTO nid;
    INSERT INTO public.ao_plan_ready_notices(notification_id, program_id, property_ids, open_count) VALUES (nid, prog.id, homes, total);
  ELSE
    UPDATE public.owner_notifications SET
      body = format('We added %s %s to your portal for %s. Open your portal to see what''s next.', total, CASE WHEN total = 1 THEN 'activity' ELSE 'activities' END, label)
     WHERE id = nid;
    UPDATE public.ao_plan_ready_notices SET property_ids = homes, open_count = total WHERE notification_id = nid;
  END IF;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION private.ao_plan_ready_notice(uuid, uuid[], integer) FROM PUBLIC, anon, authenticated;

-- An Active Owner email that goes at once when the owner has had none today (Fix 6 handoff email);
-- otherwise it waits for the next 9 AM email. Never more than one a day.
CREATE OR REPLACE FUNCTION private.ao_owner_email_now(_program uuid, _kind text, _title text, _body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prog public.owner_programs; nid uuid; got int; today date := (now() AT TIME ZONE 'America/Chicago')::date;
BEGIN
  SELECT * INTO prog FROM public.owner_programs WHERE id = _program;
  IF NOT FOUND OR prog.is_demo OR prog.owner_user_id IS NULL THEN RETURN NULL; END IF;
  nid := gen_random_uuid();
  got := 0;
  IF prog.notify_email THEN
    INSERT INTO public.ao_owner_email_days(owner_key, day, kind, notification_id)
      VALUES (prog.owner_user_id, today, CASE _kind WHEN 'ao_home_live' THEN 'home_live' WHEN 'ao_plan_ready' THEN 'plan_ready' ELSE 'daily' END, nid)
      ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS got = ROW_COUNT;
  END IF;
  INSERT INTO public.owner_notifications(id, program_id, owner_user_id, kind, priority, title, body, action_path, email_status, sms_status)
  VALUES (nid, prog.id, prog.owner_user_id, _kind, 'p3', _title, _body, '/owner',
          CASE WHEN NOT prog.notify_email THEN 'skipped' WHEN got = 1 THEN 'pending' ELSE 'held' END, 'skipped');
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION private.ao_owner_email_now(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- The five minute job step (before owner delivery): sends waiting plan is ready emails, then at the
-- daily time (default 9:00 AM Central) one email per owner listing everything held before that time,
-- grouped by home. Never two Active Owner emails for one owner on one day.
CREATE OR REPLACE FUNCTION public.ao_owner_email_run(_now timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n record; o record; got int; ready int := 0; daily int := 0; waiting int := 0;
  today date := (_now AT TIME ZONE 'America/Chicago')::date;
  cutoff timestamptz := (today + private.ao_digest_time()) AT TIME ZONE 'America/Chicago';
  body text; nid uuid; prog public.owner_programs;
BEGIN
  -- 1. Plan is ready: goes on the next run unless the owner already had an Active Owner email today.
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
  -- 2. The daily email, only from the daily time on, for items held before that time.
  IF _now >= cutoff THEN
    FOR o IN SELECT x.program_id, coalesce(x.owner_user_id, x.program_id) AS owner_key, min(x.owner_user_id::text)::uuid AS owner_user_id
              FROM public.owner_notifications x
             WHERE x.email_status = 'held' AND NOT x.is_demo AND x.created_at < cutoff
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
                        WHEN x.title LIKE 'Reminder:%' THEN coalesce(r.title, 'An activity') || ' closes soon'
                        ELSE coalesce(r.title, 'An activity') || ' is ready' END AS line
              FROM public.owner_notifications x LEFT JOIN public.owner_reviews r ON r.id = x.review_id
             WHERE x.program_id = o.program_id AND x.email_status = 'held' AND NOT x.is_demo AND x.created_at < cutoff
          ) items GROUP BY 1) blocks;
      INSERT INTO public.owner_notifications(id, program_id, owner_user_id, kind, priority, title, body, action_path, email_status, sms_status, read_at)
      VALUES (nid, o.program_id, prog.owner_user_id, 'ao_daily', 'p3', 'Your homeowner plan today', body, '/owner', 'pending', 'skipped', now());
      INSERT INTO public.ao_daily_email_items(notification_id, daily_notification_id)
        SELECT x.id, nid FROM public.owner_notifications x
         WHERE x.program_id = o.program_id AND x.email_status = 'held' AND NOT x.is_demo AND x.created_at < cutoff;
      UPDATE public.owner_notifications SET email_status = 'in_daily_email'
       WHERE id IN (SELECT notification_id FROM public.ao_daily_email_items WHERE daily_notification_id = nid);
      daily := daily + 1;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('plan_ready_sent', ready, 'plan_ready_waiting', waiting, 'daily_sent', daily);
END $$;
REVOKE ALL ON FUNCTION public.ao_owner_email_run(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ao_owner_email_run(timestamptz) TO service_role;

-- ---------------------------------------------------------------- Fix 2 and 3: the switch and its preview
CREATE OR REPLACE FUNCTION public.ao_set_home_automation(_property uuid, _on boolean, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r jsonb;
BEGIN
  IF NOT private.ao_is_editor(uid) THEN RAISE EXCEPTION 'Only Admin or Onboarding Director can change the automated plan' USING ERRCODE = '42501'; END IF;
  IF NOT _on THEN
    INSERT INTO public.ao_home_plan_settings(property_id, automated, updated_by, updated_at) VALUES (_property, false, uid, now())
      ON CONFLICT (property_id) DO UPDATE SET automated = false, updated_by = uid, updated_at = now();
    INSERT INTO public.ao_home_plan_settings_history(property_id, automated, changed_by) VALUES (_property, false, uid);
    RETURN jsonb_build_object('automated', false); -- OFF never edits or deletes existing items
  END IF;
  r := private.ao_start_home_plan(_property, uid, _covered_card_ids);
  PERFORM private.ao_plan_ready_notice((r ->> 'program_id')::uuid, ARRAY[_property], (r ->> 'open')::int);
  RETURN jsonb_build_object('automated', true, 'stage', r ->> 'stage', 'outcomes', r -> 'outcomes');
END $$;

CREATE OR REPLACE FUNCTION public.ao_preview_home_automation(_property uuid, _covered_card_ids uuid[] DEFAULT ARRAY[]::uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); hp jsonb; r record; counts jsonb := '{}'::jsonb; already int := 0; covered jsonb := '[]'::jsonb;
BEGIN
  IF NOT private.ao_is_editor(uid) THEN RAISE EXCEPTION 'Only Admin or Onboarding Director can preview the automated plan' USING ERRCODE = '42501'; END IF;
  hp := private.ao_home_program(_property);
  IF hp ? 'reason' THEN RETURN jsonb_build_object('ready', false, 'reason', hp ->> 'reason'); END IF;
  FOR r IN SELECT o.*, c.title FROM private.ao_plan_outcomes(_property, _covered_card_ids) o JOIN public.ao_library_cards c ON c.id = o.card_id LOOP
    IF r.outcome = 'already_on_plan' THEN already := already + 1; CONTINUE; END IF;
    IF r.outcome = 'already_covered' THEN covered := covered || jsonb_build_array(r.coverage || jsonb_build_object('code', r.code, 'title', r.title)); END IF;
    counts := jsonb_set(counts, ARRAY[r.outcome], to_jsonb(coalesce((counts ->> r.outcome)::int, 0) + 1));
  END LOOP;
  RETURN jsonb_build_object('ready', true, 'stage', private.ao_home_stage(_property), 'outcomes', counts, 'already_on_plan', already, 'covered', covered);
END $$;

-- ---------------------------------------------------------------- Fix 4: start at enrollment, the label
ALTER TABLE public.property_labels ADD COLUMN IF NOT EXISTS system_key text;
CREATE UNIQUE INDEX IF NOT EXISTS property_labels_system_key ON public.property_labels (system_key) WHERE system_key IS NOT NULL;
COMMENT ON COLUMN public.property_labels.system_key IS 'Set for a label Resolve adds and removes by itself (active_owner). Staff cannot add, remove, rename or retire it.';

-- The Active Owner label follows the home's program: on while the home is included in a live program.
CREATE OR REPLACE FUNCTION private.ao_label_sync(_property uuid, _actor uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE lbl public.property_labels; should boolean; live uuid; who text;
BEGIN
  SELECT * INTO lbl FROM public.property_labels WHERE system_key = 'active_owner' AND retired_at IS NULL;
  IF NOT FOUND THEN RETURN 'no_label'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.owner_program_properties e JOIN public.owner_programs p ON p.id = e.program_id
                  JOIN public.properties h ON h.id = e.property_id
                 WHERE e.property_id = _property AND e.inclusion_status = 'included' AND e.archived_at IS NULL
                   AND p.status = 'active' AND p.archived_at IS NULL AND NOT p.is_demo AND NOT h.is_demo) INTO should;
  SELECT id INTO live FROM public.property_label_assignments WHERE property_id = _property AND label_id = lbl.id AND removed_at IS NULL;
  who := CASE WHEN _actor IS NULL THEN 'Resolve' ELSE coalesce(private.actor_label(_actor), 'Resolve') END;
  PERFORM set_config('app.system_label', 'on', true);
  IF should AND live IS NULL THEN
    INSERT INTO public.property_label_assignments(property_id, label_id, added_by) VALUES (_property, lbl.id, _actor);
    INSERT INTO public.property_label_events(label_id, property_id, action, to_name, actor_id, actor_label)
      VALUES (lbl.id, _property, 'added', lbl.name, _actor, who);
    INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_id, entity_label, reason)
      VALUES (_actor, who, 'label_added', 'property', _property, lbl.name, 'Active Owner enrollment');
    PERFORM set_config('app.system_label', '', true);
    RETURN 'added';
  ELSIF NOT should AND live IS NOT NULL THEN
    UPDATE public.property_label_assignments SET removed_at = now(), removed_by = _actor WHERE id = live;
    INSERT INTO public.property_label_events(label_id, property_id, action, from_name, actor_id, actor_label)
      VALUES (lbl.id, _property, 'removed', lbl.name, _actor, who);
    INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_id, entity_label, reason)
      VALUES (_actor, who, 'label_removed', 'property', _property, lbl.name, 'Left the Active Owner program');
    PERFORM set_config('app.system_label', '', true);
    RETURN 'removed';
  END IF;
  PERFORM set_config('app.system_label', '', true);
  RETURN 'unchanged';
END $$;
REVOKE ALL ON FUNCTION private.ao_label_sync(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Staff cannot put the label on, take it off, rename or retire it by hand.
CREATE OR REPLACE FUNCTION private.guard_system_label()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.system_label', true), '') = 'on' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'property_label_assignments' THEN
    IF EXISTS (SELECT 1 FROM public.property_labels l WHERE l.id = NEW.label_id AND l.system_key IS NOT NULL) THEN
      RAISE EXCEPTION 'The Active Owner label follows the home''s homeowner program. It cannot be added or removed by hand.';
    END IF;
  ELSIF OLD.system_key IS NOT NULL AND (NEW.name IS DISTINCT FROM OLD.name OR NEW.retired_at IS DISTINCT FROM OLD.retired_at
                                        OR NEW.system_key IS DISTINCT FROM OLD.system_key) THEN
    RAISE EXCEPTION 'The Active Owner label follows the home''s homeowner program. It cannot be renamed or removed.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_system_label() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_system_label BEFORE INSERT OR UPDATE ON public.property_label_assignments
  FOR EACH ROW EXECUTE FUNCTION private.guard_system_label();
CREATE TRIGGER guard_system_label BEFORE UPDATE ON public.property_labels
  FOR EACH ROW EXECUTE FUNCTION private.guard_system_label();

-- A new enrollment in a live program starts the home's plan (once: a home with any plan setting,
-- on or off, is left to the switch) and keeps the label in step. A home that cannot start is
-- recorded and left for Admin; the enrollment itself is never refused because of the plan.
CREATE OR REPLACE FUNCTION private.ao_start_on_enrollment(_property uuid, _actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hp jsonb; r jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ao_home_plan_settings WHERE property_id = _property) THEN RETURN NULL; END IF;
  IF coalesce((SELECT is_demo FROM public.properties WHERE id = _property), true) THEN RETURN NULL; END IF;
  hp := private.ao_home_program(_property);
  IF hp ? 'reason' THEN
    INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, reason)
      VALUES (_actor, 'ao_plan_not_started', 'property', _property, 'Automated homeowner plan', hp ->> 'reason');
    RETURN hp;
  END IF;
  r := private.ao_start_home_plan(_property, _actor);
  PERFORM private.ao_plan_ready_notice((r ->> 'program_id')::uuid, ARRAY[_property], (r ->> 'open')::int);
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION private.ao_start_on_enrollment(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.ao_enrollment_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prog public.owner_programs; h uuid;
BEGIN
  IF TG_TABLE_NAME = 'owner_program_properties' THEN
    PERFORM private.ao_label_sync(NEW.property_id, auth.uid());
    IF NEW.inclusion_status = 'included' AND NEW.archived_at IS NULL AND NOT NEW.is_demo
       AND (TG_OP = 'INSERT' OR OLD.inclusion_status IS DISTINCT FROM 'included' OR OLD.archived_at IS NOT NULL) THEN
      SELECT * INTO prog FROM public.owner_programs WHERE id = NEW.program_id;
      IF prog.status = 'active' AND prog.archived_at IS NULL AND NOT prog.is_demo THEN
        PERFORM private.ao_start_on_enrollment(NEW.property_id, auth.uid());
      END IF;
    END IF;
  ELSE
    FOR h IN SELECT DISTINCT property_id FROM public.owner_program_properties WHERE program_id = NEW.id LOOP
      PERFORM private.ao_label_sync(h, auth.uid());
    END LOOP;
    -- A program that becomes active for the first time starts its included homes.
    IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' AND OLD.status IS DISTINCT FROM 'closed'
       AND NEW.archived_at IS NULL AND NOT NEW.is_demo THEN
      FOR h IN SELECT property_id FROM public.owner_program_properties
                WHERE program_id = NEW.id AND inclusion_status = 'included' AND archived_at IS NULL ORDER BY property_id LOOP
        PERFORM private.ao_start_on_enrollment(h, auth.uid());
      END LOOP;
    END IF;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.ao_enrollment_changed() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ao_enrollment_changed AFTER INSERT OR UPDATE OF inclusion_status, archived_at ON public.owner_program_properties
  FOR EACH ROW EXECUTE FUNCTION private.ao_enrollment_changed();
CREATE TRIGGER ao_program_changed AFTER UPDATE OF status, archived_at ON public.owner_programs
  FOR EACH ROW EXECUTE FUNCTION private.ao_enrollment_changed();

-- Start plans for enrolled homes (Admin): the preview writes nothing; the turn on runs every listed
-- home in one step, all or none, and each owner gets one plan is ready email.
CREATE OR REPLACE FUNCTION private.ao_enrolled_rows()
RETURNS TABLE(property_id uuid, home text, program_id uuid, stage text, open int, locked int, already_covered int, skipped int, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE hid uuid; hp jsonb;
BEGIN
  FOR hid IN
    SELECT DISTINCT x.pid FROM (
      SELECT e.property_id AS pid FROM public.owner_program_properties e JOIN public.owner_programs p ON p.id = e.program_id
       WHERE e.inclusion_status = 'included' AND e.archived_at IS NULL AND p.status = 'active' AND p.archived_at IS NULL AND NOT p.is_demo
      UNION SELECT p.property_id FROM public.owner_programs p WHERE p.status = 'active' AND p.archived_at IS NULL AND NOT p.is_demo AND p.property_id IS NOT NULL
    ) x JOIN public.properties h ON h.id = x.pid
    WHERE NOT h.is_demo AND h.archived_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.ao_home_plan_settings s WHERE s.property_id = x.pid)
  LOOP
    property_id := hid;
    SELECT public.format_property_label(to_jsonb(h)) ->> 'primary' INTO home FROM public.properties h WHERE h.id = hid;
    stage := private.ao_home_stage(hid);
    hp := private.ao_home_program(hid);
    IF hp ? 'reason' THEN
      program_id := NULL; open := NULL; locked := NULL; already_covered := NULL; skipped := NULL; reason := hp ->> 'reason';
    ELSE
      program_id := (hp ->> 'program_id')::uuid; reason := NULL;
      SELECT count(*) FILTER (WHERE o.outcome = 'open'), count(*) FILTER (WHERE o.outcome = 'locked'),
             count(*) FILTER (WHERE o.outcome = 'already_covered'), count(*) FILTER (WHERE o.outcome = 'skipped_passed')
        INTO open, locked, already_covered, skipped FROM private.ao_plan_outcomes(hid) o;
    END IF;
    RETURN NEXT;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.ao_enrolled_rows() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ao_preview_enrolled_homes()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE rows jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can start plans for enrolled homes.' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.home), '[]'::jsonb) INTO rows FROM private.ao_enrolled_rows() r;
  RETURN jsonb_build_object('homes', rows, 'blocked', EXISTS (SELECT 1 FROM jsonb_array_elements(rows) x WHERE x ->> 'reason' IS NOT NULL),
    'token', md5(rows::text));
END $$;
REVOKE ALL ON FUNCTION public.ao_preview_enrolled_homes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ao_preview_enrolled_homes() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ao_start_enrolled_homes(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); rows jsonb; x jsonb; r jsonb; started int := 0; prog record; acc jsonb := '[]'::jsonb;
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can start plans for enrolled homes.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ao_start_enrolled_homes'));
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.home), '[]'::jsonb) INTO rows FROM private.ao_enrolled_rows() q;
  IF md5(rows::text) IS DISTINCT FROM _token THEN RAISE EXCEPTION 'The list changed. Preview again.'; END IF;
  SELECT x2 INTO x FROM jsonb_array_elements(rows) x2 WHERE x2 ->> 'reason' IS NOT NULL LIMIT 1;
  IF x IS NOT NULL THEN RAISE EXCEPTION '% cannot start: %', x ->> 'home', x ->> 'reason'; END IF;
  IF jsonb_array_length(rows) = 0 THEN RETURN jsonb_build_object('started', 0); END IF;
  FOR x IN SELECT * FROM jsonb_array_elements(rows) LOOP
    r := private.ao_start_home_plan((x ->> 'property_id')::uuid, uid);
    acc := acc || jsonb_build_array(jsonb_build_object('program_id', r ->> 'program_id', 'property_id', x ->> 'property_id', 'open', (r ->> 'open')::int));
    started := started + 1;
  END LOOP;
  -- One plan is ready email per owner, covering every home started now.
  FOR prog IN SELECT (e ->> 'program_id')::uuid AS program_id, array_agg((e ->> 'property_id')::uuid ORDER BY e ->> 'property_id') AS homes,
                     sum((e ->> 'open')::int)::int AS opened
                FROM jsonb_array_elements(acc) e GROUP BY 1 LOOP
    PERFORM private.ao_plan_ready_notice(prog.program_id, prog.homes, prog.opened);
  END LOOP;
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_label, after_value)
    VALUES (uid, 'ao_start_enrolled_homes', 'ao_home_plan_settings', 'Start plans for enrolled homes', rows);
  RETURN jsonb_build_object('started', started);
END $$;
REVOKE ALL ON FUNCTION public.ao_start_enrolled_homes(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ao_start_enrolled_homes(text) TO authenticated, service_role;

-- ---------------------------------------------------------------- Fix 6: handoff and operations cards
-- When a home's handoff is accepted and its plan is on: A33 and N10 open with no lock; the other
-- released operations cards not on the plan are added (A35 and A14 are left as they are, they wait for
-- the Breezeway bridge); onboarding cards the owner has not finished stay open with their own
-- deadlines. One email: "Your home is live: new activities are in your portal.", sent at once and
-- counted under the one a day rule.
CREATE OR REPLACE FUNCTION private.ao_on_handoff(_property uuid, _actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hp jsonb; prog uuid; pc public.ao_home_plan_cards; c public.ao_library_cards; r record; opened int := 0; added int := 0; cov jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ao_home_plan_settings WHERE property_id = _property AND automated) THEN RETURN NULL; END IF;
  hp := private.ao_home_program(_property);
  IF hp ? 'reason' THEN RETURN hp; END IF;
  prog := (hp ->> 'program_id')::uuid;
  PERFORM set_config('app.ao_engine', 'on', true);
  PERFORM set_config('resolve.owner_release_batch', 'on', true);
  FOR c IN SELECT * FROM public.ao_library_cards WHERE status = 'released' AND code IN ('A33', 'N10') ORDER BY code LOOP
    SELECT * INTO pc FROM public.ao_home_plan_cards WHERE property_id = _property AND card_id = c.id;
    IF FOUND THEN
      IF pc.join_outcome = 'locked' AND pc.unlocked_at IS NULL AND private.ao_unlock(pc.id, _actor) THEN opened := opened + 1; END IF;
    ELSE
      cov := private.ao_card_coverage(_property, c.code, NULL);
      PERFORM private.ao_add_plan_card(_property, prog, c.id, CASE WHEN cov IS NULL THEN 'open' ELSE 'already_covered' END, NULL, cov, _actor);
      IF cov IS NULL THEN opened := opened + 1; END IF;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM private.ao_plan_outcomes(_property) o
            WHERE o.stage_window = 'operations' AND o.code NOT IN ('A35', 'A14', 'A33', 'N10') AND o.outcome <> 'already_on_plan' LOOP
    PERFORM private.ao_add_plan_card(_property, prog, r.card_id, r.outcome, r.task_id, r.coverage, _actor);
    IF r.outcome = 'open' THEN added := added + 1; END IF;
  END LOOP;
  PERFORM set_config('resolve.owner_release_batch', 'off', true);
  PERFORM set_config('app.ao_engine', '', true);
  IF opened + added > 0 THEN
    PERFORM private.ao_owner_email_now(prog, 'ao_home_live', 'Your home is live: new activities are in your portal.',
      'Open your portal to see what''s next.');
  END IF;
  RETURN jsonb_build_object('opened', opened, 'added', added);
END $$;
REVOKE ALL ON FUNCTION private.ao_on_handoff(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.ao_handoff_accepted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.handoff_state = 'accepted' AND OLD.handoff_state IS DISTINCT FROM 'accepted' THEN
    PERFORM private.ao_on_handoff(NEW.property_id, auth.uid());
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.ao_handoff_accepted() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ao_handoff_accepted AFTER UPDATE OF handoff_state ON public.onboarding_projects
  FOR EACH ROW EXECUTE FUNCTION private.ao_handoff_accepted();

-- ---------------------------------------------------------------- Fix 7: send to the owner, then talk it through
-- The send is the Task's evidence: which owner item a Task was sent as, by whom and when.
CREATE TABLE public.owner_item_task_sends (
  review_id uuid PRIMARY KEY REFERENCES public.owner_reviews(id),
  task_id uuid NOT NULL REFERENCES public.onboarding_tasks(id),
  property_id uuid NOT NULL,
  program_id uuid NOT NULL,
  sent_by uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  note text NOT NULL,
  is_demo boolean NOT NULL DEFAULT false
);
CREATE INDEX owner_item_task_sends_task ON public.owner_item_task_sends(task_id);
GRANT SELECT ON public.owner_item_task_sends TO authenticated;
GRANT ALL ON public.owner_item_task_sends TO service_role;
ALTER TABLE public.owner_item_task_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_item_task_sends_staff_read ON public.owner_item_task_sends FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE OR REPLACE FUNCTION private.task_sent_to_owner(_task uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.owner_item_task_sends WHERE task_id = _task)
$$;
REVOKE ALL ON FUNCTION private.task_sent_to_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.task_sent_to_owner(uuid) TO authenticated, service_role;

-- A Task sent to the owner as an owner item is complete; the owner's answer lives on the item.
CREATE OR REPLACE FUNCTION public.owner_business_decision_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE approval_required boolean;
BEGIN
  approval_required:=NEW.owner_dependency='business_decision' OR coalesce(NEW.requires_owner_approval,false);
  IF TG_TABLE_NAME='onboarding_template_tasks' THEN
    -- Existing mismatches are not silently repaired by unrelated saves.
    IF NEW.owner_dependency='business_decision' AND NOT coalesce(NEW.requires_owner_approval,false) THEN
      IF TG_OP='INSERT' THEN
        RAISE EXCEPTION 'A business decision requires homeowner approval. Turn on Requires owner approval.';
      ELSIF NEW.owner_dependency IS DISTINCT FROM OLD.owner_dependency OR NEW.requires_owner_approval IS DISTINCT FROM OLD.requires_owner_approval THEN
        RAISE EXCEPTION 'A business decision requires homeowner approval. Turn on Requires owner approval.';
      END IF;
    END IF;
  ELSIF NEW.status IN ('complete','done') AND approval_required AND NEW.owner_approval_status IS DISTINCT FROM 'approved'
        AND NOT private.task_sent_to_owner(NEW.id) THEN
    IF TG_OP='INSERT' THEN
      RAISE EXCEPTION 'A homeowner decision is required before this Task can be completed.';
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'A homeowner decision is required before this Task can be completed.';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- Send to the owner: one owner item in the owner's portal (the Task's shared files show with it),
-- the send recorded as the Task's evidence, and the Task completed. A home with no single live
-- program answers sent=false so the screen keeps the earlier path.
CREATE OR REPLACE FUNCTION public.send_task_to_owner_item(_task_id uuid, _note text, _respond_by date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE uid uuid := auth.uid(); t public.onboarding_tasks; pr public.onboarding_projects; hp jsonb; prog uuid;
  rid uuid; slot uuid; today date := (now() AT TIME ZONE 'America/Chicago')::date;
BEGIN
  SELECT * INTO t FROM public.onboarding_tasks WHERE id = _task_id AND archived_at IS NULL FOR UPDATE;
  IF uid IS NULL OR t.id IS NULL OR NOT coalesce(private.is_onboarding_staff(uid), false) THEN RAISE EXCEPTION 'That task is not available.'; END IF;
  IF coalesce(private.is_synthetic_account(), false) AND NOT coalesce(t.is_demo, false) THEN RAISE EXCEPTION 'That task is not available.'; END IF;
  SELECT * INTO pr FROM public.onboarding_projects WHERE property_id = t.property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1;
  IF NOT (coalesce(private.is_onboarding_leader(uid), false) OR t.assigned_to = uid OR pr.project_manager = uid OR pr.director = uid) THEN
    RAISE EXCEPTION 'Only the person on this task or the home''s project lead can send it.';
  END IF;
  IF t.status = 'complete' THEN RAISE EXCEPTION 'This task is already complete.'; END IF;
  IF private.onboarding_work_locked(ARRAY[t.property_id]) THEN
    RAISE EXCEPTION 'Return the handoff before changing its onboarding work; accepted work is retained in history.';
  END IF;
  IF length(btrim(coalesce(_note, ''))) < 5 OR length(_note) > 2000 THEN RAISE EXCEPTION 'Write what you are asking the homeowner, at least a sentence.'; END IF;
  IF _respond_by IS NOT NULL AND _respond_by < today THEN RAISE EXCEPTION 'Choose an answer by date of today or later.'; END IF;
  hp := private.ao_home_program(t.property_id);
  IF hp ? 'reason' THEN RETURN jsonb_build_object('sent', false, 'reason', hp ->> 'reason'); END IF;
  prog := (hp ->> 'program_id')::uuid;
  SELECT id INTO slot FROM public.owner_reviews WHERE onboarding_task_id = t.id;
  INSERT INTO public.owner_reviews(program_id, property_id, phase, stage, title, recommendation, status, source_type,
    owner_action_type, onboarding_task_id, respond_by, available_from, is_demo, created_by, task_type)
  VALUES (prog, t.property_id, 'onboarding', 'onboarding', left(t.title, 200), btrim(_note), 'awaiting_owner', 'onboarding',
    'review_comment', CASE WHEN slot IS NULL THEN t.id END, _respond_by, now(), coalesce(t.is_demo, false), uid, 'property')
  RETURNING id INTO rid;
  INSERT INTO public.owner_item_task_sends(review_id, task_id, property_id, program_id, sent_by, note, is_demo)
    VALUES (rid, t.id, t.property_id, prog, uid, btrim(_note), coalesce(t.is_demo, false));
  UPDATE public.onboarding_tasks SET status = 'complete', completed_at = now(), completed_by = uid,
    evidence_note = 'Sent to the homeowner in their portal: ' || left(btrim(_note), 300)
   WHERE id = t.id;
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
    VALUES (uid, 'owner_task_sent', 'onboarding_task', t.id, t.title,
            jsonb_build_object('ownerItem', rid, 'respondBy', _respond_by, 'taskCompleted', true));
  RETURN jsonb_build_object('sent', true, 'review_id', rid, 'completed', true);
END $$;
REVOKE ALL ON FUNCTION public.send_task_to_owner_item(uuid, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_task_to_owner_item(uuid, text, date) TO authenticated, service_role;

-- Who answers an owner item: the person on the Task it was sent from, else the Director of Onboarding.
CREATE OR REPLACE FUNCTION private.owner_item_answerer(_review_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT t.assigned_to FROM public.owner_item_task_sends s JOIN public.onboarding_tasks t ON t.id = s.task_id WHERE s.review_id = _review_id),
    (SELECT t.assigned_to FROM public.owner_reviews r JOIN public.onboarding_tasks t ON t.id = r.onboarding_task_id WHERE r.id = _review_id),
    public.seat_holder('onboarding_director'))
$$;
REVOKE ALL ON FUNCTION private.owner_item_answerer(uuid) FROM PUBLIC, anon, authenticated;

-- The owner reads the item's conversation (the earlier reader returned nothing to owners).
CREATE OR REPLACE FUNCTION public.owner_item_thread(_review_id uuid)
RETURNS SETOF public.owner_request_messages LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE r public.owner_reviews;
BEGIN
  SELECT * INTO r FROM public.owner_reviews WHERE id = _review_id AND archived_at IS NULL;
  IF auth.uid() IS NULL OR r.id IS NULL OR r.status = 'prepared'
     OR NOT (coalesce(private.is_program_member(r.program_id, auth.uid()), false) OR coalesce(private.is_staff(auth.uid()), false)) THEN
    RAISE EXCEPTION 'This activity is not available.';
  END IF;
  RETURN QUERY SELECT m.* FROM public.owner_request_messages m WHERE m.review_id = r.id ORDER BY m.created_at, m.id;
END $$;
REVOKE ALL ON FUNCTION public.owner_item_thread(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_item_thread(uuid) TO authenticated, service_role;

-- The owner writes back in the same item. A resolved item reopens. The person who answers is told in
-- Needs you now and by staff email.
CREATE OR REPLACE FUNCTION public.owner_item_reply(_review_id uuid, _body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.owner_item_reply(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_item_reply(uuid, text) TO authenticated, service_role;

-- Resolved closes the sent owner item (who and when are the event's author and time); reopened opens it.
CREATE OR REPLACE FUNCTION private.owner_item_event_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.review_id IS NULL OR coalesce(NEW.event, '') NOT IN ('resolved', 'reopened')
     OR NOT EXISTS (SELECT 1 FROM public.owner_item_task_sends s WHERE s.review_id = NEW.review_id) THEN
    RETURN NULL;
  END IF;
  PERFORM set_config('resolve.owner_release_batch', 'on', true); -- reopening never emails the owner
  UPDATE public.owner_reviews SET status = CASE WHEN NEW.event = 'resolved' THEN 'closed' ELSE 'awaiting_owner' END,
    closed_at = CASE WHEN NEW.event = 'resolved' THEN NEW.created_at END, updated_at = clock_timestamp()
   WHERE id = NEW.review_id;
  PERFORM set_config('resolve.owner_release_batch', 'off', true);
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
    VALUES (NEW.author_id, 'owner_item_' || NEW.event, 'owner_review', NEW.review_id, 'Owner item', jsonb_build_object('at', NEW.created_at));
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.owner_item_event_sync() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER owner_item_event_sync AFTER INSERT ON public.owner_request_messages
  FOR EACH ROW EXECUTE FUNCTION private.owner_item_event_sync();

-- Needs you now for the person who answers: the owner wrote back, or the answer by date passed with
-- no owner answer (one follow up row until the owner answers or the item is resolved).
CREATE OR REPLACE FUNCTION public.my_owner_item_needs()
RETURNS TABLE(review_id uuid, property_id uuid, task_id uuid, title text, why text, since timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  WITH items AS (
    SELECT r.id, r.property_id, s.task_id, r.title, r.respond_by, s.sent_at,
      (SELECT m.author_type FROM public.owner_request_messages m WHERE m.review_id = r.id AND m.event IS NULL ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_author,
      (SELECT m.created_at FROM public.owner_request_messages m WHERE m.review_id = r.id AND m.event IS NULL ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_at,
      EXISTS (SELECT 1 FROM public.owner_request_messages m WHERE m.review_id = r.id AND m.author_type = 'homeowner') AS owner_spoke
    FROM public.owner_item_task_sends s JOIN public.owner_reviews r ON r.id = s.review_id
    WHERE r.archived_at IS NULL AND r.status <> 'closed' AND private.owner_item_answerer(r.id) = auth.uid()
      AND (NOT coalesce(private.is_synthetic_account(), false) OR r.is_demo)
  )
  SELECT id, property_id, task_id, title,
         CASE WHEN last_author = 'homeowner' THEN 'The homeowner wrote back' ELSE 'No answer from the homeowner yet' END,
         CASE WHEN last_author = 'homeowner' THEN last_at ELSE (respond_by + 1)::timestamp AT TIME ZONE 'America/Chicago' END
  FROM items
  WHERE last_author = 'homeowner'
     OR (NOT owner_spoke AND respond_by IS NOT NULL AND respond_by < (now() AT TIME ZONE 'America/Chicago')::date)
  ORDER BY 6
$$;
REVOKE ALL ON FUNCTION public.my_owner_item_needs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_owner_item_needs() TO authenticated, service_role;
