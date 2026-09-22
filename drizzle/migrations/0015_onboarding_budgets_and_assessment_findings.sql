-- ============================================================
-- 1. Onboarding budgets (per property), lines, and change history
-- ============================================================
CREATE TABLE public.onboarding_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.onboarding_projects(id) ON DELETE SET NULL,
  approved_amount numeric(12,2),
  approved_basis text,
  approved_by uuid,
  approved_at timestamptz,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX onboarding_budgets_property_key ON public.onboarding_budgets(property_id);

GRANT SELECT, INSERT, UPDATE ON public.onboarding_budgets TO authenticated;
GRANT ALL ON public.onboarding_budgets TO service_role;
ALTER TABLE public.onboarding_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read onboarding budgets" ON public.onboarding_budgets
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff create onboarding budgets" ON public.onboarding_budgets
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff update onboarding budgets" ON public.onboarding_budgets
  FOR UPDATE TO authenticated USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE TABLE public.onboarding_budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.onboarding_budgets(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other',
  label text NOT NULL,
  vendor text,
  estimated_amount numeric(12,2) NOT NULL DEFAULT 0,
  committed_amount numeric(12,2),
  actual_amount numeric(12,2),
  status text NOT NULL DEFAULT 'planned',
  financial_request_id uuid REFERENCES public.financial_requests(id) ON DELETE SET NULL,
  note text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_budget_lines_category_check
    CHECK (category IN ('staging','furniture','contractor','supplies','other')),
  CONSTRAINT onboarding_budget_lines_status_check
    CHECK (status IN ('planned','committed','invoiced','paid','cancelled'))
);
CREATE INDEX onboarding_budget_lines_budget_idx ON public.onboarding_budget_lines(budget_id);
CREATE INDEX onboarding_budget_lines_property_idx ON public.onboarding_budget_lines(property_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_budget_lines TO authenticated;
GRANT ALL ON public.onboarding_budget_lines TO service_role;
ALTER TABLE public.onboarding_budget_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read budget lines" ON public.onboarding_budget_lines
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff create budget lines" ON public.onboarding_budget_lines
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff update budget lines" ON public.onboarding_budget_lines
  FOR UPDATE TO authenticated USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Supervisors remove budget lines" ON public.onboarding_budget_lines
  FOR DELETE TO authenticated USING (public.is_supervisor(auth.uid()));

-- Append-only change history: every budget or line change with a written reason.
CREATE TABLE public.onboarding_budget_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.onboarding_budgets(id) ON DELETE CASCADE,
  line_id uuid REFERENCES public.onboarding_budget_lines(id) ON DELETE SET NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  reason text NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX onboarding_budget_changes_budget_idx
  ON public.onboarding_budget_changes(budget_id, changed_at DESC);

GRANT SELECT, INSERT ON public.onboarding_budget_changes TO authenticated;
GRANT SELECT, INSERT ON public.onboarding_budget_changes TO service_role;
ALTER TABLE public.onboarding_budget_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read budget history" ON public.onboarding_budget_changes
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff append budget history" ON public.onboarding_budget_changes
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.block_budget_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Budget change history is append-only.';
END;
$$;

CREATE TRIGGER onboarding_budget_changes_immutable
  BEFORE UPDATE OR DELETE ON public.onboarding_budget_changes
  FOR EACH ROW EXECUTE FUNCTION public.block_budget_history_mutation();

CREATE TRIGGER onboarding_budgets_updated
  BEFORE UPDATE ON public.onboarding_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER onboarding_budget_lines_updated
  BEFORE UPDATE ON public.onboarding_budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. Assessment findings -> automatic correction tasks
-- ============================================================
CREATE TABLE public.assessment_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.onboarding_projects(id) ON DELETE SET NULL,
  source_task_id uuid REFERENCES public.onboarding_tasks(id) ON DELETE SET NULL,
  context text NOT NULL DEFAULT 'standard_assessment',
  category text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  detail text,
  location text,
  severity text NOT NULL DEFAULT 'normal',
  photo_url text,
  status text NOT NULL DEFAULT 'open',
  correction_task_id uuid REFERENCES public.onboarding_tasks(id) ON DELETE SET NULL,
  finding_key text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_findings_context_check
    CHECK (context IN ('new_house_setup','pre_work','standard_assessment')),
  CONSTRAINT assessment_findings_severity_check
    CHECK (severity IN ('minor','normal','urgent')),
  CONSTRAINT assessment_findings_status_check
    CHECK (status IN ('open','corrected','dismissed'))
);
CREATE UNIQUE INDEX assessment_findings_key_unique
  ON public.assessment_findings(property_id, finding_key)
  WHERE finding_key IS NOT NULL;
CREATE INDEX assessment_findings_property_idx
  ON public.assessment_findings(property_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.assessment_findings TO authenticated;
GRANT ALL ON public.assessment_findings TO service_role;
ALTER TABLE public.assessment_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read assessment findings" ON public.assessment_findings
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff record assessment findings" ON public.assessment_findings
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff update assessment findings" ON public.assessment_findings
  FOR UPDATE TO authenticated USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE TRIGGER assessment_findings_updated
  BEFORE UPDATE ON public.assessment_findings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- One finding, one tracked correction task: owner seat, due date, photo evidence.
CREATE OR REPLACE FUNCTION public.create_correction_task_for_finding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seat text;
  v_due date;
  v_task uuid;
BEGIN
  IF NEW.correction_task_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_seat := CASE
    WHEN NEW.category IN ('plumbing','electrical','appliance','hvac','damage','maintenance')
      THEN 'ops_supervisor'
    WHEN NEW.category IN ('supplies','missing_item','inventory')
      THEN 'po_day'
    ELSE 'project_manager'
  END;

  v_due := (now() AT TIME ZONE 'America/Chicago')::date + CASE NEW.severity
    WHEN 'urgent' THEN 2
    WHEN 'minor' THEN 21
    ELSE 7
  END;

  INSERT INTO public.onboarding_tasks (
    property_id, stage, title, detail, due_on, status,
    evidence_required, evidence_note, assigned_seat, blocks_handoff, is_demo, created_by
  ) VALUES (
    NEW.property_id,
    'phase3_work_orders',
    'Correct: ' || NEW.title,
    COALESCE(NEW.detail, '') ||
      CASE WHEN NEW.location IS NULL OR NEW.location = '' THEN ''
           ELSE E'\nLocation: ' || NEW.location END ||
      E'\nRaised by an assessment finding (' || NEW.context || ', ' || NEW.severity || ').',
    v_due,
    'open',
    true,
    'Attach a photo of the corrected item before closing this step.',
    v_seat,
    false,
    NEW.is_demo,
    NEW.created_by
  )
  RETURNING id INTO v_task;

  UPDATE public.assessment_findings
     SET correction_task_id = v_task
   WHERE id = NEW.id;

  NEW.correction_task_id := v_task;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assessment_findings_create_correction
  AFTER INSERT ON public.assessment_findings
  FOR EACH ROW EXECUTE FUNCTION public.create_correction_task_for_finding();