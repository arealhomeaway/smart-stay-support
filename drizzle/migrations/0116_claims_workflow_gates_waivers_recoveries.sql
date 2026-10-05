-- Claims workflow: payer/deadline facts, submission & decision evidence, nonrecovery, waivers, Finance-owned recovery ledger.
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS booking_source text,
  ADD COLUMN IF NOT EXISTS contracting_party text,
  ADD COLUMN IF NOT EXISTS deposit_payer text,
  ADD COLUMN IF NOT EXISTS deadline_source text,
  ADD COLUMN IF NOT EXISTS deadline_timezone text NOT NULL DEFAULT 'America/Chicago',
  ADD COLUMN IF NOT EXISTS deadline_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_release_on date,
  ADD COLUMN IF NOT EXISTS deposit_release_source text,
  ADD COLUMN IF NOT EXISTS deposit_release_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submission_document_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS decision_document_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS nonrecovery_reason text,
  ADD COLUMN IF NOT EXISTS finance_decision_pending text;

ALTER TABLE public.expense_recoveries
  ADD COLUMN IF NOT EXISTS claim_id uuid REFERENCES public.claims(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS accounting_reference text,
  ADD COLUMN IF NOT EXISTS corrects_id uuid REFERENCES public.expense_recoveries(id),
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.expense_recoveries ALTER COLUMN expense_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS expense_recoveries_claim_idx ON public.expense_recoveries(claim_id);

CREATE TABLE IF NOT EXISTS public.claim_waivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL DEFAULT auth.uid(),
  reason text NOT NULL,
  context text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  decided_by uuid,
  decision_notes text,
  decided_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS claim_waivers_one_pending ON public.claim_waivers(claim_id) WHERE status = 'pending';
GRANT SELECT ON public.claim_waivers TO authenticated;
GRANT ALL ON public.claim_waivers TO service_role;
ALTER TABLE public.claim_waivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal staff read claim waivers" ON public.claim_waivers FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

-- Recovery ledger: Finance seats only, append-only (corrections are reversing rows).
DROP POLICY IF EXISTS "Internal staff add recoveries" ON public.expense_recoveries;
DROP POLICY IF EXISTS "Internal staff update recoveries" ON public.expense_recoveries;
CREATE POLICY "Finance adds recoveries" ON public.expense_recoveries FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_lead(auth.uid()) OR public.is_accounting(auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_expense_recovery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cap numeric; _sum numeric;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Recovery entries are append-only; record a correcting entry instead';
  END IF;
  IF NEW.claim_id IS NULL AND NEW.expense_id IS NULL THEN
    RAISE EXCEPTION 'A recovery must belong to a claim or an expense';
  END IF;
  IF NEW.corrects_id IS NULL AND NEW.received_amount <= 0 THEN
    RAISE EXCEPTION 'Received amount must be positive; use a correction to reverse';
  END IF;
  IF NEW.corrects_id IS NOT NULL AND coalesce(btrim(NEW.note),'') = '' THEN
    RAISE EXCEPTION 'A correction needs a reason';
  END IF;
  IF NEW.claim_id IS NOT NULL AND NEW.expense_id IS NOT NULL AND NOT EXISTS (
     SELECT 1 FROM expense_links WHERE expense_id = NEW.expense_id AND link_type='claim' AND target_id = NEW.claim_id) THEN
    RAISE EXCEPTION 'Allocate only to an expense linked to this claim';
  END IF;
  IF NEW.expense_id IS NOT NULL THEN
    SELECT amount INTO _cap FROM expenses WHERE id = NEW.expense_id;
    SELECT coalesce(sum(received_amount),0) + NEW.received_amount INTO _sum FROM expense_recoveries WHERE expense_id = NEW.expense_id;
    IF _cap IS NOT NULL AND _sum > _cap THEN
      RAISE EXCEPTION 'Recoveries would exceed the expense amount (%)', _cap;
    END IF;
  END IF;
  NEW.created_by := auth.uid();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_expense_recovery ON public.expense_recoveries;
CREATE TRIGGER guard_expense_recovery BEFORE INSERT OR UPDATE OR DELETE ON public.expense_recoveries
  FOR EACH ROW EXECUTE FUNCTION public.guard_expense_recovery();

-- Received amount on a claim is derived from the ledger, never typed.
CREATE OR REPLACE FUNCTION public.sync_claim_recovered()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.claim_id IS NOT NULL THEN
    PERFORM set_config('resolve.claim_sync','on',true);
    UPDATE claims SET recovered_amount = (SELECT sum(received_amount) FROM expense_recoveries WHERE claim_id = NEW.claim_id),
      recovered_on = coalesce(NEW.received_on, current_date)
    WHERE id = NEW.claim_id;
    PERFORM set_config('resolve.claim_sync','off',true);
    INSERT INTO claim_activity(claim_id, author_id, event_type, body, is_demo)
    SELECT NEW.claim_id, auth.uid(), 'recovery',
      CASE WHEN NEW.corrects_id IS NULL THEN 'Received ' ELSE 'Correction ' END || NEW.received_amount::text ||
      coalesce(' · ref ' || NEW.accounting_reference,'') || coalesce(' · ' || NEW.note,''), c.is_demo
    FROM claims c WHERE c.id = NEW.claim_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_claim_recovered ON public.expense_recoveries;
CREATE TRIGGER sync_claim_recovered AFTER INSERT ON public.expense_recoveries
  FOR EACH ROW EXECUTE FUNCTION public.sync_claim_recovered();

-- Stage gates.
CREATE OR REPLACE FUNCTION public.guard_claim_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _post_submit text[] := ARRAY['submitted','waiting_external','info_requested','decided','recovered','closed'];
BEGIN
  IF NEW.recovered_amount IS DISTINCT FROM OLD.recovered_amount
     AND coalesce(current_setting('resolve.claim_sync', true),'off') <> 'on' THEN
    RAISE EXCEPTION 'Received amounts are recorded by Finance in the recovery ledger';
  END IF;
  IF NEW.stage = ANY(_post_submit) AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    IF NEW.submitted_on IS NULL OR coalesce(btrim(NEW.external_reference),'') = ''
       OR coalesce(array_length(NEW.submission_document_ids,1),0) = 0 THEN
      RAISE EXCEPTION 'Submitted needs a submission date, reference and proof of submission';
    END IF;
  END IF;
  IF NEW.stage IN ('decided','recovered') AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    IF NEW.disposition IS NULL OR coalesce(array_length(NEW.decision_document_ids,1),0) = 0 THEN
      RAISE EXCEPTION 'A decision needs the outcome and decision evidence';
    END IF;
  END IF;
  IF NEW.disposition IN ('approved','partial') AND NEW.approved_amount IS NULL THEN
    RAISE EXCEPTION 'Record the approved amount';
  END IF;
  IF NEW.disposition IN ('denied','withdrawn','written_off') AND coalesce(btrim(NEW.disposition_reason),'') = '' THEN
    RAISE EXCEPTION 'A denied, withdrawn or written-off claim needs a reason';
  END IF;
  IF NEW.stage = 'closed' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    IF NEW.disposition IS NULL THEN RAISE EXCEPTION 'Close with a recorded outcome'; END IF;
    IF coalesce(NEW.submitted_amount, NEW.approved_amount, 0) > coalesce(NEW.recovered_amount,0)
       AND coalesce(btrim(NEW.nonrecovery_reason),'') = '' THEN
      RAISE EXCEPTION 'Explain the unrecovered amount before closing';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_claim_workflow ON public.claims;
CREATE TRIGGER guard_claim_workflow BEFORE UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.guard_claim_workflow();

-- Waivers: PC requests, Operations Supervisors decide, PC hears back in-app.
CREATE OR REPLACE FUNCTION public.request_claim_waiver(_claim_id uuid, _reason text, _context text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _c claims; _sup uuid;
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'A waiver request needs a reason'; END IF;
  SELECT * INTO _c FROM claims WHERE id = _claim_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found'; END IF;
  IF EXISTS (SELECT 1 FROM claim_waivers WHERE claim_id=_claim_id AND status='pending') THEN
    SELECT id INTO _id FROM claim_waivers WHERE claim_id=_claim_id AND status='pending';
    RETURN _id; -- retry-safe
  END IF;
  INSERT INTO claim_waivers(claim_id, requested_by, reason, context, is_demo)
  VALUES (_claim_id, auth.uid(), _reason, _context, _c.is_demo) RETURNING id INTO _id;
  INSERT INTO claim_activity(claim_id, author_id, event_type, body, is_demo)
  VALUES (_claim_id, auth.uid(), 'waiver_requested', _reason, _c.is_demo);
  FOR _sup IN SELECT p.id FROM profiles p WHERE public.is_supervisor(p.id) AND p.id <> auth.uid() LOOP
    PERFORM public.notify_staff(_sup, 'claim_waiver', 'Waiver requested: ' || coalesce(_c.title,'claim'),
      _reason, 'claim', _claim_id, '/claims?claim=' || _claim_id, 'normal', auth.uid(), false, _c.is_demo);
  END LOOP;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.decide_claim_waiver(_waiver_id uuid, _approve boolean, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _w claim_waivers; _c claims; _who uuid;
BEGIN
  IF NOT (public.is_supervisor(auth.uid()) OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only an Operations Supervisor can decide a waiver';
  END IF;
  IF coalesce(btrim(_notes),'') = '' THEN RAISE EXCEPTION 'Decision notes are required'; END IF;
  SELECT * INTO _w FROM claim_waivers WHERE id = _waiver_id FOR UPDATE;
  IF NOT FOUND OR _w.status <> 'pending' THEN RAISE EXCEPTION 'Waiver is not pending'; END IF;
  IF _w.requested_by = auth.uid() THEN RAISE EXCEPTION 'You cannot decide your own waiver request'; END IF;
  UPDATE claim_waivers SET status = CASE WHEN _approve THEN 'approved' ELSE 'denied' END,
    decided_by = auth.uid(), decision_notes = _notes, decided_at = now() WHERE id = _waiver_id;
  SELECT * INTO _c FROM claims WHERE id = _w.claim_id;
  INSERT INTO claim_activity(claim_id, author_id, event_type, body, is_demo)
  VALUES (_c.id, auth.uid(), CASE WHEN _approve THEN 'waiver_approved' ELSE 'waiver_denied' END, _notes, _c.is_demo);
  FOR _who IN SELECT DISTINCT x FROM unnest(ARRAY[_w.requested_by, _c.assigned_to]) x WHERE x IS NOT NULL AND x <> auth.uid() LOOP
    PERFORM public.notify_staff(_who, 'claim_waiver_decision',
      'Waiver ' || CASE WHEN _approve THEN 'approved' ELSE 'denied' END || ': ' || coalesce(_c.title,'claim'),
      _notes, 'claim', _c.id, '/claims?claim=' || _c.id, 'normal', auth.uid(), false, _c.is_demo);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.request_claim_waiver(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_claim_waiver(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_claim_waiver(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_claim_waiver(uuid,boolean,text) TO authenticated;
