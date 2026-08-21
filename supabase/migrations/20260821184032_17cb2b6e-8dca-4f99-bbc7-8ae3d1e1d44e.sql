-- ============ Vendor company foundation ============

CREATE TABLE public.vendor_orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  display_name text NOT NULL,
  vendor_class text NOT NULL DEFAULT 'company',
  status text NOT NULL DEFAULT 'potential',
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  website text,
  service_categories text[] NOT NULL DEFAULT '{}',
  markets text[] NOT NULL DEFAULT '{}',
  legacy_market_hints text[] NOT NULL DEFAULT '{}',
  legacy_all_groups boolean NOT NULL DEFAULT false,
  capacity_note text,
  response_time_note text,
  emergency_available boolean NOT NULL DEFAULT false,
  pricing_note text,
  payment_terms text,
  insurance_status text NOT NULL DEFAULT 'not_verified',
  insurance_expires_on date,
  license_status text NOT NULL DEFAULT 'not_verified',
  license_expires_on date,
  w9_status text NOT NULL DEFAULT 'not_verified',
  google_place_id text,
  google_rating numeric,
  google_review_count integer,
  google_refreshed_at timestamptz,
  trial_jobs_required integer NOT NULL DEFAULT 3,
  trial_score integer,
  tier text,
  approval_limit numeric,
  notes text,
  last_verified_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vendor_org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.vendor_orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_role text NOT NULL DEFAULT 'team_member',
  masked_code text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  attested_at timestamptz,
  attestation_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id),
  UNIQUE (org_id, masked_code)
);

CREATE TABLE public.vendor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.vendor_orgs(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  role_note text,
  legacy_departments text[] NOT NULL DEFAULT '{}',
  legacy_groups text[] NOT NULL DEFAULT '{}',
  legacy_account_state text,
  source_system text,
  match_status text NOT NULL DEFAULT 'unmatched',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vendor_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.vendor_orgs(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  reason text NOT NULL,
  actor_id uuid REFERENCES auth.users(id),
  actor_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vendor_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.vendor_orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version text NOT NULL,
  statement text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Coverage ============

CREATE TABLE public.property_vendor_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.vendor_orgs(id) ON DELETE CASCADE,
  service_category text NOT NULL,
  coverage_priority text NOT NULL DEFAULT 'primary',
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  rate_note text,
  playbook_id uuid REFERENCES public.playbooks(id),
  approval_limit numeric,
  access_requirements text,
  last_verified_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vendor_coverage_property_idx ON public.property_vendor_coverage(property_id, service_category);

-- ============ Gatekeeper ============

CREATE TABLE public.gatekeeper_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  detail text,
  applies_to_class text NOT NULL DEFAULT 'any',
  applies_to_category text,
  applies_to_market text,
  requirement_level text NOT NULL DEFAULT 'required',
  verification_method text,
  approver_role text NOT NULL DEFAULT 'manager',
  expires_after_days integer,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vendor_gatekeeper_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.vendor_orgs(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES public.gatekeeper_requirements(id) ON DELETE CASCADE,
  result text NOT NULL DEFAULT 'not_verified',
  note text,
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  expires_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, requirement_id)
);

-- ============ Documents ============

CREATE TABLE public.vendor_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.vendor_orgs(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  title text NOT NULL,
  storage_path text,
  external_url text,
  restricted boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'not_verified',
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  expires_on date,
  note text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Migration staging ============

CREATE TABLE public.vendor_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  label text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'open',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vendor_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.vendor_import_batches(id) ON DELETE CASCADE,
  source_role text NOT NULL DEFAULT 'service_provider',
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_name text NOT NULL,
  email text,
  phone text,
  departments text[] NOT NULL DEFAULT '{}',
  groups text[] NOT NULL DEFAULT '{}',
  proposed_action text NOT NULL DEFAULT 'needs_review',
  match_org_id uuid REFERENCES public.vendor_orgs(id) ON DELETE SET NULL,
  match_confidence numeric,
  match_reasons text[] NOT NULL DEFAULT '{}',
  decision text NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  decision_note text,
  created_org_id uuid REFERENCES public.vendor_orgs(id) ON DELETE SET NULL,
  created_contact_id uuid REFERENCES public.vendor_contacts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vendor_import_rows_batch_idx ON public.vendor_import_rows(batch_id, decision);

-- ============ Tenancy helpers ============

CREATE OR REPLACE FUNCTION public.is_vendor_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_org_members
    WHERE user_id = _user_id AND org_id = _org_id AND active
  )
$$;

CREATE OR REPLACE FUNCTION public.is_vendor_admin(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_org_members
    WHERE user_id = _user_id AND org_id = _org_id AND active
      AND vendor_role IN ('admin','dispatcher')
  )
$$;

-- ============ Grants + RLS ============

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_orgs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_org_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_contacts TO authenticated;
GRANT SELECT, INSERT ON public.vendor_status_events TO authenticated;
GRANT SELECT, INSERT ON public.vendor_attestations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_vendor_coverage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gatekeeper_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_gatekeeper_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_import_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_import_rows TO authenticated;
GRANT ALL ON public.vendor_orgs, public.vendor_org_members, public.vendor_contacts,
  public.vendor_status_events, public.vendor_attestations, public.property_vendor_coverage,
  public.gatekeeper_requirements, public.vendor_gatekeeper_results, public.vendor_documents,
  public.vendor_import_batches, public.vendor_import_rows TO service_role;

ALTER TABLE public.vendor_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_vendor_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gatekeeper_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_gatekeeper_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_import_rows ENABLE ROW LEVEL SECURITY;

-- vendor_orgs: staff read; supervisors write; vendor members read their own org
CREATE POLICY "vendor_orgs_read" ON public.vendor_orgs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_vendor_member(auth.uid(), id));
CREATE POLICY "vendor_orgs_insert" ON public.vendor_orgs FOR INSERT TO authenticated
  WITH CHECK (public.is_supervisor(auth.uid()));
