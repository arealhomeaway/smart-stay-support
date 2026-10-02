ALTER TABLE public.tickets
  ADD COLUMN active_stay_impact text CHECK (active_stay_impact IN ('yes','no','unknown')),
  ADD COLUMN guest_comm_required text CHECK (guest_comm_required IN ('yes','no','complete')),
  ADD COLUMN issue_reservation_relation text CHECK (issue_reservation_relation IN ('current','prior','future','none'));

COMMENT ON COLUMN public.tickets.active_stay_impact IS 'Does this issue affect an active guest stay. NULL = legacy ticket, derived from guest_in_residence.';
COMMENT ON COLUMN public.tickets.guest_comm_required IS 'Guest communication requirement, separate from occupancy. NULL = legacy.';
COMMENT ON COLUMN public.tickets.issue_reservation_relation IS 'How the reservation_* (issue reservation) fields relate to now: current, prior, future, none.';

CREATE OR REPLACE FUNCTION public.log_ticket_guest_impact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  lbl text;
BEGIN
  IF NEW.active_stay_impact IS DISTINCT FROM OLD.active_stay_impact AND NEW.active_stay_impact IS NOT NULL THEN
    INSERT INTO public.ticket_activity(ticket_id, author_id, kind, body, event_type, event_at, is_demo, internal)
    VALUES (NEW.id, auth.uid(), 'note',
      'Active-stay impact changed from ' ||
      COALESCE(CASE OLD.active_stay_impact WHEN 'yes' THEN 'Yes' WHEN 'no' THEN 'No' WHEN 'unknown' THEN 'Unknown' END, 'not set') ||
      ' to ' || CASE NEW.active_stay_impact WHEN 'yes' THEN 'Yes' WHEN 'no' THEN 'No' ELSE 'Unknown / Needs review' END || '.',
      'active_stay_impact', now(), COALESCE(NEW.is_demo,false), true);
  END IF;
  IF NEW.guest_comm_required IS DISTINCT FROM OLD.guest_comm_required AND NEW.guest_comm_required IS NOT NULL THEN
    lbl := CASE NEW.guest_comm_required WHEN 'yes' THEN 'Guest communication marked required.'
      WHEN 'no' THEN 'Guest communication marked not required.'
      ELSE 'Guest communication marked complete.' END;
    INSERT INTO public.ticket_activity(ticket_id, author_id, kind, body, event_type, event_at, is_demo, internal)
    VALUES (NEW.id, auth.uid(), 'note', lbl, 'guest_comm_required', now(), COALESCE(NEW.is_demo,false), true);
  END IF;
  IF NEW.issue_reservation_relation IS DISTINCT FROM OLD.issue_reservation_relation AND NEW.issue_reservation_relation IS NOT NULL THEN
    lbl := CASE NEW.issue_reservation_relation WHEN 'current' THEN 'Issue linked to the current reservation.'
      WHEN 'prior' THEN 'Issue linked to a prior reservation.'
      WHEN 'future' THEN 'Issue linked to a future reservation.'
      ELSE 'Issue marked as not tied to any reservation.' END;
    INSERT INTO public.ticket_activity(ticket_id, author_id, kind, body, event_type, event_at, is_demo, internal)
    VALUES (NEW.id, auth.uid(), 'note', lbl, 'issue_reservation', now(), COALESCE(NEW.is_demo,false), true);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tickets_guest_impact_log
  AFTER UPDATE OF active_stay_impact, guest_comm_required, issue_reservation_relation ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_guest_impact();