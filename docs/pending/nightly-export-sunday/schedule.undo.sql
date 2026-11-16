-- Undo for nightly-export-sunday schedules.
SELECT cron.alter_job(16, schedule := '5-55/10 7-10 * * *');
SELECT cron.alter_job(17, schedule := '15 10,11 * * *');