CREATE POLICY "vendor_orgs_update" ON public.vendor_orgs FOR UPDATE TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.is_vendor_admin(auth.uid(), id))
  WITH CHECK (public.is_supervisor(auth.uid()) OR public.is_vendor_admin(auth.uid(), id));

CREATE POLICY "vendor_members_read" ON public.vendor_org_members FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_vendor_member(auth.uid(), org_id));
CREATE POLICY "vendor_members_write" ON public.vendor_org_members FOR INSERT TO authenticated
  WITH CHECK (public.is_supervisor(auth.uid()) OR public.is_vendor_admin(auth.uid(), org_id));
CREATE POLICY "vendor_members_update" ON public.vendor_org_members FOR UPDATE TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.is_vendor_admin(auth.uid(), org_id))
  WITH CHECK (public.is_supervisor(auth.uid()) OR public.is_vendor_admin(auth.uid(), org_id));

CREATE POLICY "vendor_contacts_read" ON public.vendor_contacts FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "vendor_contacts_write" ON public.vendor_contacts FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));

CREATE POLICY "vendor_status_read" ON public.vendor_status_events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "vendor_status_write" ON public.vendor_status_events FOR INSERT TO authenticated
  WITH CHECK (public.is_supervisor(auth.uid()));

CREATE POLICY "vendor_attest_read" ON public.vendor_attestations FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "vendor_attest_write" ON public.vendor_attestations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_vendor_member(auth.uid(), org_id));

CREATE POLICY "coverage_read" ON public.property_vendor_coverage FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_vendor_member(auth.uid(), org_id));
CREATE POLICY "coverage_write" ON public.property_vendor_coverage FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));

CREATE POLICY "gatekeeper_req_read" ON public.gatekeeper_requirements FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "gatekeeper_req_write" ON public.gatekeeper_requirements FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));

CREATE POLICY "gatekeeper_result_read" ON public.vendor_gatekeeper_results FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_vendor_admin(auth.uid(), org_id));
CREATE POLICY "gatekeeper_result_write" ON public.vendor_gatekeeper_results FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));

-- restricted docs: supervisors only; vendor admins see their own non-restricted docs
CREATE POLICY "vendor_docs_read" ON public.vendor_documents FOR SELECT TO authenticated
  USING (
    public.is_supervisor(auth.uid())
    OR (NOT restricted AND public.is_staff(auth.uid()))
    OR (NOT restricted AND public.is_vendor_admin(auth.uid(), org_id))
  );
CREATE POLICY "vendor_docs_write" ON public.vendor_documents FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));

CREATE POLICY "vendor_import_batches_all" ON public.vendor_import_batches FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));
CREATE POLICY "vendor_import_rows_all" ON public.vendor_import_rows FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));

-- updated_at triggers
CREATE TRIGGER vendor_orgs_updated BEFORE UPDATE ON public.vendor_orgs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER vendor_org_members_updated BEFORE UPDATE ON public.vendor_org_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER vendor_contacts_updated BEFORE UPDATE ON public.vendor_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER vendor_coverage_updated BEFORE UPDATE ON public.property_vendor_coverage FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER gatekeeper_requirements_updated BEFORE UPDATE ON public.gatekeeper_requirements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER vendor_gatekeeper_results_updated BEFORE UPDATE ON public.vendor_gatekeeper_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER vendor_documents_updated BEFORE UPDATE ON public.vendor_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER vendor_import_batches_updated BEFORE UPDATE ON public.vendor_import_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER vendor_import_rows_updated BEFORE UPDATE ON public.vendor_import_rows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- default gatekeeper requirements
INSERT INTO public.gatekeeper_requirements (code, label, detail, requirement_level, verification_method, approver_role, expires_after_days, sort_order) VALUES
  ('insurance', 'General liability insurance', 'Current certificate of insurance naming ARHA where required.', 'blocking', 'Document on file', 'manager', 365, 10),
  ('license', 'License / certification', 'Trade license where the work or market requires one.', 'required', 'Document on file', 'manager', 365, 20),
  ('w9', 'W-9 on file', 'Signed W-9 before any payment is issued.', 'blocking', 'Document on file', 'manager', NULL, 30),
  ('references', 'Two verified references', 'Two references contacted and recorded by a supervisor.', 'required', 'Reference check', 'manager', NULL, 40),
  ('attestation', 'Signed ARHA attestation', 'Subcontractor, insurance and confidentiality attestation signed by the vendor admin.', 'blocking', 'In-app signature', 'manager', 365, 50),
  ('identity', 'Identity verified', 'Identity document verified by an authorized verifier. Document itself stays restricted.', 'required', 'Restricted document review', 'admin', 730, 60),
  ('trial', 'Controlled trial completed', 'Required trial jobs completed and scored before approval.', 'required', 'Trial scorecard', 'manager', NULL, 70);
