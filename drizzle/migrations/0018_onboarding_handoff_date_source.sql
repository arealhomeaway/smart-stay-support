ALTER TABLE public.onboarding_projects
  ADD COLUMN IF NOT EXISTS target_handoff_source TEXT NOT NULL DEFAULT 'auto';

COMMENT ON COLUMN public.onboarding_projects.target_handoff_source IS
  'auto = target_handoff_on follows the access date (+3 weeks standard, +4 weeks Active Owner); manual = a person typed it.';