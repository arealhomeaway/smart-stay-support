-- Build 9 B1 (STAGE ONLY, not marked APPLY): Move to queue on the Databases Older open tab.
-- The Operations Supervisor and the Directors pick one or several older open tickets imported
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
    OR public.holds_functional_role(v_me, 'director_ops')
    OR public.holds_functional_role(v_me, 'onboarding_director')
    OR public.holds_functional_role(v_me, 'director_onboarding')) THEN
    RAISE EXCEPTION 'Only the Operations Supervisor or a Director can move tickets to the queue.';
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
