CREATE TABLE public.onboarding_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  branch text,
  project_manager uuid,
  director uuid,
  planned_closing_on date,
  possession_on date,
  target_handoff_on date,
  furnishing_scope text NOT NULL DEFAULT 'full_furnishing',
  modules text[] NOT NULL DEFAULT '{}',
  external_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  started_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_projects_status_check CHECK (status IN ('planning','active','handoff','complete','cancelled')),
  CONSTRAINT onboarding_projects_furnishing_check CHECK (furnishing_scope IN ('full_furnishing','no_furnishing'))
);

CREATE UNIQUE INDEX onboarding_projects_open_property_idx
  ON public.onboarding_projects (property_id)
  WHERE status <> 'cancelled';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_projects TO authenticated;
GRANT ALL ON public.onboarding_projects TO service_role;

ALTER TABLE public.onboarding_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff read onboarding projects"
  ON public.onboarding_projects FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY "Onboarding staff manage onboarding projects"
  ON public.onboarding_projects FOR ALL TO authenticated
  USING (public.is_onboarding_staff(auth.uid()) OR public.is_supervisor(auth.uid()))
  WITH CHECK (public.is_onboarding_staff(auth.uid()) OR public.is_supervisor(auth.uid()));

CREATE TRIGGER update_onboarding_projects_updated_at
  BEFORE UPDATE ON public.onboarding_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.onboarding_project_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  kind text NOT NULL,
  summary text NOT NULL,
  detail text,
  prior_value text,
  new_value text,
  actor uuid,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX onboarding_project_events_project_idx
  ON public.onboarding_project_events (project_id, created_at DESC);

GRANT SELECT, INSERT ON public.onboarding_project_events TO authenticated;
GRANT ALL ON public.onboarding_project_events TO service_role;

ALTER TABLE public.onboarding_project_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff read onboarding project history"
  ON public.onboarding_project_events FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY "Onboarding staff write onboarding project history"
  ON public.onboarding_project_events FOR INSERT TO authenticated
  WITH CHECK (public.is_onboarding_staff(auth.uid()) OR public.is_supervisor(auth.uid()));