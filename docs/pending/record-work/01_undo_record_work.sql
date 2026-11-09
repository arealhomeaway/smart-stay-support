-- Undo for 01_record_work.sql. No BEGIN/COMMIT.
-- Removes the new functions and setting. Dropping the two columns removes the
-- problem type and one touch mark from saved home history lines (the lines
-- themselves stay); take a backup first.

DROP FUNCTION IF EXISTS public.record_work_escalate(uuid);
DROP FUNCTION IF EXISTS public.record_work_route_preview(uuid);
DROP FUNCTION IF EXISTS public.home_repeat_flags(uuid, timestamptz);
DROP FUNCTION IF EXISTS public.home_problem_repeat(uuid, uuid);
DROP FUNCTION IF EXISTS private.home_problem_events(timestamptz);
DROP FUNCTION IF EXISTS private.record_work_repeat_settings();
DELETE FROM public.app_settings WHERE key = 'record_work_repeat';
DROP INDEX IF EXISTS public.property_activity_log_problem_repeat;
ALTER TABLE public.property_activity_log
  DROP COLUMN IF EXISTS one_touch,
  DROP COLUMN IF EXISTS problem_type_id;
