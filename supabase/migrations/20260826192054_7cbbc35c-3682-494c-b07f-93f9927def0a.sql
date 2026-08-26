-- 1. Archive + closure exception fields on tickets (no deletes, ever)
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_reason text,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS closure_exception_reason text,
  ADD COLUMN IF NOT EXISTS closure_exception_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS closure_exception_at timestamptz;

CREATE INDEX IF NOT EXISTS tickets_archived_at_idx ON public.tickets (archived_at);
CREATE INDEX IF NOT EXISTS tickets_status_priority_idx ON public.tickets (status, priority);

-- 2. Internal notes + @mentions on activity
ALTER TABLE public.ticket_activity
  ADD COLUMN IF NOT EXISTS internal boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';

-- 3. Feature flags — safe controls for unfinished / paused workflows
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_flags_select ON public.feature_flags;
CREATE POLICY feature_flags_select ON public.feature_flags
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS feature_flags_write ON public.feature_flags;
CREATE POLICY feature_flags_write ON public.feature_flags
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS feature_flags_updated ON public.feature_flags;
CREATE TRIGGER feature_flags_updated BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.feature_flags (key, label, description, enabled) VALUES
  ('email_intake', 'Email intake (mailbox sync)', 'Automatic matter creation from the shared mailbox. Paused for launch.', false),
  ('quarterly_scheduler', 'Quarterly inspection scheduler', 'Nightly auto-creation of quarterly inspection matters. Paused for launch.', false),
  ('owner_alerts', 'Homeowner email/SMS alerts', 'Outbound notifications to homeowners. Paused for launch.', false),
  ('breezeway_bridge', 'Breezeway field-task bridge', 'Temporary transitional dispatch bridge. Off until proven.', false),
  ('notion_sync', 'Notion synchronisation', 'Notion remains the editable source of truth; sync stays off.', false),
  ('operations_queue_v2', 'Operations queue (Stage 1)', 'My Work / Team Queue operational queue.', true)
ON CONFLICT (key) DO NOTHING;

-- 4. Who may edit a matter
CREATE OR REPLACE FUNCTION private.can_edit_ticket(_user_id uuid, _ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
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

REVOKE ALL ON FUNCTION private.can_edit_ticket(uuid, uuid) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS tickets_update ON public.tickets;
CREATE POLICY tickets_update ON public.tickets
  FOR UPDATE TO authenticated
  USING (
    (private.is_staff(auth.uid()) AND private.can_edit_ticket(auth.uid(), id))
    OR vendor_user_id = auth.uid()
  )
  WITH CHECK (
    (private.is_staff(auth.uid()) AND private.can_edit_ticket(auth.uid(), id))
    OR vendor_user_id = auth.uid()
  );

-- 5. Audit history for material changes to a matter
CREATE OR REPLACE FUNCTION public.audit_ticket_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE changed text[] := '{}';
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN changed := changed || 'status'; END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN changed := changed || 'priority'; END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN changed := changed || 'assigned_to'; END IF;
  IF NEW.record_owner IS DISTINCT FROM OLD.record_owner THEN changed := changed || 'record_owner'; END IF;
  IF NEW.current_action_owner IS DISTINCT FROM OLD.current_action_owner THEN changed := changed || 'current_action_owner'; END IF;
  IF NEW.accountable_owner IS DISTINCT FROM OLD.accountable_owner THEN changed := changed || 'accountable_owner'; END IF;
  IF NEW.handoff_status IS DISTINCT FROM OLD.handoff_status THEN changed := changed || 'handoff_status'; END IF;
  IF NEW.escalation_level IS DISTINCT FROM OLD.escalation_level THEN changed := changed || 'escalation_level'; END IF;
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN changed := changed || 'archived_at'; END IF;
  IF NEW.resolved_at IS DISTINCT FROM OLD.resolved_at THEN changed := changed || 'resolved_at'; END IF;
  IF NEW.closure_exception_reason IS DISTINCT FROM OLD.closure_exception_reason THEN changed := changed || 'closure_exception'; END IF;

  IF array_length(changed, 1) IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
  VALUES (
    auth.uid(),
    'matter_' || array_to_string(changed, '+') || '_changed',
    'ticket',
    NEW.id,
    NEW.title,
    COALESCE(NEW.archive_reason, NEW.closure_exception_reason),
    jsonb_build_object('status', OLD.status, 'priority', OLD.priority, 'assigned_to', OLD.assigned_to,
      'record_owner', OLD.record_owner, 'current_action_owner', OLD.current_action_owner,
      'accountable_owner', OLD.accountable_owner, 'handoff_status', OLD.handoff_status,
      'escalation_level', OLD.escalation_level, 'archived_at', OLD.archived_at, 'resolved_at', OLD.resolved_at),
    jsonb_build_object('status', NEW.status, 'priority', NEW.priority, 'assigned_to', NEW.assigned_to,
      'record_owner', NEW.record_owner, 'current_action_owner', NEW.current_action_owner,
      'accountable_owner', NEW.accountable_owner, 'handoff_status', NEW.handoff_status,
      'escalation_level', NEW.escalation_level, 'archived_at', NEW.archived_at, 'resolved_at', NEW.resolved_at)
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tickets_audit ON public.tickets;
CREATE TRIGGER tickets_audit AFTER UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.audit_ticket_change();