-- Nightly backup, Step 2: schedule 2 a.m. Central (Option B, Nov 5 2026).
-- The database creates its own random token in the unexposed private schema.
-- The scheduler reads it at run time and sends it as x-cron-secret; the app checks
-- it through a service-role-only function. No app secret, no vault copy.
-- Two calls (07:00 and 08:00 UTC) cover daylight saving; the route runs only the one
-- landing on 2 a.m. America/Chicago and skips a folder already backed up.
CREATE TABLE IF NOT EXISTS private.backup_cron_token (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO private.backup_cron_token(id) VALUES (1) ON CONFLICT DO NOTHING;
REVOKE ALL ON private.backup_cron_token FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.backup_verify_cron_token(_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(length(_token) >= 32 AND _token = (SELECT token FROM private.backup_cron_token WHERE id = 1), false)
$$;
REVOKE ALL ON FUNCTION public.backup_verify_cron_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_verify_cron_token(text) TO service_role;

DO $do$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('nightly-backup-0700utc','nightly-backup-0800utc');
  PERFORM cron.schedule('nightly-backup-0700utc', '0 7 * * *', $c$
    SELECT net.http_post(
      url := 'https://project--9ccd5407-8c2f-4bb6-af2b-c23477f01c08.lovable.app/api/public/hooks/nightly-backup',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
        (SELECT token FROM private.backup_cron_token WHERE id = 1)),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000);
  $c$);
  PERFORM cron.schedule('nightly-backup-0800utc', '0 8 * * *', $c$
    SELECT net.http_post(
      url := 'https://project--9ccd5407-8c2f-4bb6-af2b-c23477f01c08.lovable.app/api/public/hooks/nightly-backup',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
        (SELECT token FROM private.backup_cron_token WHERE id = 1)),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000);
  $c$);
END $do$;
