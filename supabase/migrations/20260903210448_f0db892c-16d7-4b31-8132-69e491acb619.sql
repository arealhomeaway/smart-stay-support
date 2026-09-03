ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS supervisor_approval_id uuid REFERENCES public.approvals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supervisor_approval_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS supervisor_approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS supervisor_approval_requested_by uuid,
  ADD COLUMN IF NOT EXISTS supervisor_approval_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS supervisor_approval_note text,
  ADD COLUMN IF NOT EXISTS owner_fyi_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_fyi_by uuid;

-- Work order updates reach the people carrying the ticket.
CREATE OR REPLACE FUNCTION public.notify_work_order_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _link text := CASE WHEN NEW.ticket_id IS NOT NULL THEN '/tickets/' || NEW.ticket_id::text ELSE '/work-orders' END;
  _assignee uuid;
  _title text;
  _body text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     AND NEW.approval_status IN ('approved','declined','info_requested') THEN
    _title := 'Homeowner ' || NEW.approval_status || ': ' || coalesce(NEW.title, 'repair');
    _body := 'The homeowner decision was recorded on this repair. Open the ticket for the next step.';
  ELSIF NEW.supervisor_approval_status IS DISTINCT FROM OLD.supervisor_approval_status
     AND NEW.supervisor_approval_status IN ('approved','declined') THEN
    _title := 'Supervisor ' || NEW.supervisor_approval_status || ': ' || coalesce(NEW.title, 'repair');
    _body := 'A supervisor decided this repair amount. Open the ticket for the next step.';
  ELSIF NEW.vendor_completed_at IS NOT NULL AND OLD.vendor_completed_at IS NULL THEN
    _title := 'Vendor finished: ' || coalesce(NEW.title, 'repair');
    _body := 'The vendor marked the work complete. Collect the evidence and close it out.';
  ELSIF NEW.closed_at IS NOT NULL AND OLD.closed_at IS NULL THEN
    _title := 'Repair closed: ' || coalesce(NEW.title, 'repair');
    _body := 'This repair is closed. Nothing further is outstanding on it.';
  ELSE
    RETURN NEW;
  END IF;

  SELECT t.assigned_to INTO _assignee FROM public.tickets t WHERE t.id = NEW.ticket_id;

  IF _assignee IS NOT NULL THEN
    PERFORM public.notify_staff(
      _assignee, 'work_order_update', _title, _body,
      'work_order', NEW.id, _link, 'normal', auth.uid(), true, NEW.is_demo
    );
  END IF;

  IF NEW.approval_requested_by IS NOT NULL AND NEW.approval_requested_by IS DISTINCT FROM _assignee THEN
    PERFORM public.notify_staff(
      NEW.approval_requested_by, 'work_order_update', _title, _body,
      'work_order', NEW.id, _link, 'normal', auth.uid(), true, NEW.is_demo
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notify_work_order_events_trg ON public.work_orders;
CREATE TRIGGER notify_work_order_events_trg
AFTER UPDATE ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_work_order_events();

-- Waiting return + closure QA.
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

DROP TRIGGER IF EXISTS notify_ticket_flow_events_trg ON public.tickets;
CREATE TRIGGER notify_ticket_flow_events_trg
AFTER UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_flow_events();

REVOKE EXECUTE ON FUNCTION public.notify_work_order_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_ticket_flow_events() FROM PUBLIC, anon, authenticated;