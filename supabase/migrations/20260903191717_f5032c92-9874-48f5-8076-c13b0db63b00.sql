-- Utilities, financial requests, permanent-fact review, app settings and
-- financial reconciliation on handoff for the Onboarding operating system.

CREATE TABLE public.utility_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.onboarding_projects(id) ON DELETE SET NULL,
  utility_type text NOT NULL,
  provider text NOT NULL DEFAULT '',
  account_label text NOT NULL DEFAULT '',
  credential_id uuid REFERENCES public.property_credentials(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'needed',
  responsible text NOT NULL DEFAULT 'arha',
  service_start_on date,
  service_end_on date,
  notes text,
  created_by uuid,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.utility_accounts TO authenticated;
GRANT ALL ON public.utility_accounts TO service_role;
ALTER TABLE public.utility_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read utility accounts" ON public.utility_accounts FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Onboarding staff write utility accounts" ON public.utility_accounts FOR ALL TO authenticated USING (public.is_onboarding_staff(auth.uid())) WITH CHECK (public.is_onboarding_staff(auth.uid()));

CREATE TABLE public.utility_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.utility_accounts(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  period_start date,
  period_end date,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  invoice_ref text,
  paid_on date,
  notes text,
  created_by uuid,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.utility_costs TO authenticated;
GRANT ALL ON public.utility_costs TO service_role;
ALTER TABLE public.utility_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read utility costs" ON public.utility_costs FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Onboarding staff write utility costs" ON public.utility_costs FOR ALL TO authenticated USING (public.is_onboarding_staff(auth.uid())) WITH CHECK (public.is_onboarding_staff(auth.uid()));

CREATE TABLE public.financial_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.onboarding_projects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.onboarding_tasks(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'repair',
  title text NOT NULL,
  vendor text,
  description text,
  estimate_amount numeric(12,2) NOT NULL DEFAULT 0,
  authority_tier text NOT NULL DEFAULT 'proceed',
  emergency boolean NOT NULL DEFAULT false,
  emergency_reason text,
  approval_id uuid REFERENCES public.approvals(id) ON DELETE SET NULL,
  approved_amount numeric(12,2),
  approved_at timestamptz,
  invoice_amount numeric(12,2),
  invoice_ref text,
  invoice_at timestamptz,
  variance_note text,
  accounting_recipient text,
  accounting_sent_at timestamptz,
  settled_at timestamptz,
  settlement_note text,
  status text NOT NULL DEFAULT 'estimate',
  created_by uuid,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_requests TO authenticated;
GRANT ALL ON public.financial_requests TO service_role;
ALTER TABLE public.financial_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read financial requests" ON public.financial_requests FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Onboarding staff write financial requests" ON public.financial_requests FOR ALL TO authenticated USING (public.is_onboarding_staff(auth.uid())) WITH CHECK (public.is_onboarding_staff(auth.uid()));

CREATE TABLE public.property_fact_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.onboarding_projects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.onboarding_tasks(id) ON DELETE SET NULL,
  field_key text NOT NULL,
  field_label text NOT NULL,
  current_value text,
  proposed_value text NOT NULL,
  source text NOT NULL DEFAULT 'field_capture',
  source_detail text,
  status text NOT NULL DEFAULT 'pending',
  proposed_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  decision_note text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_fact_proposals TO authenticated;
GRANT ALL ON public.property_fact_proposals TO service_role;
ALTER TABLE public.property_fact_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read fact proposals" ON public.property_fact_proposals FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Onboarding staff write fact proposals" ON public.property_fact_proposals FOR ALL TO authenticated USING (public.is_onboarding_staff(auth.uid())) WITH CHECK (public.is_onboarding_staff(auth.uid()));

CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read settings" ON public.app_settings FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Admins write settings" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Financial reconciliation is tracked separately from operational Live.
ALTER TABLE public.property_handoffs
  ADD COLUMN IF NOT EXISTS financial_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS financial_reconciled_by uuid,
  ADD COLUMN IF NOT EXISTS financial_reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS financial_note text;

CREATE INDEX IF NOT EXISTS idx_financial_requests_property ON public.financial_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_utility_accounts_property ON public.utility_accounts(property_id);
CREATE INDEX IF NOT EXISTS idx_fact_proposals_property ON public.property_fact_proposals(property_id, status);