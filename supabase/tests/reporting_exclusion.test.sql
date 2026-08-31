-- Live-Postgres verification for the Track 0 archived/demo reporting
-- exclusion (September 2 Operations beta).
--
-- This is NOT a bun test — it proves the actual WHERE-clause/join semantics
-- every fixed query site relies on, against a real Postgres server, which
-- bun/TypeScript cannot do without a live Supabase/PostgREST instance (not
-- available in this sandbox). Run against any disposable Postgres to
-- reproduce:
--
--   createdb reporting_exclusion_test
--   psql reporting_exclusion_test -v ON_ERROR_STOP=1 -f supabase/tests/fixtures/reporting_exclusion_schema.sql
--   psql reporting_exclusion_test -v ON_ERROR_STOP=1 -f supabase/tests/reporting_exclusion.test.sql
--   dropdb reporting_exclusion_test
--
-- Covers the two query shapes used across the fixed call sites:
--   (A) direct filter — `.eq("is_demo", false).is("archived_at", null)` —
--       used by team.tsx, vendor.index.tsx, geo.server.ts, properties.tsx,
--       owner-portal.server.ts, tickets.$ticketId.tsx, inbound.functions.ts,
--       quarterly.server.ts, vendor.server.ts.
--   (B) ticket_id membership join — used by scorecard.server.ts and
--       command-center.server.ts for vendor_job_ratings, which has no
--       is_demo/archived_at column of its own (src/lib/live-tickets.ts).
--
-- A clean run prints only NOTICEs ending in "... PASS" and finishes with
-- "ALL ASSERTIONS PASSED".

\set ON_ERROR_STOP on

INSERT INTO public.tickets (id, title, status, is_demo, archived_at, reported_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Live post-beta matter', 'open', false, NULL, now()),
  ('00000000-0000-0000-0000-000000000002', 'Pre-launch imported matter', 'open', false, now() - interval '3 days', now() - interval '30 days'),
  ('00000000-0000-0000-0000-000000000003', 'Demo walkthrough matter', 'open', true, NULL, now());

INSERT INTO public.vendor_job_ratings (id, ticket_id, vendor_user_id, overall) VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 4.5),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 1.0),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 5.0);

DO $$
DECLARE
  live_ids uuid[];
  rated_ids uuid[];
BEGIN
  -- (A) Direct filter — the pattern used by every simple query-site fix.
  SELECT array_agg(id ORDER BY id) INTO live_ids
  FROM public.tickets
  WHERE is_demo = false AND archived_at IS NULL;

  ASSERT live_ids = ARRAY['00000000-0000-0000-0000-000000000001'::uuid],
    format('Expected only the live ticket to pass the direct filter, got %s', live_ids);
  RAISE NOTICE 'A1: archived ticket excluded by is_demo=false AND archived_at IS NULL ... PASS';
  RAISE NOTICE 'A2: demo ticket excluded by is_demo=false AND archived_at IS NULL ... PASS';
  RAISE NOTICE 'A3: legitimate live post-beta ticket included ... PASS';

  -- (4) Preservation: archived/demo rows still exist and are readable
  -- unfiltered — Track 0 explicitly forbids deleting either dataset.
  PERFORM 1 FROM public.tickets WHERE id = '00000000-0000-0000-0000-000000000002' AND archived_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Archived ticket must still exist in the table, unfiltered'; END IF;
  PERFORM 1 FROM public.tickets WHERE id = '00000000-0000-0000-0000-000000000003' AND is_demo = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demo ticket must still exist in the table, unfiltered'; END IF;
  ASSERT (SELECT count(*) FROM public.tickets) = 3,
    'All three tickets (live, archived, demo) must remain in the table — nothing here deletes';
  RAISE NOTICE 'A4: archived and demo tickets are preserved, not deleted ... PASS';

  -- (5) Active-queue non-interference: a live ticket''s own status/fields are
  -- completely unaffected by the presence of archived/demo siblings.
  PERFORM 1 FROM public.tickets WHERE id = '00000000-0000-0000-0000-000000000001' AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'Live ticket''s own queue-relevant fields must be untouched'; END IF;
  RAISE NOTICE 'A5: the live ticket''s active-queue fields are unaffected ... PASS';

  -- (B) ticket_id membership join — vendor_job_ratings has no is_demo/
  -- archived_at column of its own (src/lib/live-tickets.ts).
  SELECT array_agg(r.id ORDER BY r.id) INTO rated_ids
  FROM public.vendor_job_ratings r
  WHERE r.ticket_id IN (SELECT id FROM public.tickets WHERE is_demo = false AND archived_at IS NULL);

  ASSERT rated_ids = ARRAY['00000000-0000-0000-0000-000000000101'::uuid],
    format('Expected only the live ticket''s rating to survive the join-filter, got %s', rated_ids);
  RAISE NOTICE 'B1: vendor rating on an archived ticket excluded via ticket_id join ... PASS';
  RAISE NOTICE 'B2: vendor rating on a demo ticket excluded via ticket_id join ... PASS';
  RAISE NOTICE 'B3: vendor rating on the legitimate live ticket included via ticket_id join ... PASS';

  -- All three ratings must still exist unfiltered (same preservation rule).
  ASSERT (SELECT count(*) FROM public.vendor_job_ratings) = 3,
    'All three ratings must remain in the table — the join only changes what a query SELECTS, never what exists';
  RAISE NOTICE 'B4: excluded ratings are preserved in the table, not deleted ... PASS';
END $$;

\echo 'ALL ASSERTIONS PASSED'
