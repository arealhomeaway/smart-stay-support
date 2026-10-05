-- Statement Readiness: Finance dispositions per expense/period and Finance Lead expense-review
-- sign-off per property/period. Prepares review only; never posts to OwnerRez or QuickBooks.

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS invoice_date date;

CREATE TABLE public.statement_dispositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE RESTRICT,
  property_id uuid NOT NULL,
  period date NOT NULL CHECK (extract(day FROM period) = 1),
  disposition text NOT NULL CHECK (disposition IN ('include','hold','defer','exclude')),
  defer_to_period date CHECK (defer_to_period IS NULL OR extract(day FROM defer_to_period) = 1),
  owner_description text,
  internal_note text,
  exclusion_treatment text,
  recovery_treatment text,
  decided_by uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  superseded_by uuid REFERENCES public.statement_dispositions(id),
  is_demo boolean NOT NULL DEFAULT false
);
CREATE INDEX statement_dispositions_period_idx ON public.statement_dispositions(property_id, period);
CREATE UNIQUE INDEX statement_dispositions_one_current ON public.statement_dispositions(expense_id) WHERE superseded_at IS NULL;
GRANT SELECT ON public.statement_dispositions TO authenticated;
GRANT ALL ON public.statement_dispositions TO service_role;
ALTER TABLE public.statement_dispositions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal staff read dispositions" ON public.statement_dispositions FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE TABLE public.statement_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  period date NOT NULL CHECK (extract(day FROM period) = 1),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','invalidated')),
  reviewed_by uuid NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  source_reference text NOT NULL,
  exception_resolution text,
  snapshot jsonb NOT NULL,
  invalidated_at timestamptz,
  invalidated_reason text,
  is_demo boolean NOT NULL DEFAULT false
);
CREATE INDEX statement_reconciliations_period_idx ON public.statement_reconciliations(property_id, period);
CREATE UNIQUE INDEX statement_reconciliations_one_confirmed ON public.statement_reconciliations(property_id, period) WHERE status = 'confirmed';
GRANT SELECT ON public.statement_reconciliations TO authenticated;
GRANT ALL ON public.statement_reconciliations TO service_role;
ALTER TABLE public.statement_reconciliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal staff read reconciliations" ON public.statement_reconciliations FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

-- History is never edited except the supersede/invalidate markers set by the functions below.
CREATE OR REPLACE FUNCTION private.guard_statement_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Statement review history is permanent'; END IF;
  IF coalesce(current_setting('resolve.statement', true),'off') <> 'on' THEN
    RAISE EXCEPTION 'Statement review history is permanent';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_statement_dispositions BEFORE UPDATE OR DELETE ON public.statement_dispositions
  FOR EACH ROW EXECUTE FUNCTION private.guard_statement_history();
CREATE TRIGGER guard_statement_reconciliations BEFORE UPDATE OR DELETE ON public.statement_reconciliations
  FOR EACH ROW EXECUTE FUNCTION private.guard_statement_history();

