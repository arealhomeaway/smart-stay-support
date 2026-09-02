CREATE TABLE public.guest_recovery (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  claim_id uuid REFERENCES public.claims(id) ON DELETE SET NULL,
  stage text NOT NULL DEFAULT 'reported' CHECK (stage = ANY (ARRAY['reported','impact_confirmed','evidence','decision_drafted','awaiting_approval','approved','guest_offered','guest_accepted','completed','closed'])),
  outcome text CHECK (outcome IS NULL OR outcome = ANY (ARRAY['resolved','declined_no_compensation','guest_disputed','withdrawn'])),
  recovery_action text CHECK (recovery_action IS NULL OR recovery_action = ANY (ARRAY['none','apology','mitigation','credit','partial_refund','full_refund','fee_waiver','shorten_stay','relocation'])),
  title text NOT NULL,
  issue_summary text,
  impact_detail text,
  guest_name text,
  reservation_channel text,
  reservation_confirmation text,
  ownerrez_booking_id text,
  stay_arrival date,
  stay_departure date,
  nightly_rate numeric,
  impacted_nights numeric,
  proposed_amount numeric,
  approved_amount numeric,
  delivered_amount numeric,
  currency text NOT NULL DEFAULT 'USD',
  delivery_method text CHECK (delivery_method IS NULL OR delivery_method = ANY (ARRAY['ownerrez_refund','platform','credit','non_monetary','other'])),
  authority_level text CHECK (authority_level IS NULL OR authority_level = ANY (ARRAY['self','supervisor','director','owner','emergency'])),
  approval_id uuid REFERENCES public.approvals(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamp with time zone,
  delivered_on date,
  guest_notified_on date,
  follow_up_on date,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamp with time zone,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_recovery TO authenticated;
GRANT ALL ON public.guest_recovery TO service_role;
ALTER TABLE public.guest_recovery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view guest recovery"
  ON public.guest_recovery FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff can create guest recovery"
  ON public.guest_recovery FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff can update guest recovery"
  ON public.guest_recovery FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Supervisors can delete guest recovery"
  ON public.guest_recovery FOR DELETE TO authenticated
  USING (public.is_supervisor(auth.uid()));

CREATE INDEX guest_recovery_ticket_idx ON public.guest_recovery (ticket_id);
CREATE INDEX guest_recovery_stage_idx ON public.guest_recovery (stage);
CREATE INDEX guest_recovery_property_idx ON public.guest_recovery (property_id);
CREATE INDEX guest_recovery_assigned_idx ON public.guest_recovery (assigned_to);

CREATE TRIGGER update_guest_recovery_updated_at
  BEFORE UPDATE ON public.guest_recovery
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.guest_recovery_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recovery_id uuid NOT NULL REFERENCES public.guest_recovery(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  body text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.guest_recovery_activity TO authenticated;
GRANT ALL ON public.guest_recovery_activity TO service_role;
ALTER TABLE public.guest_recovery_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view guest recovery activity"
  ON public.guest_recovery_activity FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff can add guest recovery activity"
  ON public.guest_recovery_activity FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE INDEX guest_recovery_activity_recovery_idx ON public.guest_recovery_activity (recovery_id, created_at DESC);

ALTER TABLE public.evidence_requirements DROP CONSTRAINT evidence_requirements_subject_check;
ALTER TABLE public.evidence_requirements ADD CONSTRAINT evidence_requirements_subject_check
  CHECK (subject_type = ANY (ARRAY['ticket','onboarding_task','work_order','property','assessment','claim','guest_recovery']));