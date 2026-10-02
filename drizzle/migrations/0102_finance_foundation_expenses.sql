-- Finance foundation: shared Expense record (operations now; onboarding later via financial_request_id).
-- financial_requests is NOT reused: its triggers and write policy are onboarding-only decision controls.

CREATE OR REPLACE FUNCTION private.is_finance_lead(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
  SELECT _user_id IS NOT NULL AND (
    public.seat_holder_at('finance_lead') = _user_id
    OR EXISTS (SELECT 1 FROM public.functional_role_members m WHERE m.role_code = 'finance_lead' AND m.user_id = _user_id))
$$;

CREATE OR REPLACE FUNCTION private.is_accounting(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
  SELECT private.is_finance_lead(_user_id)
    OR (_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.functional_role_members m WHERE m.role_code = 'accounting' AND m.user_id = _user_id))
$$;

CREATE OR REPLACE FUNCTION public.is_finance_lead(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public','private' AS $$ SELECT private.is_finance_lead(_user_id) $$;
CREATE OR REPLACE FUNCTION public.is_accounting(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public','private' AS $$ SELECT private.is_accounting(_user_id) $$;

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE RESTRICT,
  expense_type text NOT NULL DEFAULT 'vendor_service' CHECK (expense_type IN ('vendor_service','purchase','other')),
  payee text,
  amount numeric CHECK (amount IS NULL OR amount >= 0),
  expense_date date,
  received_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Chicago')::date,
  reason text,
  dispatch_reason text,
  visit_outcome text,
  purchased_what text,
  purchase_purpose text,
  vendor_invoice_ref text,
  invoice_document_ids uuid[] NOT NULL DEFAULT '{}',
  photo_document_ids uuid[] NOT NULL DEFAULT '{}',
  photos_required boolean NOT NULL DEFAULT false,
  approval_id uuid REFERENCES public.approvals(id) ON DELETE SET NULL,
  authorization_note text,
  owner_notified_at timestamptz,
  owner_notification_note text,
  reservation_link_state text NOT NULL DEFAULT 'not_relevant' CHECK (reservation_link_state IN ('not_relevant','linked','unresolved')),
  ownerrez_booking_id text,
  proposed_statement_period date,
  ops_completion text NOT NULL DEFAULT 'open' CHECK (ops_completion IN ('open','done')),
  recommended_responsibility text CHECK (recommended_responsibility IS NULL OR recommended_responsibility IN ('owner','arha','guest','vendor','insurance','split','pending')),
  ops_recommendation_note text,
  recommended_by uuid,
  cost_responsibility text NOT NULL DEFAULT 'pending' CHECK (cost_responsibility IN ('owner','arha','guest','vendor','insurance','split','pending')),
  split_allocations jsonb NOT NULL DEFAULT '[]'::jsonb,
  finance_review text NOT NULL DEFAULT 'not_started' CHECK (finance_review IN ('not_started','in_review','needs_clarification','reviewed','reopened')),
  finance_treatment_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  qb_reference_manual text,
  leadership_required boolean NOT NULL DEFAULT false,
  leadership_reason text,
  leadership_assignee uuid,
  leadership_decision text,
  leadership_decided_by uuid,
  leadership_decided_at timestamptz,
  change_reason text,
  financial_request_id uuid REFERENCES public.financial_requests(id) ON DELETE SET NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.expenses.qb_reference_manual IS 'Manually entered QuickBooks reference. Not synchronized or verified.';
COMMENT ON COLUMN public.expenses.financial_request_id IS 'Reserved for a future onboarding pass; not used yet.';
CREATE INDEX expenses_property_idx ON public.expenses(property_id);
CREATE INDEX expenses_review_idx ON public.expenses(finance_review);

CREATE TABLE public.expense_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  link_type text NOT NULL CHECK (link_type IN ('ticket','work_order','claim','property_activity')),
  target_id uuid NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expense_id, link_type, target_id)
);
CREATE INDEX expense_links_target_idx ON public.expense_links(link_type, target_id);

CREATE TABLE public.expense_recoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  party text NOT NULL CHECK (party IN ('guest','vendor','insurance','owner','other')),
  expected_amount numeric NOT NULL DEFAULT 0 CHECK (expected_amount >= 0),
  received_amount numeric NOT NULL DEFAULT 0 CHECK (received_amount >= 0),
  received_on date,
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.expense_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  actor_id uuid,
  kind text NOT NULL,
  before_value jsonb,
  after_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expense_events_expense_idx ON public.expense_events(expense_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.expenses TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.expense_links TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.expense_recoveries TO authenticated;
GRANT SELECT ON public.expense_events TO authenticated;
GRANT ALL ON public.expenses, public.expense_links, public.expense_recoveries, public.expense_events TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_recoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_events ENABLE ROW LEVEL SECURITY;

-- Internal staff only. Homeowners and vendors have no policy, so no access.
CREATE POLICY "Internal staff read expenses" ON public.expenses FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff create expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Internal staff update expenses" ON public.expenses FOR UPDATE TO authenticated USING (public.is_internal_staff(auth.uid())) WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff read expense links" ON public.expense_links FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff add expense links" ON public.expense_links FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff remove expense links" ON public.expense_links FOR DELETE TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff read recoveries" ON public.expense_recoveries FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff add recoveries" ON public.expense_recoveries FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff update recoveries" ON public.expense_recoveries FOR UPDATE TO authenticated USING (public.is_internal_staff(auth.uid())) WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff read expense history" ON public.expense_events FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

CREATE OR REPLACE FUNCTION private.block_expense_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Expense history is append-only'; END $$;
CREATE TRIGGER expense_events_append_only BEFORE UPDATE OR DELETE ON public.expense_events
  FOR EACH ROW EXECUTE FUNCTION private.block_expense_event_mutation();

CREATE OR REPLACE FUNCTION private.expense_open_clarifications(_expense uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT count(*)::int FROM public.work_items w
  WHERE w.source_table = 'expenses' AND w.source_id = _expense AND w.status IN ('open','in_progress')
$$;

CREATE OR REPLACE FUNCTION private.expense_split_ok(_alloc jsonb, _amount numeric) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(_alloc) = 'array' AND jsonb_array_length(_alloc) >= 2 AND _amount IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_alloc) e
      WHERE (e->>'party') NOT IN ('owner','arha','guest','vendor','insurance') OR (e->>'amount') IS NULL OR (e->>'amount')::numeric < 0)
    AND (SELECT coalesce(sum((e->>'amount')::numeric),0) FROM jsonb_array_elements(_alloc) e) = _amount
$$;

CREATE OR REPLACE FUNCTION private.guard_expense_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE
  me uuid := auth.uid();
  lead boolean := private.is_finance_lead(me);
  acct boolean := private.is_accounting(me);
  admin boolean := public.has_role(me, 'admin');
  dir boolean := private.is_director(me);
  material boolean;
  kind text := 'updated';
  b jsonb := '{}'::jsonb; a jsonb := '{}'::jsonb;
  k text;
  oldj jsonb; newj jsonb;
  tracked text[] := ARRAY['property_id','expense_type','payee','amount','expense_date','received_on','reason','dispatch_reason','visit_outcome','purchased_what','purchase_purpose','vendor_invoice_ref','invoice_document_ids','photo_document_ids','photos_required','approval_id','authorization_note','owner_notified_at','owner_notification_note','reservation_link_state','ownerrez_booking_id','proposed_statement_period','ops_completion','recommended_responsibility','ops_recommendation_note','cost_responsibility','split_allocations','finance_review','finance_treatment_note','reviewed_by','reviewed_at','qb_reference_manual','leadership_required','leadership_reason','leadership_assignee','leadership_decision','leadership_decided_by','leadership_decided_at'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF me IS NOT NULL AND NOT lead AND (NEW.finance_review <> 'not_started' OR NEW.cost_responsibility <> 'pending' OR NEW.finance_treatment_note IS NOT NULL OR NEW.reviewed_by IS NOT NULL) THEN
      RAISE EXCEPTION 'Only the Finance lead can set Finance review or final cost responsibility';
    END IF;
    IF me IS NOT NULL AND NOT acct AND NEW.qb_reference_manual IS NOT NULL THEN
      RAISE EXCEPTION 'Only Finance can enter a QuickBooks reference';
    END IF;
    IF NEW.leadership_decision IS NOT NULL THEN RAISE EXCEPTION 'A leadership decision is recorded after the route is opened'; END IF;
    IF NEW.recommended_responsibility IS NOT NULL THEN NEW.recommended_by := me; END IF;
    NEW.change_reason := NULL;
    RETURN NEW;
  END IF;

  NEW.updated_at := now();
  IF me IS NULL THEN RETURN NEW; END IF; -- service role / maintenance

  IF NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
    RAISE EXCEPTION 'Creator and demo flag cannot change';
  END IF;

  -- Final financial treatment: Finance lead only.
  IF NOT lead AND (NEW.cost_responsibility IS DISTINCT FROM OLD.cost_responsibility
     OR NEW.split_allocations IS DISTINCT FROM OLD.split_allocations
     OR NEW.finance_treatment_note IS DISTINCT FROM OLD.finance_treatment_note) THEN
    RAISE EXCEPTION 'Only the Finance lead can set final cost responsibility, split allocation or financial treatment';
  END IF;
  IF NOT acct AND NEW.qb_reference_manual IS DISTINCT FROM OLD.qb_reference_manual THEN
    RAISE EXCEPTION 'Only Finance can enter a QuickBooks reference';
  END IF;
  IF NEW.recommended_responsibility IS DISTINCT FROM OLD.recommended_responsibility OR NEW.ops_recommendation_note IS DISTINCT FROM OLD.ops_recommendation_note THEN
    NEW.recommended_by := me;
  END IF;

  -- Leadership route.
  IF NEW.leadership_decision IS DISTINCT FROM OLD.leadership_decision THEN
    IF NOT (dir OR me = OLD.leadership_assignee) THEN RAISE EXCEPTION 'Only leadership or the assigned decision-maker can record a leadership decision'; END IF;
    IF NOT OLD.leadership_required THEN RAISE EXCEPTION 'Open a leadership decision route first'; END IF;
    IF OLD.leadership_decision IS NOT NULL THEN RAISE EXCEPTION 'A recorded leadership decision cannot be changed'; END IF;
    NEW.leadership_decided_by := me; NEW.leadership_decided_at := now(); kind := 'leadership_decided';
  ELSE
    NEW.leadership_decided_by := OLD.leadership_decided_by; NEW.leadership_decided_at := OLD.leadership_decided_at;
  END IF;
  IF OLD.leadership_decision IS NOT NULL AND (NEW.leadership_required IS DISTINCT FROM OLD.leadership_required OR NEW.leadership_reason IS DISTINCT FROM OLD.leadership_reason OR NEW.leadership_assignee IS DISTINCT FROM OLD.leadership_assignee) THEN
    RAISE EXCEPTION 'A decided leadership route cannot be edited';
  END IF;
  IF NEW.leadership_required AND NOT OLD.leadership_required THEN
    IF coalesce(trim(NEW.leadership_reason),'') = '' OR NEW.leadership_assignee IS NULL THEN RAISE EXCEPTION 'A leadership decision route needs a reason and an assignee'; END IF;
    kind := 'leadership_requested';
  END IF;

  material := NEW.amount IS DISTINCT FROM OLD.amount OR NEW.property_id IS DISTINCT FROM OLD.property_id
    OR NEW.payee IS DISTINCT FROM OLD.payee OR NEW.expense_date IS DISTINCT FROM OLD.expense_date
    OR NEW.cost_responsibility IS DISTINCT FROM OLD.cost_responsibility OR NEW.split_allocations IS DISTINCT FROM OLD.split_allocations
    OR NEW.expense_type IS DISTINCT FROM OLD.expense_type;

  NEW.reviewed_by := OLD.reviewed_by; NEW.reviewed_at := OLD.reviewed_at;

  IF NEW.finance_review IS DISTINCT FROM OLD.finance_review THEN
    IF NEW.finance_review = 'reviewed' THEN
      IF NOT lead THEN RAISE EXCEPTION 'Only the Finance lead can complete Finance review'; END IF;
      IF material THEN RAISE EXCEPTION 'Save financial changes before completing Finance review'; END IF;
      IF NEW.reservation_link_state = 'unresolved' THEN RAISE EXCEPTION 'Resolve the reservation link before Finance review'; END IF;
      IF NEW.property_id IS NULL OR NEW.amount IS NULL OR coalesce(trim(NEW.payee),'') = '' THEN RAISE EXCEPTION 'Property, payee and amount are required before Finance review'; END IF;
      IF NEW.cost_responsibility = 'pending' THEN RAISE EXCEPTION 'Set cost responsibility before completing Finance review'; END IF;
      IF NEW.cost_responsibility = 'split' AND NOT private.expense_split_ok(NEW.split_allocations, NEW.amount) THEN RAISE EXCEPTION 'Split allocations must add up to the expense total'; END IF;
      IF private.expense_open_clarifications(NEW.id) > 0 THEN RAISE EXCEPTION 'Open clarification requests must be answered first'; END IF;
      IF NEW.leadership_required AND NEW.leadership_decision IS NULL THEN RAISE EXCEPTION 'A leadership decision is still required'; END IF;
      NEW.reviewed_by := me; NEW.reviewed_at := now(); kind := 'reviewed';
    ELSIF OLD.finance_review = 'reviewed' AND NEW.finance_review = 'reopened' THEN
      IF NOT (lead OR admin) THEN RAISE EXCEPTION 'Only the Finance lead or an administrator can reopen a reviewed expense'; END IF;
      IF coalesce(trim(NEW.change_reason),'') = '' THEN RAISE EXCEPTION 'A reason is required to reopen a reviewed expense'; END IF;
      NEW.reviewed_by := NULL; NEW.reviewed_at := NULL; kind := 'reopened';
    ELSIF OLD.finance_review = 'reviewed' THEN
      RAISE EXCEPTION 'A reviewed expense must be reopened first';
    ELSIF OLD.finance_review = 'needs_clarification' AND NEW.finance_review = 'in_review' AND private.expense_open_clarifications(NEW.id) = 0 THEN
      NULL; -- returns to review once every clarification is answered
    ELSIF NOT acct THEN
      RAISE EXCEPTION 'Only Finance can change the Finance review state';
    END IF;
  ELSIF OLD.finance_review = 'reviewed' AND material THEN
    IF coalesce(trim(NEW.change_reason),'') = '' THEN RAISE EXCEPTION 'This expense was reviewed by Finance. Give a reason for the change'; END IF;
    NEW.finance_review := 'reopened'; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL; kind := 'review_invalidated';
  END IF;

  oldj := to_jsonb(OLD); newj := to_jsonb(NEW);
  FOREACH k IN ARRAY tracked LOOP
    IF oldj->k IS DISTINCT FROM newj->k THEN b := b || jsonb_build_object(k, oldj->k); a := a || jsonb_build_object(k, newj->k); END IF;
  END LOOP;
  IF kind = 'review_invalidated' OR kind = 'reopened' THEN
    b := b || jsonb_build_object('reviewed_by', OLD.reviewed_by, 'reviewed_at', OLD.reviewed_at);
  END IF;
  IF a <> '{}'::jsonb THEN
    INSERT INTO public.expense_events(expense_id, actor_id, kind, before_value, after_value, reason)
    VALUES (NEW.id, me, kind, b, a, nullif(trim(NEW.change_reason),''));
  END IF;
  NEW.change_reason := NULL;
  RETURN NEW;
END $$;

CREATE TRIGGER expenses_guard BEFORE INSERT OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION private.guard_expense_write();

CREATE OR REPLACE FUNCTION private.log_expense_created() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.expense_events(expense_id, actor_id, kind, after_value)
  VALUES (NEW.id, auth.uid(), 'created', jsonb_build_object('amount', NEW.amount, 'payee', NEW.payee, 'property_id', NEW.property_id, 'expense_type', NEW.expense_type));
  RETURN NEW;
END $$;
CREATE TRIGGER expenses_created AFTER INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION private.log_expense_created();

CREATE OR REPLACE FUNCTION private.log_expense_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.expense_links;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = NEW.expense_id AND e.finance_review = 'reviewed') AND auth.uid() IS NOT NULL AND NOT private.is_finance_lead(auth.uid()) THEN
    NULL; -- links are context, not financial values; allowed and recorded
  END IF;
  INSERT INTO public.expense_events(expense_id, actor_id, kind, after_value)
  VALUES (r.expense_id, auth.uid(), CASE WHEN TG_OP = 'DELETE' THEN 'unlinked' ELSE 'linked' END, jsonb_build_object('link_type', r.link_type, 'target_id', r.target_id));
  RETURN r;
END $$;
CREATE TRIGGER expense_links_log AFTER INSERT OR DELETE ON public.expense_links FOR EACH ROW EXECUTE FUNCTION private.log_expense_link();

CREATE OR REPLACE FUNCTION private.guard_expense_recovery() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NOT NULL AND NOT private.is_accounting(me) AND (
     (TG_OP = 'INSERT' AND (NEW.received_amount <> 0 OR NEW.received_on IS NOT NULL))
     OR (TG_OP = 'UPDATE' AND (NEW.received_amount IS DISTINCT FROM OLD.received_amount OR NEW.received_on IS DISTINCT FROM OLD.received_on))) THEN
    RAISE EXCEPTION 'Only Finance can record money received';
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
  INSERT INTO public.expense_events(expense_id, actor_id, kind, before_value, after_value)
  VALUES (NEW.expense_id, me, 'recovery_' || lower(TG_OP), CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END, to_jsonb(NEW));
  RETURN NEW;
END $$;
CREATE TRIGGER expense_recoveries_guard BEFORE INSERT OR UPDATE ON public.expense_recoveries FOR EACH ROW EXECUTE FUNCTION private.guard_expense_recovery();

CREATE OR REPLACE FUNCTION public.request_expense_clarification(_expense uuid, _question text, _assignee uuid, _due date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE e public.expenses; wid uuid;
BEGIN
  IF NOT private.is_accounting(auth.uid()) THEN RAISE EXCEPTION 'Only Finance can request a clarification'; END IF;
  IF coalesce(trim(_question),'') = '' THEN RAISE EXCEPTION 'Write the question'; END IF;
  SELECT * INTO e FROM public.expenses WHERE id = _expense;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expense not found'; END IF;
  IF e.finance_review = 'reviewed' THEN RAISE EXCEPTION 'Reopen the reviewed expense first'; END IF;
  INSERT INTO public.work_items(department, kind, property_id, source_table, source_id, title, status, assigned_to, due_on, required, is_demo, source, source_department)
  VALUES ('operations','task', e.property_id, 'expenses', e.id, 'Finance clarification: ' || left(trim(_question), 120), 'open', _assignee, _due, true, e.is_demo, 'arha', 'operations')
  RETURNING id INTO wid;
  INSERT INTO public.expense_events(expense_id, actor_id, kind, after_value)
  VALUES (e.id, auth.uid(), 'clarification_requested', jsonb_build_object('work_item_id', wid, 'question', trim(_question), 'assigned_to', _assignee, 'due_on', _due));
  UPDATE public.expenses SET finance_review = 'needs_clarification' WHERE id = e.id AND finance_review <> 'needs_clarification';
  RETURN wid;
END $$;

CREATE OR REPLACE FUNCTION public.answer_expense_clarification(_work_item uuid, _answer text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','private' AS $$
DECLARE w public.work_items;
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF coalesce(trim(_answer),'') = '' THEN RAISE EXCEPTION 'Write the answer'; END IF;
  SELECT * INTO w FROM public.work_items WHERE id = _work_item AND source_table = 'expenses';
  IF NOT FOUND THEN RAISE EXCEPTION 'Clarification not found'; END IF;
  IF w.status NOT IN ('open','in_progress') THEN RAISE EXCEPTION 'This clarification is already answered'; END IF;
  INSERT INTO public.expense_events(expense_id, actor_id, kind, after_value)
  VALUES (w.source_id, auth.uid(), 'clarification_answered', jsonb_build_object('work_item_id', w.id, 'answer', trim(_answer)));
  UPDATE public.work_items SET status = 'complete', completed_at = now() WHERE id = w.id;
  IF private.expense_open_clarifications(w.source_id) = 0 THEN
    UPDATE public.expenses SET finance_review = 'in_review' WHERE id = w.source_id AND finance_review = 'needs_clarification';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.request_expense_clarification(uuid, text, uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.answer_expense_clarification(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_expense_clarification(uuid, text, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.answer_expense_clarification(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_finance_lead(uuid), public.is_accounting(uuid) TO authenticated;