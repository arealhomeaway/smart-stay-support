-- Undo for 01_record_routine.sql. Removes the function and the retired-check
-- trigger. The two columns are kept on purpose so saved answers are never
-- lost; drop them by hand only if no saved check uses them.
DROP FUNCTION IF EXISTS public.record_routine_check(jsonb);
DROP TRIGGER IF EXISTS routine_controls_no_new_retired ON public.routine_controls;
DROP FUNCTION IF EXISTS private.refuse_new_retired_routine();
