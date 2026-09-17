-- Extend the isolated fact-review fixture; never execute against live data.
CREATE ROLE service_role;
ALTER TABLE public.properties ADD lifecycle_status text DEFAULT 'onboarding', ADD handoff_accepted_at timestamptz;
CREATE TABLE public.onboarding_projects (
  id uuid PRIMARY KEY, property_id uuid, modules text[] DEFAULT '{}',
  furnishing_scope text DEFAULT 'full_furnishing', director uuid, is_demo boolean DEFAULT true
);
CREATE TABLE public.onboarding_tasks (
  id uuid PRIMARY KEY, property_id uuid, stage text, archived_at timestamptz, status text
);
