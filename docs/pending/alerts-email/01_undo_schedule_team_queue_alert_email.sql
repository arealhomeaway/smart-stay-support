-- Undo for 01: stops the every-minute Team Queue alert email run. If the app code is kept, also
-- publish code where the 5-minute pass sends these two kinds again (staff-notify.server.ts),
-- or Team Queue alert emails stop; the in-app alerts are not affected.
SELECT cron.unschedule('team-queue-alert-email');
