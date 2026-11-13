-- Remove the temporary overnight safety (cron job and function). NOT applied.
-- Apply only after "Approved: apply temp-email-safety-removal", in one transaction:
-- BEGIN; \i 00_preflight.sql \i apply.sql COMMIT;
SELECT cron.unschedule('temp-close-stalled-email-run');
DROP FUNCTION private.temp_close_stalled_email_run();
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'COO', 'temporary_job_removed', 'cron_job', 'temp-close-stalled-email-run',
        'docs/pending/temp-email-safety-removal/apply.sql applied: temporary overnight safety removed (cron job and private.temp_close_stalled_email_run). Undo: apply.undo.sql');
