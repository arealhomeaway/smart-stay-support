DROP FUNCTION IF EXISTS public.bulk_close_overdue_arrival_checks();
DROP FUNCTION IF EXISTS public.save_arrival_check_step(uuid, text, boolean, boolean);
DROP TRIGGER IF EXISTS arrival_check_team_a ON public.arrival_checks;
DROP FUNCTION IF EXISTS private.arrival_check_team_a();
-- Columns are kept (additive, nothing is deleted); they are unused after undo.
