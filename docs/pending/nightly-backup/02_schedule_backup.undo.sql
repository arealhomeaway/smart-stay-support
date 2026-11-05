-- Undo Step 2: stop the nightly backup schedule.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('nightly-backup-0700utc','nightly-backup-0800utc');
