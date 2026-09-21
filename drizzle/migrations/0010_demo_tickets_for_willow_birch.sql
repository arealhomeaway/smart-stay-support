-- Two demo tickets so the Operations side of the demo is not empty.
INSERT INTO public.tickets (property_id, title, description, category, priority, status, record_type, source_channel, initiator_type, is_demo)
SELECT 'a0000000-0000-4000-8000-00000000a001'::uuid,
       'Guest reports the AC is not cooling',
       'Demo ticket: guest says the upstairs rooms stay warm overnight.',
       'maintenance', 'p2', 'open', 'active_task', 'guest_message', 'guest', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.tickets WHERE is_demo AND property_id = 'a0000000-0000-4000-8000-00000000a001'::uuid
);

INSERT INTO public.tickets (property_id, title, description, category, priority, status, record_type, source_channel, initiator_type, is_demo)
SELECT 'a0000000-0000-4000-8000-00000000b001'::uuid,
       'Lockbox code not working at check-in',
       'Demo ticket: arriving guest cannot open the lockbox.',
       'access', 'p1', 'open', 'active_task', 'guest_message', 'guest', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.tickets WHERE is_demo AND property_id = 'a0000000-0000-4000-8000-00000000b001'::uuid
);
