ALTER TABLE public.onboarding_tasks ADD COLUMN IF NOT EXISTS owner_dependency text;
ALTER TABLE public.onboarding_tasks DROP CONSTRAINT IF EXISTS onboarding_tasks_owner_dependency_check;
ALTER TABLE public.onboarding_tasks ADD CONSTRAINT onboarding_tasks_owner_dependency_check
  CHECK (owner_dependency IS NULL OR owner_dependency IN ('none','information','feedback','acknowledge','business_decision'));
COMMENT ON COLUMN public.onboarding_tasks.owner_dependency IS
  'What the Task needs from the homeowner: none, information (info/documentation), feedback, acknowledge, business_decision. Only business_decision gates the Task (via requires_owner_approval).';
-- Backfill: existing approval gates are Business Decisions until reclassified.
UPDATE public.onboarding_tasks SET owner_dependency = 'business_decision'
  WHERE requires_owner_approval AND owner_dependency IS NULL;