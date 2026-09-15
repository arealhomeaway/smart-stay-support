-- Unapplied. Server-only: owners do not receive access to internal Work Orders.
CREATE FUNCTION public.record_owner_work_order_response(_approval_id uuid,_owner_id uuid,_approved boolean,_note text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE request public.approvals%ROWTYPE; wo public.work_orders%ROWTYPE;
 home public.properties%ROWTYPE; program public.owner_programs%ROWTYPE;
 decided timestamptz := now(); outcome text;
BEGIN
 IF _owner_id IS NULL OR _approved IS NULL OR length(coalesce(_note,''))>2000 THEN RAISE EXCEPTION 'Enter a valid owner response.'; END IF;
 IF NOT _approved AND length(trim(coalesce(_note,'')))=0 THEN RAISE EXCEPTION 'Explain what you would like changed.'; END IF;
 SELECT * INTO request FROM public.approvals WHERE id=_approval_id;
 IF NOT FOUND OR request.entity_type IS DISTINCT FROM 'work_order' OR request.approver_id IS DISTINCT FROM _owner_id THEN
  RAISE EXCEPTION 'That Work Order approval is not addressed to this owner.';
 END IF;
 SELECT * INTO wo FROM public.work_orders WHERE id=request.entity_id FOR UPDATE;
 IF NOT FOUND OR wo.closed_at IS NOT NULL OR wo.is_demo IS DISTINCT FROM false OR wo.approval_id IS DISTINCT FROM _approval_id THEN
  RAISE EXCEPTION 'That Work Order no longer accepts this owner response.';
 END IF;
 SELECT * INTO request FROM public.approvals WHERE id=_approval_id FOR UPDATE;
 IF NOT FOUND OR request.status IS DISTINCT FROM 'pending' OR request.approver_role IS DISTINCT FROM 'owner'
  OR request.approver_id IS DISTINCT FROM _owner_id OR request.is_demo IS DISTINCT FROM false
  OR request.entity_type IS DISTINCT FROM 'work_order' OR request.entity_id IS DISTINCT FROM wo.id
  OR request.property_id IS DISTINCT FROM wo.property_id THEN RAISE EXCEPTION 'The approval changed. Refresh before responding.'; END IF;
 IF request.amount IS NULL OR request.amount<0 OR request.amount::text IN ('NaN','Infinity','-Infinity')
  OR request.amount IS DISTINCT FROM wo.quote_amount THEN RAISE EXCEPTION 'The quoted amount changed. Ask the team to prepare a new approval.'; END IF;
 SELECT * INTO home FROM public.properties WHERE id=wo.property_id FOR SHARE;
 IF NOT FOUND OR home.is_demo IS DISTINCT FROM false OR home.owner_record_id IS NULL THEN RAISE EXCEPTION 'This Property is no longer available to this owner.'; END IF;
 PERFORM id FROM public.property_owners WHERE id=home.owner_record_id AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'The canonical Owner is no longer active.'; END IF;
 SELECT * INTO program FROM public.owner_programs WHERE owner_record_id=home.owner_record_id
  AND owner_user_id=_owner_id AND is_demo=false AND archived_at IS NULL AND status IN ('pending','active') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This Property is no longer enrolled for this owner.'; END IF;
 PERFORM property_id FROM public.owner_program_properties WHERE program_id=program.id
  AND property_id=home.id AND inclusion_status='included' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This Property is no longer enrolled for this owner.'; END IF;
 IF wo.ticket_id IS NOT NULL THEN
  PERFORM id FROM public.tickets WHERE id=wo.ticket_id AND property_id=home.id AND is_demo=false FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The Work Order Ticket no longer matches this Property.'; END IF;
 END IF;
 outcome := CASE WHEN _approved THEN 'approved' ELSE 'declined' END;
 UPDATE public.approvals SET status=outcome,decision_note=nullif(trim(_note),''),decided_at=decided WHERE id=request.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'The approval response could not be recorded.'; END IF;
 UPDATE public.work_orders SET approval_status=outcome,approved_amount=CASE WHEN _approved THEN request.amount ELSE NULL END,
  approval_decided_at=decided,approval_note=nullif(trim(_note),'') WHERE id=wo.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'The Work Order response could not be recorded.'; END IF;
 INSERT INTO public.work_order_events(work_order_id,author_id,event_type,body,detail,is_demo)
 VALUES(wo.id,_owner_id,'owner_approval_' || outcome,'Owner response recorded',
  jsonb_build_object('approval_id',request.id,'previous_status',wo.approval_status,'status',outcome,
   'previous_approved_amount',wo.approved_amount,'approved_amount',CASE WHEN _approved THEN request.amount ELSE NULL END,'note',nullif(trim(_note),'')),false);
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,reason,before_value,after_value)
 VALUES(_owner_id,'owner_approval_' || outcome,'approval',request.id,nullif(trim(_note),''),
  jsonb_build_object('status',request.status),jsonb_build_object('status',outcome,'decidedAt',decided,'workOrderId',wo.id));
 RETURN decided;
END $$;
REVOKE ALL ON FUNCTION public.record_owner_work_order_response(uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_owner_work_order_response(uuid,uuid,boolean,text) TO service_role;
