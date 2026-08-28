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

GRANT ALL ON public.integration_tokens TO service_role;

ALTER TABLE public.integration_tokens ENABLE ROW LEVEL SECURITY;