-- ============ departments ============
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  blurb text,
  landing_path text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "departments_read_staff" ON public.departments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "departments_write_admin" ON public.departments FOR INSERT TO authenticated WITH CHECK (public.is_platform_owner(auth.uid()));
CREATE POLICY "departments_update_admin" ON public.departments FOR UPDATE TO authenticated USING (public.is_platform_owner(auth.uid())) WITH CHECK (public.is_platform_owner(auth.uid()));
CREATE TRIGGER departments_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.departments (code, label, blurb, landing_path, sort_order) VALUES
  ('onboarding','Onboarding','New properties from contract to launch-ready.','/onboarding',10),
  ('operations','Operations','Day-to-day guest and property matters.','/dashboard',20),
  ('vendors','Vendor Management','Dispatch, coverage, quality and vendor scorecards.','/oversight',30),
  ('finance','Finance','Spend approvals, invoices, exceptions and owner statements.','/dashboard',40),
  ('pricing','Pricing & Revenue','Rate oversight, exceptions and portfolio performance.','/analytics',50),
  ('listings','Listing & Portfolio Performance','Listing quality, reviews and portfolio results.','/analytics',60),
  ('leadership','Leadership','Company-wide oversight and executive decisions.','/command-center',70),
  ('homeowner','Homeowner Experience','Owner programs, approvals and communications.','/owner-programs',80);

-- ============ department members ============
CREATE TABLE public.department_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'member',
  market_scope text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.department_members TO authenticated;
GRANT ALL ON public.department_members TO service_role;
ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dept_members_read_staff" ON public.department_members FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "dept_members_insert_sup" ON public.department_members FOR INSERT TO authenticated WITH CHECK (public.is_supervisor(auth.uid()));
CREATE POLICY "dept_members_update_sup" ON public.department_members FOR UPDATE TO authenticated USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));
CREATE TRIGGER department_members_updated BEFORE UPDATE ON public.department_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.in_department(_user_id uuid, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.department_members m
    JOIN public.departments d ON d.id = m.department_id
    WHERE m.user_id = _user_id AND m.active AND d.code = _code
  ) OR public.is_platform_owner(_user_id)
$$;

-- ============ work projects (replaces Asana project grouping) ============
CREATE TABLE public.work_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  summary text,
  department_id uuid REFERENCES public.departments(id),
  property_id uuid REFERENCES public.properties(id),
  status text NOT NULL DEFAULT 'active',
  owner_id uuid REFERENCES auth.users(id),
  starts_on date,
  target_on date,
  archived_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.work_projects TO authenticated;
GRANT ALL ON public.work_projects TO service_role;
ALTER TABLE public.work_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_read_staff" ON public.work_projects FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "projects_insert_staff" ON public.work_projects FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "projects_update_sup" ON public.work_projects FOR UPDATE TO authenticated USING (public.is_supervisor(auth.uid()) OR owner_id = auth.uid()) WITH CHECK (public.is_supervisor(auth.uid()) OR owner_id = auth.uid());
CREATE TRIGGER work_projects_updated BEFORE UPDATE ON public.work_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS department_code text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.work_projects(id);
CREATE INDEX IF NOT EXISTS tickets_department_code_idx ON public.tickets (department_code);
CREATE INDEX IF NOT EXISTS tickets_project_id_idx ON public.tickets (project_id);

-- ============ external links ============
CREATE TABLE public.external_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  system text NOT NULL,
  external_id text NOT NULL,
  external_url text,
  external_parent_id text,
  last_synced_at timestamptz,
  last_sync_status text NOT NULL DEFAULT 'pending',
  last_error text,
  payload_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (system, external_id, entity_type),
  UNIQUE (entity_type, entity_id, system)
);
GRANT SELECT, INSERT, UPDATE ON public.external_links TO authenticated;
GRANT ALL ON public.external_links TO service_role;
ALTER TABLE public.external_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "external_links_read_staff" ON public.external_links FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "external_links_insert_sup" ON public.external_links FOR INSERT TO authenticated WITH CHECK (public.is_supervisor(auth.uid()));
CREATE POLICY "external_links_update_sup" ON public.external_links FOR UPDATE TO authenticated USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));
CREATE TRIGGER external_links_updated BEFORE UPDATE ON public.external_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.external_links (entity_type, entity_id, system, external_id, last_synced_at, last_sync_status)
SELECT 'property', p.id, 'ownerrez', p.ownerrez_property_id, p.ownerrez_synced_at,
       CASE WHEN p.ownerrez_synced_at IS NULL THEN 'pending' ELSE 'ok' END
