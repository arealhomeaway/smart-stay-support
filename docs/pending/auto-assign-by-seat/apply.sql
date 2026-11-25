CREATE OR REPLACE FUNCTION public.auto_assign_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  IF NEW.status IN ('resolved', 'closed') THEN
    RETURN NEW;
  END IF;

  -- Notion imports preserve their mapped owner and quiet-import behavior.
  IF lower(coalesce(NEW.external_source, '')) = 'notion' THEN
    RETURN NEW;
  END IF;

  -- Match the existing Team B display rule for an untyped Breezeway ticket.
  -- All eligibility, load and fallback decisions remain in ticket_route_at.
  SELECT * INTO r FROM public.ticket_route_at(
    CASE WHEN lower(coalesce(NEW.external_source, '')) = 'breezeway'
           AND NEW.functional_role_code IS NULL AND NEW.work_type_id IS NULL
         THEN 'po_day' ELSE NEW.functional_role_code END,
    NEW.work_type_id, now());
  NEW.current_action_owner := r.user_id;
  NEW.assigned_to := r.user_id;
  NEW.assignment_source := r.source;
  NEW.assignment_note := r.note;
  RETURN NEW;
END;
$function$;
