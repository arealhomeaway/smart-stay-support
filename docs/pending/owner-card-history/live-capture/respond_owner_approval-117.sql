CREATE OR REPLACE FUNCTION public.respond_owner_approval(_approval_id uuid, _publication_id uuid, _expected_updated_at timestamp with time zone, _approved boolean, _note text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE request public.approvals%ROWTYPE; publication public.owner_approval_publications%ROWTYPE; decided timestamptz;
BEGIN
 IF auth.uid() IS NULL OR _approved IS NULL OR length(coalesce(_note,''))>2000 OR (_approved=false AND length(trim(coalesce(_note,'')))=0) THEN
  RAISE EXCEPTION 'Sign in and provide a valid decision, including a note when requesting changes.';
 END IF;
 -- Do not inspect/lock another recipient's operational source on a guessed id.
 IF NOT EXISTS(SELECT 1 FROM public.approvals a WHERE a.id=_approval_id AND a.approver_id=auth.uid() AND a.approver_role='owner'
  AND a.is_demo=false AND private.owner_approval_program(a) IS NOT NULL) THEN RAISE EXCEPTION 'That approval is not available to this owner account.'; END IF;
 request:=private.lock_owner_approval(_approval_id);
 SELECT * INTO publication FROM public.owner_approval_publications WHERE approval_id=request.id ORDER BY revision DESC LIMIT 1;
 IF publication.id IS NULL OR _publication_id IS DISTINCT FROM publication.id OR _expected_updated_at IS NULL OR request.updated_at IS DISTINCT FROM _expected_updated_at
  OR publication.approval_updated_at IS DISTINCT FROM request.updated_at OR publication.recipient_id IS DISTINCT FROM auth.uid()
  OR publication.program_id IS DISTINCT FROM private.owner_approval_program(request)
  OR publication.owner_record_id IS DISTINCT FROM (SELECT owner_record_id FROM public.owner_programs WHERE id=publication.program_id)
  OR publication.property_id IS DISTINCT FROM request.property_id OR publication.entity_type IS DISTINCT FROM request.entity_type OR publication.entity_id IS DISTINCT FROM request.entity_id THEN
  RAISE EXCEPTION 'A current staff-reviewed summary is required. Review the updated request before responding; your note can be kept.';
 END IF;
 IF request.entity_type IN('work_order','onboarding_task','financial_request') THEN
  decided:=public.record_versioned_owner_response(request.id,auth.uid(),_expected_updated_at,_approved,trim(coalesce(_note,'')));
 ELSE
  decided:=now();
  UPDATE public.approvals SET status=CASE WHEN _approved THEN 'approved' ELSE 'declined' END,decision_note=nullif(trim(_note),''),decided_at=decided WHERE id=request.id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.owner_approval_receipts r WHERE r.approval_id=request.id AND r.publication_id=publication.id AND r.actor_id=auth.uid()) THEN
  RAISE EXCEPTION 'The exact reviewed decision context could not be retained. No response was saved.';
 END IF;
 -- Work Order delegate already writes its canonical audit. This publication receipt
 -- is additional immutable context; task/finance/generic responses need this audit.
 IF request.entity_type<>'work_order' THEN
  INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,reason,after_value)
  VALUES(auth.uid(),CASE WHEN _approved THEN 'owner_approval_approved' ELSE 'owner_approval_declined' END,'approval',request.id,nullif(trim(_note),''),
   jsonb_build_object('decided_at',decided,'publication_id',publication.id,'revision',publication.revision));
 END IF;
 RETURN decided;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The approval context is being updated. Refresh and review it before responding.';
END $function$
;
