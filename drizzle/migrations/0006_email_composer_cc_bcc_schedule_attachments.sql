ALTER TABLE public.email_log
  ADD COLUMN IF NOT EXISTS cc text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bcc text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_time_zone text,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS email_log_scheduled_idx
  ON public.email_log (scheduled_for)
  WHERE status = 'scheduled';