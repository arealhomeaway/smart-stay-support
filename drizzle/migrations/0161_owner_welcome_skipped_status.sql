ALTER TABLE public.owner_welcome_messages DROP CONSTRAINT IF EXISTS owner_welcome_messages_status_check;
ALTER TABLE public.owner_welcome_messages ADD CONSTRAINT owner_welcome_messages_status_check
  CHECK (status = ANY (ARRAY['queued','sending','sent','failed','held_demo','skipped']));