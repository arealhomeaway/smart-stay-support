-- ============ Owner participation program: roadmap catalog ============
CREATE TABLE public.owner_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL,                 -- 'onboarding' | 'ongoing'
  stage text NOT NULL,                 -- e.g. 'Discover + assess'
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  owner_action text NOT NULL,          -- what the owner actually does
  decision_path text NOT NULL DEFAULT 'consult',  -- inform | consult | approve | time_sensitive
  planning_hours_low numeric(5,2) NOT NULL DEFAULT 0,   -- INTERNAL planning only, never shown to owners
  planning_hours_high numeric(5,2) NOT NULL DEFAULT 0,
  respond_within_days integer NOT NULL DEFAULT 5,
  recurring boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_task_templates TO authenticated;
GRANT ALL ON public.owner_task_templates TO service_role;
ALTER TABLE public.owner_task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read owner task templates" ON public.owner_task_templates
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Supervisors write owner task templates" ON public.owner_task_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER owner_task_templates_updated BEFORE UPDATE ON public.owner_task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ The 90-day program per home ============
CREATE TABLE public.owner_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_name text,
  owner_email text,
  status text NOT NULL DEFAULT 'pending',   -- pending | active | complete | paused
  started_on date,
  ends_on date,
  target_hours numeric(6,2) NOT NULL DEFAULT 100,
  onboarding_target_hours numeric(6,2) NOT NULL DEFAULT 60,
  ongoing_target_hours numeric(6,2) NOT NULL DEFAULT 40,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_programs TO authenticated;
GRANT ALL ON public.owner_programs TO service_role;
ALTER TABLE public.owner_programs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER owner_programs_updated BEFORE UPDATE ON public.owner_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: does this signed-in user own this program? (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.owns_program(_user_id uuid, _program_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.owner_programs WHERE id = _program_id AND owner_user_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.owns_program(uuid, uuid) FROM PUBLIC, anon;

CREATE POLICY "Staff read owner programs" ON public.owner_programs
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Owners read their own program" ON public.owner_programs
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "Supervisors manage owner programs" ON public.owner_programs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- ============ Owner reviews: the participation loop, linked to real tickets ============
CREATE TABLE public.owner_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.owner_programs(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.owner_task_templates(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  phase text NOT NULL,
  stage text NOT NULL,
  title text NOT NULL,
  recommendation text,
  evidence text,
  impact text,
  decision_path text NOT NULL DEFAULT 'consult',
  respond_by date,
  status text NOT NULL DEFAULT 'prepared',  -- prepared | awaiting_owner | answered | closed
  owner_decision text,                      -- approve | revise | decline | questions
  owner_response text,
  notified_at timestamptz,
  responded_at timestamptz,
  closed_at timestamptz,
  outcome text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX owner_reviews_program_idx ON public.owner_reviews(program_id);
CREATE INDEX owner_reviews_ticket_idx ON public.owner_reviews(ticket_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_reviews TO authenticated;
GRANT ALL ON public.owner_reviews TO service_role;
ALTER TABLE public.owner_reviews ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER owner_reviews_updated BEFORE UPDATE ON public.owner_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Staff read owner reviews" ON public.owner_reviews
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff manage owner reviews" ON public.owner_reviews
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Owners read their own reviews" ON public.owner_reviews
  FOR SELECT TO authenticated USING (public.owns_program(auth.uid(), program_id));
CREATE POLICY "Owners answer their own reviews" ON public.owner_reviews
  FOR UPDATE TO authenticated
  USING (public.owns_program(auth.uid(), program_id))
  WITH CHECK (public.owns_program(auth.uid(), program_id));

-- ============ Self-reported participation time ============
CREATE TABLE public.owner_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.owner_programs(id) ON DELETE CASCADE,
  review_id uuid REFERENCES public.owner_reviews(id) ON DELETE SET NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase text NOT NULL,
  entry_date date NOT NULL DEFAULT current_date,
  minutes integer NOT NULL,
  activity text NOT NULL,
  materials_reviewed text,
  output text,
  attested boolean NOT NULL DEFAULT false,
  amends_entry_id uuid REFERENCES public.owner_time_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX owner_time_entries_program_idx ON public.owner_time_entries(program_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_time_entries TO authenticated;
GRANT ALL ON public.owner_time_entries TO service_role;
ALTER TABLE public.owner_time_entries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_owner_time_entry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.minutes < 1 OR NEW.minutes > 1440 THEN
    RAISE EXCEPTION 'Reported time must be between 1 minute and 24 hours.';
  END IF;
  IF NEW.entry_date > current_date THEN
    RAISE EXCEPTION 'You cannot report time for a future date.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER owner_time_entries_validate BEFORE INSERT OR UPDATE ON public.owner_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_owner_time_entry();

CREATE POLICY "Staff read owner time entries" ON public.owner_time_entries
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Owners read their own time entries" ON public.owner_time_entries
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "Owners log their own time" ON public.owner_time_entries
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() AND public.owns_program(auth.uid(), program_id));

-- ============ Invite codes for owner self-signup ============
CREATE TABLE public.owner_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  program_id uuid NOT NULL REFERENCES public.owner_programs(id) ON DELETE CASCADE,
  owner_email text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 days'),
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_invites TO authenticated;
GRANT ALL ON public.owner_invites TO service_role;
ALTER TABLE public.owner_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read owner invites" ON public.owner_invites
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Supervisors manage owner invites" ON public.owner_invites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));