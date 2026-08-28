CREATE TABLE IF NOT EXISTS public.breezeway_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL,
  reason text,
  task_id bigint,
  home_id bigint,
  company_id bigint,
  task_updated_at timestamptz,
  is_fixture boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS breezeway_webhook_events_task_idx
  ON public.breezeway_webhook_events (task_id, task_updated_at DESC);
CREATE INDEX IF NOT EXISTS breezeway_webhook_events_received_idx
  ON public.breezeway_webhook_events (received_at DESC);

GRANT SELECT ON public.breezeway_webhook_events TO authenticated;
GRANT ALL ON public.breezeway_webhook_events TO service_role;
ALTER TABLE public.breezeway_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view breezeway webhook events" ON public.breezeway_webhook_events;
CREATE POLICY "Admins can view breezeway webhook events"
  ON public.breezeway_webhook_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.breezeway_webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id text,
  webhook_type text NOT NULL,
  receiver_host text NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  note text
);

GRANT SELECT ON public.breezeway_webhook_subscriptions TO authenticated;
GRANT ALL ON public.breezeway_webhook_subscriptions TO service_role;
ALTER TABLE public.breezeway_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view breezeway webhook subscriptions" ON public.breezeway_webhook_subscriptions;
CREATE POLICY "Admins can view breezeway webhook subscriptions"
  ON public.breezeway_webhook_subscriptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));