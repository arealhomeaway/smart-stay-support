-- Preflight for guest-in-residence-fix (read only).
SELECT format('default now: %s (expect true)', (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='tickets' AND column_name='guest_in_residence'))
UNION ALL SELECT format('vacant, no guest impact, guest in residence: %s', (SELECT count(*) FROM public.tickets WHERE occupancy_status='vacant' AND guest_impact='none' AND guest_in_residence))
UNION ALL SELECT format('vacant, no guest impact, guest update clock set: %s', (SELECT count(*) FROM public.tickets WHERE occupancy_status='vacant' AND guest_impact='none' AND next_guest_update_at IS NOT NULL))
UNION ALL SELECT format('resolved or closed with a guest update clock: %s', (SELECT count(*) FROM public.tickets WHERE status IN ('resolved','closed') AND next_guest_update_at IS NOT NULL))
UNION ALL SELECT format('rows the backfill changes: %s', (SELECT count(*) FROM public.tickets t WHERE (t.occupancy_status='vacant' AND t.guest_impact='none' AND (t.guest_in_residence OR t.next_guest_update_at IS NOT NULL)) OR (t.status IN ('resolved','closed') AND t.next_guest_update_at IS NOT NULL)))
UNION ALL SELECT format('occupied tickets (left alone): %s', (SELECT string_agg(ref::text || ' ' || occupancy_status || ' ' || guest_impact || ' ' || guest_in_residence, '; ' ORDER BY ref) FROM public.tickets WHERE occupancy_status <> 'vacant' OR guest_impact <> 'none'))
UNION ALL SELECT format('ticket triggers not enabled now: %s (expect 0; undo re-enables all)', (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.tickets'::regclass AND NOT tgisinternal AND tgenabled <> 'O'))
UNION ALL SELECT format('trigger already present: %s (expect false)', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='tickets_no_guest_clock_when_done'))
UNION ALL SELECT format('private.bonus_facts fingerprint: %s', (SELECT md5(p.prosrc) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.proname='bonus_facts'));
