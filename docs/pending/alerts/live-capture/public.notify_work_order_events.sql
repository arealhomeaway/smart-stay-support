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
$function$

