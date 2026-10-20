-- PREPARED ONLY. Never run before safety/audit migrations and the app release are approved.
-- Uses the same existing private-token lookup as str-cleaner-time-nightly; no key value copied.
-- Check cron.job for matching endpoint first; refuse to create a duplicate.
DO $schedule$
BEGIN
 IF EXISTS(SELECT 1 FROM cron.job WHERE command LIKE '%/api/public/hooks/owner-notify%') THEN
   RAISE EXCEPTION 'Matching email schedule already exists; do not create a duplicate';
 END IF;
 PERFORM cron.schedule('deliver-owner-alerts','*/5 * * * *',$command$
 SELECT net.http_post(
  url := 'https://project--9ccd5407-8c2f-4bb6-af2b-c23477f01c08.lovable.app/api/public/hooks/owner-notify',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
    (SELECT token FROM private.cleaner_cron_token WHERE id=1)),
  body := '{}'::jsonb,
  timeout_milliseconds := 120000
 );
 $command$);
END $schedule$;