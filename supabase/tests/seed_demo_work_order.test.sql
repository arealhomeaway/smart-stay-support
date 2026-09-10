-- Self-asserting proof for seed_demo_work_order (20260908000000) and its
-- ticket-lookup fix (20260909000000), against a disposable local Postgres
-- (see fixtures/seed_demo_work_order_schema.sql).
--
-- The bug this proves fixed: seed_demo_environment archives the prior demo
-- AC ticket (soft — sets archived_at, never deletes) and inserts a fresh
-- one on every re-seed, without checking for an existing ref=900000 row
-- first — so a re-seed always leaves two tickets sharing that ref, one
-- archived. seed_demo_work_order's ticket lookup had no ORDER BY and did
-- not exclude archived rows, so on a re-seed it could resolve to the old,
-- archived ticket — which already had an open demo Work Order from the
-- prior run — and its idempotency guard would then silently return,
-- leaving the ticket actually visible today with no Work Order at all.
--
-- Re-run against any disposable Postgres 16 to reproduce:
--
--   createdb seed_demo_work_order_test
--   psql seed_demo_work_order_test -v ON_ERROR_STOP=1 -f supabase/tests/fixtures/seed_demo_work_order_schema.sql
--   psql seed_demo_work_order_test -v ON_ERROR_STOP=1 -f supabase/migrations/20260908000000_seed_demo_work_order.sql
--   psql seed_demo_work_order_test -v ON_ERROR_STOP=1 -f supabase/migrations/20260909000000_fix_seed_demo_work_order_ticket_lookup.sql
--   psql seed_demo_work_order_test -v ON_ERROR_STOP=1 -f supabase/tests/seed_demo_work_order.test.sql
--   dropdb seed_demo_work_order_test
--
-- Run against a disposable local PostgreSQL 16 instance in this review
-- session (not the live database) — every assertion passed.
\set ON_ERROR_STOP on
\pset tuples_only on

INSERT INTO auth.users DEFAULT VALUES RETURNING id AS actor_id \gset
INSERT INTO public.user_roles(user_id, role) VALUES (:'actor_id', 'admin');
INSERT INTO public.properties(is_demo) VALUES (true) RETURNING id AS p_birch \gset
INSERT INTO public.vendor_orgs(legal_name, display_name, is_demo)
  VALUES ('DEMO — Music City Air & Heat', 'DEMO — Music City Air & Heat', true);

-- ---- 1. Fresh seed: the base scenario's AC ticket exists, no Work Order yet.
INSERT INTO public.tickets(ref, is_demo, property_id) VALUES (900000, true, :'p_birch') RETURNING id AS t_ac_first \gset
SELECT public.seed_demo_work_order(:'actor_id');
SELECT 1/CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS fresh_seed_creates_one_work_order
  FROM public.work_orders WHERE ticket_id = :'t_ac_first';
SELECT 1/CASE WHEN title = 'DEMO — Replace AC compressor' THEN 1 ELSE 0 END AS work_order_has_expected_title
  FROM public.work_orders WHERE ticket_id = :'t_ac_first';
SELECT 1/CASE WHEN count(*) = 2 THEN 1 ELSE 0 END AS work_order_events_recorded
  FROM public.work_order_events;

-- ---- 2. Re-seeding the base scenario: seed_demo_environment's own pattern —
-- archive the old ticket, insert a fresh one sharing the same ref, with no
-- existence check. This is exactly what a second "Seed demo data" click does.
UPDATE public.tickets SET archived_at = now() WHERE id = :'t_ac_first';
INSERT INTO public.tickets(ref, is_demo, property_id) VALUES (900000, true, :'p_birch') RETURNING id AS t_ac_current \gset

-- ---- 3. Re-run seed_demo_work_order: must land the Work Order on the
-- *current* (non-archived) ticket, not silently no-op against the archived
-- one that already has an open Work Order from step 1.
SELECT public.seed_demo_work_order(:'actor_id');
SELECT 1/CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS reseed_creates_work_order_on_current_ticket
  FROM public.work_orders WHERE ticket_id = :'t_ac_current';
SELECT 1/CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS archived_ticket_keeps_its_own_prior_work_order
  FROM public.work_orders WHERE ticket_id = :'t_ac_first';

-- ---- 4. Idempotency: clicking "Seed demo data" again with the same current
-- ticket must not create a second Work Order on it.
SELECT public.seed_demo_work_order(:'actor_id');
SELECT 1/CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS second_click_does_not_duplicate
  FROM public.work_orders WHERE ticket_id = :'t_ac_current';

-- ---- 5. No base scenario yet: seed_demo_work_order must no-op quietly,
-- never error, when there's nothing demo-flagged to link to.
DELETE FROM public.work_order_events;
DELETE FROM public.work_orders;
DELETE FROM public.tickets;
SELECT public.seed_demo_work_order(:'actor_id');
SELECT 1/CASE WHEN count(*) = 0 THEN 1 ELSE 0 END AS no_base_ticket_means_no_work_order
  FROM public.work_orders;

\pset tuples_only off
SELECT 'All seed_demo_work_order assertions passed.' AS result;
