CREATE OR REPLACE FUNCTION public.publish_owner_approval(_approval_id uuid, _expected_updated_at timestamp with time zone, _expected_revision integer, _expected_owner_id uuid, _expected_program_id uuid, _expected_recipient_id uuid, _title text, _detail text, _reviewed boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE request public.approvals%ROWTYPE; program public.owner_programs%ROWTYPE; revision integer; publication_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Only staff can publish a reviewed owner approval.'; END IF;
 IF _reviewed IS DISTINCT FROM true OR length(trim(coalesce(_title,''))) NOT BETWEEN 5 AND 180 OR length(trim(coalesce(_detail,''))) NOT BETWEEN 20 AND 4000 THEN
  RAISE EXCEPTION 'Write an owner-safe title and clear decision context, then confirm the privacy review.';
 END IF;
 request:=private.lock_owner_approval(_approval_id);
 SELECT * INTO program FROM public.owner_programs WHERE id=private.owner_approval_program(request);
 SELECT coalesce(max(p.revision),0) INTO revision FROM public.owner_approval_publications p WHERE approval_id=request.id;
 IF _expected_updated_at IS NULL OR request.updated_at IS DISTINCT FROM _expected_updated_at OR _expected_revision IS DISTINCT FROM revision
  OR _expected_owner_id IS DISTINCT FROM program.owner_record_id OR _expected_program_id IS DISTINCT FROM program.id
  OR _expected_recipient_id IS DISTINCT FROM request.approver_id THEN
  RAISE EXCEPTION 'The approval, recipient or published context changed. Review the current context before publishing; keep your draft.';
 END IF;
 INSERT INTO public.owner_approval_publications(approval_id,revision,approval_updated_at,program_id,owner_record_id,property_id,recipient_id,
  entity_type,entity_id,title,detail,amount,currency,property_name,due_on,reviewed_by)
 VALUES(request.id,revision+1,request.updated_at,program.id,program.owner_record_id,request.property_id,request.approver_id,
  request.entity_type,request.entity_id,trim(_title),trim(_detail),request.amount,CASE WHEN request.currency ~ '^[A-Z]{3}$' THEN request.currency ELSE 'USD' END,
  (SELECT public.format_property_label(to_jsonb(properties))->>'primary' FROM public.properties WHERE id=request.property_id),request.due_on,auth.uid()) RETURNING id INTO publication_id;
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,after_value)
 VALUES(auth.uid(),'owner_approval_published','approval',request.id,jsonb_build_object('publication_id',publication_id,'revision',revision+1));
 RETURN publication_id;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The approval context is being updated. Refresh and review it before publishing.';
END $function$
;