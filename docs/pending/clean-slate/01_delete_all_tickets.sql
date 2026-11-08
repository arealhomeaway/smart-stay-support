-- Clean slate, part 1: delete every ticket and what depends on it (Emily, Nov 7, 2026; register N8).
-- STAGED ONLY. Do not apply without Emily's go. It refuses to run unless a full backup that
-- finished and passed Verify in the last 2 hours is recorded (Admin tools > Back up everything).
--
-- Deletes: every ticket (42 on Nov 8: 30 demo, the 4 open lockout tickets of Nov 4 and 5, the
-- rest) with its history, notes, checklist answers, visits, escalations, handoffs, refunds and
-- vendor ratings (these go with the ticket automatically); the Work Orders created for them and
-- their history, candidates and visits; the alerts about those tickets, Work Orders and refunds;
-- the files recorded on those tickets (the file records; the stored files stay in storage);
-- the automatic homeowner opportunities made from those tickets (all demo, none answered);
-- the Home work list rows for those tickets; capture-table rows for those tickets; Finance links
-- from expenses to those tickets and Work Orders (the expenses themselves stay).
-- Unlinks, keeps: guest reviews, routine checks, onboarding Tasks, homeowner hours and Breezeway
-- work orders that pointed at a ticket.
-- Keeps: homes, owners, vendors, settings, schedule, routines, templates, Finance expenses,
-- claims that have no ticket, the audit log and integration log (see the optional 01b file).
--
-- Delete blocks switched off only inside this step and switched back on at its end:
-- tickets_never_delete (tickets), ticket_state_log_no_change and scorecard_records_no_change
-- (capture tables), routine_controls_lock_completed (one completed demo routine check points at
-- a ticket; clearing that pointer is otherwise refused). If anything fails, nothing changes.
-- Undo: none in SQL. Restore from the backup folder named in full_backups (README).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.full_backups
     WHERE status = 'succeeded' AND verify_ok IS TRUE AND finished_at >= now() - interval '2 hours'
  ) THEN
    RAISE EXCEPTION 'Clean slate refused: no checked full backup in the last 2 hours. Press Back up everything, then Verify, then try again.';
  END IF;
  -- Default (not a stated decision): stop if real work has been recorded since this was staged,
  -- so Monday's tickets are never deleted by surprise. Change the time only on purpose.
  IF EXISTS (SELECT 1 FROM public.tickets WHERE created_at > '2026-11-08 22:00:00+00' AND NOT is_demo) THEN
    RAISE EXCEPTION 'Clean slate refused: tickets were created after 4:00 PM Central on Nov 8. Review them first.';
  END IF;
END $$;

CREATE TEMP TABLE cs_tickets ON COMMIT DROP AS SELECT id FROM public.tickets;
CREATE TEMP TABLE cs_work_orders ON COMMIT DROP AS
  SELECT id FROM public.work_orders
   WHERE ticket_id IN (SELECT id FROM cs_tickets) OR follow_up_ticket_id IN (SELECT id FROM cs_tickets);
CREATE TEMP TABLE cs_recoveries ON COMMIT DROP AS
  SELECT id FROM public.guest_recovery WHERE ticket_id IN (SELECT id FROM cs_tickets);
CREATE TEMP TABLE cs_opportunities ON COMMIT DROP AS
  SELECT id FROM public.owner_reviews WHERE auto_ticket AND ticket_id IN (SELECT id FROM cs_tickets);

ALTER TABLE public.tickets DISABLE TRIGGER tickets_never_delete;
ALTER TABLE public.ticket_state_log DISABLE TRIGGER ticket_state_log_no_change;
ALTER TABLE public.scorecard_records DISABLE TRIGGER scorecard_records_no_change;
ALTER TABLE public.routine_controls DISABLE TRIGGER routine_controls_lock_completed;

-- Alerts about the tickets, their Work Orders and refunds.
DELETE FROM public.staff_notifications
 WHERE (entity_type = 'ticket' AND entity_id IN (SELECT id FROM cs_tickets))
    OR (entity_type = 'work_order' AND entity_id IN (SELECT id FROM cs_work_orders))
    OR (entity_type = 'guest_recovery' AND entity_id IN (SELECT id FROM cs_recoveries));
-- File records on the tickets.
DELETE FROM public.documents WHERE entity_type = 'ticket' AND entity_id IN (SELECT id FROM cs_tickets);
-- Finance links to the tickets and Work Orders (each unlink is recorded in the expense history).
DELETE FROM public.expense_links
 WHERE (link_type = 'ticket' AND target_id IN (SELECT id FROM cs_tickets))
    OR (link_type = 'work_order' AND target_id IN (SELECT id FROM cs_work_orders));
-- Approvals asked for those Work Orders.
DELETE FROM public.approvals WHERE entity_type = 'work_order' AND entity_id IN (SELECT id FROM cs_work_orders);
-- Work Orders created for the tickets (history, candidates and visits go with them).
DELETE FROM public.work_orders WHERE id IN (SELECT id FROM cs_work_orders);
-- Automatic homeowner opportunities made from the tickets.
DELETE FROM public.owner_reviews WHERE id IN (SELECT id FROM cs_opportunities);
-- Rows that point at a ticket and would otherwise block or be left behind.
DELETE FROM public.handoff_carryovers WHERE ticket_id IN (SELECT id FROM cs_tickets);
DELETE FROM public.ticket_owner_updates WHERE ticket_id IN (SELECT id FROM cs_tickets);
DELETE FROM public.ticket_state_log WHERE ticket_id IN (SELECT id FROM cs_tickets);
DELETE FROM public.scorecard_records WHERE ticket_id IN (SELECT id FROM cs_tickets);
DELETE FROM public.credential_access_log WHERE ticket_id IN (SELECT id FROM cs_tickets);
DELETE FROM public.email_log WHERE ticket_id IN (SELECT id FROM cs_tickets);
DELETE FROM public.work_items WHERE source_table = 'tickets' AND source_id IN (SELECT id FROM cs_tickets);
UPDATE public.cleaning_reviews
   SET linked_ticket_ids = ARRAY(SELECT x FROM unnest(linked_ticket_ids) x WHERE x NOT IN (SELECT id FROM cs_tickets))
 WHERE linked_ticket_ids && ARRAY(SELECT id FROM cs_tickets);
-- The tickets.
DELETE FROM public.tickets WHERE id IN (SELECT id FROM cs_tickets);

ALTER TABLE public.tickets ENABLE TRIGGER tickets_never_delete;
ALTER TABLE public.ticket_state_log ENABLE TRIGGER ticket_state_log_no_change;
ALTER TABLE public.scorecard_records ENABLE TRIGGER scorecard_records_no_change;
ALTER TABLE public.routine_controls ENABLE TRIGGER routine_controls_lock_completed;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.tickets) THEN RAISE EXCEPTION 'Clean slate check: tickets remain.'; END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname IN ('tickets_never_delete', 'ticket_state_log_no_change', 'scorecard_records_no_change', 'routine_controls_lock_completed') AND tgenabled = 'D') THEN
    RAISE EXCEPTION 'Clean slate check: a delete block is still off.';
  END IF;
END $$;
