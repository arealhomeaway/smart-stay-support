SELECT cron.unschedule('resolve-mailbox-sync');
SELECT cron.schedule(
  'resolve-mailbox-sync',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://project--9ccd5407-8c2f-4bb6-af2b-c23477f01c08.lovable.app/api/public/sync/mailbox',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_QhE1wTc0Zy7gL_JWJOLJxQ_EN2hvJag"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);