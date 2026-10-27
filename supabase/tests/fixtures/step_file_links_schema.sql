-- Isolated stand-in for the live tables 0166 touches. Never run against a real database.
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('test.actor', true), '')::uuid $$;
CREATE FUNCTION private.is_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_setting('test.staff', true) = 'true' $$;
CREATE FUNCTION private.is_onboarding_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_setting('test.staff', true) = 'true' $$;
CREATE FUNCTION private.is_onboarding_leader(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_setting('test.leader', true) = 'true' $$;
CREATE FUNCTION public.plan_step_applies(_c jsonb, _f text, _m text[]) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE FUNCTION public.project_role_assignee(_p uuid, _r text) RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION public.plan_due_from_rule(_a date, _d int, _u text) RETURNS date LANGUAGE sql AS $$ SELECT _a + coalesce(_d,0) $$;

CREATE TABLE public.audit_log(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid, action text NOT NULL,
  entity_type text NOT NULL, entity_id uuid, entity_label text, reason text,
  before_value jsonb, after_value jsonb, created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.onboarding_projects(
  id uuid PRIMARY KEY, property_id uuid NOT NULL, status text NOT NULL DEFAULT 'active',
  project_manager uuid, director uuid, planned_closing_on date, target_handoff_on date, possession_on date,
  furnishing_scope text, modules text[], is_demo boolean DEFAULT true, template_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.onboarding_template_tasks(
  id uuid PRIMARY KEY, template_id uuid NOT NULL, title text NOT NULL);

CREATE TABLE public.onboarding_template_versions(id uuid PRIMARY KEY, snapshot jsonb);

CREATE TABLE public.onboarding_tasks(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL, stage text, title text NOT NULL,
  detail text, description text, done_when text, video_url text, assigned_to uuid, assigned_seat text,
  due_on date, status text DEFAULT 'open', blocks_handoff boolean, is_required boolean,
  requires_owner_approval boolean, evidence_required boolean, sort_order int, schedule_anchor text,
  schedule_offset_days int, schedule_offset_unit text, due_on_source text, tags text[], template_task_id uuid,
  is_demo boolean, owner_dependency text, parent_task_id uuid, archived_at timestamptz);
