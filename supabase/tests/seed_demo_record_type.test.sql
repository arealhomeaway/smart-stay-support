-- Self-asserting proof for 20260909020000_fix_seed_demo_record_type.sql
-- against a disposable local Postgres
-- (see fixtures/seed_demo_record_type_schema.sql).
--
-- Confirms: (1) the original 'ticket'/'onboarding' record_type literals in
-- seed_demo_environment violate tickets_record_type_chk (allowed values
-- are only 'completed_interaction', 'active_task', 'collaborative_matter');
-- (2) the fix migration's live pg_get_functiondef/replace patch lands both
-- affected rows (refs 900000, 900002) on 'active_task' and lets the insert
-- succeed.
--
-- Re-run against any disposable Postgres 16 to reproduce:
--
--   createdb seed_demo_record_type_test
--   psql seed_demo_record_type_test -v ON_ERROR_STOP=1 -f supabase/tests/fixtures/seed_demo_record_type_schema.sql
--   psql seed_demo_record_type_test -v ON_ERROR_STOP=1 -f supabase/tests/seed_demo_record_type.test.sql
--   dropdb seed_demo_record_type_test
--
-- Run against a disposable local PostgreSQL 16 instance in this review
-- session (not the live database) — every assertion passed.
\set ON_ERROR_STOP on
\pset tuples_only on

-- ---- 1. Before the fix: the original literals violate the constraint.
\unset ON_ERROR_STOP
SELECT public.seed_demo_environment();
\set ON_ERROR_STOP on
SELECT 1/CASE WHEN count(*) = 0 THEN 1 ELSE 0 END AS original_literals_insert_nothing
  FROM public.tickets;

-- ---- 2. Apply the fix (the same pg_get_functiondef/replace technique
-- already used for 20260909014103, applied here to a separate migration file).
\i supabase/migrations/20260909020000_fix_seed_demo_record_type.sql

-- ---- 3. After the fix: both affected rows insert successfully with a
-- legal record_type.
SELECT public.seed_demo_environment();
SELECT 1/CASE WHEN count(*) = 2 THEN 1 ELSE 0 END AS both_rows_inserted_after_fix
  FROM public.tickets;
SELECT 1/CASE WHEN record_type = 'active_task' THEN 1 ELSE 0 END AS ac_ticket_record_type_is_active_task
  FROM public.tickets WHERE ref = 900000;
SELECT 1/CASE WHEN record_type = 'active_task' THEN 1 ELSE 0 END AS handoff_ticket_record_type_is_active_task
  FROM public.tickets WHERE ref = 900002;
-- The already-fixed escalation_level and each row's own handoff_status are
-- untouched by this migration — still exactly what the base function sets.
SELECT 1/CASE WHEN escalation_level = 'supervisor' THEN 1 ELSE 0 END AS escalation_level_unaffected
  FROM public.tickets WHERE ref = 900000;
SELECT 1/CASE WHEN handoff_status = 'accepted' THEN 1 ELSE 0 END AS ac_ticket_handoff_status_unaffected
  FROM public.tickets WHERE ref = 900000;
SELECT 1/CASE WHEN handoff_status = 'pending' THEN 1 ELSE 0 END AS handoff_ticket_handoff_status_unaffected
  FROM public.tickets WHERE ref = 900002;

\pset tuples_only off
SELECT 'All seed_demo_record_type assertions passed.' AS result;
