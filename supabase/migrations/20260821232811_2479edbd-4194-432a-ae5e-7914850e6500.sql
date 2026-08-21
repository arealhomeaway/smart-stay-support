SELECT cron.unschedule('resolve-mailbox-sync') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'resolve-mailbox-sync');
SELECT cron.schedule(
  'resolve-mailbox-sync',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--9ccd5407-8c2f-4bb6-af2b-c23477f01c08.lovable.app/api/public/sync/mailbox',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', current_setting('app.cron_secret', true)),
    body := '{}'::jsonb
  );
  $$
);