ALTER TABLE public.owner_reviews
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'program',
  ADD COLUMN IF NOT EXISTS onboarding_task_id uuid REFERENCES public.onboarding_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_action_type text NOT NULL DEFAULT 'review',
  ADD COLUMN IF NOT EXISTS available_from timestamptz,
  ADD COLUMN IF NOT EXISTS staff_context text;

UPDATE public.owner_reviews SET source_type = 'operations' WHERE ticket_id IS NOT NULL AND source_type = 'program';

ALTER TABLE public.owner_reviews
  DROP CONSTRAINT IF EXISTS owner_reviews_source_type_check,
  ADD CONSTRAINT owner_reviews_source_type_check CHECK (source_type IN ('onboarding','operations','program'));

ALTER TABLE public.owner_reviews
  DROP CONSTRAINT IF EXISTS owner_reviews_owner_action_type_check,
  ADD CONSTRAINT owner_reviews_owner_action_type_check CHECK (owner_action_type IN ('participate','review','approve','attend','research','document'));

CREATE UNIQUE INDEX IF NOT EXISTS owner_reviews_onboarding_task_uniq
  ON public.owner_reviews (onboarding_task_id) WHERE onboarding_task_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS owner_reviews_program_ticket_uniq
  ON public.owner_reviews (program_id, ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS owner_reviews_available_idx ON public.owner_reviews (program_id, available_from);

ALTER TABLE public.owner_task_templates
  ADD COLUMN IF NOT EXISTS owner_action_type text NOT NULL DEFAULT 'review';

ALTER TABLE public.owner_task_templates
  DROP CONSTRAINT IF EXISTS owner_task_templates_owner_action_type_check,
  ADD CONSTRAINT owner_task_templates_owner_action_type_check CHECK (owner_action_type IN ('participate','review','approve','attend','research','document'));