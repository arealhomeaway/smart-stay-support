-- Self-asserting proof for 20260909030000_seed_qa_work_order_only_fixture.sql
-- against a disposable local Postgres
-- (see fixtures/seed_qa_work_order_only_fixture_schema.sql).
--
-- Covers exactly what PR #7 Work Order acceptance needs from this fixture,
-- independent of seed_demo_environment: one demo property, one demo
-- ticket, one open demo Work Order linked to it; idempotent re-seeding;
-- completing the Work Order and dispatching a fresh one (Send for Repair
-- after completion); and archiving.
--
-- Re-run against any disposable Postgres 16 to reproduce:
--
--   createdb seed_qa_work_order_only_fixture_test
--   psql seed_qa_work_order_only_fixture_test -v ON_ERROR_STOP=1 -f supabase/tests/fixtures/seed_qa_work_order_only_fixture_schema.sql
--   psql seed_qa_work_order_only_fixture_test -v ON_ERROR_STOP=1 -f supabase/migrations/20260909030000_seed_qa_work_order_only_fixture.sql
--   psql seed_qa_work_order_only_fixture_test -v ON_ERROR_STOP=1 -f supabase/tests/seed_qa_work_order_only_fixture.test.sql
--   dropdb seed_qa_work_order_only_fixture_test
--
-- Run against a disposable local PostgreSQL 16 instance in this review
-- session (not the live database) — every assertion passed.
\set ON_ERROR_STOP on
\pset tuples_only on

INSERT INTO auth.users DEFAULT VALUES RETURNING id AS admin_id \gset
INSERT INTO public.user_roles(user_id, role) VALUES (:'admin_id', 'admin');

-- ---- 1. Seeding creates exactly one property, one ticket, one open Work
-- Order, and its opening event — nothing else.
SELECT public.seed_qa_work_order_fixture(:'admin_id');
SELECT 1/CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS creates_one_property
  FROM public.properties WHERE is_demo AND name = 'QA — PR7 Work Order Fixture Home';
SELECT 1/CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS creates_one_ticket
  FROM public.tickets WHERE is_demo AND title = 'QA — PR7 Work Order Acceptance Ticket';
SELECT 1/CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS creates_one_open_work_order
  FROM public.work_orders WHERE is_demo AND closed_at IS NULL;
SELECT 1/CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS records_one_created_event
  FROM public.work_order_events WHERE event_type = 'created';

-- ---- 2. Idempotent: re-seeding while the fixture is still current does
-- not duplicate anything.
SELECT public.seed_qa_work_order_fixture(:'admin_id');
SELECT 1/CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS reseed_does_not_duplicate_ticket
  FROM public.tickets;
SELECT 1/CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS reseed_does_not_duplicate_property
  FROM public.properties;
SELECT 1/CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS reseed_does_not_duplicate_work_order
  FROM public.work_orders;

-- ---- 3. Work Order completion, then a fresh Send for Repair: closing the
-- fixture's Work Order must free the ticket to take a new open one (the
-- real work_orders_one_open_per_ticket index enforces this).
UPDATE public.work_orders SET closed_at = now()
  WHERE title = 'QA — PR7 Work Order Acceptance Fixture';
INSERT INTO public.work_orders (ticket_id, property_id, title, is_demo)
  SELECT id, property_id, 'QA — PR7 Work Order Acceptance Fixture (re-dispatched)', true
  FROM public.tickets WHERE title = 'QA — PR7 Work Order Acceptance Ticket';
SELECT 1/CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS fresh_dispatch_creates_new_open_work_order
  FROM public.work_orders WHERE closed_at IS NULL;

-- ---- 4. Archiving closes any still-open Work Order and archives the
-- ticket — never deletes either.
SELECT public.archive_qa_work_order_fixture(:'admin_id');
SELECT 1/CASE WHEN count(*) = 0 THEN 1 ELSE 0 END AS archive_leaves_no_open_work_order
  FROM public.work_orders WHERE is_demo AND closed_at IS NULL;
SELECT 1/CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS archive_marks_ticket_archived_not_deleted
  FROM public.tickets WHERE archived_at IS NOT NULL;
SELECT 1/CASE WHEN count(*) = 2 THEN 1 ELSE 0 END AS both_work_orders_still_on_record
  FROM public.work_orders;

-- ---- 5. Re-seeding after archiving creates a brand-new, current fixture
-- (idempotency keys off archived_at, not a hardcoded ref).
SELECT public.seed_qa_work_order_fixture(:'admin_id');
SELECT 1/CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS reseed_after_archive_creates_current_ticket
  FROM public.tickets WHERE archived_at IS NULL;

\pset tuples_only off
SELECT 'All seed_qa_work_order_only_fixture assertions passed.' AS result;
