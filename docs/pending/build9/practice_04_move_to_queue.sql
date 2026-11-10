-- Practice run of 04_move_to_queue.sql (Build 9 B1) with real accounts on two real older open imports.
-- Cancelled at the end: nothing is kept.
CREATE TEMP TABLE practice_result(k text, v text);
GRANT ALL ON practice_result TO authenticated;
-- Build 9 B1 (STAGE ONLY, not marked APPLY): Move to queue on the Databases Older open tab.
-- The Operations Supervisor and the Director of Operations pick one or several older open tickets imported
-- from Notion and move them into the Team Queue's "Imported from Notion" group, where anyone who
-- works tickets can Take it (the existing reopen_notion_ticket). Moving stays quiet: no owner,
-- no clock, no alert, no count beyond open ticket totals (the same as a recent import, N4/T7).
-- Additive: the hold check allows one more value, 'in_queue', and one new function writes it
-- with one history line per ticket. Existing values, the import runner, reopen_notion_ticket,
-- routing and clocks are unchanged. A ticket already live, closed, archived or waiting for a
-- home is refused, and nothing in the batch is saved.
-- Undo: undo/04_move_to_queue.sql
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.

ALTER TABLE public.tickets DROP CONSTRAINT tickets_import_hold_chk;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_import_hold_chk
  CHECK (import_hold IS NULL OR import_hold = ANY (ARRAY['backlog_review'::text, 'needs_home'::text, 'in_queue'::text]));

