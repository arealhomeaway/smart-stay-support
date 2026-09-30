-- One eligibility rule: an expired insurance/licence blocks new selection for any status.
CREATE OR REPLACE FUNCTION public.vendor_dispatch_eligible(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_orgs o
    WHERE o.id = _org AND o.is_active
      AND o.status IN ('pilot','approved','gold','corrective_action')
      AND (o.status NOT IN ('approved','gold') OR (private.vendor_gates_clear(o.id) AND NOT coalesce(o.critical_failure,false)))
      AND NOT EXISTS (
        SELECT 1 FROM public.vendor_gatekeeper_results g
        JOIN public.gatekeeper_requirements q ON q.id = g.requirement_id AND q.active AND q.expiry_required
        WHERE g.org_id = o.id AND g.expires_on IS NOT NULL AND g.expires_on < current_date)
  )
$$;

-- A Ticket may only record a vendor that can take new work right now.
CREATE OR REPLACE FUNCTION private.ticket_selected_vendor_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.selected_vendor_org_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.selected_vendor_org_id IS DISTINCT FROM OLD.selected_vendor_org_id)
     AND NOT public.vendor_dispatch_eligible(NEW.selected_vendor_org_id) THEN
    RAISE EXCEPTION 'That vendor cannot take new work right now (inactive, not yet qualified, on hold or a credential has expired).';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ticket_selected_vendor_guard BEFORE INSERT OR UPDATE OF selected_vendor_org_id ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION private.ticket_selected_vendor_guard();