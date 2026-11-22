-- Practice for owner-closing-updates on 3400 N Fern Avenue: apply.sql unchanged, two practice updates, Edit by the
-- home's Project Manager, Edit by a teammate who is not, Hold by the Director, Edit after Hold, a change to a final
-- update, a removal, then apply.undo.sql unchanged. Always rolls back.
CREATE TEMP TABLE _p(n serial, line text);
CREATE TEMP TABLE _b AS SELECT (SELECT count(*) FROM public.owner_notifications) AS notices, (SELECT count(*) FROM public.email_log) AS emails, (SELECT count(*) FROM public.staff_notifications) AS staff;
-- ===== apply.sql (unchanged) =====
-- owner-closing-updates (Nov 22): three templated owner updates after closing replace the Friday weekly update.
-- One transaction, additive. A new record of each home's three updates, its append-only history, two
-- caller-authenticated actions (Edit, Hold) and the test inbox setting. Nothing existing is changed: no Task,
-- card, owner item, notice, email, permission or existing weekly update row.
DO $guard$
BEGIN
  IF to_regclass('public.owner_closing_updates') IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'owner_update_test_inbox') THEN
    RAISE EXCEPTION 'owner-closing-updates: already applied';
  END IF;
END $guard$;

-- 1. One row per home per update (1, 2 or 3). Written by the five-minute job (service role) and the two
-- actions below. send_on and send_at follow the Resolve Closing Date; edited_subject and edited_body change
-- this send only. Sent, test sent, missed, failed and held updates are final.
CREATE TABLE public.owner_closing_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  update_no smallint NOT NULL CHECK (update_no IN (1, 2, 3)),
  closing_on date NOT NULL,
  send_on date NOT NULL,
  send_at timestamptz NOT NULL,
  time_zone text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'held', 'sending', 'sent', 'test_sent', 'missed', 'stopped', 'failed')),
  status_reason text,
  edited_subject text CHECK (edited_subject IS NULL OR length(btrim(edited_subject)) BETWEEN 3 AND 200),
  edited_body text CHECK (edited_body IS NULL OR length(btrim(edited_body)) BETWEEN 20 AND 8000),
  edited_by uuid,
  edited_at timestamptz,
  held_by uuid,
  held_at timestamptz,
  preview_notified_at timestamptz,
  channel text CHECK (channel IS NULL OR channel IN ('portal', 'email')),
  sent_subject text,
  sent_body text,
  sent_to text[],
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owner_closing_updates_once UNIQUE (property_id, update_no)
);
COMMENT ON TABLE public.owner_closing_updates IS
  'Owner updates 1-3 at Closing + 7, 14 and 21 days, 9:00 AM home time (Nov 22). Replaces the Friday weekly update. Edit and Hold only through edit_owner_closing_update and hold_owner_closing_update.';
CREATE INDEX owner_closing_updates_due ON public.owner_closing_updates (status, send_at);
GRANT SELECT ON public.owner_closing_updates TO authenticated;
GRANT ALL ON public.owner_closing_updates TO service_role;
ALTER TABLE public.owner_closing_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read owner updates" ON public.owner_closing_updates
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));

-- Final statuses never change; a send in progress only finishes; nothing is removed.
CREATE FUNCTION private.guard_owner_closing_update()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Owner updates are kept as history and cannot be removed.'; END IF;
  IF OLD.status IN ('sent', 'test_sent', 'missed', 'failed', 'held') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'This owner update is final (%).', OLD.status;
  END IF;
  IF OLD.status = 'sending' AND NEW.status NOT IN ('sending', 'sent', 'test_sent', 'failed') THEN
    RAISE EXCEPTION 'This owner update is being sent.';
  END IF;
  IF OLD.status IN ('sent', 'test_sent') AND (NEW.sent_subject IS DISTINCT FROM OLD.sent_subject
       OR NEW.sent_body IS DISTINCT FROM OLD.sent_body OR NEW.sent_at IS DISTINCT FROM OLD.sent_at) THEN
    RAISE EXCEPTION 'A sent owner update cannot be changed.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION private.guard_owner_closing_update() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER owner_closing_updates_guard BEFORE UPDATE OR DELETE ON public.owner_closing_updates
  FOR EACH ROW EXECUTE FUNCTION private.guard_owner_closing_update();

