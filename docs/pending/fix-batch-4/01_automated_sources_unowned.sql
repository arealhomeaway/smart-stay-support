-- Fix batch 4, part 1: automated sources stay unowned (Emily, Nov 7, 2026; register T15).
-- Tickets created by the info inbox, by OwnerRez (including OwnerRez review follow ups) and by
-- Breezeway are created with no owner and wait in the Team Queue for their team.
-- The one rule, auto_assign_ticket, gets a source check and nothing else: the ticket's
-- external_source, which only those automated paths set (staff Record work never sets it, and
-- Notion imports are quiet and never reach this trigger). The team still comes from the work
-- type. Staff tickets and Direct Bookings keep routing by the time. Undo: 01_undo_*.sql.
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

  -- Automated sources stay unowned (Emily, Nov 7, 2026; register T15): the info inbox,
  -- OwnerRez and Breezeway. They wait in the Team Queue for their team to take them.
  IF lower(coalesce(NEW.external_source, '')) IN ('email', 'ownerrez', 'breezeway') THEN
    NEW.assignment_note := 'Waiting in the Team Queue for the team to take it.';
    RETURN NEW;
  END IF;

  SELECT * INTO r FROM public.ticket_route_at(NEW.functional_role_code, NEW.work_type_id, now());
  NEW.current_action_owner := r.user_id;
  NEW.assigned_to := r.user_id;
  NEW.assignment_source := r.source;
  NEW.assignment_note := r.note;
  RETURN NEW;
END;
$function$;
