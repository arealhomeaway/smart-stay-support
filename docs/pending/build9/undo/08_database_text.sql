-- Undo Build 9 G2: the exact live functions read on Nov 10.

CREATE OR REPLACE FUNCTION public.request_claim_waiver(_claim_id uuid, _reason text, _context text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _id uuid; _c claims; _r record;
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'A waiver request needs a reason'; END IF;
  SELECT * INTO _c FROM claims WHERE id = _claim_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found'; END IF;
  SELECT id INTO _id FROM claim_waivers WHERE claim_id=_claim_id AND status='pending';
  IF _id IS NOT NULL THEN RETURN _id; END IF; -- retry-safe, no second alert
  SELECT * INTO _r FROM private.route_claim_waiver(_c, auth.uid());
  INSERT INTO claim_waivers(claim_id, requested_by, reason, context, is_demo, routed_to, routing_basis, routing_note)
  VALUES (_claim_id, auth.uid(), _reason, _context, _c.is_demo, _r.routed_to, _r.basis, _r.note) RETURNING id INTO _id;
  INSERT INTO claim_activity(claim_id, author_id, event_type, body, is_demo)
  VALUES (_claim_id, auth.uid(), CASE WHEN _r.routed_to IS NULL THEN 'waiver_routing_exception' ELSE 'waiver_requested' END,
          _reason || ' — ' || _r.note, _c.is_demo);
  IF _r.routed_to IS NOT NULL THEN
    PERFORM public.notify_staff_isolated(_r.routed_to, 'claim_waiver', 'Waiver requested: ' || coalesce(_c.title,'claim'),
      _reason, 'claim', _claim_id, coalesce(private.ticket_link_for('ticket', _c.ticket_id), '/claims?claim=' || _claim_id), 'normal', auth.uid(), false, _c.is_demo);
  END IF;
  RETURN _id;
END $function$;

CREATE OR REPLACE FUNCTION private.route_claim_waiver(_claim claims, _requester uuid, OUT routed_to uuid, OUT basis text, OUT note text)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _cand uuid;
BEGIN
  -- No property-to-Pod-supervisor assignment exists yet; fall through to the seat.
  _cand := CASE WHEN _claim.is_demo THEN private.demo_seat_standin('ops_supervisor')
                ELSE public.seat_holder_at('ops_supervisor') END;
  IF _cand IS NOT NULL AND NOT (private.is_supervisor(_cand) OR private.is_director(_cand)) THEN
    _cand := NULL;
  END IF;
  IF _cand IS NOT NULL AND _cand <> _requester THEN
    routed_to := _cand; basis := 'ops_supervisor_seat';
    note := 'No Pod supervisor is assigned to this home; routed to the Operations Supervisor seat.';
    RETURN;
  END IF;
  IF _cand = _requester THEN
    _cand := CASE WHEN _claim.is_demo THEN private.demo_seat_standin('director_ops')
                  ELSE public.seat_holder_at('director_ops') END;
    IF _cand IS NOT NULL AND _cand <> _requester THEN
      routed_to := _cand; basis := 'director_conflict';
      note := 'The requester holds the supervisor seat; routed to the Director of Operations.';
      RETURN;
    END IF;
  END IF;
  routed_to := NULL; basis := 'exception';
  note := 'No eligible supervisor could be found — leadership must route this waiver.';
END $function$;

CREATE OR REPLACE FUNCTION public.decide_claim_waiver(_waiver_id uuid, _approve boolean, _notes text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _w claim_waivers; _c claims; _who uuid;
BEGIN
  IF coalesce(btrim(_notes),'') = '' THEN RAISE EXCEPTION 'Decision notes are required'; END IF;
  SELECT * INTO _w FROM claim_waivers WHERE id = _waiver_id FOR UPDATE;
  IF NOT FOUND OR _w.status <> 'pending' THEN RAISE EXCEPTION 'Waiver is not pending'; END IF;
  IF _w.requested_by = auth.uid() THEN RAISE EXCEPTION 'You cannot decide your own waiver request'; END IF;
  IF NOT (auth.uid() = _w.routed_to OR private.is_director(auth.uid())) THEN
    RAISE EXCEPTION 'Only the supervisor this waiver was routed to, or the Director of Operations, can decide it';
  END IF;
  UPDATE claim_waivers SET status = CASE WHEN _approve THEN 'approved' ELSE 'denied' END,
    decided_by = auth.uid(), decision_notes = _notes, decided_at = now() WHERE id = _waiver_id;
  SELECT * INTO _c FROM claims WHERE id = _w.claim_id;
  IF _approve THEN
    UPDATE claims SET finance_decision_pending = 'Waiver approved — Finance treatment pending' WHERE id = _c.id;
  END IF;
  INSERT INTO claim_activity(claim_id, author_id, event_type, body, is_demo)
  VALUES (_c.id, auth.uid(), CASE WHEN _approve THEN 'waiver_approved' ELSE 'waiver_denied' END,
    _notes || CASE WHEN _approve THEN ' — Waiver approved — Finance treatment pending' ELSE '' END, _c.is_demo);
  FOR _who IN SELECT DISTINCT x FROM unnest(ARRAY[_w.requested_by, _c.assigned_to]) x WHERE x IS NOT NULL AND x <> auth.uid() LOOP
    PERFORM public.notify_staff_isolated(_who, 'claim_waiver_decision',
      'Waiver ' || CASE WHEN _approve THEN 'approved' ELSE 'denied' END || ': ' || coalesce(_c.title,'claim'),
      _notes, 'claim', _c.id, coalesce(private.ticket_link_for('ticket', _c.ticket_id), '/claims?claim=' || _c.id), 'normal', auth.uid(), false, _c.is_demo);
  END LOOP;
END $function$;

CREATE OR REPLACE FUNCTION public.record_claim_finance_treatment(_claim_id uuid, _treatment text, _note text, _needs_leadership boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _c claims;
BEGIN
  IF NOT (private.is_finance_lead(auth.uid()) OR private.is_accounting(auth.uid())) THEN
    RAISE EXCEPTION 'Only Finance can record the treatment of an unrecovered amount';
  END IF;
  IF coalesce(btrim(_treatment),'') = '' OR coalesce(btrim(_note),'') = '' THEN
    RAISE EXCEPTION 'Record the treatment and the reasoning';
  END IF;
  SELECT * INTO _c FROM claims WHERE id = _claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found'; END IF;
  PERFORM set_config('resolve.claim_finance','on',true);
  UPDATE claims SET finance_treatment = btrim(_treatment), finance_treatment_note = btrim(_note),
    finance_treated_by = auth.uid(), finance_treated_at = now(),
    leadership_decision_required = coalesce(_needs_leadership,false),
    leadership_decision = NULL, leadership_decided_by = NULL, leadership_decided_at = NULL,
    finance_decision_pending = CASE WHEN coalesce(_needs_leadership,false) THEN 'Leadership decision pending' END
  WHERE id = _claim_id;
  PERFORM set_config('resolve.claim_finance','off',true);
  INSERT INTO claim_activity(claim_id, author_id, event_type, body, is_demo)
  VALUES (_claim_id, auth.uid(), 'finance_treatment', 'Finance treatment: ' || btrim(_treatment) || ' — ' || btrim(_note)
    || CASE WHEN _needs_leadership THEN ' (leadership decision required)' ELSE '' END, _c.is_demo);
END $function$;

CREATE OR REPLACE FUNCTION public.record_statement_disposition(_expense uuid, _period date, _disposition text, _owner_description text DEFAULT NULL::text, _internal_note text DEFAULT NULL::text, _defer_to date DEFAULT NULL::date, _exclusion_treatment text DEFAULT NULL::text, _recovery_treatment text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
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
END $function$;

CREATE OR REPLACE FUNCTION private.statement_include_authorization_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE e public.expenses; a jsonb;
BEGIN
  IF NEW.disposition = 'include' THEN
    SELECT * INTO e FROM public.expenses WHERE id = NEW.expense_id;
    a := private.expense_authorization_detail(e);
    IF NOT (a->>'ok')::boolean THEN RAISE EXCEPTION 'Authorization is missing — %', a->>'reason'; END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.expense_review_readiness_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
DECLARE a jsonb;
BEGIN
  IF NEW.finance_review = 'reviewed' AND OLD.finance_review IS DISTINCT FROM 'reviewed' THEN
    IF NEW.is_estimate THEN RAISE EXCEPTION 'This is an estimate — convert it to the actual invoice (or archive it as replaced) before Finance review'; END IF;
    IF NEW.duplicate_flag = 'suspected' THEN RAISE EXCEPTION 'Resolve the suspected duplicate first — mark it "Not a duplicate" or archive the duplicate entry'; END IF;
    IF private.expense_evidence_changed(OLD, NEW) THEN RAISE EXCEPTION 'Save evidence changes before completing Finance review'; END IF;
    IF NOT private.expense_documentation_ok(NEW) THEN
      RAISE EXCEPTION 'Documentation is incomplete — a stored invoice or itemized receipt (and any required facts and photos) must be on record before Finance review';
    END IF;
    a := private.expense_authorization_detail(NEW);
    IF NOT (a->>'ok')::boolean THEN RAISE EXCEPTION 'Authorization is missing — %', a->>'reason'; END IF;
    IF auth.uid() IS NOT NULL AND (a->>'decided_by')::uuid = auth.uid() THEN
      RAISE EXCEPTION 'You approved this spending, so a different Finance reviewer must complete its Finance review';
    END IF;
  ELSIF OLD.finance_review = 'reviewed' AND NEW.finance_review = 'reviewed' AND private.expense_evidence_changed(OLD, NEW) THEN
    IF coalesce(btrim(NEW.change_reason),'') = '' THEN
      RAISE EXCEPTION 'This expense was reviewed by Finance. Give a reason for changing its required evidence';
    END IF;
    PERFORM set_config('resolve.evidence_reason', btrim(NEW.change_reason), true);
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION private.expense_authorization_detail(e expenses)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE wo public.work_orders; ap public.approvals; pol jsonb; rec jsonb; sup numeric; own numeric; who text;
  incl boolean; also_sup boolean; owner_ok boolean := false; sup_ok boolean := false;
BEGIN
  IF e.expense_type IS DISTINCT FROM 'vendor_service' OR e.amount IS NULL THEN
    RETURN jsonb_build_object('required',false,'ok',true,'reason','Not required by the Maintenance Authority Policy.');
  END IF;
  SELECT value INTO pol FROM public.app_settings WHERE key = 'maintenance_authority_policy';
  SELECT w.* INTO wo FROM public.expense_links l JOIN public.work_orders w ON w.id = l.target_id
   WHERE l.expense_id = e.id AND l.link_type = 'work_order' ORDER BY l.created_at LIMIT 1;
  -- The linked Work Order keeps the policy version it was decided under.
  rec := pol;
  IF wo.id IS NOT NULL AND pol IS NOT NULL AND wo.policy_version IS DISTINCT FROM pol->>'version'
     AND jsonb_typeof(pol->'previousVersions') = 'array' THEN
    SELECT p INTO rec FROM jsonb_array_elements(pol->'previousVersions') p
     WHERE p->>'version' = wo.policy_version LIMIT 1;
    IF rec IS NULL THEN rec := pol; END IF;
  END IF;
  sup := (rec->>'supervisorApprovalThreshold')::numeric; own := (rec->>'ownerApprovalThreshold')::numeric;
  IF sup IS NULL OR own IS NULL THEN
    RETURN jsonb_build_object('required',true,'ok',false,'who','owner','reason','The Maintenance Authority Policy is not configured, so authorization cannot be confirmed.');
  END IF;
  incl := coalesce(rec->'ownerThresholdInclusive' = 'true'::jsonb, false);
  also_sup := coalesce(rec->'supervisorAlsoApprovesOwnerTier' = 'true'::jsonb, false);
  IF wo.id IS NOT NULL AND wo.phase = 'mitigation' AND wo.emergency_reason IS NOT NULL THEN
    RETURN jsonb_build_object('required',false,'ok',true,'reason','Emergency mitigation exception recorded on the linked Work Order.');
  END IF;
  IF (CASE WHEN incl THEN e.amount >= own ELSE e.amount > own END) AND NOT coalesce(wo.contractual_exception,false) THEN who := 'owner';
  ELSIF e.amount >= sup THEN who := 'supervisor';
  ELSE RETURN jsonb_build_object('required',false,'ok',true,'reason',
    CASE WHEN incl THEN 'Under $' || sup::text || ': it proceeds and the cost is recorded.'
      ELSE 'Below the supervisor approval threshold — no approval required.' END);
  END IF;
  IF wo.id IS NOT NULL THEN
    IF coalesce(wo.authorization_stale,false) THEN
      RETURN jsonb_build_object('required',true,'ok',false,'who',who,'reason','The Work Order approval no longer covers its vendor, scope or amount — it must be re-approved.');
    END IF;
    IF who = 'owner' AND wo.approval_status = 'approved' THEN
      SELECT * INTO ap FROM public.approvals a WHERE a.id = wo.approval_id AND a.status = 'approved'
        AND a.approver_role = 'owner' AND a.decided_at IS NOT NULL AND a.entity_type = 'work_order' AND a.entity_id = wo.id;
      IF ap.id IS NOT NULL AND coalesce(ap.amount,0) >= e.amount AND coalesce(wo.authorized_amount,0) >= e.amount THEN
        owner_ok := true;
      END IF;
    END IF;
    IF wo.supervisor_approval_status = 'approved'
      AND private.can_approve_spending(wo.supervisor_approval_decided_by)
      AND coalesce(wo.authorized_amount,0) >= e.amount THEN
      sup_ok := true;
    END IF;
    IF who = 'owner' AND owner_ok AND (NOT also_sup OR sup_ok) THEN
      RETURN jsonb_build_object('required',true,'ok',true,'who',who,'reason',
        CASE WHEN also_sup THEN 'Operations Supervisor and owner approvals recorded on the linked Work Order cover this amount.'
          ELSE 'Owner approval recorded on the linked Work Order covers this amount.' END);
    ELSIF who = 'supervisor' AND sup_ok THEN
      RETURN jsonb_build_object('required',true,'ok',true,'who',who,'reason','Supervisor approval recorded on the linked Work Order covers this amount.','decided_by',wo.supervisor_approval_decided_by);
    END IF;
  END IF;
  IF e.approval_id IS NOT NULL THEN
    SELECT * INTO ap FROM public.approvals a WHERE a.id = e.approval_id AND a.status = 'approved' AND a.decided_at IS NOT NULL
      AND coalesce(a.amount,0) >= e.amount
      AND ((a.entity_type = 'expense' AND a.entity_id = e.id) OR (wo.id IS NOT NULL AND a.entity_type = 'work_order' AND a.entity_id = wo.id));
    IF ap.id IS NOT NULL AND who = 'owner' AND ap.approver_role = 'owner' THEN
      owner_ok := true;
    END IF;
    IF ap.id IS NOT NULL AND ((who = 'owner' AND ap.approver_role = 'owner' AND (NOT also_sup OR sup_ok))
      OR (who = 'supervisor' AND private.can_approve_spending(ap.approver_id))) THEN
      RETURN jsonb_build_object('required',true,'ok',true,'who',who,'reason','A linked approval by an authorized decision-maker covers this amount.','decided_by',CASE WHEN who='supervisor' THEN ap.approver_id END);
    END IF;
  END IF;
  RETURN jsonb_build_object('required',true,'ok',false,'who',who,
    'reason', CASE
      WHEN who = 'owner' AND also_sup AND owner_ok
      THEN 'Approval by the Operations Supervisor or Director of Operations, covering this amount, is not recorded on the linked Work Order. A written note does not count.'
      WHEN who = 'owner' AND also_sup
      THEN 'The Operations Supervisor and the owner must both approve this amount on the linked Work Order before work starts. A written note does not count.'
      WHEN who = 'owner'
      THEN 'Owner approval covering this amount is not recorded on the linked Work Order. A written note does not count.'
      ELSE 'Approval by the Operations Supervisor or Director of Operations, covering this amount, is not recorded on the linked Work Order. A written note does not count.' END);
END $function$;

CREATE OR REPLACE FUNCTION public.wo_candidate_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$;

CREATE OR REPLACE FUNCTION public.decide_onboarding_financial_request(_request_id uuid, _approved boolean, _note text, _approved_amount numeric DEFAULT NULL::numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE request financial_requests%ROWTYPE; approval approvals%ROWTYPE; home properties%ROWTYPE; amount numeric; source_property uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT private.onboarding_assignment_staff(auth.uid()) THEN RAISE EXCEPTION 'Only enabled Onboarding staff can record this decision.'; END IF;
 IF _approved IS NULL OR length(trim(coalesce(_note,'')))<3 THEN RAISE EXCEPTION 'Record who decided and the evidence for their answer.'; END IF;
 SELECT property_id INTO source_property FROM financial_requests WHERE id=_request_id;
 SELECT * INTO home FROM properties WHERE id=source_property AND archived_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'That request property is not available.'; END IF;
 SELECT * INTO request FROM financial_requests WHERE id=_request_id AND property_id=home.id FOR UPDATE;
 IF NOT FOUND OR request.is_demo IS DISTINCT FROM home.is_demo THEN RAISE EXCEPTION 'That request is not available.'; END IF;
 IF NOT private.can_record_onboarding_financial_decision(auth.uid(),home.id,request.authority_tier) THEN RAISE EXCEPTION 'You do not hold the responsibility required for this financial decision.'; END IF;
 IF request.status IS DISTINCT FROM 'awaiting_approval' OR request.approval_id IS NULL OR request.approved_amount IS NOT NULL OR request.approved_at IS NOT NULL THEN RAISE EXCEPTION 'Prepare a canonical pending approval before recording its decision.'; END IF;
 SELECT * INTO approval FROM approvals WHERE id=request.approval_id FOR UPDATE;
 IF NOT FOUND OR approval.status IS DISTINCT FROM 'pending' OR approval.entity_type IS DISTINCT FROM 'financial_request' OR approval.entity_id IS DISTINCT FROM request.id OR approval.property_id IS DISTINCT FROM home.id OR approval.approver_role IS DISTINCT FROM request.authority_tier OR approval.is_demo IS DISTINCT FROM request.is_demo OR approval.amount IS DISTINCT FROM request.estimate_amount THEN RAISE EXCEPTION 'The canonical approval changed. Refresh before recording its decision.'; END IF;
 IF request.authority_tier='owner' AND NOT (
  (approval.approver_id IS NOT NULL AND private.owner_current_property_for_actor(approval.approver_id,home.id,NULL)) OR
  (approval.owner_email_sent_at IS NOT NULL AND length(trim(coalesce(approval.owner_email_to,'')))>0 AND EXISTS(
   SELECT 1 FROM property_owners o WHERE o.id=home.owner_record_id AND o.active AND lower(trim(o.email))=lower(trim(approval.owner_email_to))))) THEN
  RAISE EXCEPTION 'This approval needs a current canonical owner recipient or a recorded delivery to that owner before staff can transcribe the answer.';
 END IF;
 amount:=CASE WHEN _approved THEN coalesce(_approved_amount,request.estimate_amount) ELSE NULL END;
 IF _approved AND (amount IS NULL OR amount<0 OR amount>approval.amount OR amount>1000000 OR amount::text IN('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Enter a valid approved amount.'; END IF;
 UPDATE approvals SET status=CASE WHEN _approved THEN 'approved' ELSE 'declined' END,decision_note=trim(_note),decided_at=now() WHERE id=approval.id;
 UPDATE financial_requests SET status=CASE WHEN _approved THEN 'approved' ELSE 'declined' END,approved_amount=amount,approved_at=CASE WHEN _approved THEN now() ELSE NULL END,updated_at=now() WHERE id=request.id;
 IF request.project_id IS NOT NULL THEN
  INSERT INTO onboarding_project_events(project_id,property_id,kind,summary,detail,prior_value,new_value,actor,is_demo)
  VALUES(request.project_id,request.property_id,'financial_decision',request.title||' — '||CASE WHEN _approved THEN 'approved' ELSE 'declined' END,trim(_note),request.approved_amount::text,amount::text,auth.uid(),request.is_demo);
 END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.review_onboarding_handoff(_handoff_id uuid, _expected_step text, _decision text, _note text DEFAULT ''::text, _exception text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE handoff public.property_handoffs%ROWTYPE; step_after text; status_after text; home_id uuid; snapshot jsonb; expected_snapshot jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to record a handoff review.'; END IF;
  SELECT property_id INTO home_id FROM property_handoffs WHERE id=_handoff_id AND archived_at IS NULL;
  IF home_id IS NULL THEN RAISE EXCEPTION 'That handoff is not available.'; END IF;
  IF NOT private.onboarding_gate_reviewer(auth.uid(),_expected_step) THEN RAISE EXCEPTION 'You do not have responsibility for this review gate.'; END IF;
  PERFORM private.lock_onboarding_readiness(home_id);
  SELECT * INTO handoff FROM public.property_handoffs WHERE id = _handoff_id AND property_id=home_id AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That handoff is not available.'; END IF;
  IF handoff.status NOT IN ('requested','accepted_pending_live') THEN RAISE EXCEPTION 'This handoff was already closed.'; END IF;
  IF handoff.gate_step <> _expected_step THEN RAISE EXCEPTION 'The handoff advanced. Refresh before reviewing the next gate.'; END IF;
  IF NOT private.onboarding_gate_reviewer(auth.uid(),handoff.gate_step) THEN RAISE EXCEPTION 'Review responsibility changed. Refresh before deciding.'; END IF;

  -- Separation of duties.
  IF auth.uid() = handoff.requested_by THEN
    RAISE EXCEPTION 'The project manager who submitted this handoff cannot approve it.';
  END IF;
  IF EXISTS(SELECT 1 FROM onboarding_projects WHERE property_id=home_id AND status<>'cancelled' AND project_manager=auth.uid()) THEN
    RAISE EXCEPTION 'The project manager for this home cannot approve its own handoff.';
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.handoff_reviews r
    WHERE r.handoff_id = handoff.id AND r.decision='accepted' AND r.reviewer_id = auth.uid()
      AND r.step <> handoff.gate_step
      AND NOT (r.step IN ('operations_acceptance','live_confirmation') AND handoff.gate_step IN ('operations_acceptance','live_confirmation'))
  ) THEN
    RAISE EXCEPTION 'Each handoff review role signs for itself — you already passed an earlier gate on this handoff.';
  END IF;

  IF handoff.is_demo IS DISTINCT FROM (SELECT is_demo FROM properties WHERE id=home_id) THEN RAISE EXCEPTION 'Handoff property context changed.'; END IF;
  IF _decision IS NULL OR _decision NOT IN ('accepted','returned') THEN RAISE EXCEPTION 'Invalid review decision.'; END IF;
  IF _decision = 'returned' AND length(trim(_note)) < 3 THEN RAISE EXCEPTION 'Record the corrections needed.'; END IF;
  IF _decision='accepted' THEN
    IF EXISTS(SELECT 1 FROM properties WHERE id=home_id AND lifecycle_status<>'handoff_requested') OR EXISTS(
     SELECT 1 FROM onboarding_projects WHERE property_id=home_id AND status<>'cancelled' AND status NOT IN('planning','active','handoff')) THEN RAISE EXCEPTION 'The lifecycle changed. Return the handoff for corrections.'; END IF;
    snapshot:=private.onboarding_handoff_snapshot(home_id);
    expected_snapshot:=CASE WHEN handoff.gate_step='live_confirmation' THEN handoff.validation->'acceptedReadinessSnapshot' ELSE handoff.validation->'readinessSnapshot' END;
    IF expected_snapshot IS NULL OR private.comparable_onboarding_snapshot(snapshot) IS DISTINCT FROM private.comparable_onboarding_snapshot(expected_snapshot) THEN RAISE EXCEPTION 'The submitted readiness record changed. Return the handoff for corrections.'; END IF;
  END IF;
  step_after := CASE handoff.gate_step WHEN 'kati_review' THEN 'micah_review'
    WHEN 'micah_review' THEN 'operations_acceptance' WHEN 'operations_acceptance' THEN 'live_confirmation'
    WHEN 'live_confirmation' THEN 'complete' ELSE NULL END;
  IF step_after IS NULL THEN RAISE EXCEPTION 'Invalid handoff gate.'; END IF;
  INSERT INTO public.handoff_reviews(handoff_id, property_id, step, decision, reviewer_id, note, exception_reason, is_demo)
    VALUES (handoff.id, handoff.property_id, handoff.gate_step, _decision, auth.uid(), nullif(_note,''), nullif(_exception,''), handoff.is_demo);
  IF _decision = 'returned' THEN
    UPDATE public.property_handoffs SET status = 'returned', reviewed_by = auth.uid(), reviewed_at = now(), corrections = _note WHERE id = handoff.id;
    UPDATE public.properties SET lifecycle_status = 'handoff_corrections', handoff_accepted_at = NULL WHERE id = handoff.property_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'The property correction state could not be recorded.'; END IF;
    RETURN jsonb_build_object('ok', true, 'step', handoff.gate_step, 'status', 'returned', 'propertyId', handoff.property_id);
  END IF;
  status_after := CASE handoff.gate_step WHEN 'operations_acceptance' THEN 'accepted_pending_live'
    WHEN 'live_confirmation' THEN 'accepted' ELSE 'requested' END;
  UPDATE public.property_handoffs SET gate_step = step_after, status = status_after,
    exceptions = CASE WHEN length(_exception) > 0 THEN coalesce(exceptions,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('step',handoff.gate_step,'reason',_exception,'by',auth.uid(),'at',now())) ELSE exceptions END,
    kati_reviewer = CASE WHEN handoff.gate_step = 'kati_review' THEN auth.uid() ELSE kati_reviewer END,
    kati_decision = CASE WHEN handoff.gate_step = 'kati_review' THEN 'approved' ELSE kati_decision END,
    kati_note = CASE WHEN handoff.gate_step = 'kati_review' THEN _note ELSE kati_note END,
    kati_at = CASE WHEN handoff.gate_step = 'kati_review' THEN now() ELSE kati_at END,
    micah_reviewer = CASE WHEN handoff.gate_step = 'micah_review' THEN auth.uid() ELSE micah_reviewer END,
    micah_decision = CASE WHEN handoff.gate_step = 'micah_review' THEN 'approved' ELSE micah_decision END,
    micah_note = CASE WHEN handoff.gate_step = 'micah_review' THEN _note ELSE micah_note END,
    micah_at = CASE WHEN handoff.gate_step = 'micah_review' THEN now() ELSE micah_at END,
    accepted_by = CASE WHEN handoff.gate_step = 'operations_acceptance' THEN auth.uid() ELSE accepted_by END,
    accepted_at = CASE WHEN handoff.gate_step = 'operations_acceptance' THEN now() ELSE accepted_at END,
    reviewed_by = auth.uid(), reviewed_at = now(),
    live_confirmed_by = CASE WHEN handoff.gate_step = 'live_confirmation' THEN auth.uid() ELSE live_confirmed_by END,
    live_confirmed_at = CASE WHEN handoff.gate_step = 'live_confirmation' THEN now() ELSE live_confirmed_at END
  WHERE id = handoff.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'The handoff decision could not be recorded.'; END IF;
  IF handoff.gate_step = 'operations_acceptance' THEN
    UPDATE public.properties SET onboarding_stage = 'pending_live_confirmation', handoff_accepted_at = now() WHERE id = handoff.property_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Operations acceptance could not be recorded.'; END IF;
    UPDATE public.onboarding_tasks SET status = 'carryover' WHERE property_id = handoff.property_id
      AND id = ANY(handoff.open_task_ids) AND status IN ('open','blocked');
    UPDATE property_handoffs SET validation=coalesce(validation,'{}'::jsonb)||jsonb_build_object('acceptedReadinessSnapshot',private.onboarding_handoff_snapshot(home_id)) WHERE id=handoff.id;
  END IF;
  IF handoff.gate_step = 'live_confirmation' THEN
    UPDATE public.properties SET lifecycle_status = 'active_operations', active = true WHERE id = handoff.property_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Live confirmation could not be recorded.'; END IF;
    UPDATE public.onboarding_projects SET status = 'complete', completed_at = now()
      WHERE property_id = handoff.property_id AND status <> 'cancelled';
  END IF;
  RETURN jsonb_build_object('ok', true, 'step', handoff.gate_step, 'status', status_after, 'propertyId', handoff.property_id);
END $function$;

CREATE OR REPLACE FUNCTION public.record_owner_financial_response(_approval_id uuid, _owner_id uuid, _approved boolean, _note text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE approval public.approvals%ROWTYPE; request public.financial_requests%ROWTYPE; decided timestamptz := now(); amount numeric;
BEGIN
 SELECT * INTO approval FROM public.approvals WHERE id=_approval_id;
 IF NOT FOUND OR approval.entity_type IS DISTINCT FROM 'financial_request' OR approval.approver_id IS DISTINCT FROM _owner_id OR _owner_id IS NULL THEN
  RAISE EXCEPTION 'That financial approval is not addressed to this owner.';
 END IF;
 SELECT * INTO request FROM public.financial_requests WHERE id=approval.entity_id AND property_id=approval.property_id FOR UPDATE;
 IF NOT FOUND OR request.status IS DISTINCT FROM 'awaiting_approval' OR request.approval_id IS DISTINCT FROM _approval_id OR request.approved_amount IS NOT NULL THEN
  RAISE EXCEPTION 'That financial request no longer accepts a response.';
 END IF;
 SELECT * INTO approval FROM public.approvals WHERE id=_approval_id FOR UPDATE;
 IF approval.is_demo IS DISTINCT FROM false OR request.is_demo IS DISTINCT FROM false OR approval.status IS DISTINCT FROM 'pending' OR approval.approver_id IS DISTINCT FROM _owner_id OR approval.approver_role IS DISTINCT FROM 'owner' OR approval.entity_type IS DISTINCT FROM 'financial_request' OR approval.entity_id IS DISTINCT FROM request.id OR approval.property_id IS DISTINCT FROM request.property_id THEN
  RAISE EXCEPTION 'The approval changed. Refresh before responding.';
 END IF;
 IF approval.amount IS DISTINCT FROM request.estimate_amount OR approval.amount IS NULL OR approval.amount < 0 OR approval.amount > 1000000 THEN
  RAISE EXCEPTION 'The requested amount changed. Ask the team to prepare a new approval.';
 END IF;
 IF NOT _approved AND length(trim(coalesce(_note,'')))=0 THEN RAISE EXCEPTION 'Explain what you would like changed.'; END IF;
 amount := CASE WHEN _approved THEN approval.amount ELSE NULL END;
 UPDATE public.approvals SET status=CASE WHEN _approved THEN 'approved' ELSE 'declined' END, decision_note=nullif(trim(_note),''),decided_at=decided WHERE id=_approval_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'The response could not be recorded.'; END IF;
 UPDATE public.financial_requests SET status=CASE WHEN _approved THEN 'approved' ELSE 'declined' END,
 approved_amount=amount, approved_at=CASE WHEN _approved THEN decided ELSE NULL END, updated_at=decided WHERE id=request.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'The financial response could not be recorded.'; END IF;
 IF request.project_id IS NOT NULL THEN
  INSERT INTO public.onboarding_project_events(project_id,property_id,kind,summary,detail,prior_value,new_value,actor,is_demo)
  VALUES(request.project_id,request.property_id,'financial_decision',request.title || ' — ' || CASE WHEN _approved THEN 'approved' ELSE 'declined' END,
   _note,request.approved_amount::text,amount::text,_owner_id,request.is_demo);
 END IF;
 RETURN decided;
END $function$;

CREATE OR REPLACE FUNCTION public.review_onboarding_fact(_proposal_id uuid, _accept boolean, _note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  proposal public.property_fact_proposals%ROWTYPE;
  property_record public.properties%ROWTYPE;
  asset_record public.property_assets%ROWTYPE;
  actual_value text;
  decision text;
  changed integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_onboarding_staff(auth.uid()) THEN
    RAISE EXCEPTION 'You do not have access to review onboarding facts.';
  END IF;
  SELECT * INTO proposal FROM public.property_fact_proposals
    WHERE id = _proposal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That proposed change is not available.'; END IF;
  IF proposal.status <> 'pending' THEN
    RAISE EXCEPTION 'That change has already been reviewed.';
  END IF;
  IF proposal.asset_id IS NOT NULL THEN
    IF proposal.field_key NOT IN ('name','kind','manufacturer','model','serial_number','location','warranty_notes') THEN
      RAISE EXCEPTION 'This asset field cannot be changed through onboarding fact review.';
    END IF;
    SELECT * INTO asset_record FROM public.property_assets WHERE id=proposal.asset_id AND property_id=proposal.property_id AND archived_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'That asset is not available for this property.'; END IF;
    actual_value := to_jsonb(asset_record)->>proposal.field_key;
    IF _accept AND actual_value IS DISTINCT FROM proposal.current_value THEN RAISE EXCEPTION 'The asset changed after this proposal. Submit a new proposal.'; END IF;
    IF _accept THEN
      EXECUTE format('UPDATE public.property_assets SET %I=$1,updated_at=now() WHERE id=$2 AND property_id=$3',proposal.field_key)
        USING proposal.proposed_value,proposal.asset_id,proposal.property_id;
      GET DIAGNOSTICS changed=ROW_COUNT;
      IF changed <> 1 THEN RAISE EXCEPTION 'The asset could not be updated.'; END IF;
      SELECT * INTO asset_record FROM public.property_assets WHERE id=proposal.asset_id;
      IF (to_jsonb(asset_record)->>proposal.field_key) IS DISTINCT FROM proposal.proposed_value THEN RAISE EXCEPTION 'The asset could not be updated.'; END IF;
    END IF;
  ELSE
  IF proposal.field_key NOT IN
    ('wifi_notes','access_notes','address_line1','city','state','postal_code','nickname') THEN
    RAISE EXCEPTION 'This field cannot be changed through onboarding fact review.';
  END IF;
  SELECT * INTO property_record FROM public.properties
    WHERE id = proposal.property_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That property is not available.'; END IF;
  actual_value := to_jsonb(property_record) ->> proposal.field_key;
  IF _accept AND actual_value IS DISTINCT FROM proposal.current_value THEN
    RAISE EXCEPTION 'The property changed after this proposal. Review the current value and submit a new proposal.';
  END IF;
  IF _accept THEN
    EXECUTE format('UPDATE public.properties SET %I = $1 WHERE id = $2', proposal.field_key)
      USING proposal.proposed_value, proposal.property_id;
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN RAISE EXCEPTION 'The property could not be updated.'; END IF;
    SELECT * INTO property_record FROM public.properties WHERE id = proposal.property_id;
    IF (to_jsonb(property_record) ->> proposal.field_key) IS DISTINCT FROM proposal.proposed_value THEN
      RAISE EXCEPTION 'The property could not be updated.';
    END IF;
  END IF;
  END IF;
  decision := CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END;
  UPDATE public.property_fact_proposals SET status = decision,
    reviewed_by = auth.uid(), reviewed_at = now(), decision_note = _note
    WHERE id = proposal.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'The review could not be recorded.'; END IF;
  IF proposal.project_id IS NOT NULL THEN
    INSERT INTO public.onboarding_project_events
      (project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
    VALUES
      (proposal.project_id, proposal.property_id, 'fact_' || decision,
       proposal.field_label || ' — ' || decision, _note, actual_value,
       CASE WHEN _accept THEN proposal.proposed_value ELSE actual_value END,
       auth.uid(), proposal.is_demo);
  END IF;
  RETURN jsonb_build_object('ok', true, 'status', decision);
END;
$function$;

CREATE OR REPLACE FUNCTION public.prepare_work_order_owner_approval(_work_order_id uuid, _expected_updated_at timestamp with time zone, _owner_summary text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE wo public.work_orders%ROWTYPE; home public.properties%ROWTYPE;
 owner public.property_owners%ROWTYPE;
 publication_context jsonb; request_id uuid; recipient uuid; summary text := trim(coalesce(_owner_summary,''));
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_internal_staff(auth.uid()) THEN
  RAISE EXCEPTION 'You do not have access to request this decision.';
 END IF;
 IF length(summary) NOT BETWEEN 20 AND 4000 THEN
  RAISE EXCEPTION 'Explain the repair and proposed work for the owner in 20–4,000 characters.';
 END IF;
 SELECT * INTO wo FROM public.work_orders WHERE id=_work_order_id FOR UPDATE;
 IF NOT FOUND OR wo.closed_at IS NOT NULL THEN RAISE EXCEPTION 'This Work Order is not available for an approval request.'; END IF;
 IF _expected_updated_at IS NULL OR wo.updated_at IS DISTINCT FROM _expected_updated_at THEN
  RAISE EXCEPTION 'The Work Order changed. Refresh before requesting approval.';
 END IF;
 IF wo.approval_id IS NOT NULL OR wo.approval_status='approved' OR EXISTS(
  SELECT 1 FROM public.approvals WHERE entity_type='work_order' AND entity_id=wo.id AND approver_role='owner' AND status='pending'
 ) THEN RAISE EXCEPTION 'An owner approval already exists. Review it before requesting another.'; END IF;
 IF wo.quote_amount IS NULL OR wo.quote_amount<0 OR wo.quote_amount::text IN ('NaN','Infinity','-Infinity') THEN
  RAISE EXCEPTION 'Record a valid quote before requesting approval.';
 END IF;
 SELECT * INTO home FROM public.properties WHERE id=wo.property_id FOR SHARE;
 IF NOT FOUND OR home.owner_record_id IS NULL OR home.is_demo IS DISTINCT FROM wo.is_demo THEN
  RAISE EXCEPTION 'The Work Order requires a current canonical Owner and Property.';
 END IF;
 SELECT * INTO owner FROM public.property_owners WHERE id=home.owner_record_id FOR SHARE;
 IF NOT FOUND OR NOT owner.active THEN RAISE EXCEPTION 'The canonical Owner is not active.'; END IF;
 IF wo.ticket_id IS NOT NULL THEN
  PERFORM id FROM public.tickets WHERE id=wo.ticket_id AND property_id=home.id AND is_demo=wo.is_demo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The Work Order Ticket no longer matches this Property.'; END IF;
 END IF;
 recipient:=private.work_order_owner_recipient(wo.id);
 INSERT INTO public.approvals(entity_type,entity_id,property_id,kind,title,detail,amount,
  requested_by,approver_role,approver_id,status,is_demo)
 VALUES('work_order',wo.id,home.id,'maintenance_owner_approval','Owner approval — property repair',summary,wo.quote_amount,
  auth.uid(),'owner',recipient,'pending',wo.is_demo) RETURNING id INTO request_id;
 UPDATE public.work_orders SET approval_id=request_id,approval_status='pending',
  approval_requested_at=now(),approval_requested_by=auth.uid() WHERE id=wo.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'The approval could not be linked to its Work Order.'; END IF;
 INSERT INTO public.work_order_events(work_order_id,author_id,event_type,body,detail,is_demo)
 VALUES(wo.id,auth.uid(),'owner_approval_requested','Owner approval requested',
  jsonb_build_object('approval_id',request_id,'work_order_id',wo.id,'ticket_id',wo.ticket_id,
   'property_id',home.id,'owner_record_id',owner.id,'quote_amount',wo.quote_amount,
   'policy_version',wo.policy_version,'work_order_snapshot',to_jsonb(wo)),wo.is_demo);
 -- This existing action already requires an explicit owner-safe summary. Publish
 -- it atomically only when a canonical, eligible portal recipient is available.
 publication_context:=public.read_owner_approval_publication_context(request_id);
 IF (publication_context->>'canPublish')::boolean THEN
  PERFORM public.publish_owner_approval(request_id,(publication_context->>'expectedUpdatedAt')::timestamptz,
   (publication_context->>'expectedRevision')::integer,(publication_context->>'ownerId')::uuid,
   (publication_context->>'programId')::uuid,(publication_context->>'recipientId')::uuid,
   'Owner approval — property repair',summary,true);
 END IF;
 RETURN request_id;
END $function$;

CREATE OR REPLACE FUNCTION private.assert_onboarding_independent_ready(_snapshot jsonb, _applicable uuid[], _carryover uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE row jsonb;
BEGIN
 IF _snapshot IS NULL THEN RAISE EXCEPTION 'Independent readiness is unavailable. Refresh before requesting handoff.'; END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(_snapshot->'financials') LOOP
  IF row->>'issue' IS NOT NULL AND (jsonb_array_length(row->'taskIds')=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(row->'taskIds') id WHERE id::uuid=ANY(_applicable))) THEN
   RAISE EXCEPTION 'Financial readiness blocked: % — %',row->>'title',row->>'issue';
  END IF;
 END LOOP;
 FOR row IN SELECT value FROM jsonb_array_elements(_snapshot->'fieldWork') LOOP
  IF row->>'issue' IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(row->'taskIds') id WHERE id::uuid=ANY(_applicable) AND NOT id::uuid=ANY(_carryover)) THEN
   RAISE EXCEPTION 'Field readiness blocked: % — %',row->>'title',row->>'issue';
  END IF;
 END LOOP;
END $function$;

CREATE OR REPLACE FUNCTION public.create_onboarding_financial_request(_actor_id uuid, _property_id uuid, _request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE home properties%ROWTYPE; project onboarding_projects%ROWTYPE; request financial_requests%ROWTYPE;
 policy jsonb:=_request->'authority_policy'; stored jsonb; estimate numeric; tier text; emergency boolean; task_id uuid;
BEGIN
 IF NOT private.onboarding_assignment_staff(_actor_id) THEN RAISE EXCEPTION 'Only enabled Onboarding staff can create a financial request.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('onboarding_authority_policy'));
 SELECT value INTO stored FROM app_settings WHERE key='onboarding_authority_policy' FOR SHARE;
 IF coalesce(stored,'null'::jsonb) IS DISTINCT FROM coalesce(_request->'expected_policy','null'::jsonb) THEN RAISE EXCEPTION 'The authority policy changed. Refresh before creating this cost request.'; END IF;
 IF policy IS NULL OR jsonb_typeof(policy)<>'object' OR length(trim(coalesce(policy->>'version','')))=0 OR jsonb_typeof(policy->'supervisorApprovalThreshold') IS DISTINCT FROM 'number' OR jsonb_typeof(policy->'ownerApprovalThreshold') IS DISTINCT FROM 'number'
 OR (policy->>'supervisorApprovalThreshold')::numeric<0 OR (policy->>'ownerApprovalThreshold')::numeric<(policy->>'supervisorApprovalThreshold')::numeric OR (policy->>'ownerApprovalThreshold')::numeric>1000000 THEN RAISE EXCEPTION 'The recorded authority policy is invalid.'; END IF;
 IF stored IS NOT NULL AND policy IS DISTINCT FROM jsonb_build_object('version',trim(stored->>'version'),'supervisorApprovalThreshold',(stored->>'supervisorApprovalThreshold')::numeric,'ownerApprovalThreshold',(stored->>'ownerApprovalThreshold')::numeric) THEN RAISE EXCEPTION 'The authority policy snapshot does not match its source.'; END IF;
 -- A missing setting uses the baseline resolved by the trusted server, never an
 -- unprivileged caller. The locked absence check prevents a policy-creation race.
 estimate:=(_request->>'estimate_amount')::numeric; emergency:=coalesce((_request->>'emergency')::boolean,false);
 IF estimate IS NULL OR estimate<0 OR estimate>1000000 OR estimate::text IN('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Enter a valid estimate.'; END IF;
 IF emergency AND length(trim(coalesce(_request->>'emergency_reason','')))=0 THEN RAISE EXCEPTION 'Record the emergency authority reason.'; END IF;
 tier:=CASE WHEN emergency THEN 'emergency' WHEN estimate<(policy->>'supervisorApprovalThreshold')::numeric THEN 'proceed' WHEN estimate<=(policy->>'ownerApprovalThreshold')::numeric THEN 'supervisor' ELSE 'owner' END;
 SELECT * INTO project FROM onboarding_projects WHERE property_id=_property_id AND status<>'cancelled' FOR SHARE;
 SELECT * INTO home FROM properties WHERE id=_property_id AND archived_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'That property is not available.'; END IF;
 IF project.id IS NOT NULL AND project.is_demo IS DISTINCT FROM home.is_demo THEN RAISE EXCEPTION 'The project property context changed.'; END IF;
 task_id:=nullif(_request->>'task_id','')::uuid;
 IF task_id IS NOT NULL THEN
  PERFORM id FROM onboarding_tasks WHERE id=task_id AND property_id=_property_id AND archived_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That task is not available for this property.'; END IF;
 END IF;
 IF length(trim(coalesce(_request->>'title','')))<3 THEN RAISE EXCEPTION 'Enter a cost request title.'; END IF;
 INSERT INTO financial_requests(property_id,project_id,task_id,kind,title,vendor,description,estimate_amount,authority_tier,authority_policy,emergency,emergency_reason,status,created_by,is_demo)
 VALUES(home.id,project.id,task_id,coalesce(nullif(_request->>'kind',''),'other'),trim(_request->>'title'),nullif(_request->>'vendor',''),nullif(_request->>'description',''),estimate,tier,policy,emergency,nullif(_request->>'emergency_reason',''),'estimate',_actor_id,home.is_demo) RETURNING * INTO request;
 IF project.id IS NOT NULL THEN
  INSERT INTO onboarding_project_events(project_id,property_id,kind,summary,detail,new_value,actor,is_demo)
  VALUES(project.id,home.id,'financial_request_created',request.title||' — estimate recorded',tier,jsonb_build_object('requestId',request.id,'estimate',estimate,'authorityPolicy',policy)::text,_actor_id,home.is_demo);
 END IF;
 RETURN to_jsonb(request);
END $function$;

CREATE OR REPLACE FUNCTION private.cleaner_recompute_core(_task bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  s record; a record; acct record; cur record; person_ids bigint[] := '{}';
  secs int; invalid boolean; short boolean; long boolean; finished boolean;
  comp_date date; n_ind int; n_comp int; key text;
  d_method text; d_minutes numeric; d_counted boolean; d_state text; d_conf text; d_worker uuid;
  inserted int := 0; unchanged int := 0; voided int := 0;
BEGIN
  SELECT * INTO s FROM cleaner_task_snapshots WHERE breezeway_task_id=_task ORDER BY source_updated_at DESC NULLS LAST, synced_at DESC, id DESC LIMIT 1;
  IF s IS NULL THEN RETURN jsonb_build_object('skipped','no snapshot'); END IF;

  finished := coalesce(s.department,'') = 'housekeeping' AND coalesce(s.status_stage,'') = 'finished' AND s.finished_at IS NOT NULL;
  secs := s.elapsed_seconds;
  invalid := secs IS NULL OR secs <= 0;
  short := NOT invalid AND secs < 600;
  long := NOT invalid AND secs > 28800;
  comp_date := (s.finished_at AT TIME ZONE 'America/Chicago')::date;

  -- Register every assignee account seen on the Task (identity by Breezeway ID, never by name).
  FOR a IN SELECT DISTINCT ON ((x->>'assignee_id')::bigint) (x->>'assignee_id')::bigint AS pid, nullif(btrim(x->>'name'),'') AS nm
             FROM jsonb_array_elements(s.assignees) x WHERE (x->>'assignee_id') ~ '^\d+$' LOOP
    INSERT INTO cleaner_breezeway_accounts(breezeway_person_id, last_seen_name, first_seen_at, last_seen_at)
    VALUES (a.pid, a.nm, now(), now())
    ON CONFLICT (breezeway_person_id) DO UPDATE SET last_seen_name = coalesce(EXCLUDED.last_seen_name, cleaner_breezeway_accounts.last_seen_name),
      last_seen_at = now(), updated_at = now();
    person_ids := person_ids || a.pid;
    PERFORM private.cleaner_person_reviews(a.pid, s.is_fixture);
  END LOOP;

  -- Unmatched property: keep the source, never guess a property, no exposure.
  IF s.property_id IS NULL THEN
    IF finished THEN
      PERFORM private.cleaner_open_review('unmatched_property', 'task:unmatched:'||_task, _task, NULL, s.breezeway_home_id, NULL,
        s.source_updated_at, jsonb_build_object('task', s.task_name, 'home_id', s.breezeway_home_id, 'completed', comp_date), s.is_fixture);
    END IF;
    FOR cur IN SELECT * FROM cleaner_exposure_ledger WHERE breezeway_task_id=_task AND superseded_at IS NULL AND attribution_method <> 'manual_correction' AND entry_key LIKE 'bz:%' LOOP
      UPDATE cleaner_exposure_ledger SET superseded_at=now(), superseded_reason='Breezeway home is no longer matched to a Resolve property' WHERE id=cur.id;
      voided := voided + 1;
    END LOOP;
    RETURN jsonb_build_object('unmatched', true, 'voided', voided);
  END IF;
  PERFORM private.cleaner_close_review('task:unmatched:'||_task, 'Property matched');

  IF NOT finished THEN
    FOR cur IN SELECT * FROM cleaner_exposure_ledger WHERE breezeway_task_id=_task AND superseded_at IS NULL AND entry_key LIKE 'bz:%' LOOP
      IF cur.attribution_method = 'manual_correction' THEN
        PERFORM private.cleaner_open_review('source_changed_after_correction', 'task:corr:'||_task||':'||coalesce(cur.breezeway_person_id::text,''),
          _task, cur.breezeway_person_id, s.breezeway_home_id, s.property_id, s.source_updated_at,
          jsonb_build_object('change','Task is no longer finished in Breezeway','status', s.status_code), s.is_fixture);
      ELSE
        UPDATE cleaner_exposure_ledger SET superseded_at=now(), superseded_reason='Task is no longer finished in Breezeway ('||coalesce(s.status_code,'unknown')||')' WHERE id=cur.id;
        voided := voided + 1;
      END IF;
    END LOOP;
    PERFORM private.cleaner_close_review('task:dur:'||_task, 'Task not finished');
    PERFORM private.cleaner_close_review('task:company:'||_task, 'Task not finished');
    RETURN jsonb_build_object('finished', false, 'voided', voided);
  END IF;

  SELECT count(*) FILTER (WHERE coalesce(c.classification,'unclassified') <> 'company'),
         count(*) FILTER (WHERE c.classification = 'company')
    INTO n_ind, n_comp
    FROM unnest(person_ids) p(pid) LEFT JOIN cleaner_breezeway_accounts c ON c.breezeway_person_id = p.pid;

  FOR acct IN SELECT c.* FROM unnest(person_ids) p(pid) JOIN cleaner_breezeway_accounts c ON c.breezeway_person_id=p.pid LOOP
    key := 'bz:'||_task||':'||acct.breezeway_person_id;
    d_worker := acct.worker_id;
    IF acct.classification = 'company' THEN
      IF n_ind > 0 THEN
        d_method := 'company_account_not_counted'; d_minutes := NULL; d_counted := false; d_state := 'not_counted'; d_conf := 'low';
      ELSE
        d_method := 'company_only_needs_review'; d_minutes := CASE WHEN invalid THEN NULL ELSE round(secs/60.0, 2) END;
        d_counted := NOT invalid; d_state := 'needs_review'; d_conf := 'low';
      END IF;
    ELSIF invalid OR short THEN
      -- Conservative provisional duration pending review (never zero).
      d_method := 'provisional_duration'; d_minutes := private.cleaner_standard_minutes(s.property_id); d_counted := true; d_state := 'needs_review'; d_conf := 'low';
    ELSIF long THEN
      -- Provisional cap: standard duration + 2.0 h, pending review.
      d_method := 'provisional_cap'; d_minutes := least(round(secs/60.0, 2), private.cleaner_standard_minutes(s.property_id) + 120); d_counted := true; d_state := 'needs_review'; d_conf := 'low';
    ELSE
      d_method := CASE WHEN n_ind = 1 THEN 'single_individual_assignee' ELSE 'multi_assignee_full_elapsed' END;
      d_minutes := round(secs/60.0, 2); d_counted := true;
      IF acct.classification IN ('individual','duplicate') AND NOT short AND NOT long THEN
        d_state := 'auto'; d_conf := CASE WHEN n_ind = 1 THEN 'high' ELSE 'medium' END;
      ELSE
        d_state := 'needs_review'; d_conf := 'low';
      END IF;
    END IF;

    SELECT * INTO cur FROM cleaner_exposure_ledger WHERE entry_key=key AND superseded_at IS NULL;
    IF cur.id IS NOT NULL AND cur.attribution_method = 'manual_correction' THEN
      IF cur.source_revision IS DISTINCT FROM s.source_updated_at
         AND (cur.raw_elapsed_seconds IS DISTINCT FROM secs OR cur.property_id IS DISTINCT FROM s.property_id OR cur.completion_date IS DISTINCT FROM comp_date) THEN
        PERFORM private.cleaner_open_review('source_changed_after_correction', 'task:corr:'||_task||':'||acct.breezeway_person_id,
          _task, acct.breezeway_person_id, s.breezeway_home_id, s.property_id, s.source_updated_at,
          jsonb_build_object('corrected_minutes', cur.attributed_minutes, 'new_elapsed_seconds', secs), s.is_fixture);
      END IF;
      unchanged := unchanged + 1;
      CONTINUE;
    END IF;
    IF cur.id IS NOT NULL
       AND cur.worker_id IS NOT DISTINCT FROM d_worker AND cur.property_id IS NOT DISTINCT FROM s.property_id
       AND cur.completion_date = comp_date AND cur.raw_elapsed_seconds IS NOT DISTINCT FROM secs
       AND cur.attributed_minutes IS NOT DISTINCT FROM d_minutes AND cur.attribution_method = d_method
       AND cur.review_state = d_state AND cur.counted = d_counted AND cur.confidence = d_conf
       AND cur.assignee_count IS NOT DISTINCT FROM cardinality(person_ids)
       AND cur.breezeway_person_name IS NOT DISTINCT FROM acct.last_seen_name THEN
      unchanged := unchanged + 1;
      CONTINUE;
    END IF;
    IF cur.id IS NOT NULL THEN
      UPDATE cleaner_exposure_ledger SET superseded_at=now(), superseded_reason='Recalculated from Breezeway revision '||coalesce(s.source_updated_at::text,'unknown') WHERE id=cur.id;
    END IF;
    INSERT INTO cleaner_exposure_ledger(entry_key, worker_id, breezeway_person_id, breezeway_person_name, property_id,
      completion_date, breezeway_task_id, assignee_count, raw_elapsed_seconds, attributed_minutes, attribution_method,
      counted, review_state, confidence, snapshot_id, source_revision, supersedes_id, is_fixture)
    VALUES (key, d_worker, acct.breezeway_person_id, acct.last_seen_name, s.property_id, comp_date, _task,
      cardinality(person_ids), secs, d_minutes, d_method, d_counted, d_state, d_conf, s.id, s.source_updated_at, cur.id, s.is_fixture);
    inserted := inserted + 1;
  END LOOP;

  -- Assignees removed in Breezeway.
  FOR cur IN SELECT * FROM cleaner_exposure_ledger WHERE breezeway_task_id=_task AND superseded_at IS NULL AND entry_key LIKE 'bz:%'
               AND NOT (breezeway_person_id = ANY(person_ids)) LOOP
    IF cur.attribution_method = 'manual_correction' THEN
      PERFORM private.cleaner_open_review('source_changed_after_correction', 'task:corr:'||_task||':'||cur.breezeway_person_id,
        _task, cur.breezeway_person_id, s.breezeway_home_id, s.property_id, s.source_updated_at,
        jsonb_build_object('change','Assignee removed in Breezeway'), s.is_fixture);
    ELSE
      UPDATE cleaner_exposure_ledger SET superseded_at=now(), superseded_reason='Assignee removed from the Task in Breezeway' WHERE id=cur.id;
      voided := voided + 1;
    END IF;
  END LOOP;

  -- Task-level review items.
  IF invalid OR short OR long THEN
    PERFORM private.cleaner_open_review(CASE WHEN invalid THEN 'zero_duration' WHEN short THEN 'short_duration' ELSE 'long_duration' END,
      'task:dur:'||_task, _task, NULL, s.breezeway_home_id, s.property_id, s.source_updated_at,
      jsonb_build_object('task', s.task_name, 'total_time', s.total_time, 'elapsed_seconds', secs, 'completed', comp_date), s.is_fixture);
  ELSE
    PERFORM private.cleaner_close_review('task:dur:'||_task, 'Elapsed time now within 10 minutes – 8 hours');
  END IF;
  IF n_comp > 0 AND n_ind = 0 THEN
    PERFORM private.cleaner_open_review('company_only', 'task:company:'||_task, _task, NULL, s.breezeway_home_id, s.property_id,
      s.source_updated_at, jsonb_build_object('task', s.task_name, 'completed', comp_date), s.is_fixture);
  ELSE
    PERFORM private.cleaner_close_review('task:company:'||_task, 'Individual cleaner now identified on the Task');
  END IF;

  RETURN jsonb_build_object('inserted', inserted, 'unchanged', unchanged, 'voided', voided);
END $function$;

CREATE OR REPLACE FUNCTION public.cleaner_safeguard_weekly_digest()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE homes int; warn int; restr int; hard int; ovr int; open_items int; body text; r uuid;
BEGIN
  SELECT count(*) INTO homes FROM cleaner_hours_properties WHERE active AND NOT is_fixture;
  IF homes = 0 THEN RETURN; END IF;
  SELECT count(*) FILTER (WHERE detail->>'state'='warning'), count(*) FILTER (WHERE detail->>'state'='restricted'), count(*) FILTER (WHERE detail->>'state'='hard_block')
    INTO warn, restr, hard FROM cleaner_review_items WHERE kind='threshold_reached' AND status='open' AND NOT is_fixture;
  SELECT count(*) INTO ovr FROM cleaner_safeguard_overrides WHERE NOT is_fixture AND created_at > now() - interval '7 days';
  SELECT count(*) INTO open_items FROM cleaner_review_items WHERE status='open' AND NOT is_fixture;
  body := homes||' enrolled STR home(s). Open states — Warning: '||warn||', Restricted: '||restr||', Hard Block: '||hard
    ||'. Overrides this week: '||ovr||'. Open Attention Queue items: '||open_items||'.';
  FOR r IN SELECT * FROM private.cleaner_leadership_ids() LOOP
    PERFORM public.notify_staff(r, 'cleaner_safeguard_digest', 'Weekly STR cleaner time digest', body, 'cleaner_safeguard', NULL, '/cleaner-hours', 'normal', NULL, false, false);
  END LOOP;
END $function$;

CREATE OR REPLACE FUNCTION public.vendor_transitional_sweep(_today date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record; _th text; _id uuid; _rcp uuid[]; _u uuid; _sent int := 0; _ended int := 0; _clear boolean;
BEGIN
  FOR r IN SELECT id, display_name, program_owner, transitional_deadline, is_demo FROM public.vendor_orgs
            WHERE transitional_review AND transitional_deadline IS NOT NULL LOOP
    _rcp := private.vendor_ops_leads(r.program_owner);
    IF r.transitional_deadline < _today THEN
      _clear := private.vendor_gates_clear(r.id);
      UPDATE public.vendor_orgs SET transitional_review = false, transitional_ended_at = now(),
        transitional_outcome = CASE WHEN _clear THEN 'qualification_complete' ELSE 'leadership_review' END
       WHERE id = r.id;
      _th := 'ended'; _ended := _ended + 1;
    ELSE
      _th := CASE r.transitional_deadline - _today WHEN 14 THEN '14_days' WHEN 7 THEN '7_days' WHEN 1 THEN '1_day' END;
      CONTINUE WHEN _th IS NULL;
    END IF;
    INSERT INTO public.vendor_transitional_reminders (org_id, threshold, deadline, recipients)
      VALUES (r.id, _th, r.transitional_deadline, _rcp) ON CONFLICT DO NOTHING RETURNING id INTO _id;
    CONTINUE WHEN _id IS NULL;
    _sent := _sent + 1;
    FOREACH _u IN ARRAY _rcp LOOP
      PERFORM public.notify_staff(_u, 'vendor_transitional_' || _th,
        CASE WHEN _th = 'ended' THEN r.display_name || ': Transitional Review ended'
             ELSE r.display_name || ': Transitional Review ends ' || to_char(r.transitional_deadline, 'FMMM/FMDD/YYYY') END,
        CASE WHEN _th = 'ended' AND _clear THEN 'All Must Pass checks are complete. Set the right Gold Standard status — nothing was changed automatically.'
             WHEN _th = 'ended' THEN 'Must Pass checks are still missing, so this vendor can no longer be chosen for new work. Leadership review needed.'
             ELSE 'Finish the missing Must Pass checks before the deadline, or the vendor can no longer be chosen for new work.' END,
        'vendor', r.id, '/vendors/' || r.id, CASE WHEN _th IN ('1_day','ended') THEN 'urgent' ELSE 'normal' END,
        NULL, false, r.is_demo);
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('reminders', _sent, 'ended', _ended);
END $function$;

CREATE OR REPLACE FUNCTION public.request_new_vendor(_ticket uuid, _market text, _category text, _note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _owner uuid; _owners uuid[]; _dir uuid[]; _id uuid; _u uuid; _demo boolean;
BEGIN
  IF _uid IS NULL OR NOT public.is_internal_staff(_uid) THEN RAISE EXCEPTION 'Not allowed.'; END IF;
  IF coalesce(trim(_market),'') = '' OR coalesce(trim(_category),'') = '' THEN
    RAISE EXCEPTION 'Choose the market and service needed.';
  END IF;
  SELECT coalesce(is_demo,false) INTO _demo FROM public.tickets WHERE id = _ticket;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found.'; END IF;

  SELECT id INTO _id FROM public.vendor_sourcing_requests
   WHERE ticket_id = _ticket AND market = _market AND service_category = _category AND state NOT IN ('ready','closed');
  IF _id IS NOT NULL THEN RETURN _id; END IF;

  -- The Program Owner for this market + service, when exactly one is configured; otherwise the Director.
  SELECT array_agg(DISTINCT v.program_owner) INTO _owners
    FROM public.vendor_market_coverage c JOIN public.vendor_orgs v ON v.id = c.org_id
   WHERE c.market = _market AND c.service_category = _category AND v.program_owner IS NOT NULL;
  _dir := private.vendor_ops_leads(NULL);
  _owner := CASE WHEN coalesce(array_length(_owners,1),0) = 1 THEN _owners[1] ELSE _dir[1] END;

  INSERT INTO public.vendor_sourcing_requests (ticket_id, market, service_category, owner_id, requested_by, note, is_demo)
  VALUES (_ticket, _market, _category, _owner, _uid, nullif(trim(_note),''), _demo) RETURNING id INTO _id;

  INSERT INTO public.ticket_activity (ticket_id, author_id, kind, body, event_type, is_demo)
  VALUES (_ticket, _uid, 'note', 'No eligible vendor found — requested a new ' || _category || ' vendor for ' || _market || '.', 'note', _demo);

  FOREACH _u IN ARRAY (SELECT array_agg(DISTINCT x) FROM unnest(_dir || _owner) x WHERE x IS NOT NULL) LOOP
    PERFORM public.notify_staff(_u, 'vendor_sourcing_request', 'New vendor needed: ' || _category || ' in ' || _market,
      'A coordinator could not find an eligible vendor on a Ticket.', 'vendor_sourcing', _id,
      '/vendors?tab=coverage', 'normal', _uid, false, _demo);
  END LOOP;
  RETURN _id;
END $function$;

CREATE OR REPLACE FUNCTION public.log_ticket_insurance_risk()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.insurance_risk IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.insurance_risk IS DISTINCT FROM OLD.insurance_risk) THEN
    INSERT INTO public.ticket_activity(ticket_id, author_id, kind, body, event_type, event_at, is_demo, internal)
    VALUES (NEW.id, auth.uid(), 'note',
      'Potential insurance-related event: ' || COALESCE(initcap(NEW.insurance_risk), 'cleared') ||
      CASE WHEN NEW.insurance_risk IN ('yes','unsure') THEN ' — flagged for supervisor visibility. No insurance action taken.' ELSE '' END,
      'insurance_risk', now(), COALESCE(NEW.is_demo,false), true);
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.create_departure_review_from_clean(_wo_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  wo record; prop record; res jsonb; live boolean; new_id uuid; dep date; m record;
BEGIN
  SELECT * INTO wo FROM breezeway_work_orders WHERE id = _wo_id;
  IF wo IS NULL OR wo.property_id IS NULL THEN RETURN NULL; END IF;
  IF wo.department IS DISTINCT FROM 'housekeeping' THEN RETURN NULL; END IF;
  IF lower(coalesce(wo.status,'')) NOT IN ('finished','approved','closed') THEN RETURN NULL; END IF;
  res := wo.reservation_snapshot;
  IF res IS NULL OR res = 'null'::jsonb THEN
    SELECT * INTO m FROM departure_clean_matches WHERE breezeway_work_order_id = wo.id AND state = 'matched';
    IF m IS NULL THEN RETURN NULL; END IF;
    res := coalesce(m.reservation, '{}'::jsonb) || jsonb_build_object('ownerrez_booking_id', m.ownerrez_booking_id, 'departure', m.checkout_date);
  END IF;
  IF (res->>'departure') IS NULL THEN RETURN NULL; END IF;
  dep := (res->>'departure')::date;
  IF dep > (now() AT TIME ZONE 'America/Chicago')::date THEN RETURN NULL; END IF;
  SELECT id, is_demo INTO prop FROM properties WHERE id = wo.property_id;
  SELECT coalesce((value->>'enabled')::boolean, false) INTO live FROM app_settings WHERE key = 'departure_review_live_homes';
  IF NOT coalesce(prop.is_demo, false) AND NOT coalesce(live, false) THEN RETURN NULL; END IF;
  -- One review per reservation even if several cleans exist.
  IF (res->>'ownerrez_booking_id') IS NOT NULL AND EXISTS (
    SELECT 1 FROM departure_reviews WHERE property_id = wo.property_id AND ownerrez_booking_id = res->>'ownerrez_booking_id'
  ) THEN RETURN NULL; END IF;

  INSERT INTO departure_reviews (property_id, breezeway_work_order_id, breezeway_task_id, event_key,
    guest_name, stay_arrival, stay_departure, ownerrez_booking_id, reservation_code, booking_source,
    deposit_payer, deposit_amount, clean_name, clean_completed_at, clean_completed_exact, cleaner_name, clean_photo_count, is_demo)
  VALUES (wo.property_id, wo.id, wo.breezeway_task_id,
    'clean:' || wo.breezeway_task_id || ':' || coalesce(res->>'ownerrez_booking_id', res->>'reservation_code', dep::text),
    res->>'guest_name', (res->>'arrival')::date, dep, res->>'ownerrez_booking_id', res->>'reservation_code', res->>'booking_source',
    res->>'deposit_payer', nullif(res->>'deposit_amount','')::numeric,
    wo.name, coalesce(wo.finished_at, wo.breezeway_updated_at), wo.finished_at IS NOT NULL,
    (SELECT string_agg(coalesce(a->>'name', trim(coalesce(a->>'first_name','') || ' ' || coalesce(a->>'last_name',''))), ', ')
       FROM jsonb_array_elements(CASE WHEN jsonb_typeof(wo.assignees)='array' THEN wo.assignees ELSE '[]'::jsonb END) a),
    wo.photo_count, coalesce(prop.is_demo, false))
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO new_id;

  IF new_id IS NOT NULL THEN
    INSERT INTO cleaning_reviews (departure_review_id, property_id, breezeway_task_id, ownerrez_booking_id, reservation_code, cleaner_name, is_demo)
    SELECT id, property_id, breezeway_task_id, ownerrez_booking_id, reservation_code, cleaner_name, is_demo FROM departure_reviews WHERE id = new_id;
    INSERT INTO departure_review_events (departure_review_id, property_id, event_type, summary)
    VALUES (new_id, wo.property_id, 'created', 'Departure Review created — departure clean completed in Breezeway');
  END IF;
  RETURN new_id;
END $function$;

CREATE OR REPLACE FUNCTION public.expense_purchase_auth_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.expense_type = 'purchase' AND NEW.purchase_auth_status IN ('missing','uncertain')
     AND NEW.cost_responsibility IN ('owner','split') AND NEW.leadership_decision IS NULL THEN
    RAISE EXCEPTION 'Purchase authorization is missing or uncertain — record a leadership decision before allocating to the owner';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.wo_authorization_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
END $function$;

CREATE OR REPLACE FUNCTION public.notify_recovery_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _authority text;
  _target uuid;
  _seat text;
  _title text;
  _body text;
  _link text;
BEGIN
  IF NEW.approval_status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.approval_status IS NOT DISTINCT FROM NEW.approval_status THEN
    RETURN NEW;
  END IF;

  _authority := COALESCE(NEW.approval_authority, 'supervisor');
  IF _authority = 'director' THEN
    SELECT current_seat_holder, current_seat_name INTO _target, _seat
      FROM public.functional_roles WHERE code = 'director_ops';
  ELSE
    SELECT current_seat_holder, current_seat_name INTO _target, _seat
      FROM public.functional_roles WHERE code = 'ops_supervisor';
  END IF;

  IF _target IS NULL OR _target = COALESCE(NEW.requested_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RETURN NEW;
  END IF;

  _link := coalesce(private.ticket_link_for('ticket', NEW.ticket_id), '/recovery?open=' || NEW.id::text);
  _title := CASE WHEN _authority = 'director'
    THEN 'Director approval needed — guest recovery'
    ELSE 'Approval needed — guest recovery' END;
  _body := COALESCE(NEW.title, 'Guest recovery')
    || CASE WHEN NEW.proposed_amount IS NOT NULL
         THEN ' — proposed ' || to_char(NEW.proposed_amount, 'FM$999,999.00') ELSE '' END
    || CASE WHEN _authority = 'director'
         THEN '. This decision sits with the Director of Operations.'
         ELSE '. This decision sits with the Operations Supervisor.' END;

  PERFORM public.notify_staff(
    _target, 'approval_required', _title, _body,
    'guest_recovery', NEW.id, _link, 'urgent',
    NEW.requested_by, true, COALESCE(NEW.is_demo, false)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.ticket_selected_vendor_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$;