-- Mark a confirmed sign-off as needing re-review (kept, never overwritten).
CREATE OR REPLACE FUNCTION private.invalidate_statement_period(_property uuid, _period date, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF _property IS NULL OR _period IS NULL THEN RETURN; END IF;
  PERFORM set_config('resolve.statement','on',true);
  UPDATE statement_reconciliations SET status = 'invalidated', invalidated_at = now(), invalidated_reason = _reason
  WHERE property_id = _property AND period = date_trunc('month',_period)::date AND status = 'confirmed';
  PERFORM set_config('resolve.statement','off',true);
END $$;

-- Periods an expense currently touches: its proposed period and any current disposition period.
CREATE OR REPLACE FUNCTION private.expense_statement_periods(_expense uuid)
RETURNS TABLE(property_id uuid, period date) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.property_id, date_trunc('month', e.proposed_statement_period)::date FROM expenses e
   WHERE e.id = _expense AND e.proposed_statement_period IS NOT NULL
  UNION
  SELECT d.property_id, d.period FROM statement_dispositions d WHERE d.expense_id = _expense AND d.superseded_at IS NULL
$$;

CREATE OR REPLACE FUNCTION private.statement_expense_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE r record; _why text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.proposed_statement_period IS NOT NULL THEN
      PERFORM private.invalidate_statement_period(NEW.property_id, NEW.proposed_statement_period, 'New expense assigned to this period');
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN _why := 'Expense amount changed';
  ELSIF NEW.cost_responsibility IS DISTINCT FROM OLD.cost_responsibility OR NEW.split_allocations IS DISTINCT FROM OLD.split_allocations THEN _why := 'Owner allocation changed';
  ELSIF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN _why := 'Expense archived or restored';
  ELSIF NEW.finance_review IS DISTINCT FROM OLD.finance_review AND OLD.finance_review = 'reviewed' THEN _why := 'Finance review reopened';
  ELSIF NEW.is_estimate IS DISTINCT FROM OLD.is_estimate OR NEW.property_id IS DISTINCT FROM OLD.property_id THEN _why := 'Expense facts changed';
  ELSIF NEW.proposed_statement_period IS DISTINCT FROM OLD.proposed_statement_period THEN _why := 'Expense moved between periods';
  END IF;
  IF _why IS NULL THEN RETURN NEW; END IF;
  IF OLD.proposed_statement_period IS NOT NULL THEN
    PERFORM private.invalidate_statement_period(OLD.property_id, OLD.proposed_statement_period, _why);
  END IF;
  FOR r IN SELECT * FROM private.expense_statement_periods(NEW.id) LOOP
    PERFORM private.invalidate_statement_period(r.property_id, r.period, _why);
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER statement_expense_changed AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION private.statement_expense_changed();

CREATE OR REPLACE FUNCTION private.statement_recovery_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE r record;
BEGIN
  IF NEW.expense_id IS NOT NULL THEN
    FOR r IN SELECT * FROM private.expense_statement_periods(NEW.expense_id) LOOP
      PERFORM private.invalidate_statement_period(r.property_id, r.period, 'Recovery recorded or corrected');
    END LOOP;
  END IF;
  IF NEW.claim_id IS NOT NULL THEN
    FOR r IN SELECT p.* FROM expense_links l, LATERAL private.expense_statement_periods(l.expense_id) p
             WHERE l.link_type = 'claim' AND l.target_id = NEW.claim_id LOOP
      PERFORM private.invalidate_statement_period(r.property_id, r.period, 'Recovery recorded on a linked claim');
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER statement_recovery_changed AFTER INSERT ON public.expense_recoveries
  FOR EACH ROW EXECUTE FUNCTION private.statement_recovery_changed();

-- Finance (Finance Lead or Accounting) records a disposition. Never posts anything.
CREATE OR REPLACE FUNCTION public.record_statement_disposition(_expense uuid, _period date, _disposition text,
  _owner_description text DEFAULT NULL, _internal_note text DEFAULT NULL, _defer_to date DEFAULT NULL,
  _exclusion_treatment text DEFAULT NULL, _recovery_treatment text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE e expenses; _p date := date_trunc('month',_period)::date; _d date := date_trunc('month',_defer_to)::date;
        _prev statement_dispositions; _id uuid; _open_recovery boolean;
  t text := nullif(btrim(coalesce(_owner_description,'')),'');
  n text := nullif(btrim(coalesce(_internal_note,'')),'');
  x text := nullif(btrim(coalesce(_exclusion_treatment,'')),'');
  rt text := nullif(btrim(coalesce(_recovery_treatment,'')),'');
BEGIN
  IF NOT private.is_accounting(auth.uid()) THEN RAISE EXCEPTION 'Only Finance can record a statement disposition'; END IF;
  SELECT * INTO e FROM expenses WHERE id = _expense FOR UPDATE;
  IF NOT FOUND OR e.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Expense not found or archived'; END IF;
  IF e.property_id IS NULL THEN RAISE EXCEPTION 'Assign the expense to a property first'; END IF;
  IF _disposition NOT IN ('include','hold','defer','exclude') THEN RAISE EXCEPTION 'Unknown disposition'; END IF;
  IF _disposition = 'include' THEN
    IF e.is_estimate THEN RAISE EXCEPTION 'An estimate cannot be included — record the actual invoice'; END IF;
    IF e.duplicate_flag = 'suspected' THEN RAISE EXCEPTION 'Resolve the suspected duplicate first'; END IF;
    IF e.finance_review <> 'reviewed' THEN RAISE EXCEPTION 'Finance review must be complete before including the expense'; END IF;
    IF coalesce(e.cost_responsibility,'pending') = 'pending' THEN RAISE EXCEPTION 'Cost responsibility is unresolved'; END IF;
    IF e.cost_responsibility IN ('owner','split') AND t IS NULL THEN
      RAISE EXCEPTION 'An owner-facing charge needs an owner-safe description';
    END IF;
    SELECT EXISTS (SELECT 1 FROM expense_links l JOIN claims c ON c.id = l.target_id
                   WHERE l.expense_id = e.id AND l.link_type = 'claim' AND c.stage <> 'closed')
        OR coalesce((SELECT sum(expected_amount) - sum(received_amount) FROM expense_recoveries WHERE expense_id = e.id AND corrects_id IS NULL),0) > 0
      INTO _open_recovery;
    IF _open_recovery AND rt IS NULL THEN
      RAISE EXCEPTION 'Record the Finance treatment of the outstanding recovery or open claim';
    END IF;
  ELSIF _disposition = 'hold' THEN
    IF n IS NULL THEN RAISE EXCEPTION 'Say what the hold is waiting on'; END IF;
  ELSIF _disposition = 'defer' THEN
    IF _d IS NULL OR _d <= _p THEN RAISE EXCEPTION 'Choose a later statement period to defer to'; END IF;
  ELSIF _disposition = 'exclude' THEN
    IF n IS NULL OR x IS NULL THEN RAISE EXCEPTION 'Exclusion needs a reason and the recorded financial treatment'; END IF;
  END IF;

  SELECT * INTO _prev FROM statement_dispositions WHERE expense_id = e.id AND superseded_at IS NULL;
  INSERT INTO statement_dispositions(expense_id, property_id, period, disposition, defer_to_period, owner_description,
    internal_note, exclusion_treatment, recovery_treatment, decided_by, is_demo)
  VALUES (e.id, e.property_id, _p, _disposition, CASE WHEN _disposition='defer' THEN _d END, t, n, x, rt, auth.uid(), e.is_demo)
  ON CONFLICT DO NOTHING RETURNING id INTO _id;
  IF _id IS NULL THEN
    -- one current row per expense: supersede the previous, then insert
    PERFORM set_config('resolve.statement','on',true);
    UPDATE statement_dispositions SET superseded_at = now() WHERE id = _prev.id;
    PERFORM set_config('resolve.statement','off',true);
    INSERT INTO statement_dispositions(expense_id, property_id, period, disposition, defer_to_period, owner_description,
      internal_note, exclusion_treatment, recovery_treatment, decided_by, is_demo)
    VALUES (e.id, e.property_id, _p, _disposition, CASE WHEN _disposition='defer' THEN _d END, t, n, x, rt, auth.uid(), e.is_demo)
    RETURNING id INTO _id;
    PERFORM set_config('resolve.statement','on',true);
    UPDATE statement_dispositions SET superseded_by = _id WHERE id = _prev.id;
    PERFORM set_config('resolve.statement','off',true);
    PERFORM private.invalidate_statement_period(_prev.property_id, _prev.period, 'Disposition changed');
  END IF;
  PERFORM private.invalidate_statement_period(e.property_id, _p, 'Disposition changed');
  IF _disposition = 'defer' THEN
    UPDATE expenses SET proposed_statement_period = _d WHERE id = e.id; -- Finance sets the period
  ELSIF e.proposed_statement_period IS DISTINCT FROM _p THEN
    UPDATE expenses SET proposed_statement_period = _p WHERE id = e.id;
  END IF;
  INSERT INTO expense_events(expense_id, actor_id, kind, after_value)
  VALUES (e.id, auth.uid(), 'statement_disposition', jsonb_build_object('period', _p, 'disposition', _disposition, 'defer_to', _d));
  RETURN _id;
END $$;

-- Finance Lead sign-off: "Expense review ready" for one property and period (manual source reference).
CREATE OR REPLACE FUNCTION public.confirm_statement_reconciliation(_property uuid, _period date, _source_reference text, _exception_resolution text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _p date := date_trunc('month',_period)::date; _id uuid; _snap jsonb; _undecided int; _exceptions int; _demo boolean;
BEGIN
  IF NOT private.is_finance_lead(auth.uid()) THEN RAISE EXCEPTION 'Only the Finance Lead can confirm the expense review'; END IF;
  IF coalesce(btrim(_source_reference),'') = '' THEN RAISE EXCEPTION 'Record the source records or reference you reviewed'; END IF;
  SELECT is_demo INTO _demo FROM properties WHERE id = _property;
  IF NOT FOUND THEN RAISE EXCEPTION 'Property not found'; END IF;
  -- every active expense proposed for this period needs a current disposition here
  SELECT count(*) INTO _undecided FROM expenses e
   WHERE e.property_id = _property AND e.archived_at IS NULL AND NOT e.is_estimate
     AND date_trunc('month', e.proposed_statement_period)::date = _p
     AND NOT EXISTS (SELECT 1 FROM statement_dispositions d WHERE d.expense_id = e.id AND d.superseded_at IS NULL AND d.period = _p);
  IF _undecided > 0 THEN RAISE EXCEPTION '% expense(s) in this period have no disposition yet', _undecided; END IF;
  SELECT count(*) INTO _exceptions FROM statement_dispositions d
   WHERE d.property_id = _property AND d.period = _p AND d.superseded_at IS NULL AND d.disposition IN ('hold','exclude','defer');
  IF _exceptions > 0 AND coalesce(btrim(_exception_resolution),'') = '' THEN
    RAISE EXCEPTION 'Explain how each held, deferred or excluded item is resolved';
  END IF;
  SELECT jsonb_build_object(
    'source_label','manual',
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'expense_id', e.id, 'payee', e.payee, 'amount', e.amount, 'cost_responsibility', e.cost_responsibility,
      'split_allocations', e.split_allocations, 'disposition', d.disposition, 'defer_to', d.defer_to_period,
      'owner_description', d.owner_description, 'recovery_treatment', d.recovery_treatment,
      'received', (SELECT coalesce(sum(received_amount),0) FROM expense_recoveries r WHERE r.expense_id = e.id),
      'expected', (SELECT coalesce(sum(expected_amount),0) FROM expense_recoveries r WHERE r.expense_id = e.id AND r.corrects_id IS NULL)
    )) FILTER (WHERE d.id IS NOT NULL), '[]'::jsonb))
  INTO _snap
  FROM statement_dispositions d JOIN expenses e ON e.id = d.expense_id
  WHERE d.property_id = _property AND d.period = _p AND d.superseded_at IS NULL;
  PERFORM private.invalidate_statement_period(_property, _p, 'Superseded by a new sign-off');
  INSERT INTO statement_reconciliations(property_id, period, reviewed_by, source_reference, exception_resolution, snapshot, is_demo)
  VALUES (_property, _p, auth.uid(), btrim(_source_reference), nullif(btrim(coalesce(_exception_resolution,'')),''), _snap, coalesce(_demo,false))
  RETURNING id INTO _id;
  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.record_statement_disposition(uuid,date,text,text,text,date,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_statement_reconciliation(uuid,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_statement_disposition(uuid,date,text,text,text,date,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_statement_reconciliation(uuid,date,text,text) TO authenticated;