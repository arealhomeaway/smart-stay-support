CREATE TABLE public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_type text NOT NULL CHECK (claim_type = ANY (ARRAY['channel_aircover','channel_vrbo','guest_damage','deposit_recovery','insurance','owner_recovery'])),
  stage text NOT NULL DEFAULT 'potential' CHECK (stage = ANY (ARRAY['potential','gathering','costing','ready_to_submit','submitted','waiting_external','info_requested','decided','recovered','closed'])),
  disposition text CHECK (disposition IS NULL OR disposition = ANY (ARRAY['approved','partial','denied','withdrawn','written_off'])),
  disposition_reason text,
  title text NOT NULL,
  incident_description text,
  incident_on date,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  work_order_id uuid REFERENCES public.breezeway_work_orders(id) ON DELETE SET NULL,
  guest_name text,
  reservation_channel text,
  reservation_confirmation text,
  ownerrez_booking_id text,
  stay_arrival date,
  stay_departure date,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deadline_on date,
  follow_up_on date,
  submitted_on date,
  decided_on date,
  recovered_on date,
  closed_at timestamptz,
  estimated_amount numeric(12,2),
  actual_cost numeric(12,2),
  submitted_amount numeric(12,2),
  approved_amount numeric(12,2),
  recovered_amount numeric(12,2),
  currency text NOT NULL DEFAULT 'USD',
  external_reference text,
  cost_snapshot jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX claims_stage_idx ON public.claims (stage);
CREATE INDEX claims_property_idx ON public.claims (property_id);
CREATE INDEX claims_ticket_idx ON public.claims (ticket_id);
CREATE INDEX claims_deadline_idx ON public.claims (deadline_on);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.claims TO authenticated;
GRANT ALL ON public.claims TO service_role;

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can read claims" ON public.claims
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff can create claims" ON public.claims
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff can update claims" ON public.claims
  FOR UPDATE TO authenticated USING (public.is_internal_staff(auth.uid())) WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Supervisors can delete claims" ON public.claims
  FOR DELETE TO authenticated USING (public.is_supervisor(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.claim_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'note',
  body text,
  detail jsonb,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX claim_activity_claim_idx ON public.claim_activity (claim_id, created_at DESC);

GRANT SELECT, INSERT ON public.claim_activity TO authenticated;
GRANT ALL ON public.claim_activity TO service_role;

ALTER TABLE public.claim_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can read claim activity" ON public.claim_activity
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff can add claim activity" ON public.claim_activity
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));

ALTER TABLE public.evidence_requirements DROP CONSTRAINT evidence_requirements_subject_check;
ALTER TABLE public.evidence_requirements ADD CONSTRAINT evidence_requirements_subject_check
  CHECK (subject_type = ANY (ARRAY['ticket','onboarding_task','work_order','property','assessment','claim']));