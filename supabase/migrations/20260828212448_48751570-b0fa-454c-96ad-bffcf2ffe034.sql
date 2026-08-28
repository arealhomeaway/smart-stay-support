ALTER TABLE public.breezeway_webhook_events
  ADD COLUMN IF NOT EXISTS retryable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovered_at timestamptz;

CREATE INDEX IF NOT EXISTS breezeway_webhook_events_retryable_idx
  ON public.breezeway_webhook_events (received_at)
  WHERE retryable = true AND recovered_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS breezeway_webhook_events_processed_once
  ON public.breezeway_webhook_events (task_id, task_updated_at, is_fixture)
  WHERE outcome = 'processed';