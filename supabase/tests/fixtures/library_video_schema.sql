-- Isolated stand-in for the live tables 0167 touches. Never run against a real database.
CREATE SCHEMA auth;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TYPE public.app_role AS ENUM ('admin','manager','tech','vendor','owner','onboarding');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('test.actor', true), '')::uuid $$;
CREATE TABLE public.user_roles(user_id uuid NOT NULL, role public.app_role NOT NULL);
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE FUNCTION public.is_internal_staff(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','manager','tech','onboarding')) $$;
CREATE TABLE public.owner_opportunity_library(id uuid PRIMARY KEY, title text NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE TABLE public.owner_programs(id uuid PRIMARY KEY, owner_user_id uuid, status text NOT NULL);
CREATE TABLE public.work_items(
  id uuid PRIMARY KEY, kind text NOT NULL, program_id uuid, library_template_id uuid,
  status text NOT NULL DEFAULT 'open', retired_at timestamptz);
