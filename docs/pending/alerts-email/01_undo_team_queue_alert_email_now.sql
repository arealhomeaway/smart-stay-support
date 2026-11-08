-- Undo for 01: stops asking for the Team Queue alert email the moment the alert is written.
-- The 5-minute pass still sends any Team Queue alert email waiting more than 10 minutes; to make
-- it send them on its next pass again, publish the earlier staff-notify.server.ts.
DROP TRIGGER IF EXISTS staff_notifications_team_queue_email_now ON public.staff_notifications;
DROP FUNCTION IF EXISTS private.request_team_queue_alert_email();
