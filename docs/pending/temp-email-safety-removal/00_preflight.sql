-- Preflight for removing the temporary overnight safety (added Nov 12). Changes nothing.
-- Stops unless the job and the function are both still there and nothing else calls the function.
DO $$
BEGIN
  IF to_regprocedure('private.temp_close_stalled_email_run()') IS NULL THEN
    RAISE EXCEPTION 'Preflight: private.temp_close_stalled_email_run() is not there. Nothing to remove.';
  END IF;
  IF (SELECT count(*) FROM cron.job WHERE jobname = 'temp-close-stalled-email-run') <> 1 THEN
    RAISE EXCEPTION 'Preflight: expected one job named temp-close-stalled-email-run.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE prosrc ILIKE '%temp_close_stalled_email_run%' AND proname <> 'temp_close_stalled_email_run') THEN
    RAISE EXCEPTION 'Preflight: another function calls temp_close_stalled_email_run. Stop and review.';
  END IF;
END $$;