-- 2. History: scheduled, moved, stopped, preview sent, edited, held, sent, test sent, missed, failed.
CREATE TABLE public.owner_closing_update_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id uuid NOT NULL REFERENCES public.owner_closing_updates(id),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  action text NOT NULL CHECK (action IN ('scheduled', 'moved', 'stopped', 'preview_sent', 'edited', 'edit_cleared',
    'held', 'sent', 'test_sent', 'missed', 'failed')),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.owner_closing_update_events IS 'Append-only history of owner updates 1-3 (Nov 22).';
CREATE INDEX owner_closing_update_events_home ON public.owner_closing_update_events (property_id, created_at DESC);
GRANT SELECT ON public.owner_closing_update_events TO authenticated;
GRANT ALL ON public.owner_closing_update_events TO service_role;
ALTER TABLE public.owner_closing_update_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read owner update history" ON public.owner_closing_update_events
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE FUNCTION private.block_owner_closing_update_event_change()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  RAISE EXCEPTION 'Owner update history is kept and cannot be changed.';
END $function$;
REVOKE ALL ON FUNCTION private.block_owner_closing_update_event_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER owner_closing_update_events_append_only BEFORE UPDATE OR DELETE ON public.owner_closing_update_events
  FOR EACH ROW EXECUTE FUNCTION private.block_owner_closing_update_event_change();

-- 3. Who may Edit or Hold: the home's assigned Project Manager; the Director of Onboarding and Admin cover.
CREATE FUNCTION private.owner_update_editor(_property_id uuid, _me uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'private' AS $function$
  SELECT _me IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.onboarding_projects p WHERE p.property_id = _property_id AND p.status <> 'cancelled'
             AND p.project_manager = _me)
    OR public.is_onboarding_director(_me) OR private.has_role(_me, 'admin'));
$function$;
REVOKE ALL ON FUNCTION private.owner_update_editor(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Edit: changes this send only. Both blank puts the template back. Only before it sends.
CREATE FUNCTION public.edit_owner_closing_update(_id uuid, _subject text, _body text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _me uuid := auth.uid();
  _u public.owner_closing_updates;
  _clear boolean := nullif(btrim(coalesce(_subject, '')), '') IS NULL AND nullif(btrim(coalesce(_body, '')), '') IS NULL;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  SELECT * INTO _u FROM public.owner_closing_updates WHERE id = _id FOR UPDATE;
  IF _u.id IS NULL THEN RAISE EXCEPTION 'That owner update was not found.'; END IF;
  IF NOT private.owner_update_editor(_u.property_id, _me) THEN
    RAISE EXCEPTION 'Only this home''s Project Manager can change its owner updates.';
  END IF;
  IF _u.status <> 'scheduled' OR _u.send_at <= now() THEN RAISE EXCEPTION 'This update can no longer be changed.'; END IF;
  IF NOT _clear AND (length(btrim(coalesce(_subject, ''))) < 3 OR length(btrim(coalesce(_body, ''))) < 20) THEN
    RAISE EXCEPTION 'Add a subject and the message.';
  END IF;
  UPDATE public.owner_closing_updates
     SET edited_subject = CASE WHEN _clear THEN NULL ELSE btrim(_subject) END,
         edited_body = CASE WHEN _clear THEN NULL ELSE btrim(_body) END,
         edited_by = _me, edited_at = now()
   WHERE id = _id;
  INSERT INTO public.owner_closing_update_events(update_id, property_id, action, detail, actor_id)
  VALUES (_id, _u.property_id, CASE WHEN _clear THEN 'edit_cleared' ELSE 'edited' END,
          jsonb_build_object('update_no', _u.update_no, 'before_subject', _u.edited_subject, 'before_body', _u.edited_body), _me);
  RETURN jsonb_build_object('ok', true, 'cleared', _clear);
END $function$;
REVOKE ALL ON FUNCTION public.edit_owner_closing_update(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_owner_closing_update(uuid, text, text) TO authenticated;

-- Hold: skips this send. Final; the next update still sends on its own date.
CREATE FUNCTION public.hold_owner_closing_update(_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  _me uuid := auth.uid();
  _u public.owner_closing_updates;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  SELECT * INTO _u FROM public.owner_closing_updates WHERE id = _id FOR UPDATE;
  IF _u.id IS NULL THEN RAISE EXCEPTION 'That owner update was not found.'; END IF;
  IF NOT private.owner_update_editor(_u.property_id, _me) THEN
    RAISE EXCEPTION 'Only this home''s Project Manager can hold its owner updates.';
  END IF;
  IF _u.status = 'held' THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;
  IF _u.status <> 'scheduled' OR _u.send_at <= now() THEN RAISE EXCEPTION 'This update can no longer be held.'; END IF;
  UPDATE public.owner_closing_updates SET status = 'held', status_reason = 'Held by the Project Manager.', held_by = _me, held_at = now()
   WHERE id = _id;
  INSERT INTO public.owner_closing_update_events(update_id, property_id, action, detail, actor_id)
  VALUES (_id, _u.property_id, 'held', jsonb_build_object('update_no', _u.update_no, 'send_on', _u.send_on), _me);
  RETURN jsonb_build_object('ok', true, 'already', false);
END $function$;
REVOKE ALL ON FUNCTION public.hold_owner_closing_update(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hold_owner_closing_update(uuid) TO authenticated;

-- 4. While this is set, every owner update goes only to this address and never to an owner or the portal.
INSERT INTO public.app_settings(key, value) VALUES ('owner_update_test_inbox', '{"email": "emily.jimenez@arealhomeaway.com"}'::jsonb);

INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
VALUES (NULL, 'owner_closing_updates.apply', 'function', NULL, 'Owner updates after closing',
  jsonb_build_object('tables', jsonb_build_array('owner_closing_updates', 'owner_closing_update_events'),
    'functions', jsonb_build_array('edit_owner_closing_update', 'hold_owner_closing_update'), 'test_inbox', true));
-- ===== cases =====
SELECT set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
CREATE TEMP TABLE _u AS
WITH ins AS (
  INSERT INTO public.owner_closing_updates(property_id, update_no, closing_on, send_on, send_at, time_zone)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 1, current_date, current_date + 7, now() + interval '7 days', 'America/Chicago'),
         ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 2, current_date, current_date + 14, now() + interval '14 days', 'America/Chicago')
  RETURNING id, update_no)
SELECT * FROM ins;
CREATE FUNCTION pg_temp.edit(_who uuid, _no int, _s text, _b text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r jsonb; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _who, 'role', 'authenticated')::text, true);
  r := public.edit_owner_closing_update((SELECT id FROM _u WHERE update_no = _no), _s, _b);
  RETURN 'saved, cleared ' || (r->>'cleared');
EXCEPTION WHEN OTHERS THEN RETURN 'refused: ' || SQLERRM;
END $f$;
CREATE FUNCTION pg_temp.hold(_who uuid, _no int) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r jsonb; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _who, 'role', 'authenticated')::text, true);
  r := public.hold_owner_closing_update((SELECT id FROM _u WHERE update_no = _no));
  RETURN 'held, already ' || (r->>'already');
