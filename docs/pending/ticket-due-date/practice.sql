-- Practice for ticket-due-date. Always rolls back (ends with RAISE EXCEPTION 'PRACTICE ROLLED BACK').
-- Insert apply.sql at the APPLY marker below (the Nov 18 run used the first 20 Notion dates; the full list is checked read only).
CREATE TEMP TABLE _p(n serial, line text);
GRANT ALL ON _p TO authenticated;
GRANT ALL ON SEQUENCE _p_n_seq TO authenticated;
CREATE TEMP TABLE _before AS SELECT id, status, priority, updated_at, assigned_to FROM public.tickets;
INSERT INTO _p(line) SELECT 'notices before: ' || ((SELECT count(*) FROM public.staff_notifications) + (SELECT count(*) FROM public.owner_notifications));
-- @@APPLY@@
INSERT INTO _p(line) SELECT format('open tickets with a due date: %s of %s', count(*) FILTER (WHERE due_on IS NOT NULL), count(*)) FROM public.tickets WHERE status NOT IN ('resolved','closed');
INSERT INTO _p(line) SELECT 'resolved or closed with a due date: ' || count(*) FROM public.tickets WHERE status IN ('resolved','closed') AND due_on IS NOT NULL;
INSERT INTO _p(line) SELECT 'rows whose updated_at, status, priority or owner moved: ' || count(*) FROM public.tickets t JOIN _before b USING (id)
  WHERE t.updated_at IS DISTINCT FROM b.updated_at OR t.status IS DISTINCT FROM b.status OR t.priority IS DISTINCT FROM b.priority OR t.assigned_to IS DISTINCT FROM b.assigned_to;
INSERT INTO _p(line) SELECT 'live P2 #4930 (opened Nov 16): ' || coalesce(due_on::text, 'none') FROM public.tickets WHERE ref = 4930;
INSERT INTO _p(line) SELECT 'Notion #1441 (Notion Due Date 2026-12-01 when in sample): ' || coalesce(due_on::text, 'none') FROM public.tickets WHERE ref = 1441;
INSERT INTO _p(line) SELECT 'Notion sample 0017a8d1 (Notion Due Date 2025-08-18): ' || coalesce(due_on::text, 'none') FROM public.tickets WHERE id = '0017a8d1-cd16-43f5-87de-dbabf25161ec';
INSERT INTO _p(line) SELECT 'triggers back on: ' || (SELECT bool_and(tgenabled = 'O') FROM pg_trigger WHERE tgrelid='public.tickets'::regclass AND tgname IN ('tickets_updated','tickets_keep_reopened_notion'))::text;
-- New tickets, quiet so no alerts: the rule sets the date from priority.
SELECT set_config('resolve.import_quiet', 'on', true);
INSERT INTO public.tickets(title, priority, is_demo, record_type) VALUES ('Practice P1', 'p1', true, 'active_task'), ('Practice P2', 'p2', true, 'active_task'), ('Practice P3', 'p3', true, 'active_task');
INSERT INTO _p(line) SELECT 'new tickets (today Central ' || (now() AT TIME ZONE 'America/Chicago')::date || '): ' || string_agg(title || ' ' || due_on, '; ' ORDER BY title) FROM public.tickets WHERE title LIKE 'Practice P%' AND is_demo;
INSERT INTO public.tickets(title, priority, is_demo, record_type, due_on) VALUES ('Practice given', 'p3', true, 'active_task', DATE '2026-12-24');
INSERT INTO _p(line) SELECT 'a date given at creation is kept: ' || due_on FROM public.tickets WHERE title = 'Practice given';
UPDATE public.tickets SET priority = 'p1', priority_override_reason = 'practice' WHERE title = 'Practice P3' AND is_demo;
INSERT INTO _p(line) SELECT 'Routine changed to Right now keeps its date: ' || due_on FROM public.tickets WHERE title = 'Practice P3';
SELECT set_config('resolve.import_quiet', '', true);
-- Change the date as the Admin on a live ticket: one history line with the person.
SELECT set_config('request.jwt.claims', json_build_object('sub', '98bd6696-4018-4965-b645-0471c5ae3925', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
INSERT INTO _p(line) SELECT 'Admin changes #4930: ' || public.set_ticket_due_on('a899316b-8140-463c-bd7c-6f697b0cdd9e', DATE '2026-11-20')::text;
INSERT INTO _p(line) SELECT 'history line: ' || body || ' by ' || coalesce((SELECT full_name FROM public.profiles WHERE id = author_id), '?') FROM public.ticket_activity WHERE ticket_id = 'a899316b-8140-463c-bd7c-6f697b0cdd9e' AND event_type = 'due_date_changed';
INSERT INTO _p(line) SELECT 'same date again: ' || public.set_ticket_due_on('a899316b-8140-463c-bd7c-6f697b0cdd9e', DATE '2026-11-20')::text;
RESET ROLE;
-- A coordinator cannot change a demo ticket (only Admin edits demo tickets today).
SELECT set_config('request.jwt.claims', json_build_object('sub', '1a4b8de5-0824-4066-8691-8e6bb912f964', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $d$ BEGIN
  PERFORM public.set_ticket_due_on('12cc6227-ff3b-4e58-803d-6b04741e6733', DATE '2026-11-30');
  INSERT INTO _p(line) VALUES ('coordinator on a demo ticket: allowed (unexpected)');
EXCEPTION WHEN OTHERS THEN INSERT INTO _p(line) VALUES ('coordinator on a demo ticket: refused, ' || SQLERRM);
END $d$;
DO $d$ BEGIN
  PERFORM public.set_ticket_due_on('260ff7ac-213a-43dd-bf98-c79e264902e0', DATE '2026-11-21');
  INSERT INTO _p(line) VALUES ('coordinator on #4941, someone else''s ticket: allowed (unexpected)');
EXCEPTION WHEN OTHERS THEN INSERT INTO _p(line) VALUES ('coordinator on #4941, someone else''s ticket: refused, ' || SQLERRM);
END $d$;
INSERT INTO _p(line) SELECT 'coordinator changes own #4930: ' || public.set_ticket_due_on('a899316b-8140-463c-bd7c-6f697b0cdd9e', DATE '2026-11-22')::text;
INSERT INTO _p(line) SELECT 'history on #4930: ' || string_agg(body || ' by ' || coalesce((SELECT full_name FROM public.profiles WHERE id = author_id), '?'), ' | ' ORDER BY event_at) FROM public.ticket_activity WHERE ticket_id = 'a899316b-8140-463c-bd7c-6f697b0cdd9e' AND event_type = 'due_date_changed';
RESET ROLE;
INSERT INTO _p(line) SELECT 'notices after: ' || ((SELECT count(*) FROM public.staff_notifications) + (SELECT count(*) FROM public.owner_notifications));
INSERT INTO _p(line) SELECT 'audit row: ' || count(*) FROM public.audit_log WHERE action = 'ticket_due_date.apply';
DO $d$ DECLARE s text; BEGIN
  SELECT string_agg(line, E'\n' ORDER BY n) INTO s FROM _p;
  RAISE EXCEPTION 'PRACTICE ROLLED BACK:%', E'\n' || s;
END $d$;
