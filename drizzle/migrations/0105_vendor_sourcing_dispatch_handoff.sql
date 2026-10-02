ALTER TABLE public.vendor_orgs ADD COLUMN IF NOT EXISTS uses_telegram boolean NOT NULL DEFAULT false;

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS dispatch_reason text,
  ADD COLUMN IF NOT EXISTS guest_impact text,
  ADD COLUMN IF NOT EXISTS authorized_scope text,
  ADD COLUMN IF NOT EXISTS authorized_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS authorization_stale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_by uuid,
  ADD COLUMN IF NOT EXISTS breezeway_handoff_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS breezeway_request_key text,
  ADD COLUMN IF NOT EXISTS breezeway_task_ref text,
  ADD COLUMN IF NOT EXISTS breezeway_handoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS breezeway_handoff_error text;
ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_bz_handoff_chk
  CHECK (breezeway_handoff_status IN ('not_sent','sent','failed','uncertain','simulated'));
CREATE UNIQUE INDEX IF NOT EXISTS work_orders_bz_request_key_uq ON public.work_orders(breezeway_request_key) WHERE breezeway_request_key IS NOT NULL;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS work_order_visit_id uuid,
  ADD COLUMN IF NOT EXISTS is_estimate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_flag text,
  ADD COLUMN IF NOT EXISTS duplicate_of uuid,
  ADD COLUMN IF NOT EXISTS purchase_auth_status text,
  ADD COLUMN IF NOT EXISTS purchase_auth_evidence text,
  ADD COLUMN IF NOT EXISTS purchase_authorized_by text;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_duplicate_flag_chk CHECK (duplicate_flag IS NULL OR duplicate_flag IN ('suspected','cleared'));
ALTER TABLE public.expenses ADD CONSTRAINT expenses_purchase_auth_chk CHECK (purchase_auth_status IS NULL OR purchase_auth_status IN ('authorized','not_required','missing','uncertain'));

CREATE TABLE public.work_order_vendor_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  vendor_org_id uuid REFERENCES public.vendor_orgs(id),
  vendor_name text NOT NULL,
  choice text NOT NULL DEFAULT 'primary' CHECK (choice IN ('primary','backup','other')),
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','contacted','declined','accepted','withdrawn')),
  next_follow_up_on date,
  accepted_at timestamptz,
  accepted_by uuid,
  declined_reason text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX work_order_one_accepted_vendor ON public.work_order_vendor_candidates(work_order_id) WHERE status = 'accepted';

CREATE TABLE public.work_order_contact_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.work_order_vendor_candidates(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('phone','text','email','breezeway','telegram','other')),
  response text NOT NULL CHECK (response IN ('no_answer','left_message','call_back','interested','declined')),
  note text,
  next_follow_up_on date,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);

CREATE TABLE public.work_order_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.work_order_vendor_candidates(id),
  vendor_name text NOT NULL,
  visit_date date NOT NULL DEFAULT current_date,
  outcome text NOT NULL CHECK (outcome IN ('resolved','diagnosed_only','no_issue_found','parts_needed','follow_up_visit','owner_decision','unable_to_access','unable_to_complete')),
  findings text,
  work_done text,
  evidence_document_ids uuid[] NOT NULL DEFAULT '{}',
  follow_up_work_item_id uuid UNIQUE REFERENCES public.work_items(id),
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS work_items_one_visit_followup ON public.work_items(source_id) WHERE source_table = 'work_order_visits';
ALTER TABLE public.expenses ADD CONSTRAINT expenses_wo_visit_fk FOREIGN KEY (work_order_visit_id) REFERENCES public.work_order_visits(id);

GRANT SELECT, INSERT, UPDATE ON public.work_order_vendor_candidates TO authenticated;
GRANT SELECT, INSERT ON public.work_order_contact_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.work_order_visits TO authenticated;
GRANT ALL ON public.work_order_vendor_candidates, public.work_order_contact_attempts, public.work_order_visits TO service_role;

ALTER TABLE public.work_order_vendor_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_contact_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage vendor candidates" ON public.work_order_vendor_candidates FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff read contact attempts" ON public.work_order_contact_attempts FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff log contact attempts" ON public.work_order_contact_attempts FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff manage visits" ON public.work_order_visits FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Contact attempts are append-only and never imply acceptance.
CREATE OR REPLACE FUNCTION public.wo_contact_attempt_after() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.work_order_vendor_candidates
     SET status = CASE WHEN NEW.response = 'declined' THEN 'declined'
                       WHEN status = 'candidate' THEN 'contacted' ELSE status END,
         next_follow_up_on = NEW.next_follow_up_on
   WHERE id = NEW.candidate_id AND status <> 'accepted';
  RETURN NEW;
END $$;
CREATE TRIGGER wo_contact_attempt_after AFTER INSERT ON public.work_order_contact_attempts FOR EACH ROW EXECUTE FUNCTION public.wo_contact_attempt_after();
CREATE OR REPLACE FUNCTION public.block_contact_attempt_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Contact attempts are append-only'; END $$;
CREATE TRIGGER block_contact_attempt_mutation BEFORE UPDATE OR DELETE ON public.work_order_contact_attempts FOR EACH ROW EXECUTE FUNCTION public.block_contact_attempt_mutation();

