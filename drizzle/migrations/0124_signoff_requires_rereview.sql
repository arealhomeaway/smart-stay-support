CREATE OR REPLACE FUNCTION public.confirm_statement_reconciliation(_property uuid, _period date, _source_reference text, _exception_resolution text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _p date := date_trunc('month',_period)::date; _id uuid; _snap jsonb; _undecided int; _exceptions int; _demo boolean; _stale int;
BEGIN
  IF NOT private.is_finance_lead(auth.uid()) THEN RAISE EXCEPTION 'Only the Finance Lead can confirm the expense review'; END IF;
  IF coalesce(btrim(_source_reference),'') = '' THEN RAISE EXCEPTION 'Record the source records or reference you reviewed'; END IF;
  SELECT is_demo INTO _demo FROM properties WHERE id = _property;
  IF NOT FOUND THEN RAISE EXCEPTION 'Property not found'; END IF;
  SELECT count(*) INTO _undecided FROM expenses e
   WHERE e.property_id = _property AND e.archived_at IS NULL AND NOT e.is_estimate
     AND date_trunc('month', e.proposed_statement_period)::date = _p
     AND NOT EXISTS (SELECT 1 FROM statement_dispositions d WHERE d.expense_id = e.id AND d.superseded_at IS NULL AND d.period = _p);
  IF _undecided > 0 THEN RAISE EXCEPTION '% expense(s) in this period have no disposition yet', _undecided; END IF;
  -- An included expense whose Finance review was reopened by a material change is not ready until re-reviewed.
  SELECT count(*) INTO _stale FROM statement_dispositions d JOIN expenses e ON e.id = d.expense_id
   WHERE d.property_id = _property AND d.period = _p AND d.superseded_at IS NULL AND d.disposition = 'include'
     AND (e.finance_review <> 'reviewed' OR e.archived_at IS NOT NULL);
  IF _stale > 0 THEN RAISE EXCEPTION '% included expense(s) changed and need Finance re-review before sign-off', _stale; END IF;
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