ALTER TABLE public.email_log
  ADD COLUMN IF NOT EXISTS to_additional text[] NOT NULL DEFAULT '{}';