-- Minimal stub schema for validating seed_demo_work_order (20260908000000,
-- fixed by 20260909000000) against a disposable local Postgres. Not part of
-- the app's real migration chain — just enough surface for both migrations
-- to apply and be exercised directly.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO PUBLIC;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;

CREATE TYPE public.app_role AS ENUM ('admin','manager','tech','onboarding','vendor','owner');
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role public.app_role NOT NULL
);
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_demo boolean NOT NULL DEFAULT false
);

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref serial,
  status text NOT NULL DEFAULT 'open',
  is_demo boolean NOT NULL DEFAULT false,
  property_id uuid REFERENCES public.properties(id),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vendor_orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  display_name text NOT NULL,
  is_demo boolean NOT NULL DEFAULT false
);

-- Real work_orders shape (20260902021357 + 20260903210448), trimmed to the
-- columns seed_demo_work_order and its dependents touch/require.
CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  title text NOT NULL,
  scope text,
  service_category text,
  priority text NOT NULL DEFAULT 'p3' CHECK (priority IN ('p1','p2','p3')),
  phase text NOT NULL DEFAULT 'permanent' CHECK (phase IN ('mitigation','permanent')),
  authority_level text CHECK (authority_level IN ('self','supervisor','owner','emergency')),
  approval_status text NOT NULL DEFAULT 'not_required' CHECK (approval_status IN ('not_required','pending','approved','declined','info_requested')),
  vendor_org_id uuid REFERENCES public.vendor_orgs(id) ON DELETE SET NULL,
  vendor_name text,
  vendor_contacted_at timestamptz,
  vendor_acknowledged_at timestamptz,
  scheduled_for timestamptz,
  vendor_eta_at timestamptz,
  temporary_mitigation text,
  permanent_repair_needed boolean NOT NULL DEFAULT false,
  occupied_now boolean NOT NULL DEFAULT false,
  guest_notified_at timestamptz,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closure_note text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX work_orders_one_open_per_ticket
  ON public.work_orders(ticket_id)
  WHERE closed_at IS NULL AND ticket_id IS NOT NULL;

CREATE TABLE public.work_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  body text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.properties, public.tickets, public.vendor_orgs,
  public.work_orders, public.work_order_events, public.user_roles TO PUBLIC;
