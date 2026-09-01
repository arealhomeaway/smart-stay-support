CREATE UNIQUE INDEX IF NOT EXISTS integration_events_mailbox_once
  ON public.integration_events (system, operation, external_id)
  WHERE operation = 'mailbox_message';

ALTER TABLE public.integration_events
  ADD COLUMN IF NOT EXISTS conversation_id text;

CREATE INDEX IF NOT EXISTS integration_events_conversation_idx
  ON public.integration_events (system, conversation_id)
  WHERE conversation_id IS NOT NULL;