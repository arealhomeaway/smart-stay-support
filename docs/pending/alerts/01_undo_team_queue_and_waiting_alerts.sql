-- Undo for 01_team_queue_and_waiting_alerts.sql. No BEGIN/COMMIT.
-- Stops the minute check, restores notify_ticket_flow_events exactly as captured live
-- (live-capture/public.notify_ticket_flow_events.sql), removes the wait clock trigger, the alert
-- log and the column. Clocks already moved forward for tickets taken in between stay as they are.

SELECT cron.unschedule('ticket-timed-alerts');

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
$function$;

DROP FUNCTION public.run_ticket_timed_alerts();
DROP TABLE public.ticket_timed_alerts;
DROP TRIGGER tickets_owner_wait_clock ON public.tickets;
DROP FUNCTION private.ticket_owner_wait_clock();
ALTER TABLE public.tickets DROP COLUMN unowned_since;
