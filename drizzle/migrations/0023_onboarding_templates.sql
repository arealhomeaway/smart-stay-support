CREATE TABLE public.onboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.onboarding_template_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.onboarding_templates(id) ON DELETE CASCADE,
  stage text NOT NULL,
  title text NOT NULL,
  role text,
  detail text,
  sort_order integer NOT NULL DEFAULT 0,
  blocks_handoff boolean NOT NULL DEFAULT false,
  requires_owner_approval boolean NOT NULL DEFAULT false,
  owner_approval_when_active_owner boolean NOT NULL DEFAULT false,
  evidence_required boolean NOT NULL DEFAULT false,
  schedule_anchor text,
  offset_days integer,
  breezeway_template_id text,
  subtasks text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX onboarding_template_tasks_template_idx
  ON public.onboarding_template_tasks (template_id, sort_order);

CREATE UNIQUE INDEX onboarding_templates_one_default
  ON public.onboarding_templates (is_default)
  WHERE is_default AND NOT is_archived;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_templates TO authenticated;
GRANT ALL ON public.onboarding_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_template_tasks TO authenticated;
GRANT ALL ON public.onboarding_template_tasks TO service_role;

ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_template_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Onboarding staff read templates"
  ON public.onboarding_templates FOR SELECT TO authenticated
  USING (public.is_onboarding_staff(auth.uid()));

CREATE POLICY "Supervisors write templates"
  ON public.onboarding_templates FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()))
  WITH CHECK (public.is_supervisor(auth.uid()));

CREATE POLICY "Onboarding staff read template tasks"
  ON public.onboarding_template_tasks FOR SELECT TO authenticated
  USING (public.is_onboarding_staff(auth.uid()));

CREATE POLICY "Supervisors write template tasks"
  ON public.onboarding_template_tasks FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()))
  WITH CHECK (public.is_supervisor(auth.uid()));

CREATE TRIGGER onboarding_templates_updated_at
  BEFORE UPDATE ON public.onboarding_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER onboarding_template_tasks_updated_at
  BEFORE UPDATE ON public.onboarding_template_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();