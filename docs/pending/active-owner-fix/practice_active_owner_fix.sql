-- Cancelled practice on the real database: applies 01 to 04 inside one transaction, runs the
-- read-only checks, then ROLLBACK. Nothing is kept.
BEGIN;
\i 01_fix1_plan_cards_read.sql
\i 02_engine.sql
\i 03_retire_a56.sql
\i 04_active_owner_label.sql
SELECT r.home, r.stage, r.open, r.locked, r.already_covered, r.skipped, r.reason FROM private.ao_enrolled_rows() r ORDER BY r.home;
SELECT count(*) AS plan_cards FROM public.ao_home_plan_cards;
SELECT count(*) AS held_or_pending_owner_email FROM public.owner_notifications WHERE created_at > now() - interval '1 minute';
ROLLBACK;
