-- Undo for 04_tighten_record_tables.sql: gives back exactly the rights removed.
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.

GRANT INSERT, UPDATE, DELETE ON public.scorecard_records TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.ticket_state_log TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.routine_check_corrections TO authenticated, anon;
