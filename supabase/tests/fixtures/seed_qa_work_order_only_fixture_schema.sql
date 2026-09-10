-- Minimal stub schema for validating 20260909030000_seed_qa_work_order_only_fixture.sql
-- against a disposable local Postgres. Real properties/tickets/work_orders
-- shapes (base tables + the ops_structural_correction demo-consistency
-- trigger + the CHECK constraints two earlier fixes in this PR had to
-- learn the hard way), trimmed to what this fixture actually touches.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE SCHEMA IF NOT EXISTS private;

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
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref serial,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other',
  priority text NOT NULL DEFAULT 'p3',
  status text NOT NULL DEFAULT 'open',
  guest_in_residence boolean NOT NULL DEFAULT true,
  reported_at timestamptz NOT NULL DEFAULT now(),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  record_type text NOT NULL DEFAULT 'active_task',
  source_channel text NOT NULL DEFAULT 'internal',
  initiator_type text NOT NULL DEFAULT 'guest',
  handoff_type text,
  handoff_status text NOT NULL DEFAULT 'none',
  escalation_level text NOT NULL DEFAULT 'none',
  outcome_type text,
  closure_qa_result text NOT NULL DEFAULT 'not_reviewed',
  waiting_on text,
  is_demo boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  archive_reason text,
  archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT tickets_priority_chk CHECK (priority = ANY (ARRAY['p1'::text,'p2'::text,'p3'::text])),
  CONSTRAINT tickets_record_type_chk CHECK (record_type IN ('completed_interaction','active_task','collaborative_matter')),
  CONSTRAINT tickets_handoff_status_chk CHECK (handoff_status IN ('none','pending','accepted','rejected','expired')),
  CONSTRAINT tickets_handoff_type_chk CHECK (handoff_type IS NULL OR handoff_type IN ('action_request','ownership_transfer','shift_coverage','supervisor_intervention')),
  CONSTRAINT tickets_escalation_chk CHECK (escalation_level IN ('none','supervisor','director','executive')),
  CONSTRAINT tickets_qa_chk CHECK (closure_qa_result = ANY (ARRAY['not_reviewed'::text,'pass'::text,'fail'::text,'corrected'::text,'returned'::text,'waived'::text,'not_required'::text])),
  CONSTRAINT tickets_outcome_chk CHECK (outcome_type IS NULL OR outcome_type IN ('resolved','information_provided','vendor_completed','no_issue_found','cancelled_by_requestor','duplicate','other')),
  CONSTRAINT tickets_waiting_on_chk CHECK (waiting_on IS NULL OR waiting_on IN ('guest','owner','vendor','approval','parts','scheduled_date','internal_team','other'))
);

-- The real demo/property consistency trigger (ops_structural_correction,
-- already live): a demo ticket must link to a demo property, and vice versa.
CREATE OR REPLACE FUNCTION private.enforce_ticket_demo_consistency()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prop_is_demo boolean;
BEGIN
  IF NEW.property_id IS NOT NULL THEN
    SELECT is_demo INTO prop_is_demo FROM public.properties WHERE id = NEW.property_id;
    IF prop_is_demo IS NOT NULL AND prop_is_demo IS DISTINCT FROM NEW.is_demo THEN
      RAISE EXCEPTION 'A % ticket cannot be linked to a % property.',
        (CASE WHEN NEW.is_demo THEN 'demo' ELSE 'live' END),
        (CASE WHEN prop_is_demo THEN 'demo' ELSE 'live' END)
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tickets_demo_property_consistency
  BEFORE INSERT OR UPDATE OF property_id, is_demo ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION private.enforce_ticket_demo_consistency();

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

GRANT ALL ON public.properties, public.tickets, public.work_orders,
  public.work_order_events, public.user_roles TO PUBLIC;
