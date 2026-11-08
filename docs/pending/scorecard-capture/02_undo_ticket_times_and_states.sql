-- Undo for 02_ticket_times_and_states.sql. Removes the receipt-time lock, the server-time
-- stamp on history lines and the next action / Waiting logging trigger.
-- The ticket_state_log table is kept on purpose so recorded lines are never lost.
-- No BEGIN/COMMIT.

DROP TRIGGER IF EXISTS tickets_log_state ON public.tickets;
DROP FUNCTION IF EXISTS private.log_ticket_state();
DROP TRIGGER IF EXISTS ticket_activity_server_time ON public.ticket_activity;
DROP FUNCTION IF EXISTS private.stamp_ticket_activity_time();
DROP TRIGGER IF EXISTS tickets_lock_receipt_time ON public.tickets;
DROP FUNCTION IF EXISTS private.lock_ticket_receipt_time();
