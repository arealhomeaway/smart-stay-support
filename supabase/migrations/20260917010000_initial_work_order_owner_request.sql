-- A newly created above-authority Work Order is pending before its first owner request.
-- Permit that unlinked state; retain canonical request, approved-state and retry guards.
CREATE OR REPLACE FUNCTION public.prepare_work_order_owner_approval(
 _work_order_id uuid, _expected_updated_at timestamptz, _owner_summary text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.prepare_work_order_owner_approval(uuid,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prepare_work_order_owner_approval(uuid,timestamptz,text) TO authenticated,service_role;
