CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  title text NOT NULL,
  scope text,
  service_category text,
  priority text NOT NULL DEFAULT 'p3' CHECK (priority IN ('p1','p2','p3')),
  phase text NOT NULL DEFAULT 'permanent' CHECK (phase IN ('mitigation','permanent')),
  emergency_reason text,
  contractual_exception boolean NOT NULL DEFAULT false,
  policy_version text NOT NULL DEFAULT 'ARHA Maintenance Authority Policy for Resolve — v2',

  quote_requested_at timestamptz,
  quote_received_at timestamptz,
  quote_amount numeric(12,2),
  second_quote_amount numeric(12,2),
  replacement_cost numeric(12,2),
  diagnosis_uncertain boolean NOT NULL DEFAULT false,
  owner_requested_comparison boolean NOT NULL DEFAULT false,

  authority_level text CHECK (authority_level IN ('self','supervisor','owner','emergency')),
  approval_status text NOT NULL DEFAULT 'not_required' CHECK (approval_status IN ('not_required','pending','approved','declined','info_requested')),
  approval_id uuid REFERENCES public.approvals(id) ON DELETE SET NULL,
  approval_requested_at timestamptz,
  approval_requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_amount numeric(12,2),
  approval_decided_at timestamptz,
  approval_note text,

  vendor_org_id uuid REFERENCES public.vendor_orgs(id) ON DELETE SET NULL,
  vendor_name text,
  vendor_contacted_at timestamptz,
  vendor_acknowledged_at timestamptz,
  scheduled_for timestamptz,
  vendor_eta_at timestamptz,
  vendor_arrived_at timestamptz,
  vendor_completed_at timestamptz,
  missed_commitments integer NOT NULL DEFAULT 0,

  warranty_may_apply boolean NOT NULL DEFAULT false,
  warranty_kind text,
  warranty_contact text,
  warranty_contacted_at timestamptz,
  warranty_eta_at timestamptz,
  warranty_override_reason text,
  warranty_override_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  warranty_override_at timestamptz,

  temporary_mitigation text,
  permanent_repair_needed boolean NOT NULL DEFAULT false,
  follow_up_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,

  occupied_now boolean NOT NULL DEFAULT false,
  guest_notified_at timestamptz,
  final_cost numeric(12,2),
  invoice_reference text,
  vendor_report text,
  evidence_complete boolean NOT NULL DEFAULT false,

  claim_id uuid REFERENCES public.claims(id) ON DELETE SET NULL,
  recovery_id uuid REFERENCES public.guest_recovery(id) ON DELETE SET NULL,

  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closure_note text,
  reopened_at timestamptz,
  reopened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reopen_reason text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX work_orders_ticket_idx ON public.work_orders(ticket_id);
CREATE INDEX work_orders_property_idx ON public.work_orders(property_id);
CREATE INDEX work_orders_open_idx ON public.work_orders(closed_at) WHERE closed_at IS NULL;
CREATE INDEX work_orders_assigned_idx ON public.work_orders(assigned_to);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view work orders"
  ON public.work_orders FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY "Internal staff can create work orders"
  ON public.work_orders FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE POLICY "Internal staff can update work orders"
  ON public.work_orders FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE POLICY "Supervisors can delete work orders"
  ON public.work_orders FOR DELETE TO authenticated
  USING (public.is_supervisor(auth.uid()));

CREATE TRIGGER update_work_orders_updated_at
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.work_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  body text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX work_order_events_wo_idx ON public.work_order_events(work_order_id, created_at DESC);

GRANT SELECT, INSERT ON public.work_order_events TO authenticated;
GRANT ALL ON public.work_order_events TO service_role;

ALTER TABLE public.work_order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view work order events"
  ON public.work_order_events FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY "Internal staff can add work order events"
  ON public.work_order_events FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

ALTER TABLE public.evidence_requirements DROP CONSTRAINT IF EXISTS evidence_requirements_subject_type_check;
ALTER TABLE public.evidence_requirements ADD CONSTRAINT evidence_requirements_subject_type_check
  CHECK (subject_type IN ('ticket','claim','guest_recovery','onboarding_task','work_order','property','vendor'));