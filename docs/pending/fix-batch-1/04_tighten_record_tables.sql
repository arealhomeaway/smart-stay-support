-- Fix batch 1, part 4: tighten the three add-only record tables. Staged only.
-- Undo: 04_undo_tighten_record_tables.sql
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.
--
-- Today signed-in and signed-out sessions still hold the default insert,
-- update and delete rights on these tables. Rows were already safe (no write
-- policy, so row security refuses writes; the no-change triggers refuse
-- edits), but the rights should not be there. Every writer is a function that
-- runs with elevated rights (log_ticket_state, log_queue_open,
-- add_routine_correction and the record_* functions), so they keep working.
-- Reads stay exactly as they are.

REVOKE INSERT, UPDATE, DELETE ON public.scorecard_records FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.ticket_state_log FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.routine_check_corrections FROM authenticated, anon;
