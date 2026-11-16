-- nightly-export-sunday, schedules: job 16 nightly-export-continue (was 5-55/10 7-10 * * *), job 17 nightly-export-missed-check (was 15 10,11 * * *).
-- Only the timing changes; the call, its address, token and time limit are unchanged.
SELECT cron.alter_job(16, schedule := '5-55/5 7-12 * * *');
SELECT cron.alter_job(17, schedule := '15 10-13 * * *');
