-- Active Owner plan engine, pass 1. STAGED ONLY. Not applied.
-- Adds new objects only; replaces no live function, policy or trigger.
-- HARD RULE: never modifies onboarding templates (Full Plan, Standard), their versions or steps, or any home plan or Task.

CREATE TABLE public.ao_library_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version int NOT NULL DEFAULT 1,
  title text NOT NULL,
  what_text text NOT NULL DEFAULT '', why_text text NOT NULL DEFAULT '',
  how_text text NOT NULL DEFAULT '', required_output text NOT NULL DEFAULT '',
  documentation_note text NOT NULL DEFAULT '',
  est_hours_min numeric, est_hours_max numeric,
  lane text NOT NULL CHECK (lane IN ('critical','launch','flexible','triggered')),
  stage_window text NOT NULL CHECK (stage_window IN ('onboarding_early','onboarding_launch','anytime','operations')),
  team_needs_this boolean NOT NULL DEFAULT false,
  lock_rule text NOT NULL DEFAULT 'none' CHECK (lock_rule IN ('none','until_linked_step_done')),
  linked_template_task_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[], -- read-only refs; may list matching steps in both Full Plan and Standard
  deadline_business_days int NOT NULL DEFAULT 5,
  cutoff_business_days int NOT NULL DEFAULT 1,
  takeover_text text NOT NULL DEFAULT '',
  output_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  retired_at timestamptz,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ao_library_card_history (
  id bigserial PRIMARY KEY, card_id uuid NOT NULL REFERENCES public.ao_library_cards(id),
  version int NOT NULL, snapshot jsonb NOT NULL, changed_by uuid, changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ao_home_plan_settings (
  property_id uuid PRIMARY KEY REFERENCES public.properties(id),
  automated boolean NOT NULL DEFAULT false,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ao_home_plan_settings_history (
  id bigserial PRIMARY KEY, property_id uuid NOT NULL, automated boolean NOT NULL,
  changed_by uuid, changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ao_home_plan_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  program_id uuid NOT NULL REFERENCES public.owner_programs(id),
  card_id uuid NOT NULL REFERENCES public.ao_library_cards(id),
  card_version int NOT NULL,
  join_outcome text NOT NULL CHECK (join_outcome IN ('skipped_passed','already_covered','locked','open')),
  owner_review_id uuid REFERENCES public.owner_reviews(id),
  linked_task_id uuid REFERENCES public.onboarding_tasks(id),
  unlocked_at timestamptz, unlocked_by uuid,
  deadline_at timestamptz, reminder_at timestamptz, cutoff_at timestamptz,
  reminder_sent_at timestamptz, expired_at timestamptz, owner_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, card_id)
);
CREATE TABLE public.ao_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_card_id uuid NOT NULL REFERENCES public.ao_home_plan_cards(id),
  property_id uuid NOT NULL, program_id uuid NOT NULL, card_id uuid NOT NULL,
  submitted_by uuid NOT NULL, field_values jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ao_business_holidays (day date PRIMARY KEY, label text NOT NULL DEFAULT '');

GRANT SELECT ON public.ao_library_cards, public.ao_library_card_history, public.ao_home_plan_settings,
  public.ao_home_plan_settings_history, public.ao_home_plan_cards, public.ao_contributions, public.ao_business_holidays TO authenticated;
GRANT ALL ON public.ao_library_cards, public.ao_library_card_history, public.ao_home_plan_settings,
  public.ao_home_plan_settings_history, public.ao_home_plan_cards, public.ao_contributions, public.ao_business_holidays TO service_role;

ALTER TABLE public.ao_library_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ao_library_card_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ao_home_plan_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ao_home_plan_settings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ao_home_plan_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ao_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ao_business_holidays ENABLE ROW LEVEL SECURITY;

-- Reads: staff (existing is_staff helper); members read their own home cards and contributions.
CREATE POLICY ao_cards_staff_read ON public.ao_library_cards FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY ao_card_hist_staff_read ON public.ao_library_card_history FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY ao_settings_staff_read ON public.ao_home_plan_settings FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY ao_settings_hist_staff_read ON public.ao_home_plan_settings_history FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY ao_plan_read ON public.ao_home_plan_cards FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()) OR private.is_program_member(program_id, auth.uid()));
CREATE POLICY ao_contrib_read ON public.ao_contributions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid()) OR public.is_director(auth.uid())
         OR private.is_program_member(program_id, auth.uid()));
CREATE POLICY ao_holidays_read ON public.ao_business_holidays FOR SELECT TO authenticated USING (true);
-- Writes go only through later caller-authenticated RPCs (pass 2). No anon grants, no new anon-executable function.
