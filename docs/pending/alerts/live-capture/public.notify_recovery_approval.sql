CREATE OR REPLACE FUNCTION public.notify_recovery_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _authority text;
  _target uuid;
  _seat text;
  _title text;
  _body text;
  _link text;
BEGIN
  IF NEW.approval_status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.approval_status IS NOT DISTINCT FROM NEW.approval_status THEN
    RETURN NEW;
  END IF;

  _authority := COALESCE(NEW.approval_authority, 'supervisor');
  IF _authority = 'director' THEN
    SELECT current_seat_holder, current_seat_name INTO _target, _seat
      FROM public.functional_roles WHERE code = 'director_ops';
  ELSE
    SELECT current_seat_holder, current_seat_name INTO _target, _seat
      FROM public.functional_roles WHERE code = 'ops_supervisor';
  END IF;

  IF _target IS NULL OR _target = COALESCE(NEW.requested_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RETURN NEW;
  END IF;

  _link := '/recovery?open=' || NEW.id::text;
  _title := CASE WHEN _authority = 'director'
    THEN 'Director approval needed — guest recovery'
    ELSE 'Approval needed — guest recovery' END;
  _body := COALESCE(NEW.title, 'Guest recovery')
    || CASE WHEN NEW.proposed_amount IS NOT NULL
         THEN ' — proposed ' || to_char(NEW.proposed_amount, 'FM$999,999.00') ELSE '' END
    || CASE WHEN _authority = 'director'
         THEN '. This decision sits with the Director of Operations.'
         ELSE '. This decision sits with the Operations Supervisor.' END;

  PERFORM public.notify_staff(
    _target, 'approval_required', _title, _body,
    'guest_recovery', NEW.id, _link, 'urgent',
    NEW.requested_by, true, COALESCE(NEW.is_demo, false)
  );
  RETURN NEW;
END;
$function$

