-- Nightly backup, Step 2: schedule 2 a.m. Central (rebuilt Nov 5 2026).
-- Two calls (07:00 and 08:00 UTC) cover daylight saving; the route runs only the one
-- landing on 2 a.m. America/Chicago and skips a folder already backed up.
-- The x-backup-secret header must equal the server secret BACKUP_CRON_SECRET.
-- The scheduler reads it from the database vault entry 'backup_cron_secret', which
-- must hold the same value. No value appears in this file.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'backup_cron_secret') THEN
    RAISE EXCEPTION 'vault entry backup_cron_secret is missing; stop';
  END IF;
  PERFORM cron.schedule('nightly-backup-0700utc', '0 7 * * *', $c$
    SELECT net.http_post(
      url := 'https://project--9ccd5407-8c2f-4bb6-af2b-c23477f01c08.lovable.app/api/public/hooks/nightly-backup',
      headers := jsonb_build_object('Content-Type','application/json','x-backup-secret',
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'backup_cron_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000);
  $c$);
  PERFORM cron.schedule('nightly-backup-0800utc', '0 8 * * *', $c$
    SELECT net.http_post(
      url := 'https://project--9ccd5407-8c2f-4bb6-af2b-c23477f01c08.lovable.app/api/public/hooks/nightly-backup',
      headers := jsonb_build_object('Content-Type','application/json','x-backup-secret',
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'backup_cron_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000);
  $c$);
END $do$;
