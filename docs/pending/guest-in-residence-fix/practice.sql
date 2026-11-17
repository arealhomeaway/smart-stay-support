-- Practice for guest-in-residence-fix: fingerprint, apply, checks with demo tickets, undo, fingerprint.
-- Always rolls back (ends with RAISE EXCEPTION 'PRACTICE ROLLED BACK').
CREATE TEMP TABLE _p(n serial, line text);
CREATE TEMP TABLE _demo(kind text, id uuid);
CREATE OR REPLACE FUNCTION pg_temp.fp() RETURNS text LANGUAGE sql AS $f$
  SELECT md5(string_agg(id::text || guest_in_residence::text || coalesce(next_guest_update_at::text,'') || coalesce(updated_at::text,'') || status, ',' ORDER BY id))
    FROM public.tickets WHERE id NOT IN (SELECT id FROM _demo)
$f$;
INSERT INTO _p(line) SELECT 'before: ' || pg_temp.fp();
INSERT INTO _p(line) SELECT 'audit rows before: ' || (SELECT count(*) FROM public.audit_log);
-- @@APPLY@@
INSERT INTO _p(line) SELECT 'audit: ' || (SELECT after_value::text FROM public.audit_log WHERE action = 'guest_in_residence_fix.apply');
INSERT INTO _p(line) SELECT format('default after: %s', (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='tickets' AND column_name='guest_in_residence'));
INSERT INTO _p(line) SELECT format('left: vacant+none with guest=%s, vacant+none with clock=%s, done with clock=%s',
  (SELECT count(*) FROM public.tickets WHERE occupancy_status='vacant' AND guest_impact='none' AND guest_in_residence),
  (SELECT count(*) FROM public.tickets WHERE occupancy_status='vacant' AND guest_impact='none' AND next_guest_update_at IS NOT NULL),
  (SELECT count(*) FROM public.tickets WHERE status IN ('resolved','closed') AND next_guest_update_at IS NOT NULL));
INSERT INTO _p(line) SELECT 'named: ' || (SELECT string_agg(format('#%s %s guest=%s clock=%s', ref, status, guest_in_residence, coalesce(to_char(next_guest_update_at AT TIME ZONE 'America/Chicago','MM/DD HH24:MI'),'none')), '; ' ORDER BY ref)
  FROM public.tickets WHERE ref IN (1465, 1467, 1511, 4930, 4941, 4960));
-- Demo tickets on a demo home, created the way each path creates them.
WITH ins AS (
  INSERT INTO public.tickets (title, property_id, status, record_type, is_demo, occupancy_status, guest_impact, reported_at)
  VALUES ('Practice: vacant home', 'a0000000-0000-4000-8000-00000000b001', 'open', 'active_task', true, 'vacant', 'none', now())
  RETURNING id) INSERT INTO _demo SELECT 'vacant', id FROM ins;
-- Occupied: the app passes guestInResidenceFor({ occupancy: 'occupied', guestImpact: 'active_guest_affected' }) = true.
WITH ins AS (
  INSERT INTO public.tickets (title, property_id, status, record_type, is_demo, occupancy_status, guest_impact, guest_in_residence, next_guest_update_at, reported_at)
  VALUES ('Practice: occupied home', 'a0000000-0000-4000-8000-00000000b001', 'open', 'active_task', true, 'occupied', 'active_guest_affected', true, now() + interval '2 hours', now())
  RETURNING id) INSERT INTO _demo SELECT 'occupied', id FROM ins;
-- Imported: the same columns import_notion_ticket writes (no guest fields).
WITH ins AS (
  INSERT INTO public.tickets (title, description, category, entry_kind, priority, status, property_id, reported_at,
    source_channel, source_reference, external_source, external_id, external_status, is_demo, escalation_level, record_type)
  VALUES ('Practice: imported', 'x', 'other', 'maintenance', 'p3', 'in_progress', 'a0000000-0000-4000-8000-00000000b001', now(),
    'internal', 'Imported from Notion', 'notion', 'practice-guest-fix', 'In progress', true, 'none', 'active_task')
  RETURNING id) INSERT INTO _demo SELECT 'imported', id FROM ins;
-- Resolved: an imported ticket arriving resolved with a clock, and the occupied ticket resolved later.
WITH ins AS (
  INSERT INTO public.tickets (title, property_id, status, record_type, is_demo, occupancy_status, guest_impact, guest_in_residence, next_guest_update_at, resolved_at, reported_at)
  VALUES ('Practice: resolved', 'a0000000-0000-4000-8000-00000000b001', 'resolved', 'active_task', true, 'occupied', 'active_guest_affected', true, now() + interval '2 hours', now(), now())
  RETURNING id) INSERT INTO _demo SELECT 'resolved_insert', id FROM ins;
INSERT INTO _p(line) SELECT 'demo after create: ' || (SELECT string_agg(format('%s guest=%s clock=%s', d.kind, t.guest_in_residence, t.next_guest_update_at IS NOT NULL), '; ' ORDER BY d.kind) FROM _demo d JOIN public.tickets t ON t.id = d.id);
UPDATE public.tickets SET status = 'resolved', resolved_at = now() WHERE id = (SELECT id FROM _demo WHERE kind = 'occupied');
INSERT INTO _p(line) SELECT 'demo occupied after resolve: clock=' || (SELECT (next_guest_update_at IS NOT NULL)::text FROM public.tickets WHERE id = (SELECT id FROM _demo WHERE kind = 'occupied'));
UPDATE public.tickets SET next_guest_update_at = now() + interval '1 hour' WHERE id = (SELECT id FROM _demo WHERE kind = 'occupied');
INSERT INTO _p(line) SELECT 'demo resolved, clock set again: clock=' || (SELECT (next_guest_update_at IS NOT NULL)::text FROM public.tickets WHERE id = (SELECT id FROM _demo WHERE kind = 'occupied'));
INSERT INTO _p(line) SELECT 'trigger enabled states: ' || (SELECT string_agg(DISTINCT tgenabled::text, ',') FROM pg_trigger WHERE tgrelid='public.tickets'::regclass AND NOT tgisinternal);
-- @@UNDO@@
INSERT INTO _p(line) SELECT 'after undo: ' || pg_temp.fp();
INSERT INTO _p(line) SELECT format('after undo: default=%s trigger=%s', (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='tickets' AND column_name='guest_in_residence'), EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='tickets_no_guest_clock_when_done'));
INSERT INTO _p(line) SELECT 'bonus_facts: ' || (SELECT md5(p.prosrc) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.proname='bonus_facts');
DO $d$ DECLARE s text; b text; u text; BEGIN
  SELECT substr(line, 9) INTO b FROM _p WHERE line LIKE 'before: %';
  SELECT substr(line, 13) INTO u FROM _p WHERE line LIKE 'after undo: %' AND line NOT LIKE '%default=%';
  SELECT string_agg(line, E'\n' ORDER BY n) INTO s FROM _p;
  s := s || E'\nundo matches before: ' || (b = u)::text;
  RAISE EXCEPTION 'PRACTICE ROLLED BACK:%', E'\n' || s;
END $d$;
