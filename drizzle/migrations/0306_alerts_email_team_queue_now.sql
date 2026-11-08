-- Team Queue alert emails right away (Emily, Nov 8, 2026; answers to the alerts batch, item 1).
-- Undo: 01_undo_team_queue_alert_email_now.sql. No BEGIN/COMMIT.
--
-- Instead of a second run every minute, the email is asked for the moment the alert is
-- written: when the minute check saves a Supervisor (10 minute) or Director (15 minute) Team
-- Queue alert that wants an email, this asks the app to email that one alert. Same sender and
-- same safety checks as every other staff email (demo never emailed, staff only, personal
-- settings). No extra scheduled job, so no cost when nothing is waiting.
-- The caller presents the database-held scheduler token. A failed request never undoes the
-- alert; the 5-minute pass picks up any Team Queue alert email still waiting after 10 minutes.
-- The app address answers once the app is published; until then the 5-minute pass sends these
-- emails as it does today.

CREATE OR REPLACE FUNCTION private.request_team_queue_alert_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Email is only a delivery channel: it never blocks the alert.
  BEGIN
    PERFORM net.http_post(
      url := 'https://project--9ccd5407-8c2f-4bb6-af2b-c23477f01c08.lovable.app/api/public/hooks/team-queue-alert-email',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret',
        (SELECT token FROM private.cleaner_cron_token WHERE id = 1)),
      body := jsonb_build_object('id', NEW.id),
      timeout_milliseconds := 30000
    );
  EXCEPTION WHEN others THEN
    NULL;
  END;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.request_team_queue_alert_email() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER staff_notifications_team_queue_email_now
  AFTER INSERT ON public.staff_notifications
  FOR EACH ROW
  WHEN (NEW.kind IN ('team_queue_supervisor', 'team_queue_director')
        AND NEW.email_status = 'pending'
        AND NOT coalesce(NEW.is_demo, false))
  EXECUTE FUNCTION private.request_team_queue_alert_email();
