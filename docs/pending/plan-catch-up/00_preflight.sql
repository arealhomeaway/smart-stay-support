-- Plan catch-up preflight. Run on the live database before apply.sql; it changes nothing.
-- Stops if the live bulk complete changed since it was captured on Nov 12 (live-capture/), or a function this change relies on is missing.
DO $$
BEGIN
  IF md5(pg_get_functiondef('public.bulk_complete_onboarding_tasks(uuid,uuid[],text,date,uuid,boolean)'::regprocedure))
     <> 'c47d225ed1e250669433b70e8f1c9c35' THEN
    RAISE EXCEPTION 'bulk_complete_onboarding_tasks changed since Nov 12. Stop and compare with live-capture/.';
  END IF;
  PERFORM 'private.ao_plan_outcomes(uuid,uuid[])'::regprocedure, 'private.ao_home_program(uuid)'::regprocedure,
          'public.holds_functional_role(uuid,text)'::regprocedure, 'public.has_role(uuid,app_role)'::regprocedure,
          'private.write_onboarding_bulk_completion(uuid,jsonb,uuid)'::regprocedure,
          'private.onboarding_bulk_review_blocker(uuid)'::regprocedure, 'private.onboarding_work_locked(uuid[])'::regprocedure;
  IF to_regclass('public.onboarding_task_batches') IS NOT NULL THEN
    RAISE NOTICE 'onboarding_task_batches already exists (kept from an earlier apply and undo); apply.sql reuses it.';
  END IF;
END $$;
