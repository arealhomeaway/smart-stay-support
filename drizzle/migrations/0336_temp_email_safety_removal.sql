-- docs/pending/temp-email-safety-removal: 00_preflight.sql then apply.sql, one transaction (Approved: apply temp-email-safety-removal, Nov 13).
-- The job check in 00_preflight.sql was read through the schedule listing (job 23, on, */5) just before this ran; the migration tool cannot read cron.job.
DO $$
BEGIN
  IF to_regprocedure('private.temp_close_stalled_email_run()') IS NULL THEN
    RAISE EXCEPTION 'Preflight: private.temp_close_stalled_email_run() is not there. Nothing to remove.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE prosrc ILIKE '%temp_close_stalled_email_run%' AND proname <> 'temp_close_stalled_email_run') THEN
    RAISE EXCEPTION 'Preflight: another function calls temp_close_stalled_email_run. Stop and review.';
  END IF;
END $$;
SELECT cron.unschedule('temp-close-stalled-email-run');
DROP FUNCTION private.temp_close_stalled_email_run();
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'COO', 'temporary_job_removed', 'cron_job', 'temp-close-stalled-email-run',
        'docs/pending/temp-email-safety-removal/apply.sql applied: temporary overnight safety removed (cron job and private.temp_close_stalled_email_run). Undo: apply.undo.sql');