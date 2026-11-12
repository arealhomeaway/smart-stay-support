-- Onboarding Home as the project database (Admin approval Nov 12). Run first, same transaction as apply.sql.
-- Stops if anything this change relies on is missing or if any of its new objects already exist.
DO $$
BEGIN
  IF to_regprocedure('public.set_onboarding_project_role(uuid,text,uuid,boolean)') IS NULL THEN
    RAISE EXCEPTION 'Preflight: set_onboarding_project_role is missing.';
  END IF;
  IF to_regprocedure('public.is_onboarding_director(uuid)') IS NULL OR to_regprocedure('public.has_role(uuid,public.app_role)') IS NULL THEN
    RAISE EXCEPTION 'Preflight: a role check function is missing.';
  END IF;
  IF to_regprocedure('public.is_onboarding_staff(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Preflight: is_onboarding_staff is missing.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vendor_service_categories WHERE label = 'Staging' AND active) THEN
    RAISE EXCEPTION 'Preflight: the Staging vendor service category is missing.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_projects_status_check'
      AND pg_get_constraintdef(oid) LIKE '%planning%' AND pg_get_constraintdef(oid) LIKE '%cancelled%'
  ) THEN
    RAISE EXCEPTION 'Preflight: onboarding_projects status no longer allows planning and cancelled.';
  END IF;
  IF to_regclass('public.saved_views') IS NOT NULL OR to_regclass('public.onboarding_project_stagers') IS NOT NULL
     OR to_regclass('public.ownerrez_listing_cache') IS NOT NULL OR to_regclass('public.ownerrez_listing_dismissals') IS NOT NULL THEN
    RAISE EXCEPTION 'Preflight: a table this change adds already exists.';
  END IF;
END $$;
