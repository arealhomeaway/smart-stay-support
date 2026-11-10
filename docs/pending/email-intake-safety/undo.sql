-- Undo for the email intake safety batch.
-- Part A (data, query tool): put the Sep 1 claim back exactly as it was.
UPDATE public.integration_events
   SET status = 'processing', error_message = NULL, resolved_at = NULL
 WHERE id = '8fbaabe8-805d-4f0d-a1c7-95660ab999b9'
   AND status = 'skipped'
   AND error_message = 'left unfinished on Sep 1; closed so it can never create work';

-- Part B (schema and scheduler): restore the sweep job exactly as saved, then remove what was added.
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'resolve-mailbox-sync'),
  schedule := (SELECT job ->> 'schedule' FROM private.email_intake_safety_undo WHERE id = 1),
  command := (SELECT job ->> 'command' FROM private.email_intake_safety_undo WHERE id = 1),
  active := (SELECT (job ->> 'active')::boolean FROM private.email_intake_safety_undo WHERE id = 1));
DROP TABLE IF EXISTS private.email_intake_safety_undo;

DROP FUNCTION IF EXISTS public.clear_email_intake_test_records();
DROP TRIGGER IF EXISTS staff_notifications_email_test_prefix ON public.staff_notifications;
DROP FUNCTION IF EXISTS private.prefix_email_test_alert();
DROP FUNCTION IF EXISTS public.email_intake_sweep_job();
DROP FUNCTION IF EXISTS public.set_email_intake(boolean);
DROP TRIGGER IF EXISTS feature_flags_email_intake_guard ON public.feature_flags;
DROP FUNCTION IF EXISTS private.guard_email_intake_switch();
-- The start line (integration_events processing_checkpoint) and the switch history rows are
-- records and are left as they are. The app code must be rolled back with this (the sweep
-- route no longer accepts the project key the old job sends).
