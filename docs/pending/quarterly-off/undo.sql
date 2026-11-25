-- Undo quarterly-off (applied Nov 25 2026). Restores the 54 tickets listed in undo.csv.
-- Their previous archived_at, archive_reason and archived_by were all empty.
UPDATE public.tickets SET archived_at = NULL, archived_by = NULL, archive_reason = NULL
WHERE archive_reason = 'Quarterly reviews not set up yet';
-- Turn the page, menu and nightly pass back on:
UPDATE public.feature_flags SET enabled = true WHERE key IN ('quarterly_scheduler','quarterly_reviews');
SELECT cron.alter_job(2, active := true); -- job quarterly-inspection-scheduler
-- The 54 "Archived" activity lines stay as history.
