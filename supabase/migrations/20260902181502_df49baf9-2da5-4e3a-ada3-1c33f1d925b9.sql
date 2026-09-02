-- =========================================================
-- 1. Canonical Special Handling
-- =========================================================
CREATE TABLE IF NOT EXISTS public.special_handling (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  trade text,
  title text NOT NULL,
  instruction text NOT NULL,
  vendor_org_id uuid REFERENCES public.vendor_orgs(id) ON DELETE SET NULL,
  vendor_name text,
  threshold_amount numeric,
  owner_notification_required boolean NOT NULL DEFAULT false,
  applies_to text[] NOT NULL DEFAULT '{}',
  severity text NOT NULL DEFAULT 'standard',
  active boolean NOT NULL DEFAULT true,
  source text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT special_handling_rule_type_check CHECK (rule_type IN (
    'required_vendor','preferred_vendor','owner_self_maintenance','owner_notification',
    'spend_threshold','scheduling','access','trade_rule','restriction','note')),
  CONSTRAINT special_handling_severity_check CHECK (severity IN ('critical','standard','info'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_handling TO authenticated;
GRANT ALL ON public.special_handling TO service_role;
ALTER TABLE public.special_handling ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read special handling" ON public.special_handling
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Supervisors and onboarding write special handling" ON public.special_handling
  FOR INSERT TO authenticated
  WITH CHECK (public.is_supervisor(auth.uid()) OR public.is_onboarding_staff(auth.uid()));
CREATE POLICY "Supervisors and onboarding update special handling" ON public.special_handling
  FOR UPDATE TO authenticated
  USING (public.is_supervisor(auth.uid()) OR public.is_onboarding_staff(auth.uid()))
  WITH CHECK (public.is_supervisor(auth.uid()) OR public.is_onboarding_staff(auth.uid()));
CREATE POLICY "Supervisors delete special handling" ON public.special_handling
  FOR DELETE TO authenticated USING (public.is_supervisor(auth.uid()));

CREATE INDEX IF NOT EXISTS special_handling_property_idx ON public.special_handling(property_id) WHERE active;
CREATE TRIGGER special_handling_updated_at BEFORE UPDATE ON public.special_handling
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2. Playbook lifecycle, lineage and approval history
-- =========================================================
ALTER TABLE public.playbooks
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'authored',
  ADD COLUMN IF NOT EXISTS source_refs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS supersedes_id uuid REFERENCES public.playbooks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requires_director boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS retired_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

CREATE TABLE IF NOT EXISTS public.playbook_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id uuid NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_id uuid,
  actor_role text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.playbook_approvals TO authenticated;
GRANT ALL ON public.playbook_approvals TO service_role;
ALTER TABLE public.playbook_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read playbook approvals" ON public.playbook_approvals
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Supervisors record playbook approvals" ON public.playbook_approvals
  FOR INSERT TO authenticated WITH CHECK (public.is_supervisor(auth.uid()));

-- =========================================================
-- 3. Routine Controls
-- =========================================================
CREATE TABLE IF NOT EXISTS public.routine_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  event_key text NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  follow_up_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'due',
  outcome text,
  title text NOT NULL,
  guest_name text,
  reservation_confirmation text,
  reservation_channel text,
  stay_arrival date,
  stay_departure date,
  due_at timestamptz NOT NULL DEFAULT now(),
  assigned_to uuid,
  assigned_role_code text,
  team text,
  findings text,
  notes text,
  contact_result text,
  evidence_urls text[] NOT NULL DEFAULT '{}',
  completed_by uuid,
  completed_at timestamptz,
  created_by uuid,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT routine_controls_kind_check CHECK (kind IN ('cleaning_review','guest_review','checkout','guest_touch_base')),
  CONSTRAINT routine_controls_status_check CHECK (status IN ('due','in_progress','completed','cancelled')),
  CONSTRAINT routine_controls_outcome_check CHECK (outcome IS NULL OR outcome IN ('looks_good','needs_follow_up','no_answer','not_applicable'))
);
CREATE UNIQUE INDEX IF NOT EXISTS routine_controls_event_key_idx ON public.routine_controls(kind, event_key);
CREATE INDEX IF NOT EXISTS routine_controls_open_idx ON public.routine_controls(status, due_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_controls TO authenticated;
GRANT ALL ON public.routine_controls TO service_role;
ALTER TABLE public.routine_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read routine controls" ON public.routine_controls
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff create routine controls" ON public.routine_controls
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff update routine controls" ON public.routine_controls
  FOR UPDATE TO authenticated USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Supervisors delete routine controls" ON public.routine_controls
  FOR DELETE TO authenticated USING (public.is_supervisor(auth.uid()));

CREATE TRIGGER routine_controls_updated_at BEFORE UPDATE ON public.routine_controls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 4. Guest Recovery approval notifications
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_recovery_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _authority text;
  _target uuid;
  _seat text;
  _title text;
  _body text;
  _link text;
BEGIN
  IF NEW.approval_status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.approval_status IS NOT DISTINCT FROM NEW.approval_status THEN
    RETURN NEW;
  END IF;

  _authority := COALESCE(NEW.approval_authority, 'supervisor');
  IF _authority = 'director' THEN
    SELECT current_seat_holder, current_seat_name INTO _target, _seat
      FROM public.functional_roles WHERE code = 'director_ops';
  ELSE
    SELECT current_seat_holder, current_seat_name INTO _target, _seat
      FROM public.functional_roles WHERE code = 'ops_supervisor';
  END IF;

  IF _target IS NULL OR _target = COALESCE(NEW.requested_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RETURN NEW;
  END IF;

  _link := '/recovery?open=' || NEW.id::text;
  _title := CASE WHEN _authority = 'director'
    THEN 'Director approval needed — guest recovery'
    ELSE 'Approval needed — guest recovery' END;
  _body := COALESCE(NEW.title, 'Guest recovery')
    || CASE WHEN NEW.proposed_amount IS NOT NULL
         THEN ' — proposed ' || to_char(NEW.proposed_amount, 'FM$999,999.00') ELSE '' END
    || CASE WHEN _authority = 'director'
         THEN '. This decision sits with the Director of Operations.'
         ELSE '. This decision sits with the Operations Supervisor.' END;

  PERFORM public.notify_staff(
    _target, 'approval_required', _title, _body,
    'guest_recovery', NEW.id, _link, 'urgent',
    NEW.requested_by, true, COALESCE(NEW.is_demo, false)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_recovery_approval_trg ON public.guest_recovery;
CREATE TRIGGER notify_recovery_approval_trg
  AFTER INSERT OR UPDATE OF approval_status, approval_authority ON public.guest_recovery
  FOR EACH ROW EXECUTE FUNCTION public.notify_recovery_approval();

REVOKE ALL ON FUNCTION public.notify_recovery_approval() FROM PUBLIC, anon;