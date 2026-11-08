-- Team Queue alert emails right away (Emily, Nov 8, 2026; answers to the alerts batch, item 1).
-- A second email run every minute for the Team Queue alerts only (Supervisor at 10 minutes,
-- Director at 15). Same scheduler token and same address as the 5-minute pass. Project specific
-- (address and token), so it is run with the data tool, not as a migration.
-- The address answers only once the app is published; until then each call gets "not found"
-- and nothing is sent. Undo: 01_undo_schedule_team_queue_alert_email.sql.
SELECT cron.schedule(
  'team-queue-alert-email',
  '* * * * *',
  $job$
 SELECT net.http_post(
  url := 'https://project--9ccd5407-8c2f-4bb6-af2b-c23477f01c08.lovable.app/api/public/hooks/team-queue-alert-email',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
    (SELECT token FROM private.cleaner_cron_token WHERE id=1)),
  body := '{}'::jsonb,
  timeout_milliseconds := 55000
 );
$job$
);
