-- Only a Supervisor (manager) or Platform Owner (admin) may move a ticket off
-- its calculated priority, a written reason is always required, and every such
-- change is recorded permanently in the audit log by the database itself.

CREATE OR REPLACE FUNCTION public.enforce_ticket_priority_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  calculated text;
  previous text;
  written_reason text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.priority IS NOT DISTINCT FROM OLD.priority THEN
      RETURN NEW;
    END IF;
    previous := OLD.priority;
    calculated := COALESCE(OLD.suggested_priority, OLD.priority);
  ELSE
    calculated := NEW.suggested_priority;
    IF calculated IS NULL OR NEW.priority IS NOT DISTINCT FROM calculated THEN
      RETURN NEW;
    END IF;
    previous := calculated;
  END IF;

  -- System and integration paths carry no signed-in person; they only ever
  -- write the calculated value and are not an override.
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT (public.has_role(actor, 'manager') OR public.has_role(actor, 'admin')) THEN
    RAISE EXCEPTION 'Only a Supervisor or Manager can change a ticket priority.'
      USING ERRCODE = '42501';
  END IF;

  written_reason := NULLIF(btrim(COALESCE(NEW.priority_override_reason, '')), '');
  IF written_reason IS NULL THEN
    RAISE EXCEPTION 'A written reason is required to change a ticket priority.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.priority_override_reason IS NOT DISTINCT FROM OLD.priority_override_reason THEN
    RAISE EXCEPTION 'A written reason is required to change a ticket priority.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.audit_log (
    actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value
  ) VALUES (
    actor,
    'ticket_priority_changed',
    'ticket',
    NEW.id,
    NEW.title,
    written_reason,
    jsonb_build_object(
      'priority', previous,
      'calculated_priority', calculated
    ),
    jsonb_build_object(
      'priority', NEW.priority,
      'calculated_priority', calculated,
      'reason', written_reason,
      'manager_id', actor,
      'changed_at', now()
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tickets_priority_authority ON public.tickets;
CREATE TRIGGER tickets_priority_authority
  BEFORE INSERT OR UPDATE OF priority ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ticket_priority_authority();

-- The audit trail is append-only: nothing may edit or erase a recorded change.
CREATE OR REPLACE FUNCTION public.block_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'The audit log is permanent and cannot be changed or deleted.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_immutable ON public.audit_log;
CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_log_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_log FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_log FROM anon;
GRANT ALL ON public.audit_log TO service_role;