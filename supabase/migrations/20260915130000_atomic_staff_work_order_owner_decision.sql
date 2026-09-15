-- Unapplied. Staff transcribe an evidenced owner response using existing table RLS.
CREATE FUNCTION public.record_staff_work_order_owner_decision(
 _work_order_id uuid,_expected_updated_at timestamptz,_outcome text,_approved_amount numeric,_note text
) RETURNS timestamptz LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE wo public.work_orders%ROWTYPE; request public.approvals%ROWTYPE;
 decided timestamptz:=now(); note text:=trim(coalesce(_note,'')); canonical_status text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'You do not have access to record this decision.'; END IF;
 IF _outcome IS NULL OR _outcome NOT IN ('approved','declined','info_requested') OR length(note) NOT BETWEEN 1 AND 2000 THEN
  RAISE EXCEPTION 'Record the owner response and where it was received.';
 END IF;
 -- Same lock order as preparation and the owner-entered response.
 SELECT * INTO wo FROM public.work_orders WHERE id=_work_order_id FOR UPDATE;
 IF NOT FOUND OR wo.closed_at IS NOT NULL OR wo.approval_id IS NULL THEN RAISE EXCEPTION 'Prepare a canonical owner approval before recording a response.'; END IF;
 IF _expected_updated_at IS NULL OR wo.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'The Work Order changed. Refresh before recording the response.'; END IF;
 SELECT * INTO request FROM public.approvals WHERE id=wo.approval_id FOR UPDATE;
 IF NOT FOUND OR request.status IS DISTINCT FROM 'pending' OR request.approver_role IS DISTINCT FROM 'owner'
  OR request.entity_type IS DISTINCT FROM 'work_order' OR request.entity_id IS DISTINCT FROM wo.id
  OR request.property_id IS DISTINCT FROM wo.property_id OR request.is_demo IS DISTINCT FROM wo.is_demo THEN
  RAISE EXCEPTION 'The canonical approval changed. Review it before recording a response.';
 END IF;
 IF request.amount IS NULL OR request.amount<0 OR request.amount::text IN ('NaN','Infinity','-Infinity')
  OR request.amount IS DISTINCT FROM wo.quote_amount THEN RAISE EXCEPTION 'The quote changed. Prepare a new approval before recording a response.'; END IF;
 IF _outcome='approved' THEN
  IF _approved_amount IS NULL OR _approved_amount<0 OR _approved_amount>request.amount OR _approved_amount::text IN ('NaN','Infinity','-Infinity') THEN
   RAISE EXCEPTION 'Record the owner-approved amount within this request.';
  END IF;
 ELSIF _approved_amount IS NOT NULL THEN RAISE EXCEPTION 'A decline or information request cannot authorize an amount.';
 END IF;
 canonical_status:=CASE WHEN _outcome='info_requested' THEN 'pending' ELSE _outcome END;
 UPDATE public.approvals SET status=canonical_status,decision_note=note,
  decided_at=CASE WHEN _outcome='info_requested' THEN NULL ELSE decided END,
  recorded_by=auth.uid(),responded_at=decided,response_channel='staff_recorded' WHERE id=request.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'The canonical response could not be recorded.'; END IF;
 UPDATE public.work_orders SET approval_status=_outcome,approved_amount=_approved_amount,approval_note=note,
  approval_decided_at=CASE WHEN _outcome='info_requested' THEN NULL ELSE decided END WHERE id=wo.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'The Work Order response could not be recorded.'; END IF;
 INSERT INTO public.work_order_events(work_order_id,author_id,event_type,body,detail,is_demo)
 VALUES(wo.id,auth.uid(),'owner_' || _outcome,'Owner response recorded by staff',
  jsonb_build_object('approval_id',request.id,'outcome',_outcome,'approved_amount',_approved_amount,
   'recorded_by',auth.uid(),'note',note,'previous_approval',to_jsonb(request),
   'previous_work_order_status',wo.approval_status,'previous_approved_amount',wo.approved_amount),wo.is_demo);
 RETURN decided;
END $$;
REVOKE ALL ON FUNCTION public.record_staff_work_order_owner_decision(uuid,timestamptz,text,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_staff_work_order_owner_decision(uuid,timestamptz,text,numeric,text) TO authenticated,service_role;
