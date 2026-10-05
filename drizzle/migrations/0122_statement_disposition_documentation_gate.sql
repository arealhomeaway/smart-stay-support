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
    IF coalesce(array_length(e.invoice_document_ids,1),0) = 0 OR coalesce(btrim(e.payee),'') = '' OR e.amount IS NULL
       OR e.expense_date IS NULL OR coalesce(btrim(e.reason),'') = ''
       OR (e.expense_type = 'vendor_service' AND (coalesce(btrim(e.dispatch_reason),'') = '' OR coalesce(btrim(e.visit_outcome),'') = ''))
       OR (e.expense_type = 'purchase' AND (coalesce(btrim(e.purchased_what),'') = '' OR coalesce(btrim(e.purchase_purpose),'') = '')) THEN
      RAISE EXCEPTION 'Documentation is incomplete — hold the expense until Operations supplies the missing facts';
    END IF;
    IF e.finance_review <> 'reviewed' THEN RAISE EXCEPTION 'Finance review must be complete before including the expense'; END IF;
    IF coalesce(e.cost_responsibility,'pending') = 'pending' THEN RAISE EXCEPTION 'Cost responsibility is unresolved'; END IF;
    IF e.cost_responsibility IN ('owner','split') AND t IS NULL THEN
      RAISE EXCEPTION 'An owner-facing charge needs an owner-safe description';
    END IF;
    SELECT EXISTS (SELECT 1 FROM expense_links l JOIN claims c ON c.id = l.target_id
                   WHERE l.expense_id = e.id AND l.link_type = 'claim' AND c.stage <> 'closed')
        OR coalesce((SELECT least(e.amount, max(expected_amount) FILTER (WHERE corrects_id IS NULL)) - sum(received_amount)
                     FROM expense_recoveries WHERE expense_id = e.id),0) > 0
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
    UPDATE expenses SET proposed_statement_period = _d WHERE id = e.id;
  ELSIF e.proposed_statement_period IS DISTINCT FROM _p THEN
    UPDATE expenses SET proposed_statement_period = _p WHERE id = e.id;
  END IF;
  INSERT INTO expense_events(expense_id, actor_id, kind, after_value)
  VALUES (e.id, auth.uid(), 'statement_disposition', jsonb_build_object('period', _p, 'disposition', _disposition, 'defer_to', _d));
  RETURN _id;
END $$;