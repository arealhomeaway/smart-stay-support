-- Finance review must cover required documentation that exists at review time;
-- changing designated invoice/photo evidence reopens a reviewed expense.
CREATE OR REPLACE FUNCTION private.expense_live_docs(_ids uuid[])
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT count(*)::int FROM public.documents d
  WHERE d.id = ANY(coalesce(_ids,'{}'::uuid[])) AND d.archived_at IS NULL
    AND coalesce(d.upload_status,'stored') = 'stored'
    AND (d.storage_path IS NOT NULL OR d.external_url IS NOT NULL)
$$;

CREATE OR REPLACE FUNCTION private.expense_documentation_ok(e public.expenses)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT private.expense_live_docs(e.invoice_document_ids) > 0
    AND coalesce(btrim(e.payee),'') <> '' AND e.amount IS NOT NULL AND e.property_id IS NOT NULL
    AND e.expense_date IS NOT NULL AND coalesce(btrim(e.reason),'') <> ''
    AND NOT (e.expense_type = 'vendor_service' AND (coalesce(btrim(e.dispatch_reason),'') = '' OR coalesce(btrim(e.visit_outcome),'') = ''))
    AND NOT (e.expense_type = 'purchase' AND (coalesce(btrim(e.purchased_what),'') = '' OR coalesce(btrim(e.purchase_purpose),'') = ''))
    AND NOT (coalesce(e.photos_required,false) AND private.expense_live_docs(e.photo_document_ids) = 0)
$$;

CREATE OR REPLACE FUNCTION private.expense_evidence_changed(o public.expenses, n public.expenses)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT array_agg(x ORDER BY x) FROM unnest(o.invoice_document_ids) x),'{}')
           IS DISTINCT FROM coalesce((SELECT array_agg(x ORDER BY x) FROM unnest(n.invoice_document_ids) x),'{}')
      OR coalesce(o.photos_required,false) IS DISTINCT FROM coalesce(n.photos_required,false)
      OR (coalesce(n.photos_required,false) AND
          coalesce((SELECT array_agg(x ORDER BY x) FROM unnest(o.photo_document_ids) x),'{}')
           IS DISTINCT FROM coalesce((SELECT array_agg(x ORDER BY x) FROM unnest(n.photo_document_ids) x),'{}'))
$$;

-- Runs before expenses_guard (trigger name order): gates review and captures the change reason.
CREATE OR REPLACE FUNCTION public.expense_review_readiness_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, private AS $function$
BEGIN
  IF NEW.finance_review = 'reviewed' AND OLD.finance_review IS DISTINCT FROM 'reviewed' THEN
    IF NEW.is_estimate THEN RAISE EXCEPTION 'This is an estimate — convert it to the actual invoice (or archive it as replaced) before Finance review'; END IF;
    IF NEW.duplicate_flag = 'suspected' THEN RAISE EXCEPTION 'Resolve the suspected duplicate first — mark it "Not a duplicate" or archive the duplicate entry'; END IF;
    IF private.expense_evidence_changed(OLD, NEW) THEN RAISE EXCEPTION 'Save evidence changes before completing Finance review'; END IF;
    IF NOT private.expense_documentation_ok(NEW) THEN
      RAISE EXCEPTION 'Documentation is incomplete — a stored invoice or itemized receipt (and any required facts and photos) must be on record before Finance review';
    END IF;
  ELSIF OLD.finance_review = 'reviewed' AND NEW.finance_review = 'reviewed' AND private.expense_evidence_changed(OLD, NEW) THEN
    IF coalesce(btrim(NEW.change_reason),'') = '' THEN
      RAISE EXCEPTION 'This expense was reviewed by Finance. Give a reason for changing its required evidence';
    END IF;
    PERFORM set_config('resolve.evidence_reason', btrim(NEW.change_reason), true);
  END IF;
  RETURN NEW;
END $function$;

-- Runs after expenses_guard: reopens review for evidence changes, keeping the prior reviewer in history.
CREATE OR REPLACE FUNCTION private.expense_evidence_reopen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF OLD.finance_review = 'reviewed' AND NEW.finance_review = 'reviewed' AND private.expense_evidence_changed(OLD, NEW) THEN
    INSERT INTO public.expense_events(expense_id, actor_id, kind, before_value, after_value, reason)
    VALUES (NEW.id, auth.uid(), 'review_invalidated',
      jsonb_build_object('finance_review','reviewed','reviewed_by',OLD.reviewed_by,'reviewed_at',OLD.reviewed_at,
                         'invoice_document_ids',to_jsonb(OLD.invoice_document_ids),'photo_document_ids',to_jsonb(OLD.photo_document_ids)),
      jsonb_build_object('finance_review','reopened','invoice_document_ids',to_jsonb(NEW.invoice_document_ids),'photo_document_ids',to_jsonb(NEW.photo_document_ids)),
      coalesce(nullif(current_setting('resolve.evidence_reason', true),''), 'Required evidence changed'));
    PERFORM set_config('resolve.evidence_reason', '', true);
    NEW.finance_review := 'reopened'; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS expenses_zz_evidence_reopen ON public.expenses;
CREATE TRIGGER expenses_zz_evidence_reopen BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION private.expense_evidence_reopen();

-- Archiving / failing a designated file removes it from the expense through the audited path.
CREATE OR REPLACE FUNCTION private.expense_designated_doc_retired()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF (NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL)
     OR (coalesce(NEW.upload_status,'stored') <> 'stored' AND coalesce(OLD.upload_status,'stored') = 'stored') THEN
    UPDATE public.expenses SET
      invoice_document_ids = array_remove(invoice_document_ids, NEW.id),
      photo_document_ids = array_remove(photo_document_ids, NEW.id),
      change_reason = 'Designated evidence file removed: ' || coalesce(NEW.title, NEW.id::text)
    WHERE NEW.id = ANY(invoice_document_ids) OR NEW.id = ANY(photo_document_ids);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS expense_designated_doc_retired ON public.documents;
CREATE TRIGGER expense_designated_doc_retired AFTER UPDATE OF archived_at, upload_status ON public.documents
  FOR EACH ROW EXECUTE FUNCTION private.expense_designated_doc_retired();