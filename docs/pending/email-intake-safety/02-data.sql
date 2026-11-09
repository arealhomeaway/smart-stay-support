-- Email intake safety batch, data step (one row). Run through the database query tool.
-- The claim left "processing" on Sep 1 23:49 UTC is marked skipped so it can never create work.
UPDATE public.integration_events
   SET status = 'skipped',
       error_message = 'left unfinished on Sep 1; closed so it can never create work',
       resolved_at = now()
 WHERE id = '8fbaabe8-805d-4f0d-a1c7-95660ab999b9'
   AND system = 'outlook_inbox'
   AND operation = 'mailbox_message'
   AND status = 'processing';
