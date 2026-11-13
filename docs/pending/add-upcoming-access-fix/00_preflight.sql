-- Preflight for the add_upcoming_onboarding_home access fix. Changes nothing.
-- Stops unless the live function is still the Nov 12 version (onboarding team check by is_onboarding_staff).
DO $$
DECLARE d text;
BEGIN
  IF to_regprocedure('public.add_upcoming_onboarding_home(uuid, text, text, text, text, text, date, text, text)') IS NULL THEN
    RAISE EXCEPTION 'Preflight: add_upcoming_onboarding_home is not there.';
  END IF;
  d := pg_get_functiondef('public.add_upcoming_onboarding_home(uuid, text, text, text, text, text, date, text, text)'::regprocedure);
  IF position('OR public.is_onboarding_staff(me))' IN d) = 0 THEN
    RAISE EXCEPTION 'Preflight: the live function changed since Nov 13 (or this fix is already in). Nothing changed.';
  END IF;
END $$;
