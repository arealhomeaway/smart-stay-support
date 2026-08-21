-- ============ program-level columns ============
ALTER TABLE public.owner_programs
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE public.owner_programs
  ADD COLUMN IF NOT EXISTS activated_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS operating_target_hours numeric NOT NULL DEFAULT 105,
  ADD COLUMN IF NOT EXISTS onboarding_milestone_hours numeric NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS onboarding_milestone_day integer NOT NULL DEFAULT 35,
  ADD COLUMN IF NOT EXISTS onboarding_lead uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS operations_lead uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS dfy_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dfy_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS last_owner_activity_at timestamptz;

-- ============ owner tasks (reviews) ============
ALTER TABLE public.owner_reviews
  ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'program_wide',
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id),
  ADD COLUMN IF NOT EXISTS business_question text,
  ADD COLUMN IF NOT EXISTS attachment_path text;

-- ============ participation entries ============
ALTER TABLE public.owner_time_entries
  ADD COLUMN IF NOT EXISTS activity_category text,
  ADD COLUMN IF NOT EXISTS decision_outcome text,
  ADD COLUMN IF NOT EXISTS comments text,
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS correction_reason text;

-- ============ program properties ============
CREATE TABLE IF NOT EXISTS public.owner_program_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.owner_programs(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id),
  closing_date date,
  closing_confirmed boolean NOT NULL DEFAULT false,
  added_on date NOT NULL DEFAULT current_date,
  added_by uuid REFERENCES auth.users(id),
  inclusion_status text NOT NULL DEFAULT 'included',
  onboarding_status text NOT NULL DEFAULT 'not_started',
  launch_status text NOT NULL DEFAULT 'not_ready',
  coverage_status text NOT NULL DEFAULT 'no_activity',
  last_owner_activity_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, property_id)
);
GRANT SELECT, INSERT, UPDATE ON public.owner_program_properties TO authenticated;
GRANT ALL ON public.owner_program_properties TO service_role;
ALTER TABLE public.owner_program_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage program properties" ON public.owner_program_properties
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Owners read their program properties" ON public.owner_program_properties
  FOR SELECT TO authenticated USING (public.owns_program(auth.uid(), program_id));
CREATE TRIGGER owner_program_properties_updated BEFORE UPDATE ON public.owner_program_properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ entry <-> property links (never carry minutes) ============
CREATE TABLE IF NOT EXISTS public.owner_time_entry_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.owner_time_entries(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_id, property_id)
);
GRANT SELECT, INSERT ON public.owner_time_entry_properties TO authenticated;
GRANT ALL ON public.owner_time_entry_properties TO service_role;
ALTER TABLE public.owner_time_entry_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read entry properties" ON public.owner_time_entry_properties
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Owners read their entry properties" ON public.owner_time_entry_properties
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.owner_time_entries e
    WHERE e.id = entry_id AND e.owner_user_id = auth.uid()));
CREATE POLICY "Owners link their own entries" ON public.owner_time_entry_properties
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.owner_time_entries e
    WHERE e.id = entry_id AND e.owner_user_id = auth.uid()));

-- ============ task <-> property links ============
CREATE TABLE IF NOT EXISTS public.owner_review_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.owner_reviews(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, property_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_review_properties TO authenticated;
GRANT ALL ON public.owner_review_properties TO service_role;
ALTER TABLE public.owner_review_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage review properties" ON public.owner_review_properties
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Owners read their review properties" ON public.owner_review_properties
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.owner_reviews r
    WHERE r.id = review_id AND public.owns_program(auth.uid(), r.program_id)));

-- ============ badges ============
CREATE TABLE IF NOT EXISTS public.owner_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.owner_programs(id) ON DELETE CASCADE,
  code text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  trigger_rule text NOT NULL,
  supporting jsonb NOT NULL DEFAULT '{}'::jsonb,
  needs_review boolean NOT NULL DEFAULT false,
  review_note text,
  UNIQUE (program_id, code)
);
GRANT SELECT, INSERT, UPDATE ON public.owner_badges TO authenticated;
GRANT ALL ON public.owner_badges TO service_role;
ALTER TABLE public.owner_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage badges" ON public.owner_badges
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Owners read their badges" ON public.owner_badges
  FOR SELECT TO authenticated USING (public.owns_program(auth.uid(), program_id));

-- ============ audit history ============
CREATE TABLE IF NOT EXISTS public.owner_program_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.owner_programs(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id),
  entry_id uuid REFERENCES public.owner_time_entries(id),
  review_id uuid REFERENCES public.owner_reviews(id),
  kind text NOT NULL,
  summary text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_value text,
  new_value text,
  reason text,
  actor_id uuid REFERENCES auth.users(id),
  actor_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.owner_program_events TO authenticated;
GRANT ALL ON public.owner_program_events TO service_role;
ALTER TABLE public.owner_program_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read program history" ON public.owner_program_events
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Owners read their program history" ON public.owner_program_events
  FOR SELECT TO authenticated USING (public.owns_program(auth.uid(), program_id));
CREATE POLICY "Signed-in users append program history" ON public.owner_program_events
  FOR INSERT TO authenticated WITH CHECK (
    public.is_staff(auth.uid()) OR public.owns_program(auth.uid(), program_id));

-- ============ alert de-duplication log ============
CREATE TABLE IF NOT EXISTS public.owner_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.owner_programs(id) ON DELETE CASCADE,
  alert_kind text NOT NULL,
  severity integer NOT NULL DEFAULT 0,
  status_at_send text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.owner_alert_log TO authenticated;
GRANT ALL ON public.owner_alert_log TO service_role;
ALTER TABLE public.owner_alert_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read alert log" ON public.owner_alert_log
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS owner_alert_log_program_idx ON public.owner_alert_log (program_id, alert_kind, sent_at DESC);

-- ============ backfill existing single-property programs ============
INSERT INTO public.owner_program_properties (program_id, property_id, added_on, inclusion_status, added_by)
SELECT p.id, p.property_id, COALESCE(p.started_on, p.created_at::date), 'included', p.created_by
FROM public.owner_programs p
WHERE p.property_id IS NOT NULL
ON CONFLICT (program_id, property_id) DO NOTHING;

INSERT INTO public.owner_time_entry_properties (entry_id, property_id)
SELECT e.id, pp.property_id
FROM public.owner_time_entries e
JOIN public.owner_program_properties pp ON pp.program_id = e.program_id
ON CONFLICT (entry_id, property_id) DO NOTHING;

UPDATE public.owner_reviews r
   SET task_type = 'property_specific',
       property_id = t.property_id
  FROM public.tickets t
 WHERE r.ticket_id = t.id AND t.property_id IS NOT NULL;

UPDATE public.owner_programs SET activated_at = created_at
 WHERE started_on IS NOT NULL AND activated_at IS NULL;

CREATE INDEX IF NOT EXISTS owner_program_properties_program_idx ON public.owner_program_properties (program_id);
CREATE INDEX IF NOT EXISTS owner_time_entry_properties_property_idx ON public.owner_time_entry_properties (property_id);
CREATE INDEX IF NOT EXISTS owner_program_events_program_idx ON public.owner_program_events (program_id, created_at DESC);