-- Preflight for guest-ready-standards (read only).
SELECT 'ticket-due-date applied (due_on exists): ' || EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tickets' AND column_name='due_on')::text || ' (expect true; stop if false)'
UNION ALL SELECT 'guest_ready_standards exists: ' || (to_regclass('public.guest_ready_standards') IS NOT NULL)::text || ' (expect false)'
UNION ALL SELECT 'tickets.due_locked exists: ' || EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tickets' AND column_name='due_locked')::text || ' (expect false)'
UNION ALL SELECT 'can_save_playbooks exists: ' || EXISTS (SELECT 1 FROM pg_proc WHERE proname='can_save_playbooks')::text || ' (expect true)'
UNION ALL SELECT 'work types found (Cleaning Review Log, Arrival check, Quarterly inspection review): ' ||
  (SELECT count(*) FROM public.work_types WHERE name IN ('Cleaning Review Log','Arrival check','Quarterly inspection review'))::text || ' (expect 3)';
