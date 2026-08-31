-- Minimal fixture schema matching the real Supabase schema shape closely
-- enough to load and exercise supabase/migrations/20260828220000_...sql
-- (the tickets_auto_assign trigger) unmodified, without needing the full
-- production migration history. Not a substitute for applying the real
-- migrations to a full staging database — see supabase/tests/auto_assign_trigger.test.sql
-- for how this is used.

-- Minimal fixture matching the real schema shape, just enough to load and
-- exercise the real auto-assign migration file unmodified.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());

CREATE TYPE public.app_role AS ENUM ('admin','manager','onboarding','tech','vendor','owner');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role public.app_role NOT NULL
);

CREATE TABLE public.functional_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  team text NOT NULL DEFAULT 'property_operations',
  coverage_window text,
  lunch_window text,
  lunch_coverage text,
  backup_role_code text,
  current_seat_holder uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  current_seat_name text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.work_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  bucket text NOT NULL DEFAULT 'administrative',
  team text NOT NULL DEFAULT 'property_operations',
  functional_role_code text,
  backup_coverage text,
  default_priority text NOT NULL DEFAULT 'p3',
  response_minutes integer NOT NULL DEFAULT 120,
  action_start_minutes integer NOT NULL DEFAULT 480,
  clock_type text NOT NULL DEFAULT 'standard',
  completion_target text,
  operating_standard text,
  required_closure_evidence text,
  guest_communication_required boolean NOT NULL DEFAULT false,
  pending_approval boolean NOT NULL DEFAULT false,
  playbook_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Test ticket',
  status text NOT NULL DEFAULT 'open',
  work_type_id uuid REFERENCES public.work_types(id),
  functional_role_code text,
  record_owner uuid,
  accountable_owner uuid,
  current_action_owner uuid,
  assigned_to uuid,
  created_by uuid,
  pending_handoff_to uuid,
  handoff_status text,
  escalation_level text
);

CREATE TABLE public.ticket_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'note',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL DEFAULT 'update',
  internal boolean NOT NULL DEFAULT true
);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  actor_label text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_label text,
  reason text,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
