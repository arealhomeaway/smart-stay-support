DELETE FROM public.ticket_activity WHERE ticket_id IN (SELECT id FROM public.tickets WHERE external_source = 'email' AND created_at > now() - interval '60 minutes');
DELETE FROM public.tickets WHERE external_source = 'email' AND created_at > now() - interval '60 minutes';
DELETE FROM public.integration_events WHERE system = 'outlook_inbox';