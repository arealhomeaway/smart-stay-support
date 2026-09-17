-- Minimal isolated schema for exercising the actual migration. Never run in a live database.
CREATE SCHEMA auth;
CREATE ROLE authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
  $$ SELECT nullif(current_setting('test.actor', true), '')::uuid $$;
CREATE FUNCTION public.is_onboarding_staff(uuid) RETURNS boolean LANGUAGE sql AS
  $$ SELECT coalesce(current_setting('test.staff', true), 'false') = 'true' $$;
CREATE TABLE public.properties (
  id uuid PRIMARY KEY, wifi_notes text, access_notes text, address_line1 text,
  city text, state text, postal_code text, nickname text
);
CREATE TABLE public.property_fact_proposals (
  id uuid PRIMARY KEY, property_id uuid REFERENCES properties(id), project_id uuid,
  field_key text, field_label text, current_value text, proposed_value text,
  status text DEFAULT 'pending', reviewed_by uuid, reviewed_at timestamptz,
  decision_note text, is_demo boolean DEFAULT true
);
CREATE TABLE public.onboarding_project_events (
  project_id uuid, property_id uuid, kind text, summary text, detail text,
  prior_value text, new_value text, actor uuid, is_demo boolean
);
