ALTER TABLE public.onboarding_projects
  ADD COLUMN utility_manager uuid;

COMMENT ON COLUMN public.onboarding_projects.utility_manager IS
  'Staff account accountable for utilities on this home. Shown to the homeowner as "Your utility manager".';