-- Live-Postgres verification of the REAL breezeway_outbound_tasks migrations
-- (both files, applied unmodified) — proves the constraint shapes the
-- application code assumes actually exist and behave as expected, beyond
-- what the in-memory test fakes (necessarily) approximate.
--
-- Not a bun test — exercises real Postgres constraint enforcement, which
-- bun/TypeScript cannot do. Run against any disposable Postgres 16 to
-- reproduce:
--
--   createdb outbound_review_test
--   psql outbound_review_test -v ON_ERROR_STOP=1 -f supabase/tests/fixtures/breezeway_outbound_review_schema.sql
--   psql outbound_review_test -v ON_ERROR_STOP=1 -f supabase/migrations/20260831190522_8c437f09-088b-47d5-aac9-2e9432a0d125.sql
--   psql outbound_review_test -v ON_ERROR_STOP=1 -f supabase/migrations/20260831193624_2ea18ce8-201f-4d09-8740-971a548a2ff5.sql
--   psql outbound_review_test -v ON_ERROR_STOP=1 -f supabase/tests/breezeway_outbound_review.test.sql
--   dropdb outbound_review_test
--
-- A clean run prints only NOTICEs ending in "... PASS" and finishes with
-- "ALL ASSERTIONS PASSED".
\set ON_ERROR_STOP on

INSERT INTO public.tickets (id) VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.properties (id) VALUES ('00000000-0000-0000-0000-000000000002');

DO $$
DECLARE
  r1 uuid;
  r2 uuid;
BEGIN
  -- 1. Two 'creating' rows for the SAME ticket must conflict (the original
  --    partial unique index).
  INSERT INTO public.breezeway_outbound_tasks
    (source_type, ticket_id, property_id, breezeway_home_id, request_key, status, title)
  VALUES ('ticket', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
          '1473933', 'req-A', 'creating', 'First attempt')
  RETURNING id INTO r1;

  BEGIN
    INSERT INTO public.breezeway_outbound_tasks
      (source_type, ticket_id, property_id, breezeway_home_id, request_key, status, title)
    VALUES ('ticket', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
            '1473933', 'req-B', 'creating', 'Racing attempt');
    RAISE EXCEPTION 'expected a unique-violation for a second creating row on the same ticket';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'T1: a second creating row for the same ticket is rejected (23505) ... PASS';
  END;

  -- 2. Move the first row to needs_review (the NEW migration's transition) —
  --    the lock must still hold; needs_review must ALSO block a new attempt.
  UPDATE public.breezeway_outbound_tasks SET status = 'needs_review' WHERE id = r1;

  BEGIN
    INSERT INTO public.breezeway_outbound_tasks
      (source_type, ticket_id, property_id, breezeway_home_id, request_key, status, title)
    VALUES ('ticket', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
            '1473933', 'req-C', 'creating', 'Attempt while needs_review');
    RAISE EXCEPTION 'expected needs_review to also hold the lock';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'T2: needs_review still holds the one-in-flight lock (new migration) ... PASS';
  END;

  -- 3. Abandoning the row must release the lock — a new attempt now succeeds.
  UPDATE public.breezeway_outbound_tasks SET status = 'abandoned' WHERE id = r1;
  INSERT INTO public.breezeway_outbound_tasks
    (source_type, ticket_id, property_id, breezeway_home_id, request_key, status, title)
  VALUES ('ticket', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
          '1473933', 'req-D', 'creating', 'Deliberate second send')
  RETURNING id INTO r2;
  RAISE NOTICE 'T3: abandoning the uncertain row releases the lock — a new send is accepted ... PASS';

  -- 4. Binding a breezeway_task_id already used elsewhere must conflict.
  UPDATE public.breezeway_outbound_tasks SET status = 'created', breezeway_task_id = 555001 WHERE id = r2;
  INSERT INTO public.breezeway_outbound_tasks
    (source_type, ticket_id, property_id, breezeway_home_id, request_key, status, title)
  VALUES ('ticket', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
          '1473933', 'req-E', 'needs_review', 'Another uncertain row');
  BEGIN
    UPDATE public.breezeway_outbound_tasks SET breezeway_task_id = 555001 WHERE request_key = 'req-E';
    RAISE EXCEPTION 'expected a unique-violation binding an already-used breezeway_task_id';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'T4: binding an already-linked Breezeway task id to another record is rejected ... PASS';
  END;

  -- 5. The status CHECK constraint added by the new migration accepts every
  --    reported new state and rejects an invalid one.
  UPDATE public.breezeway_outbound_tasks SET status = 'error' WHERE request_key = 'req-E';
  RAISE NOTICE 'T5a: status=error accepted ... PASS';
  BEGIN
    UPDATE public.breezeway_outbound_tasks SET status = 'not_a_real_status' WHERE request_key = 'req-E';
    RAISE EXCEPTION 'expected the status CHECK constraint to reject an invalid value';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'T5b: an invalid status value is rejected by the CHECK constraint ... PASS';
  END;
END $$;

\echo 'ALL ASSERTIONS PASSED'