EXCEPTION WHEN OTHERS THEN RETURN 'refused: ' || SQLERRM;
END $f$;
INSERT INTO _p(line) SELECT 'Project Manager edits update 1: ' || pg_temp.edit('f2a762fa-f28b-4df3-8f33-a94461c6837f', 1, 'Quick update on 3400 N Fern Ave', 'Hi Rachel and Mike, a practice edit for this send only.');
INSERT INTO _p(line) SELECT 'Project Manager of other homes edits update 1: ' || pg_temp.edit('82bdbc3a-791c-433a-9944-651661f89eb1', 1, 'Practice', 'A practice edit from another home''s Project Manager.');
INSERT INTO _p(line) SELECT 'Project Manager saves a blank message: ' || pg_temp.edit('f2a762fa-f28b-4df3-8f33-a94461c6837f', 1, 'Practice', '');
INSERT INTO _p(line) SELECT 'Project Manager of other homes holds update 2: ' || pg_temp.hold('82bdbc3a-791c-433a-9944-651661f89eb1', 2);
INSERT INTO _p(line) SELECT 'Director of Onboarding holds update 2: ' || pg_temp.hold('40de2f41-5596-4ec1-98d7-29e16549a25f', 2);
INSERT INTO _p(line) SELECT 'Hold again: ' || pg_temp.hold('40de2f41-5596-4ec1-98d7-29e16549a25f', 2);
INSERT INTO _p(line) SELECT 'Edit a held update: ' || pg_temp.edit('f2a762fa-f28b-4df3-8f33-a94461c6837f', 2, 'Practice', 'Editing an update that is held.');
INSERT INTO _p(line) SELECT 'Project Manager puts the template back on update 1: ' || pg_temp.edit('f2a762fa-f28b-4df3-8f33-a94461c6837f', 1, '', '');
SELECT set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
DO $t$ BEGIN
  BEGIN UPDATE public.owner_closing_updates SET status = 'scheduled' WHERE id = (SELECT id FROM _u WHERE update_no = 2);
    INSERT INTO _p(line) VALUES ('un-hold update 2 directly: allowed');
  EXCEPTION WHEN OTHERS THEN INSERT INTO _p(line) VALUES ('un-hold update 2 directly: refused: ' || SQLERRM); END;
  UPDATE public.owner_closing_updates SET status = 'sending' WHERE id = (SELECT id FROM _u WHERE update_no = 1);
  UPDATE public.owner_closing_updates SET status = 'test_sent', sent_subject = 's', sent_body = 'b', sent_at = now() WHERE id = (SELECT id FROM _u WHERE update_no = 1);
  BEGIN UPDATE public.owner_closing_updates SET sent_body = 'changed' WHERE id = (SELECT id FROM _u WHERE update_no = 1);
    INSERT INTO _p(line) VALUES ('change a sent update: allowed');
  EXCEPTION WHEN OTHERS THEN INSERT INTO _p(line) VALUES ('change a sent update: refused: ' || SQLERRM); END;
  BEGIN DELETE FROM public.owner_closing_updates WHERE id = (SELECT id FROM _u WHERE update_no = 1);
    INSERT INTO _p(line) VALUES ('remove an update: allowed');
  EXCEPTION WHEN OTHERS THEN INSERT INTO _p(line) VALUES ('remove an update: refused: ' || SQLERRM); END;
  BEGIN DELETE FROM public.owner_closing_update_events;
    INSERT INTO _p(line) VALUES ('remove history: allowed');
  EXCEPTION WHEN OTHERS THEN INSERT INTO _p(line) VALUES ('remove history: refused: ' || SQLERRM); END;
