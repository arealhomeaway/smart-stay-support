-- Isolated stand-in for the live tables Property page Part 2 touches (live column names, Nov 13). Fake rows only.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
GRANT USAGE ON SCHEMA public, auth, private TO authenticated, service_role, anon;
CREATE TABLE public.me(id uuid);
GRANT SELECT ON public.me TO authenticated, anon, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'tech', 'vendor', 'owner', 'onboarding');
CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
CREATE TABLE public.directors(user_id uuid);
CREATE FUNCTION public.is_onboarding_director(_u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.directors WHERE user_id = _u) $$;
CREATE FUNCTION public.is_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _u AND role::text IN ('admin','manager','tech','onboarding')) $$;
CREATE FUNCTION public.seat_holder(_code text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT user_id FROM public.directors LIMIT 1 $$;
CREATE FUNCTION private.ao_digest_time() RETURNS time LANGUAGE sql STABLE AS $$ SELECT time '09:00' $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, full_name text, email text);
CREATE TABLE public.properties(id uuid PRIMARY KEY, name text, owner_record_id uuid, is_demo boolean DEFAULT false);
CREATE FUNCTION public.format_property_label(_p jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$ SELECT jsonb_build_object('primary', _p->>'name') $$;
CREATE TABLE public.property_owners(id uuid PRIMARY KEY, name text, email text, notes text);
GRANT SELECT, UPDATE ON public.property_owners TO authenticated;
CREATE TABLE public.onboarding_projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, status text DEFAULT 'active',
  project_manager uuid, director uuid, utility_manager uuid, role_assignments jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now());
CREATE TABLE public.onboarding_follows(property_id uuid, user_id uuid);
CREATE TABLE public.onboarding_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, title text);
CREATE TABLE public.onboarding_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL, task_id uuid, author_id uuid,
  body text NOT NULL, internal boolean DEFAULT true, is_demo boolean DEFAULT false, mentions uuid[] DEFAULT '{}', archived_at timestamptz,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
GRANT SELECT, INSERT ON public.onboarding_notes TO authenticated;
CREATE TABLE public.documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, entity_type text, entity_id uuid, deleted_at timestamptz);
CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, action text, entity_type text, entity_id uuid,
  entity_label text, before_value jsonb, after_value jsonb, created_at timestamptz DEFAULT now());
CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, kind text, title text, body text,
  entity_type text, entity_id uuid, link_path text, priority text, actor_id uuid, is_demo boolean DEFAULT false,
  email_status text DEFAULT 'none', created_at timestamptz DEFAULT now());
CREATE TABLE public.owner_programs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_user_id uuid, notify_email boolean DEFAULT true);
CREATE TABLE public.program_members(program_id uuid, user_id uuid, removed_at timestamptz);
CREATE TABLE public.owner_program_properties(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_id uuid, property_id uuid,
  archived_at timestamptz, created_at timestamptz DEFAULT now());
CREATE FUNCTION private.is_program_member(_program_id uuid, _user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.owner_programs p WHERE p.id=_program_id
    AND (p.owner_user_id=_user_id OR EXISTS (SELECT 1 FROM public.program_members m WHERE m.program_id=p.id AND m.user_id=_user_id AND m.removed_at IS NULL))) $$;
CREATE TABLE public.owner_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, property_id uuid);
CREATE TABLE public.owner_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_id uuid NOT NULL, owner_user_id uuid, kind text,
  priority text, title text, body text, action_path text, email_status text DEFAULT 'pending', sms_status text DEFAULT 'skipped',
  is_demo boolean DEFAULT false, read_at timestamptz, review_id uuid, delivery_error text, created_at timestamptz DEFAULT now());
CREATE TABLE public.ao_owner_email_days(owner_key uuid, day date, kind text, notification_id uuid, created_at timestamptz DEFAULT now(),
  UNIQUE (owner_key, day, kind));
CREATE TABLE public.ao_daily_email_items(notification_id uuid, daily_notification_id uuid, created_at timestamptz DEFAULT now());
CREATE TABLE public.ao_business_holidays(day date PRIMARY KEY, label text DEFAULT '');
CREATE TABLE public.work_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text DEFAULT 'opportunity', source text DEFAULT 'arha',
  program_id uuid, property_id uuid, title text, due_on date, response_types text[] DEFAULT '{}', status text DEFAULT 'sent',
  retired_at timestamptz, responded_at timestamptz, sent_at timestamptz DEFAULT now(), is_demo boolean DEFAULT false,
  updated_at timestamptz DEFAULT now());
CREATE PUBLICATION supabase_realtime;
