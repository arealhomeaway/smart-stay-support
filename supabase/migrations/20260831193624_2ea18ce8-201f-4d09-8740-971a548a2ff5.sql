ALTER TABLE public.breezeway_outbound_tasks
  DROP CONSTRAINT IF EXISTS breezeway_outbound_tasks_status_check;

ALTER TABLE public.breezeway_outbound_tasks
  ADD CONSTRAINT breezeway_outbound_tasks_status_check
  CHECK (status IN ('creating','created','synced','error','needs_review','abandoned'));

ALTER TABLE public.breezeway_outbound_tasks
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

DROP INDEX IF EXISTS public.breezeway_outbound_one_inflight_ticket;
DROP INDEX IF EXISTS public.breezeway_outbound_one_inflight_onboarding;

CREATE UNIQUE INDEX breezeway_outbound_one_inflight_ticket
  ON public.breezeway_outbound_tasks (ticket_id)
  WHERE ticket_id IS NOT NULL AND status IN ('creating','needs_review');

CREATE UNIQUE INDEX breezeway_outbound_one_inflight_onboarding
  ON public.breezeway_outbound_tasks (onboarding_task_id)
  WHERE onboarding_task_id IS NOT NULL AND status IN ('creating','needs_review');