-- Preflight for ticket-due-date (read only).
SELECT 'due_on column exists: ' || EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tickets' AND column_name='due_on')::text || ' (expect false)'
UNION ALL SELECT 'set_ticket_due_on exists: ' || EXISTS (SELECT 1 FROM pg_proc WHERE proname='set_ticket_due_on')::text || ' (expect false)'
UNION ALL SELECT format('open tickets: %s (of them from the Notion import: %s); resolved or closed: %s',
  (SELECT count(*) FROM public.tickets WHERE status NOT IN ('resolved','closed')),
  (SELECT count(*) FROM public.tickets WHERE status NOT IN ('resolved','closed') AND external_source='notion'),
  (SELECT count(*) FROM public.tickets WHERE status IN ('resolved','closed')))
UNION ALL SELECT 'triggers tickets_updated and tickets_keep_reopened_notion enabled: ' ||
  (SELECT bool_and(tgenabled = 'O') FROM pg_trigger WHERE tgrelid='public.tickets'::regclass AND tgname IN ('tickets_updated','tickets_keep_reopened_notion'))::text;
