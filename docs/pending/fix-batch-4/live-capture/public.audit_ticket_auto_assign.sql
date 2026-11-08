CREATE OR REPLACE FUNCTION public.audit_ticket_auto_assign()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, body, internal)
  VALUES (
    NEW.id, NULL, 'assignment',
    CASE WHEN NEW.assigned_to IS NOT NULL THEN 'auto_assigned' ELSE 'auto_assign_skipped' END,
    CASE WHEN NEW.assigned_to IS NOT NULL THEN 'Automatically assigned: ' || NEW.assignment_note
         ELSE COALESCE(NEW.assignment_note, 'Not auto-assigned.') END,
    false
  );

  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason, after_value)
  VALUES (
    NULL,
    CASE WHEN NEW.assigned_to IS NOT NULL THEN 'ticket_auto_assigned' ELSE 'ticket_auto_assign_skipped' END,
    'ticket', NEW.id, NEW.title, NEW.assignment_note,
    jsonb_build_object(
      'assigned_to', NEW.assigned_to,
      'current_action_owner', NEW.current_action_owner,
      'assignment_source', NEW.assignment_source,
      'functional_role_code', NEW.functional_role_code
    )
  );
  RETURN NULL;
END;
$function$

