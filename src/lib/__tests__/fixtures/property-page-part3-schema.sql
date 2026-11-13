-- Isolated stand-in for the live tables the Property page Part 3 staged change touches
-- (live column names and checks, Nov 13). Fake rows only.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE TABLE public.me(id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'tech', 'vendor', 'owner', 'onboarding');
CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE TABLE public.directors(user_id uuid);
CREATE FUNCTION public.is_onboarding_director(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.directors WHERE user_id = _u) $$;
CREATE TABLE public.functional_role_members(role_code text, user_id uuid);
CREATE FUNCTION public.holds_functional_role(_user_id uuid, _code text) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS (SELECT 1 FROM public.functional_role_members WHERE user_id = _user_id AND role_code = _code) $$;
-- Live definition of private.onboarding_home_lead (Nov 13).
CREATE FUNCTION private.onboarding_home_lead(_u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS
  $$ SELECT _u IS NOT NULL AND (public.has_role(_u, 'admin') OR public.is_onboarding_director(_u)) $$;
CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, actor_label text, action text NOT NULL,
  entity_type text NOT NULL, entity_id uuid, entity_label text, reason text, before_value jsonb, after_value jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.onboarding_projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'planning', project_manager uuid, utility_manager uuid, role_assignments jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_demo boolean NOT NULL DEFAULT false, handoff_state text DEFAULT 'in_progress',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.onboarding_project_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid, property_id uuid, kind text,
  summary text, detail text, prior_value text, new_value text, actor uuid, is_demo boolean, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.vendor_orgs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text, service_categories text[] NOT NULL DEFAULT '{}');
CREATE TABLE public.onboarding_project_stagers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL, vendor_org_id uuid NOT NULL,
  added_by uuid, added_at timestamptz NOT NULL DEFAULT now(), removed_at timestamptz, removed_by uuid);
CREATE TABLE public.documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text NOT NULL, entity_id uuid NOT NULL, title text,
  original_filename text, property_id uuid, category text, visibility text NOT NULL DEFAULT 'internal', is_demo boolean NOT NULL DEFAULT false,
  archived_at timestamptz, deleted_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.properties(id uuid PRIMARY KEY, name text);
CREATE FUNCTION public.format_property_label(p jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$ SELECT jsonb_build_object('primary', p->>'name') $$;
CREATE TABLE public.onboarding_follows(user_id uuid NOT NULL, property_id uuid NOT NULL, created_at timestamptz DEFAULT now(), PRIMARY KEY (user_id, property_id));
CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, kind text NOT NULL, title text NOT NULL,
  body text NOT NULL DEFAULT '', entity_type text, entity_id uuid, link_path text, priority text NOT NULL DEFAULT 'normal', actor_id uuid,
  read_at timestamptz, email_status text NOT NULL DEFAULT 'none', is_demo boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.owner_request_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, author_id uuid, author_type text,
  body text, is_demo boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
