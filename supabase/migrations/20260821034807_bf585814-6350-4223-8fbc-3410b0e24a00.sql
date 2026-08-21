CREATE TABLE public.ticket_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  vendor_user_id uuid NOT NULL,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  check_in_lat double precision,
  check_in_lng double precision,
  check_in_accuracy_m double precision,
  check_in_distance_m double precision,
  check_in_verified boolean NOT NULL DEFAULT false,
  checked_out_at timestamptz,
  check_out_lat double precision,
  check_out_lng double precision,
  check_out_accuracy_m double precision,
  check_out_distance_m double precision,
  check_out_verified boolean NOT NULL DEFAULT false,
  minutes_on_site integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ticket_visits_ticket_idx ON public.ticket_visits(ticket_id);
CREATE INDEX ticket_visits_vendor_idx ON public.ticket_visits(vendor_user_id, checked_in_at DESC);
CREATE UNIQUE INDEX ticket_visits_one_open_per_vendor_ticket
  ON public.ticket_visits(ticket_id, vendor_user_id)
  WHERE checked_out_at IS NULL;

GRANT SELECT ON public.ticket_visits TO authenticated;
GRANT ALL ON public.ticket_visits TO service_role;

ALTER TABLE public.ticket_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can see their own site visits"
  ON public.ticket_visits FOR SELECT TO authenticated
  USING (vendor_user_id = auth.uid());

CREATE POLICY "Staff can see all site visits"
  ON public.ticket_visits FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER ticket_visits_updated_at
  BEFORE UPDATE ON public.ticket_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();