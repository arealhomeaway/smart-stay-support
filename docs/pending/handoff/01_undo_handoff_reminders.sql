-- Undo for 01_handoff_reminders.sql. Removes only what 01 added. No BEGIN/COMMIT.
SELECT cron.unschedule('handoff-reminders');
DROP FUNCTION IF EXISTS public.run_handoff_reminders(timestamptz);
DROP TABLE IF EXISTS public.handoff_reminders;
