-- Shared, server-only cache for Breezeway (and future) integration tokens.
-- Tokens are stored encrypted (AES-256-GCM) and are NEVER readable by the
-- browser: no anon/authenticated grants, RLS on, no policies.
CREATE TABLE IF NOT EXISTS public.integration_tokens (
  provider text PRIMARY KEY,
  access_token_enc text,
  refresh_token_enc text,
  obtained_at timestamptz,
  expires_at timestamptz,
  last_auth_attempt_at timestamptz,
  last_check_at timestamptz,
  last_check_ok boolean,
  last_error text,
  company_label text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- service_role only: server functions use the admin client. Deliberately no
-- GRANT to anon or authenticated — this table holds credentials material.
GRANT ALL ON public.integration_tokens TO service_role;

ALTER TABLE public.integration_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: RLS denies every anon/authenticated request by design.
