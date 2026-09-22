ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_signature text;

COMMENT ON COLUMN public.profiles.email_signature IS 'Personal sign-off appended to emails this person composes in Resolve.';