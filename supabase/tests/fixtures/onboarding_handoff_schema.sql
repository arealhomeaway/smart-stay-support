-- Extend the isolated test schema. Never apply to a live database.
CREATE FUNCTION public.is_supervisor(uuid) RETURNS boolean LANGUAGE sql AS
  $$ SELECT coalesce(current_setting('test.supervisor', true), 'false') = 'true' $$;
ALTER TABLE properties ADD onboarding_stage text, ADD active boolean DEFAULT false;
ALTER TABLE onboarding_projects ADD status text DEFAULT 'active', ADD completed_at timestamptz;
CREATE TABLE property_handoffs (
  id uuid PRIMARY KEY, property_id uuid, status text, gate_step text,
  is_demo boolean DEFAULT true, open_task_ids uuid[] DEFAULT '{}',
  reviewed_by uuid, reviewed_at timestamptz, corrections text,
  exceptions jsonb DEFAULT '[]', kati_reviewer uuid, kati_decision text,
  kati_note text, kati_at timestamptz, micah_reviewer uuid, micah_decision text,
  micah_note text, micah_at timestamptz, accepted_by uuid, accepted_at timestamptz,
  live_confirmed_by uuid, live_confirmed_at timestamptz
);
CREATE TABLE handoff_reviews (
  handoff_id uuid, property_id uuid, step text, decision text,
  reviewer_id uuid, note text, exception_reason text, is_demo boolean
);
