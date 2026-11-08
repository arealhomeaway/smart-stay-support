-- Undo for 03_escalation_schedule.sql: stops the scheduled check. No BEGIN/COMMIT.
-- After this, the 2 minute alert again fires only while a request screen is open.

SELECT cron.unschedule('direct-booking-approval-escalation');