CREATE OR REPLACE FUNCTION public.move_notion_to_queue(_ticket_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_t public.tickets%ROWTYPE;
  v_n integer := 0;
BEGIN
  IF v_me IS NULL OR NOT (
       public.holds_functional_role(v_me, 'ops_supervisor')
    OR public.holds_functional_role(v_me, 'director_ops')) THEN
    RAISE EXCEPTION 'Only the Operations Supervisor or the Director of Operations can move tickets to the queue.';
  END IF;
  IF _ticket_ids IS NULL OR cardinality(_ticket_ids) = 0 THEN RAISE EXCEPTION 'Pick at least one ticket.'; END IF;
  IF cardinality(_ticket_ids) > 200 THEN RAISE EXCEPTION 'Pick 200 tickets or fewer at once.'; END IF;
  FOR v_t IN SELECT * FROM public.tickets WHERE id = ANY (_ticket_ids) ORDER BY ref FOR UPDATE LOOP
    IF v_t.external_source IS DISTINCT FROM 'notion' OR v_t.external_status = 'reopened_in_resolve' THEN
      RAISE EXCEPTION 'Ticket % is not a quiet Notion import.', v_t.ref;
    END IF;
    IF v_t.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Ticket % is archived.', v_t.ref; END IF;
    IF v_t.status NOT IN ('new','triage','open','dispatched','in_progress','waiting','scheduled','awaiting_guest') THEN
      RAISE EXCEPTION 'Ticket % is closed.', v_t.ref;
    END IF;
    IF v_t.import_hold = 'needs_home' THEN RAISE EXCEPTION 'Choose the home for ticket % first.', v_t.ref; END IF;
    IF v_t.import_hold = 'in_queue' THEN CONTINUE; END IF;
    UPDATE public.tickets SET import_hold = 'in_queue' WHERE id = v_t.id;
    INSERT INTO public.ticket_activity(ticket_id, author_id, kind, event_type, body, internal, is_demo)
    VALUES (v_t.id, v_me, 'status', 'moved_to_queue', 'Moved to the Team Queue from the Notion import.', true, coalesce(v_t.is_demo, false));
    v_n := v_n + 1;
  END LOOP;
  IF (SELECT count(*) FROM public.tickets WHERE id = ANY (_ticket_ids)) <> cardinality(_ticket_ids) THEN
    RAISE EXCEPTION 'A ticket was not found. Refresh and try again.';
  END IF;
  RETURN v_n;
END
$function$;

REVOKE ALL ON FUNCTION public.move_notion_to_queue(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_notion_to_queue(uuid[]) TO authenticated, service_role;

CREATE TEMP TABLE practice_ids AS
SELECT (SELECT m.user_id FROM public.functional_role_members m JOIN public.functional_roles r ON r.id = m.role_id WHERE r.code = 'ops_supervisor' ORDER BY m.user_id LIMIT 1) AS sup,
       (SELECT m.user_id FROM public.functional_role_members m JOIN public.functional_roles r ON r.id = m.role_id WHERE r.code = 'director_ops' ORDER BY m.user_id LIMIT 1) AS ops_dir,
       public.seat_holder('onboarding_director') AS onb_dir,
       public.seat_holder('po_day') AS coord,
       ARRAY(SELECT id FROM public.tickets WHERE external_source = 'notion' AND coalesce(external_status,'') <> 'reopened_in_resolve'
               AND archived_at IS NULL AND import_hold IS DISTINCT FROM 'needs_home' AND reported_at < now() - interval '30 days'
               AND status IN ('new','triage','open','dispatched','in_progress','waiting','scheduled','awaiting_guest')
             ORDER BY ref LIMIT 2) AS two,
       (SELECT id FROM public.tickets WHERE external_source = 'notion' AND status IN ('closed','resolved','cancelled') ORDER BY ref LIMIT 1) AS closed_one;
GRANT SELECT ON practice_ids TO authenticated;

CREATE FUNCTION pg_temp.try_move(_who uuid, _ids uuid[]) RETURNS text LANGUAGE plpgsql AS $t$
DECLARE n integer;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', _who, 'role', 'authenticated')::text, true);
    n := public.move_notion_to_queue(_ids);
    RAISE EXCEPTION 'ALLOWED %', n;
  EXCEPTION WHEN others THEN RETURN CASE WHEN SQLERRM LIKE 'ALLOWED%' THEN lower(SQLERRM) ELSE 'refused: ' || SQLERRM END;
  END;
END $t$;
GRANT EXECUTE ON FUNCTION pg_temp.try_move(uuid, uuid[]) TO authenticated;

SET LOCAL ROLE authenticated;
INSERT INTO practice_result SELECT 'by_coordinator', pg_temp.try_move(coord, two) FROM practice_ids;
INSERT INTO practice_result SELECT 'by_director_of_onboarding', pg_temp.try_move(onb_dir, two) FROM practice_ids;
INSERT INTO practice_result SELECT 'with_a_closed_ticket', pg_temp.try_move(sup, two || closed_one) FROM practice_ids;
INSERT INTO practice_result SELECT 'by_director_of_operations', pg_temp.try_move(ops_dir, two) FROM practice_ids;
INSERT INTO practice_result SELECT 'by_supervisor', pg_temp.try_move(sup, two) FROM practice_ids;
RESET ROLE;
-- try_move rolls each try back, so run the supervisor move for real (still inside this cancelled practice).
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT sup FROM practice_ids), 'role', 'authenticated')::text, true);
INSERT INTO practice_result SELECT 'moved', public.move_notion_to_queue(two)::text FROM practice_ids;
INSERT INTO practice_result SELECT 'moved_again_counts', public.move_notion_to_queue(two)::text FROM practice_ids;
INSERT INTO practice_result SELECT 'holds_after', string_agg(coalesce(import_hold,'none') || '/' || coalesce(assigned_to::text,'no owner') || '/' || coalesce(acknowledged_at::text,'no clock'), ', ') FROM public.tickets WHERE id = ANY ((SELECT two FROM practice_ids));
INSERT INTO practice_result SELECT 'history_lines', count(*)::text FROM public.ticket_activity WHERE event_type = 'moved_to_queue' AND ticket_id = ANY ((SELECT two FROM practice_ids));
DO $practice$ BEGIN
  RAISE EXCEPTION 'PRACTICE CANCELLED %', (SELECT json_object_agg(k, v) FROM practice_result);
END $practice$;
