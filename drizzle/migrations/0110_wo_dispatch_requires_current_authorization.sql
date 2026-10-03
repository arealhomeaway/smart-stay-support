CREATE OR REPLACE FUNCTION public.wo_authorization_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE newly boolean;
BEGIN
  IF NEW.vendor_org_id IS NOT NULL AND NEW.vendor_org_id IS DISTINCT FROM OLD.vendor_org_id
     AND EXISTS (SELECT 1 FROM public.work_order_vendor_candidates c WHERE c.work_order_id = NEW.id)
     AND NOT EXISTS (SELECT 1 FROM public.work_order_vendor_candidates c WHERE c.work_order_id = NEW.id AND c.status = 'accepted' AND c.vendor_org_id = NEW.vendor_org_id) THEN
    RAISE EXCEPTION 'Change the vendor through Find a Vendor — the new vendor must accept first';
  END IF;
  newly := (NEW.approval_status = 'approved' AND OLD.approval_status IS DISTINCT FROM 'approved')
        OR (NEW.supervisor_approval_status = 'approved' AND OLD.supervisor_approval_status IS DISTINCT FROM 'approved');
  IF newly THEN
    NEW.authorized_scope := NEW.scope;
    NEW.authorized_amount := COALESCE(NEW.approved_amount, NEW.quote_amount);
    NEW.authorized_vendor_org_id := NEW.vendor_org_id;
    NEW.authorized_at := now();
    NEW.authorization_stale := false;
  ELSIF NEW.authorized_at IS NOT NULL AND (
        NEW.scope IS DISTINCT FROM NEW.authorized_scope
     OR (NEW.authorized_amount IS NOT NULL AND COALESCE(NEW.quote_amount, 0) > NEW.authorized_amount)
     OR (NEW.authorized_vendor_org_id IS NOT NULL AND NEW.vendor_org_id IS DISTINCT FROM NEW.authorized_vendor_org_id)) THEN
    NEW.authorization_stale := true;
  END IF;
  -- Dispatch needs current authorization: never while stale or while a required approval is undecided/declined.
  IF NEW.dispatched_at IS NOT NULL AND OLD.dispatched_at IS NULL THEN
    IF NEW.authorization_stale THEN RAISE EXCEPTION 'The approval no longer covers this vendor, scope or amount — get it re-approved before dispatch'; END IF;
    IF NEW.approval_status IN ('pending','declined','info_requested') OR NEW.supervisor_approval_status IN ('pending','declined','info_requested') THEN
      RAISE EXCEPTION 'Required approval is not in place yet — dispatch after it is approved';
    END IF;
  END IF;
  IF NEW.breezeway_handoff_status IN ('sent','simulated') AND OLD.breezeway_handoff_status NOT IN ('sent','simulated') THEN
    IF NOT EXISTS (SELECT 1 FROM public.work_order_vendor_candidates c WHERE c.work_order_id = NEW.id AND c.status = 'accepted') THEN
      RAISE EXCEPTION 'A vendor must accept before the Breezeway handoff';
    END IF;
    IF NEW.authorization_stale THEN RAISE EXCEPTION 'The approval no longer covers this vendor, scope or amount'; END IF;
  END IF;
  IF OLD.breezeway_handoff_status = 'uncertain' AND NEW.breezeway_handoff_status = 'failed'
     AND NEW.breezeway_handoff_error IS NOT DISTINCT FROM OLD.breezeway_handoff_error THEN
    RAISE EXCEPTION 'Record what was found in Breezeway before marking the handoff as not created';
  END IF;
  IF OLD.breezeway_task_ref IS NOT NULL AND NEW.breezeway_task_ref IS DISTINCT FROM OLD.breezeway_task_ref THEN
    RAISE EXCEPTION 'The external task reference cannot be changed';
  END IF;
  RETURN NEW;
END $$;