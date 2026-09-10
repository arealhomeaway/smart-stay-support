-- Minimal stub schema + a stand-in seed_demo_environment for validating
-- 20260909020000_fix_seed_demo_record_type.sql against a disposable local
-- Postgres. The real seed_demo_environment (20260826193501) has many more
-- dependent tables (work_types, ticket_steps, handoffs, ticket_activity,
-- demo_environment); this only reproduces the two ticket inserts the fix
-- migration actually targets (refs 900000 and 900002), against the tickets
-- table's real CHECK constraints, so the fix's text-replace can be proven
-- against the exact literal patterns that exist in the live function.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text,
  bucket text,
  priority text NOT NULL DEFAULT 'p3',
  status text NOT NULL DEFAULT 'open',
  record_type text NOT NULL DEFAULT 'active_task',
  source_channel text,
  guest_impact text,
  occupancy_status text,
  guest_in_residence boolean NOT NULL DEFAULT false,
  guest_name text,
  property_id uuid,
  work_type_id uuid,
  vendor_name text,
  assigned_to uuid,
  current_action_owner uuid,
  accountable_owner uuid,
  record_owner uuid,
  created_by uuid,
  reported_at timestamptz,
  response_due_at timestamptz,
  due_at timestamptz,
  acknowledged_at timestamptz,
  escalated_at timestamptz,
  escalation_level text NOT NULL DEFAULT 'none',
  handoff_status text NOT NULL DEFAULT 'none',
  initiator_type text,
  ref serial,
  is_demo boolean NOT NULL DEFAULT false,
  CONSTRAINT tickets_record_type_chk CHECK (record_type IN ('completed_interaction','active_task','collaborative_matter')),
  CONSTRAINT tickets_handoff_status_chk CHECK (handoff_status IN ('none','pending','accepted','rejected','expired')),
  CONSTRAINT tickets_escalation_chk CHECK (escalation_level IN ('none','supervisor','director','executive'))
);

-- Stand-in for the live seed_demo_environment: only the two ticket inserts
-- (refs 900000, 900002) the fix migration's replace() patterns target,
-- with the exact literal text those patterns match against. The other four
-- inserts (901, 903-905) are omitted here — they fail on
-- tickets_handoff_status_chk, a separate, not-yet-fixed defect, and adding
-- them would only make this fixture fail for an unrelated reason.
CREATE OR REPLACE FUNCTION public.seed_demo_environment(_actor uuid DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  p_birch uuid := gen_random_uuid();
  p_oak uuid := gen_random_uuid();
  wt_immediate uuid := gen_random_uuid();
  wt_review uuid := gen_random_uuid();
  actor uuid := gen_random_uuid();
  t_ac uuid;
BEGIN
  INSERT INTO public.tickets
    (title, description, category, bucket, priority, status, record_type, source_channel, guest_impact, occupancy_status,
     guest_in_residence, guest_name, property_id, work_type_id, vendor_name, assigned_to, current_action_owner,
     accountable_owner, record_owner, created_by, reported_at, response_due_at, due_at, acknowledged_at,
     escalated_at, escalation_level, handoff_status, initiator_type, ref, is_demo)
  VALUES
    ('DEMO — AC not cooling, guest mid-stay','...','maintenance','active_guest_emergency','p1','in_progress','ticket','guest_call','active_guest','occupied',
     true,'Demo Guest',p_birch,wt_immediate,'DEMO — Music City Air & Heat',actor,actor,
     actor,actor,actor,
     now() - interval '1 day', now() - interval '1 day' + interval '10 min', now() + interval '4 hours', now() - interval '1 day' + interval '13 min',
     now() - interval '20 hours','supervisor','accepted','guest',900000,true)
  RETURNING id INTO t_ac;

  INSERT INTO public.tickets
    (title, description, category, bucket, priority, status, record_type, source_channel, guest_impact, occupancy_status,
     guest_in_residence, property_id, work_type_id, assigned_to, current_action_owner, accountable_owner, record_owner, created_by,
     reported_at, response_due_at, due_at, acknowledged_at, handoff_status, initiator_type, ref, is_demo)
  VALUES
    ('DEMO — Home ready for handoff review','...','admin','administrative','p3','awaiting_owner','onboarding','internal','none','vacant',
     false,p_oak,wt_review,actor,actor,actor,actor,actor,
     now() - interval '2 days', now() - interval '2 days' + interval '8 hours', now() + interval '1 day', now() - interval '2 days' + interval '1 hour',
     'pending','internal',900002,true);
END;
$function$;
