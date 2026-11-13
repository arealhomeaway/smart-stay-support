-- Isolated stand-in for the live tables the Onboarding Home staged change touches (live column
-- names and checks, Nov 12). Fake rows only.
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
CREATE FUNCTION public.is_onboarding_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _u AND role::text IN ('admin', 'manager', 'onboarding')) $$;
CREATE FUNCTION public.is_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _u AND role::text IN ('admin', 'manager', 'tech', 'onboarding')) $$;
CREATE TABLE public.feature_flags(key text PRIMARY KEY, label text, description text, enabled boolean NOT NULL DEFAULT false);
CREATE TABLE public.functional_roles(code text PRIMARY KEY, current_seat_holder uuid, active boolean DEFAULT true);
CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, actor_label text, action text NOT NULL,
  entity_type text NOT NULL, entity_id uuid, entity_label text, reason text, before_value jsonb, after_value jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.properties(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, address_line1 text, unit text, city text,
  state text, postal_code text, lifecycle_status text DEFAULT 'onboarding', planned_closing_on date, is_demo boolean NOT NULL DEFAULT false);
CREATE TABLE public.onboarding_projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'planning' CHECK (status = ANY (ARRAY['planning','active','handoff','complete','cancelled'])),
  project_status text CHECK (project_status IS NULL OR project_status = ANY (ARRAY['Upcoming Property','Waiting on New House Assessment','Waiting for Design','Waiting for Closing','Waiting for Access to Home','Starting Onboard Process','Waiting for Deliveries','Repairs','Staging/Furniture Setup','Waiting for Handoff','Property Handed Off','Contract Fell Through'])),
  planned_closing_on date, director uuid, project_manager uuid, started_by uuid,
  furnishing_scope text NOT NULL DEFAULT 'full_furnishing' CHECK (furnishing_scope = ANY (ARRAY['full_furnishing','owner_furnished','no_furnishing'])),
  is_demo boolean NOT NULL DEFAULT false, completed_at timestamptz);
CREATE UNIQUE INDEX onboarding_projects_open_property_idx ON public.onboarding_projects(property_id) WHERE status <> 'cancelled';
CREATE TABLE public.onboarding_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, title text, archived_at timestamptz);
CREATE TABLE public.onboarding_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL, task_id uuid, body text NOT NULL,
  mentions uuid[] NOT NULL DEFAULT '{}', internal boolean NOT NULL DEFAULT true, author_id uuid, is_demo boolean NOT NULL DEFAULT false,
  archived_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.onboarding_project_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL, property_id uuid NOT NULL,
  kind text NOT NULL, summary text NOT NULL, detail text, prior_value text, new_value text, actor uuid, is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.vendor_orgs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text, service_categories text[] NOT NULL DEFAULT '{}');
