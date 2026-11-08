CREATE OR REPLACE FUNCTION public.notify_ticket_flow_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _link text := '/tickets/' || NEW.id::text;
  _ref text := coalesce('#' || NEW.ref::text || ' ', '');
  _supervisor uuid;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'waiting' AND NEW.status <> 'waiting' AND NEW.assigned_to IS NOT NULL THEN
    PERFORM public.notify_staff(
      NEW.assigned_to, 'waiting_returned',
      'Back from waiting: ' || _ref || NEW.title,
      'What this ticket was waiting on has come back. Pick it up again.',
      'ticket', NEW.id, _link, 'normal', auth.uid(), true, NEW.is_demo
    );
  END IF;

  IF NEW.status = 'resolved' AND OLD.status <> 'resolved' THEN
    _supervisor := public.seat_holder_at('ops_supervisor', now());
    IF _supervisor IS NOT NULL THEN
      PERFORM public.notify_staff(
        _supervisor, 'closure_qa',
        'Closure QA: ' || _ref || NEW.title,
        'This ticket is resolved and waiting on closure QA before it can be closed.',
        'ticket', NEW.id, _link, 'normal', auth.uid(), true, NEW.is_demo
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$

