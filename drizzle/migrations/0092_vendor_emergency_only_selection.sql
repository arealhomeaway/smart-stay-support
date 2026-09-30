ALTER TABLE public.vendor_orgs ADD COLUMN IF NOT EXISTS emergency_only boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.vendor_orgs.emergency_only IS 'Restriction preserved from legacy Notion "EMERGENCY ONLY". Never Primary/Backup, never routine coverage.';
UPDATE public.vendor_orgs SET emergency_only = true
 WHERE legacy_fields->>'Restriction: Emergency only' = 'yes' OR lower(coalesce(legacy_fields->>'Notion: preference','')) LIKE '%emergency only%';

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS emergency_vendor_basis text,
  ADD COLUMN IF NOT EXISTS emergency_vendor_reason text,
  ADD COLUMN IF NOT EXISTS emergency_vendor_authorized_by uuid,
  ADD COLUMN IF NOT EXISTS emergency_vendor_authorized_at timestamptz;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_emergency_vendor_basis_chk
  CHECK (emergency_vendor_basis IS NULL OR emergency_vendor_basis IN ('p1','no_routine_vendor','after_hours','supervisor_approval','supervisor_override'));

-- Emergency Only vendors: P1 free; P2 needs a recorded basis (no routine vendor / after hours / Supervisor approval);
-- P3 needs a Supervisor override. Reason and authorizer are stamped server-side.
CREATE OR REPLACE FUNCTION private.ticket_selected_vendor_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _emerg boolean; _uid uuid := auth.uid();
BEGIN
  IF NEW.selected_vendor_org_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.selected_vendor_org_id IS DISTINCT FROM OLD.selected_vendor_org_id) THEN
    IF NOT public.vendor_dispatch_eligible(NEW.selected_vendor_org_id) THEN
      RAISE EXCEPTION 'That vendor cannot take new work right now (inactive, not yet qualified, on hold, missing market/contact details or a credential has expired).';
    END IF;
    SELECT emergency_only INTO _emerg FROM public.vendor_orgs WHERE id = NEW.selected_vendor_org_id;
    IF coalesce(_emerg,false) THEN
      IF NEW.priority = 'p1' THEN
        NEW.emergency_vendor_basis := 'p1'; NEW.emergency_vendor_reason := coalesce(nullif(trim(NEW.emergency_vendor_reason),''), 'P1 Ticket');
      ELSE
        IF length(trim(coalesce(NEW.emergency_vendor_reason,''))) < 10 THEN
          RAISE EXCEPTION 'Emergency Only vendor: give a reason (at least 10 characters).';
        END IF;
        IF NEW.priority = 'p2' AND coalesce(NEW.emergency_vendor_basis,'') NOT IN ('no_routine_vendor','after_hours','supervisor_approval') THEN
          RAISE EXCEPTION 'Emergency Only vendor on a P2 Ticket needs a basis: no routine vendor available, after-hours coverage, or Supervisor approval.';
        END IF;
        IF NEW.priority <> 'p2' AND coalesce(NEW.emergency_vendor_basis,'') <> 'supervisor_override' THEN
          RAISE EXCEPTION 'Emergency Only vendor on a P3 Ticket requires a Supervisor override.';
        END IF;
        IF NEW.emergency_vendor_basis IN ('supervisor_approval','supervisor_override')
           AND (_uid IS NULL OR NOT private.is_supervisor(_uid)) THEN
          RAISE EXCEPTION 'Only a Supervisor can approve an Emergency Only vendor on this Ticket.';
        END IF;
      END IF;
      NEW.emergency_vendor_authorized_by := _uid;
      NEW.emergency_vendor_authorized_at := now();
    ELSE
      NEW.emergency_vendor_basis := NULL; NEW.emergency_vendor_reason := NULL;
      NEW.emergency_vendor_authorized_by := NULL; NEW.emergency_vendor_authorized_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ticket_selected_vendor_guard ON public.tickets;
CREATE TRIGGER trg_ticket_selected_vendor_guard BEFORE INSERT OR UPDATE OF selected_vendor_org_id ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION private.ticket_selected_vendor_guard();