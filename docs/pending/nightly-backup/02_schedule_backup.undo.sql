-- Undo Step 2: stop the nightly backup schedule and remove its database token.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('nightly-backup-0700utc','nightly-backup-0800utc');
DROP FUNCTION IF EXISTS public.backup_verify_cron_token(text);
DROP TABLE IF EXISTS private.backup_cron_token;
