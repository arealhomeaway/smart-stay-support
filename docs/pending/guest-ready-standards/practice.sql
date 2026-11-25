-- Practice: run inside one transaction that always rolls back.
BEGIN;
-- APPLY: paste apply.sql here
SELECT label, locked, rule FROM public.guest_ready_standards ORDER BY sort_order;
SELECT count(*) AS open_locked FROM public.tickets WHERE due_locked;
ROLLBACK;