FROM public.properties p
WHERE p.ownerrez_property_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============ integration events ============
CREATE TABLE public.integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system text NOT NULL,
  direction text NOT NULL,
  entity_type text,
  entity_id uuid,
  external_id text,
  operation text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  payload_hash text,
  request_payload jsonb,
  previous_value jsonb,
  error_message text,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX integration_events_status_idx ON public.integration_events (system, status, next_attempt_at);
GRANT SELECT, INSERT, UPDATE ON public.integration_events TO authenticated;
GRANT ALL ON public.integration_events TO service_role;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integration_events_read_staff" ON public.integration_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "integration_events_update_sup" ON public.integration_events FOR UPDATE TO authenticated USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));
CREATE TRIGGER integration_events_updated BEFORE UPDATE ON public.integration_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ field conflicts ============
CREATE TABLE public.field_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  system text NOT NULL,
  field_key text NOT NULL,
  field_label text NOT NULL,
  resolve_value text,
  external_value text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open',
  chosen_source text,
  final_value text,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX field_conflicts_open_idx ON public.field_conflicts (entity_type, entity_id, system, field_key) WHERE status = 'open';
GRANT SELECT, INSERT, UPDATE ON public.field_conflicts TO authenticated;
GRANT ALL ON public.field_conflicts TO service_role;
ALTER TABLE public.field_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "field_conflicts_read_staff" ON public.field_conflicts FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "field_conflicts_update_sup" ON public.field_conflicts FOR UPDATE TO authenticated USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));
CREATE TRIGGER field_conflicts_updated BEFORE UPDATE ON public.field_conflicts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ documents ============
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  department_id uuid REFERENCES public.departments(id),
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'link',
  storage_path text,
  external_url text,
  visibility text NOT NULL DEFAULT 'staff',
  required boolean NOT NULL DEFAULT false,
  note text,
  archived_at timestamptz,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_entity_idx ON public.documents (entity_type, entity_id);
GRANT SELECT, INSERT, UPDATE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_read_staff" ON public.documents FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "documents_insert_staff" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY "documents_update_sup" ON public.documents FOR UPDATE TO authenticated USING (public.is_supervisor(auth.uid()) OR uploaded_by = auth.uid()) WITH CHECK (public.is_supervisor(auth.uid()) OR uploaded_by = auth.uid());
CREATE TRIGGER documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ approvals ============
CREATE TABLE public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  department_id uuid REFERENCES public.departments(id),
  property_id uuid REFERENCES public.properties(id),
  kind text NOT NULL,
  title text NOT NULL,
  detail text,
  amount numeric,
  currency text NOT NULL DEFAULT 'USD',
  requested_by uuid REFERENCES auth.users(id),
  approver_id uuid REFERENCES auth.users(id),
  approver_role text,
  status text NOT NULL DEFAULT 'pending',
  decision_note text,
  decided_at timestamptz,
  due_on date,
  evidence_url text,
  external_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX approvals_status_idx ON public.approvals (status, department_id);
GRANT SELECT, INSERT, UPDATE ON public.approvals TO authenticated;
GRANT ALL ON public.approvals TO service_role;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approvals_read_staff" ON public.approvals FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "approvals_insert_staff" ON public.approvals FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND requested_by = auth.uid());
CREATE POLICY "approvals_update_decider" ON public.approvals FOR UPDATE TO authenticated USING (public.is_supervisor(auth.uid()) OR approver_id = auth.uid()) WITH CHECK (public.is_supervisor(auth.uid()) OR approver_id = auth.uid());
CREATE TRIGGER approvals_updated BEFORE UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ metric definitions ============
CREATE TABLE public.metric_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  section text NOT NULL,
  department_id uuid REFERENCES public.departments(id),
  business_definition text NOT NULL,
  source_system text NOT NULL,
  unit text NOT NULL DEFAULT 'count',
  target_text text,
  target_low numeric,
  target_high numeric,
  higher_is_better boolean NOT NULL DEFAULT true,
  drill_path text,
  connected boolean NOT NULL DEFAULT true,
  unavailable_reason text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.metric_definitions TO authenticated;
GRANT ALL ON public.metric_definitions TO service_role;
ALTER TABLE public.metric_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metric_definitions_read_staff" ON public.metric_definitions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "metric_definitions_insert_admin" ON public.metric_definitions FOR INSERT TO authenticated WITH CHECK (public.is_platform_owner(auth.uid()));
CREATE POLICY "metric_definitions_update_admin" ON public.metric_definitions FOR UPDATE TO authenticated USING (public.is_platform_owner(auth.uid())) WITH CHECK (public.is_platform_owner(auth.uid()));
CREATE TRIGGER metric_definitions_updated BEFORE UPDATE ON public.metric_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();