-- Acceptance is its own recorded fact.
CREATE OR REPLACE FUNCTION public.wo_candidate_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status <> 'accepted') THEN
    NEW.accepted_at := now(); NEW.accepted_by := auth.uid();
  ELSIF NEW.status <> 'accepted' THEN
    NEW.accepted_at := NULL; NEW.accepted_by := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER wo_candidate_guard BEFORE INSERT OR UPDATE ON public.work_order_vendor_candidates FOR EACH ROW EXECUTE FUNCTION public.wo_candidate_guard();

-- Authorization snapshot: approval covers only the scope and amount it was given for.
CREATE OR REPLACE FUNCTION public.wo_authorization_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE newly boolean;
BEGIN
  newly := (NEW.approval_status = 'approved' AND OLD.approval_status IS DISTINCT FROM 'approved')
        OR (NEW.supervisor_approval_status = 'approved' AND OLD.supervisor_approval_status IS DISTINCT FROM 'approved');
  IF newly THEN
    NEW.authorized_scope := NEW.scope;
    NEW.authorized_amount := COALESCE(NEW.approved_amount, NEW.quote_amount);
    NEW.authorized_at := now();
    NEW.authorization_stale := false;
  ELSIF NEW.authorized_at IS NOT NULL AND (
        NEW.scope IS DISTINCT FROM NEW.authorized_scope
     OR (NEW.authorized_amount IS NOT NULL AND COALESCE(NEW.quote_amount, 0) > NEW.authorized_amount)) THEN
    NEW.authorization_stale := true;
  END IF;
  -- Breezeway handoff only after acceptance and a current authorization.
  IF NEW.breezeway_handoff_status IN ('sent','simulated') AND OLD.breezeway_handoff_status NOT IN ('sent','simulated') THEN
    IF NOT EXISTS (SELECT 1 FROM public.work_order_vendor_candidates c WHERE c.work_order_id = NEW.id AND c.status = 'accepted') THEN
      RAISE EXCEPTION 'A vendor must accept before the Breezeway handoff';
    END IF;
    IF NEW.authorization_stale THEN RAISE EXCEPTION 'The approval no longer covers this scope or amount'; END IF;
  END IF;
  IF OLD.breezeway_task_ref IS NOT NULL AND NEW.breezeway_task_ref IS DISTINCT FROM OLD.breezeway_task_ref THEN
    RAISE EXCEPTION 'The external task reference cannot be changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER wo_authorization_snapshot BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.wo_authorization_snapshot();

-- Suspected duplicate invoices are flagged, never merged.
CREATE OR REPLACE FUNCTION public.expense_duplicate_check() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE dup uuid;
BEGIN
  IF NEW.archived_at IS NOT NULL OR NEW.is_estimate OR NEW.duplicate_flag = 'cleared' THEN RETURN NEW; END IF;
  SELECT e.id INTO dup FROM public.expenses e
   WHERE e.id <> NEW.id AND e.archived_at IS NULL AND NOT e.is_estimate AND e.is_demo = NEW.is_demo
     AND ((NEW.vendor_invoice_ref IS NOT NULL AND lower(e.vendor_invoice_ref) = lower(NEW.vendor_invoice_ref)
           AND lower(coalesce(e.payee,'')) = lower(coalesce(NEW.payee,'')))
       OR (NEW.payee IS NOT NULL AND NEW.amount IS NOT NULL AND lower(e.payee) = lower(NEW.payee)
           AND e.amount IS NOT NULL AND abs(e.amount - NEW.amount) <= greatest(1, NEW.amount * 0.01)
           AND e.expense_date IS NOT NULL AND NEW.expense_date IS NOT NULL AND abs(e.expense_date - NEW.expense_date) <= 7))
   ORDER BY e.created_at LIMIT 1;
  IF dup IS NOT NULL THEN NEW.duplicate_flag := 'suspected'; NEW.duplicate_of := dup;
  ELSIF NEW.duplicate_flag = 'suspected' THEN NEW.duplicate_flag := NULL; NEW.duplicate_of := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expense_duplicate_check BEFORE INSERT OR UPDATE OF payee, amount, expense_date, vendor_invoice_ref, duplicate_flag ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.expense_duplicate_check();

-- Purchases: missing or uncertain authorization needs a leadership decision before owner allocation.
CREATE OR REPLACE FUNCTION public.expense_purchase_auth_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.expense_type = 'purchase' AND NEW.purchase_auth_status IN ('missing','uncertain')
     AND NEW.cost_responsibility IN ('owner','split') AND NEW.leadership_decision IS NULL THEN
    RAISE EXCEPTION 'Purchase authorization is missing or uncertain — record a leadership decision before allocating to the owner';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expense_purchase_auth_guard BEFORE INSERT OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.expense_purchase_auth_guard();