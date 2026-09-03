CREATE OR REPLACE FUNCTION public.notify_unrouted_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _supervisor uuid;
BEGIN
  IF NEW.status <> 'pending' OR NEW.approver_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND OLD.approver_id IS NULL THEN
    RETURN NEW;
  END IF;

  _supervisor := public.seat_holder_at('ops_supervisor', now());
  IF _supervisor IS NULL OR _supervisor = NEW.requested_by THEN
    _supervisor := NEW.requested_by;
  END IF;

  IF _supervisor IS NOT NULL THEN
    PERFORM public.notify_staff(
      _supervisor, 'approval_required',
      'Send for approval: ' || NEW.title,
      'This homeowner answers outside Resolve. Send the request, then record their answer on this approval.',
      'approval', NEW.id,
      '/approvals', 'normal', auth.uid(), true, NEW.is_demo
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notify_unrouted_approval_trg ON public.approvals;
CREATE TRIGGER notify_unrouted_approval_trg
AFTER INSERT OR UPDATE OF status ON public.approvals
FOR EACH ROW EXECUTE FUNCTION public.notify_unrouted_approval();

REVOKE EXECUTE ON FUNCTION public.notify_unrouted_approval() FROM PUBLIC, anon, authenticated;