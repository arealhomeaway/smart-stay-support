CREATE OR REPLACE FUNCTION public.audit_ticket_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE changed text[] := '{}';
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN changed := changed || ARRAY['status']; END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN changed := changed || ARRAY['priority']; END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN changed := changed || ARRAY['assigned_to']; END IF;
  IF NEW.record_owner IS DISTINCT FROM OLD.record_owner THEN changed := changed || ARRAY['record_owner']; END IF;
  IF NEW.current_action_owner IS DISTINCT FROM OLD.current_action_owner THEN changed := changed || ARRAY['current_action_owner']; END IF;
  IF NEW.accountable_owner IS DISTINCT FROM OLD.accountable_owner THEN changed := changed || ARRAY['accountable_owner']; END IF;
  IF NEW.handoff_status IS DISTINCT FROM OLD.handoff_status THEN changed := changed || ARRAY['handoff_status']; END IF;
  IF NEW.escalation_level IS DISTINCT FROM OLD.escalation_level THEN changed := changed || ARRAY['escalation_level']; END IF;
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN changed := changed || ARRAY['archived_at']; END IF;
  IF NEW.resolved_at IS DISTINCT FROM OLD.resolved_at THEN changed := changed || ARRAY['resolved_at']; END IF;
  IF NEW.closure_exception_reason IS DISTINCT FROM OLD.closure_exception_reason THEN changed := changed || ARRAY['closure_exception']; END IF;

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
END; $function$;