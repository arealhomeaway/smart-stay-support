-- 1. Onboarding tasks: subtasks, dependencies, exceptions, matter links, archiving
ALTER TABLE public.onboarding_tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.onboarding_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS depends_on uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exception_reason text,
  ADD COLUMN IF NOT EXISTS exception_by uuid,
  ADD COLUMN IF NOT EXISTS exception_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS onboarding_tasks_property_idx ON public.onboarding_tasks(property_id);
CREATE INDEX IF NOT EXISTS onboarding_tasks_parent_idx ON public.onboarding_tasks(parent_task_id);

-- 2. Internal onboarding notes with @mentions
CREATE TABLE IF NOT EXISTS public.onboarding_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  body text NOT NULL,
  mentions uuid[] NOT NULL DEFAULT '{}',
  internal boolean NOT NULL DEFAULT true,
  author_id uuid,
  is_demo boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.onboarding_notes TO authenticated;
GRANT ALL ON public.onboarding_notes TO service_role;
ALTER TABLE public.onboarding_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Onboarding staff read notes" ON public.onboarding_notes
  FOR SELECT TO authenticated
  USING (public.is_onboarding_staff(auth.uid()) OR public.is_supervisor(auth.uid()));
CREATE POLICY "Onboarding staff write notes" ON public.onboarding_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_onboarding_staff(auth.uid()) OR public.is_supervisor(auth.uid()));
CREATE POLICY "Supervisors archive notes" ON public.onboarding_notes
  FOR UPDATE TO authenticated
  USING (public.is_supervisor(auth.uid()) OR author_id = auth.uid())
  WITH CHECK (public.is_supervisor(auth.uid()) OR author_id = auth.uid());

CREATE TRIGGER onboarding_notes_updated_at BEFORE UPDATE ON public.onboarding_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Two-review handoff gate + full history
ALTER TABLE public.property_handoffs
  ADD COLUMN IF NOT EXISTS gate_step text NOT NULL DEFAULT 'kati_review',
  ADD COLUMN IF NOT EXISTS kati_reviewer uuid,
  ADD COLUMN IF NOT EXISTS kati_decision text,
  ADD COLUMN IF NOT EXISTS kati_note text,
  ADD COLUMN IF NOT EXISTS kati_at timestamptz,
  ADD COLUMN IF NOT EXISTS micah_reviewer uuid,
  ADD COLUMN IF NOT EXISTS micah_decision text,
  ADD COLUMN IF NOT EXISTS micah_note text,
  ADD COLUMN IF NOT EXISTS micah_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by uuid,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS live_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS exceptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.handoff_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id uuid NOT NULL REFERENCES public.property_handoffs(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  step text NOT NULL,
  decision text NOT NULL,
  reviewer_id uuid,
  note text,
  exception_reason text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.handoff_reviews TO authenticated;
GRANT ALL ON public.handoff_reviews TO service_role;
ALTER TABLE public.handoff_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read handoff reviews" ON public.handoff_reviews
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid()));
CREATE POLICY "Reviewers record decisions" ON public.handoff_reviews
  FOR INSERT TO authenticated
  WITH CHECK (public.is_supervisor(auth.uid()) OR public.is_onboarding_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS handoff_reviews_handoff_idx ON public.handoff_reviews(handoff_id);

-- 4. Standard external-record framework (Notion / Fillout replacements, incl. Property Utility Matrix)
CREATE TABLE IF NOT EXISTS public.external_databases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  source text NOT NULL DEFAULT 'notion',
  external_database_id text,
  description text,
  sync_enabled boolean NOT NULL DEFAULT false,
  read_only boolean NOT NULL DEFAULT true,
  verified boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.external_databases TO authenticated;
GRANT ALL ON public.external_databases TO service_role;
ALTER TABLE public.external_databases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read external databases" ON public.external_databases
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid()));

CREATE TRIGGER external_databases_updated_at BEFORE UPDATE ON public.external_databases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.external_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  database_key text NOT NULL REFERENCES public.external_databases(key) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'notion',
  external_id text NOT NULL,
  title text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  ownerrez_property_id text,
  match_status text NOT NULL DEFAULT 'unmatched',
  match_note text,
  matched_by uuid,
  matched_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (database_key, external_id)
);

GRANT SELECT, INSERT, UPDATE ON public.external_records TO authenticated;
GRANT ALL ON public.external_records TO service_role;
ALTER TABLE public.external_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read external records" ON public.external_records
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid()));
CREATE POLICY "Supervisors resolve external records" ON public.external_records
  FOR UPDATE TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.is_onboarding_staff(auth.uid()))
  WITH CHECK (public.is_supervisor(auth.uid()) OR public.is_onboarding_staff(auth.uid()));
CREATE POLICY "Supervisors add external records" ON public.external_records
  FOR INSERT TO authenticated
  WITH CHECK (public.is_supervisor(auth.uid()) OR public.is_onboarding_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS external_records_db_idx ON public.external_records(database_key, match_status);
CREATE INDEX IF NOT EXISTS external_records_property_idx ON public.external_records(property_id);

CREATE TRIGGER external_records_updated_at BEFORE UPDATE ON public.external_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Registry rows: every database gets identical treatment, none is special-cased.
INSERT INTO public.external_databases (key, label, source, description, sync_enabled, read_only, verified)
VALUES
  ('property_utility_matrix', 'Property Utility Matrix', 'notion', 'Utility accounts, providers and shut-off details per property.', false, true, false),
  ('property_access_details', 'Property Access Details', 'notion', 'Gate codes, lockboxes and entry instructions per property.', false, true, false),
  ('onboarding_intake', 'Onboarding Intake (Fillout replacement)', 'fillout', 'Owner intake submissions awaiting canonical property matching.', false, true, false)
ON CONFLICT (key) DO NOTHING;

-- 5. Feature flags for Stage 2 surfaces
INSERT INTO public.feature_flags (key, label, description, enabled)
VALUES
  ('onboarding_portal_v2', 'Onboarding portal (Stage 2)', 'Structured onboarding workflow, two-review handoff gate and external-record review queue.', true),
  ('onboarding_sharepoint_docs', 'Onboarding document links (SharePoint)', 'Disabled until the SharePoint connection is confirmed scoped to the approved folder.', false),
  ('onboarding_external_sync', 'Onboarding external database sync', 'Read-only configuration only. No Notion or Fillout writes.', false)
ON CONFLICT (key) DO NOTHING;