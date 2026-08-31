CREATE TABLE public.breezeway_outbound_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('ticket','onboarding_task')),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  onboarding_task_id uuid REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  breezeway_home_id text NOT NULL,
  request_key text NOT NULL,
  breezeway_task_id bigint,
  status text NOT NULL DEFAULT 'creating' CHECK (status IN ('creating','created','synced','error')),
  title text NOT NULL,
  description text,
  priority text,
  department text,
  scheduled_date date,
  scheduled_time text,
  template_id text,
  assignee text,
  tags text[],
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  last_webhook_at timestamptz,
  CONSTRAINT breezeway_outbound_source_exactly_one CHECK (
    (source_type = 'ticket' AND ticket_id IS NOT NULL AND onboarding_task_id IS NULL)
    OR (source_type = 'onboarding_task' AND onboarding_task_id IS NOT NULL AND ticket_id IS NULL)
  )
);

CREATE UNIQUE INDEX breezeway_outbound_request_key_uniq
  ON public.breezeway_outbound_tasks (request_key);

CREATE UNIQUE INDEX breezeway_outbound_task_id_uniq
  ON public.breezeway_outbound_tasks (breezeway_task_id)
  WHERE breezeway_task_id IS NOT NULL;

CREATE UNIQUE INDEX breezeway_outbound_one_inflight_ticket
  ON public.breezeway_outbound_tasks (ticket_id)
  WHERE ticket_id IS NOT NULL AND status = 'creating';

CREATE UNIQUE INDEX breezeway_outbound_one_inflight_onboarding
  ON public.breezeway_outbound_tasks (onboarding_task_id)
  WHERE onboarding_task_id IS NOT NULL AND status = 'creating';

CREATE INDEX breezeway_outbound_ticket_idx ON public.breezeway_outbound_tasks (ticket_id);
CREATE INDEX breezeway_outbound_onboarding_idx ON public.breezeway_outbound_tasks (onboarding_task_id);

GRANT SELECT ON public.breezeway_outbound_tasks TO authenticated;
GRANT ALL ON public.breezeway_outbound_tasks TO service_role;

ALTER TABLE public.breezeway_outbound_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Resolve staff can read outbound Breezeway links"
  ON public.breezeway_outbound_tasks FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'onboarding')
    OR public.has_role(auth.uid(), 'tech')
  );

CREATE TRIGGER breezeway_outbound_set_updated_at
  BEFORE UPDATE ON public.breezeway_outbound_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.feature_flags (key, label, description, enabled)
VALUES (
  'breezeway_outbound',
  'Breezeway outbound task creation',
  'Allows approved Resolve staff to create a Breezeway task from a ticket or onboarding task. Pilot property only.',
  false
)
ON CONFLICT (key) DO NOTHING;