END $t$;
INSERT INTO _p(line) SELECT format('history lines %s (%s), test inbox %s',
  (SELECT count(*) FROM public.owner_closing_update_events),
  (SELECT string_agg(action, ', ' ORDER BY created_at, action) FROM public.owner_closing_update_events),
  (SELECT value->>'email' FROM public.app_settings WHERE key = 'owner_update_test_inbox'));
INSERT INTO _p(line) SELECT format('owner notices %s, emails %s, staff notices %s', (SELECT count(*) FROM public.owner_notifications) - notices,
  (SELECT count(*) FROM public.email_log) - emails, (SELECT count(*) FROM public.staff_notifications) - staff) FROM _b;
-- ===== apply.undo.sql (unchanged) =====
-- owner-closing-updates undo: removes the two actions, the guards, both records and the test inbox setting.
-- Every update row and history line is copied into one audit line first, so nothing is lost.
-- The Owner tab then shows the schedule as planned only, with Edit and Hold off.
INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
SELECT NULL, 'owner_closing_updates.undone', 'function', NULL, 'Owner updates after closing',
  jsonb_build_object(
    'updates', coalesce((SELECT jsonb_agg(to_jsonb(u) ORDER BY u.created_at) FROM public.owner_closing_updates u), '[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at) FROM public.owner_closing_update_events e), '[]'::jsonb),
    'test_inbox', (SELECT value FROM public.app_settings WHERE key = 'owner_update_test_inbox'));
DROP FUNCTION public.hold_owner_closing_update(uuid);
DROP FUNCTION public.edit_owner_closing_update(uuid, text, text);
DROP FUNCTION private.owner_update_editor(uuid, uuid);
DROP TRIGGER owner_closing_update_events_append_only ON public.owner_closing_update_events;
DROP FUNCTION private.block_owner_closing_update_event_change();
DROP TABLE public.owner_closing_update_events;
DROP TRIGGER owner_closing_updates_guard ON public.owner_closing_updates;
DROP FUNCTION private.guard_owner_closing_update();
DROP TABLE public.owner_closing_updates;
DELETE FROM public.app_settings WHERE key = 'owner_update_test_inbox';
INSERT INTO _p(line) SELECT format('after undo: records gone %s, actions gone %s, setting gone %s, updates kept in the undo audit line %s',
  to_regclass('public.owner_closing_updates') IS NULL AND to_regclass('public.owner_closing_update_events') IS NULL,
  NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('edit_owner_closing_update', 'hold_owner_closing_update')),
  NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'owner_update_test_inbox'),
  (SELECT jsonb_array_length(after_value->'updates') FROM public.audit_log WHERE action = 'owner_closing_updates.undone' ORDER BY created_at DESC LIMIT 1));
DO $out$ DECLARE s text; BEGIN SELECT string_agg(line, E'\n' ORDER BY n) INTO s FROM _p; RAISE EXCEPTION E'PRACTICE ROLLED BACK\n%', s; END $out$;
