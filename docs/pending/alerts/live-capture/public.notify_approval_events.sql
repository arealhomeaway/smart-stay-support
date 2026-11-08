CREATE OR REPLACE FUNCTION public.notify_approval_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.approver_id IS NOT NULL
     AND NEW.status = 'pending'
     AND (TG_OP = 'INSERT'
          OR NEW.approver_id IS DISTINCT FROM OLD.approver_id
          OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.notify_staff(
      NEW.approver_id,
      'approval_required',
      'Approval needed: ' || NEW.title,
      coalesce(NEW.detail, 'Open Resolve to approve or decline.'),
      'approval', NEW.id, '/oversight', 'urgent',
      NEW.requested_by, true, NEW.is_demo
    );
  END IF;
  RETURN NEW;
END;
$function$

