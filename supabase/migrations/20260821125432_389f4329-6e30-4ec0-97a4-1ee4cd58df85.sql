CREATE TABLE public.owner_contact_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.owner_programs(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES public.owner_notifications(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'p1',
  owner_name text,
  owner_phone text,
  owner_email text,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT 'Urgent matter — reach this homeowner by text or phone.',
  status text NOT NULL DEFAULT 'pending',
  handled_by uuid,
  handled_at timestamptz,
  handled_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.owner_contact_alerts TO authenticated;
GRANT ALL ON public.owner_contact_alerts TO service_role;

ALTER TABLE public.owner_contact_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisors read owner contact alerts"
ON public.owner_contact_alerts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Supervisors update owner contact alerts"
ON public.owner_contact_alerts FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE INDEX owner_contact_alerts_status_idx ON public.owner_contact_alerts (status, created_at DESC);