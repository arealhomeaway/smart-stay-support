-- 1. Telegram channel is unknown until staff confirm it.
ALTER TABLE public.vendor_orgs
  ADD COLUMN IF NOT EXISTS telegram_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS telegram_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS telegram_confirmed_at timestamptz;
UPDATE public.vendor_orgs SET telegram_status = 'yes' WHERE uses_telegram AND telegram_status = 'unknown';
ALTER TABLE public.vendor_orgs ADD CONSTRAINT vendor_orgs_telegram_status_chk CHECK (telegram_status IN ('unknown','yes','no'));
COMMENT ON COLUMN public.vendor_orgs.uses_telegram IS 'DEPRECATED: replaced by telegram_status (unknown/yes/no); false never meant "does not use Telegram".';

CREATE OR REPLACE FUNCTION public.confirm_vendor_telegram(_org uuid, _status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only the internal team can confirm vendor channels'; END IF;
  IF _status NOT IN ('unknown','yes','no') THEN RAISE EXCEPTION 'Unknown Telegram status'; END IF;
  UPDATE public.vendor_orgs SET telegram_status = _status, uses_telegram = (_status = 'yes'),
         telegram_confirmed_by = CASE WHEN _status = 'unknown' THEN NULL ELSE auth.uid() END,
         telegram_confirmed_at = CASE WHEN _status = 'unknown' THEN NULL ELSE now() END
   WHERE id = _org;
END $$;
REVOKE ALL ON FUNCTION public.confirm_vendor_telegram(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_vendor_telegram(uuid, text) TO authenticated;

-- 2. Authorization covers one vendor, scope and amount.
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS authorized_vendor_org_id uuid;
UPDATE public.work_orders SET authorized_vendor_org_id = vendor_org_id WHERE authorized_at IS NOT NULL AND authorized_vendor_org_id IS NULL;
ALTER TABLE public.work_order_vendor_candidates ADD COLUMN IF NOT EXISTS released_reason text;

CREATE OR REPLACE FUNCTION public.wo_authorization_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE newly boolean;
BEGIN
  -- The vendor on a Work Order with sourcing history is only ever the accepted vendor.
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
  IF NEW.breezeway_handoff_status IN ('sent','simulated') AND OLD.breezeway_handoff_status NOT IN ('sent','simulated') THEN
    IF NOT EXISTS (SELECT 1 FROM public.work_order_vendor_candidates c WHERE c.work_order_id = NEW.id AND c.status = 'accepted') THEN
      RAISE EXCEPTION 'A vendor must accept before the Breezeway handoff';
    END IF;
    IF NEW.authorization_stale THEN RAISE EXCEPTION 'The approval no longer covers this vendor, scope or amount'; END IF;
  END IF;
  -- Leaving "uncertain" needs reconciliation evidence: a task id (sent) or a recorded check (failed).
  IF OLD.breezeway_handoff_status = 'uncertain' AND NEW.breezeway_handoff_status = 'failed'
     AND NEW.breezeway_handoff_error IS NOT DISTINCT FROM OLD.breezeway_handoff_error THEN
    RAISE EXCEPTION 'Record what was found in Breezeway before marking the handoff as not created';
  END IF;
  IF OLD.breezeway_task_ref IS NOT NULL AND NEW.breezeway_task_ref IS DISTINCT FROM OLD.breezeway_task_ref THEN
    RAISE EXCEPTION 'The external task reference cannot be changed';
  END IF;
  RETURN NEW;
END $$;

-- Acceptance: eligible vendors only; Emergency Only needs the Ticket's recorded basis.
CREATE OR REPLACE FUNCTION public.wo_candidate_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; emerg boolean;
BEGIN
  IF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status <> 'accepted') THEN
    IF NEW.vendor_org_id IS NOT NULL THEN
      IF NOT public.vendor_dispatch_eligible(NEW.vendor_org_id) THEN
        RAISE EXCEPTION 'That vendor cannot take new work right now (inactive, not yet qualified, on hold, missing details or an expired credential).';
      END IF;
      SELECT emergency_only INTO emerg FROM public.vendor_orgs WHERE id = NEW.vendor_org_id;
      SELECT tk.priority, tk.selected_vendor_org_id, tk.emergency_vendor_reason INTO t
        FROM public.work_orders w JOIN public.tickets tk ON tk.id = w.ticket_id WHERE w.id = NEW.work_order_id;
      IF coalesce(emerg,false) AND coalesce(t.priority,'p3') <> 'p1'
         AND (t.selected_vendor_org_id IS DISTINCT FROM NEW.vendor_org_id OR t.emergency_vendor_reason IS NULL) THEN
        RAISE EXCEPTION 'Emergency Only vendor: choose it on the Ticket''s vendor step first so the basis and reason are recorded.';
      END IF;
    END IF;
    NEW.accepted_at := now(); NEW.accepted_by := auth.uid();
  ELSIF NEW.status <> 'accepted' THEN
    NEW.accepted_at := NULL; NEW.accepted_by := NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'accepted' AND NEW.status = 'withdrawn' AND length(trim(coalesce(NEW.released_reason,''))) < 5
     AND EXISTS (SELECT 1 FROM public.work_orders w WHERE w.id = NEW.work_order_id AND w.dispatched_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Give a reason for releasing a dispatched vendor';
  END IF;
  RETURN NEW;
END $$;

-- After acceptance/release: the Work Order and Ticket follow the accepted vendor.
CREATE OR REPLACE FUNCTION public.wo_candidate_after() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w record;
BEGIN
  SELECT id, ticket_id, is_demo, dispatched_at, vendor_completed_at INTO w FROM public.work_orders WHERE id = NEW.work_order_id;
  IF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status <> 'accepted') THEN
    UPDATE public.work_orders SET vendor_org_id = NEW.vendor_org_id, vendor_name = NEW.vendor_name WHERE id = NEW.work_order_id
      AND (vendor_org_id IS DISTINCT FROM NEW.vendor_org_id OR vendor_name IS DISTINCT FROM NEW.vendor_name);
    IF w.ticket_id IS NOT NULL AND NEW.vendor_org_id IS NOT NULL THEN
      UPDATE public.tickets SET selected_vendor_org_id = NEW.vendor_org_id WHERE id = w.ticket_id AND selected_vendor_org_id IS DISTINCT FROM NEW.vendor_org_id;
    END IF;
    INSERT INTO public.work_order_events(work_order_id, author_id, event_type, body, is_demo)
      VALUES (NEW.work_order_id, auth.uid(), 'vendor_accepted', NEW.vendor_name || ' accepted the work', w.is_demo);
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'accepted' AND NEW.status <> 'accepted' THEN
    IF w.vendor_completed_at IS NULL THEN
      UPDATE public.work_orders SET dispatched_at = NULL, dispatched_by = NULL WHERE id = NEW.work_order_id AND dispatched_at IS NOT NULL;
    END IF;
    INSERT INTO public.work_order_events(work_order_id, author_id, event_type, body, is_demo)
      VALUES (NEW.work_order_id, auth.uid(), 'vendor_released', NEW.vendor_name || ' released' || coalesce(' — ' || NEW.released_reason, ''), w.is_demo);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS wo_candidate_after ON public.work_order_vendor_candidates;
CREATE TRIGGER wo_candidate_after AFTER INSERT OR UPDATE OF status ON public.work_order_vendor_candidates FOR EACH ROW EXECUTE FUNCTION public.wo_candidate_after();

-- 3. Estimates and suspected duplicates never pass final Finance review.
CREATE OR REPLACE FUNCTION public.expense_review_readiness_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.finance_review = 'reviewed' AND OLD.finance_review IS DISTINCT FROM 'reviewed' THEN
    IF NEW.is_estimate THEN RAISE EXCEPTION 'This is an estimate — convert it to the actual invoice (or archive it as replaced) before Finance review'; END IF;
    IF NEW.duplicate_flag = 'suspected' THEN RAISE EXCEPTION 'Resolve the suspected duplicate first — mark it "Not a duplicate" or archive the duplicate entry'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS expense_review_readiness_guard ON public.expenses;
CREATE TRIGGER expense_review_readiness_guard BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.expense_review_readiness_guard();

-- Converting an estimate into an invoice re-runs the duplicate check.
DROP TRIGGER IF EXISTS expense_duplicate_check ON public.expenses;
CREATE TRIGGER expense_duplicate_check BEFORE INSERT OR UPDATE OF payee, amount, expense_date, vendor_invoice_ref, duplicate_flag, is_estimate ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.expense_duplicate_check();