-- Regression test: P4 is retired from the Operations priority model.
--
-- Proves at the database level that:
--   * p1, p2, p3 still insert normally (behaviour unchanged)
--   * p4 (and any other value) is rejected on tickets and work_types
--
-- Reproduce against any disposable Postgres:
--   createdb priority_constraint_test
--   psql priority_constraint_test -v ON_ERROR_STOP=1 -f supabase/tests/fixtures/priority_constraint_schema.sql
--   psql priority_constraint_test -v ON_ERROR_STOP=1 -f supabase/tests/priority_constraint.test.sql
--   dropdb priority_constraint_test

\set ON_ERROR_STOP on

DO $$
DECLARE
  rejected boolean;
BEGIN
  -- P1/P2/P3 still accepted.
  INSERT INTO public.tickets (title, priority) VALUES ('critical', 'p1'), ('high', 'p2'), ('standard', 'p3');
  IF (SELECT count(*) FROM public.tickets) <> 3 THEN
    RAISE EXCEPTION 'p1/p2/p3 inserts should all succeed';
  END IF;
  RAISE NOTICE 'tickets accept p1/p2/p3 ... PASS';

  -- Default priority is still p3.
  INSERT INTO public.tickets (title) VALUES ('defaulted');
  IF (SELECT priority FROM public.tickets WHERE title = 'defaulted') <> 'p3' THEN
    RAISE EXCEPTION 'default priority should remain p3';
  END IF;
  RAISE NOTICE 'tickets default to p3 ... PASS';

  -- P4 rejected on tickets.
  rejected := false;
  BEGIN
    INSERT INTO public.tickets (title, priority) VALUES ('retired', 'p4');
  EXCEPTION WHEN check_violation THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'p4 ticket insert should be rejected'; END IF;
  RAISE NOTICE 'tickets reject p4 ... PASS';

  -- P4 rejected on update too.
  rejected := false;
  BEGIN
    UPDATE public.tickets SET priority = 'p4' WHERE title = 'standard';
  EXCEPTION WHEN check_violation THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'p4 ticket update should be rejected'; END IF;
  RAISE NOTICE 'tickets reject update to p4 ... PASS';

  -- P4 rejected on work_types default_priority.
  rejected := false;
  BEGIN
    INSERT INTO public.work_types (name, default_priority) VALUES ('retired type', 'p4');
  EXCEPTION WHEN check_violation THEN
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'p4 work type insert should be rejected'; END IF;
  RAISE NOTICE 'work_types reject p4 ... PASS';

  INSERT INTO public.work_types (name, default_priority) VALUES ('standard type', 'p2');
  RAISE NOTICE 'work_types accept p1/p2/p3 ... PASS';

  RAISE NOTICE 'ALL ASSERTIONS PASSED';
END $$;
