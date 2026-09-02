CREATE OR REPLACE FUNCTION public.notify_ticket_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _link text := '/tickets/' || NEW.id::text;
  _ref text := coalesce('#' || NEW.ref::text || ' ', '');
  _reassigned boolean := TG_OP = 'UPDATE' AND OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to;
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
    PERFORM public.notify_staff(
      NEW.assigned_to,
      CASE WHEN _reassigned THEN 'ticket_reassigned' ELSE 'ticket_assigned' END,
      CASE WHEN _reassigned THEN 'Reassigned to you: ' ELSE '' END || _ref || NEW.title,
      CASE WHEN _reassigned
        THEN 'This ticket was reassigned to you. Open it to see the next action.'
        ELSE 'This ticket is now yours. Open it to see the next action.' END,
      'ticket', NEW.id, _link,
      CASE WHEN NEW.priority = 'p1' THEN 'urgent' ELSE 'normal' END,
      auth.uid(), true, NEW.is_demo
    );
  END IF;

  IF TG_OP = 'UPDATE'
     AND coalesce(NEW.reopen_count, 0) > coalesce(OLD.reopen_count, 0) THEN
    PERFORM public.notify_staff(
      NEW.assigned_to,
      'ticket_reopened',
      'Reopened: ' || _ref || NEW.title,
      'This ticket was reopened and needs another pass.',
      'ticket', NEW.id, _link, 'urgent', auth.uid(), true, NEW.is_demo
    );
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      PERFORM public.notify_staff(
        OLD.assigned_to,
        'ticket_reopened',
        'Reopened: ' || _ref || NEW.title,
        'A ticket you previously owned was reopened.',
        'ticket', NEW.id, _link, 'normal', auth.uid(), true, NEW.is_demo
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.notify_ticket_events() FROM PUBLIC, anon, authenticated;