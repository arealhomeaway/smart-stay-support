-- Private scheduler token for the nightly STR cleaner-time check. Lives in the
-- unexposed private schema; the scheduled job reads it at run time and the app
-- verifies it through a service-role-only function. Never the public app key.
CREATE TABLE IF NOT EXISTS private.cleaner_cron_token (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO private.cleaner_cron_token(id) VALUES (1) ON CONFLICT DO NOTHING;
REVOKE ALL ON private.cleaner_cron_token FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cleaner_verify_cron_token(_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(length(_token) >= 32 AND _token = (SELECT token FROM private.cleaner_cron_token WHERE id = 1), false)
$$;
REVOKE ALL ON FUNCTION public.cleaner_verify_cron_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleaner_verify_cron_token(text) TO service_role;