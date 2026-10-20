-- lovable-cron-fallback-reviewed: Emily approved the existing combined five-minute email delivery pass, 288 checks per day; recurring Cloud costs and maximum five-minute delivery delay disclosed. Preserve approved timing and stored-key method.
-- Prerequisites: applied safety function 0151; trigger 0154_block_demo_owner_notification_trigger.sql; audit 0155_email_job_run_audit.sql; approved app release. Combined 0156 is superseded.
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