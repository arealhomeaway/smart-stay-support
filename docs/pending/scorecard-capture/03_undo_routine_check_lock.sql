-- Undo for 03_routine_check_lock.sql. Removes the lock and the completion stamp.
-- The corrections table is kept on purpose so saved corrections are never lost; only the
-- function that adds them is removed. No BEGIN/COMMIT.

DROP FUNCTION IF EXISTS public.add_routine_correction(uuid, text);
DROP TRIGGER IF EXISTS routine_controls_stamp_completion ON public.routine_controls;
DROP TRIGGER IF EXISTS routine_controls_lock_completed ON public.routine_controls;
DROP FUNCTION IF EXISTS private.stamp_routine_completion();
DROP FUNCTION IF EXISTS private.lock_completed_routine_check();
