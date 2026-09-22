ALTER TABLE public.onboarding_template_tasks
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.onboarding_tasks
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.onboarding_template_tasks.tags IS 'Free-form step tags. The reserved tag "active_owner" marks work meant for the homeowner to do.';
COMMENT ON COLUMN public.onboarding_tasks.tags IS 'Tags copied from the plan step; "active_owner" marks homeowner work.';

CREATE INDEX IF NOT EXISTS onboarding_tasks_tags_idx ON public.onboarding_tasks USING gin (tags);