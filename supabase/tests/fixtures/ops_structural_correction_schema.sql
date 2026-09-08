-- Minimal stub schema for validating 20260905000000_ops_structural_correction.sql
-- against a disposable local Postgres. Not part of the app's real migration
-- chain — just enough surface for the new migration to apply and be
-- exercised directly.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO PUBLIC;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO PUBLIC;

CREATE TYPE public.app_role AS ENUM ('admin','manager','tech','onboarding','vendor','owner');
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role public.app_role NOT NULL
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_supervisor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('admin','manager'))
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('admin','manager','tech','onboarding'))
$$;

CREATE OR REPLACE FUNCTION public.is_internal_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff(_user_id)
$$;

-- private.* mirrors of is_staff/is_supervisor: the real migration history
-- moves the implementation into the private schema with public.* left as
-- thin wrappers (see 20260821194743). tickets_update and can_edit_ticket
-- call the private.* names directly, so the fixture needs them too.
CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff(_user_id)
$$;

CREATE OR REPLACE FUNCTION private.is_supervisor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_supervisor(_user_id)
$$;

CREATE TABLE public.functional_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  current_seat_holder uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.seat_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  kind text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT now() + interval '1 day'
);

CREATE OR REPLACE FUNCTION public.seat_override_at(_role_code text, _at timestamptz DEFAULT now())
RETURNS TABLE(user_id uuid, kind text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.user_id, o.kind FROM public.seat_overrides o
  WHERE o.role_code = _role_code AND _at BETWEEN o.starts_at AND o.ends_at
$$;

CREATE OR REPLACE FUNCTION public.seat_holder_at(_role_code text, _at timestamptz DEFAULT now())
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(
    (SELECT o.user_id FROM public.seat_override_at(_role_code, _at) o WHERE o.kind = 'cover'),
    (SELECT r.current_seat_holder FROM public.functional_roles r WHERE r.code = _role_code)
  )
$$;

CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_demo boolean NOT NULL DEFAULT false
);

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'open',
  is_demo boolean NOT NULL DEFAULT false,
  property_id uuid REFERENCES public.properties(id),
  vendor_user_id uuid REFERENCES auth.users(id),
  record_owner uuid REFERENCES auth.users(id),
  accountable_owner uuid REFERENCES auth.users(id),
  current_action_owner uuid REFERENCES auth.users(id),
  assigned_to uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  pending_handoff_to uuid REFERENCES auth.users(id)
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tickets_test_insert ON public.tickets FOR INSERT TO PUBLIC WITH CHECK (true);

-- Real definition (20260826192054): who may edit a ticket — a supervisor,
-- anyone named as its owner/assignee in one of these columns, or anyone at
-- all when the ticket has no owner yet.
CREATE OR REPLACE FUNCTION private.can_edit_ticket(_user_id uuid, _ticket_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = _ticket_id
      AND (
        private.is_supervisor(_user_id)
        OR t.record_owner = _user_id
        OR t.accountable_owner = _user_id
        OR t.current_action_owner = _user_id
        OR t.assigned_to = _user_id
        OR t.created_by = _user_id
        OR t.pending_handoff_to = _user_id
        OR COALESCE(t.record_owner, t.accountable_owner, t.current_action_owner, t.assigned_to) IS NULL
      )
  )
$$;

CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id),
  closed_at timestamptz
);

CREATE TABLE public.breezeway_outbound_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id)
);

CREATE TABLE public.handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid REFERENCES auth.users(id),
  to_user uuid REFERENCES auth.users(id)
);

CREATE TABLE public.escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escalated_by uuid NOT NULL REFERENCES auth.users(id),
  escalated_to_role text NOT NULL CHECK (escalated_to_role IN ('supervisor','director')),
  status text NOT NULL DEFAULT 'open'
);
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal staff read escalations" ON public.escalations
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY tickets_select ON public.tickets FOR SELECT TO authenticated USING (true);
GRANT ALL ON public.escalations, public.tickets, public.work_orders,
  public.breezeway_outbound_tasks, public.handoffs, public.functional_roles,
  public.user_roles, public.seat_overrides, public.properties TO PUBLIC;
