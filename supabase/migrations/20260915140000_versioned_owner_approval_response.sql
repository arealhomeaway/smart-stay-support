-- Unapplied. Browser version is checked inside the same transaction as the existing response.
CREATE FUNCTION public.record_versioned_owner_response(
 _approval_id uuid,_owner_id uuid,_expected_updated_at timestamptz,_approved boolean,_note text
) RETURNS timestamptz LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE source_type text; source_id uuid; request public.approvals%ROWTYPE;
BEGIN
 SELECT entity_type,entity_id INTO source_type,source_id FROM public.approvals WHERE id=_approval_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'That approval is not available.'; END IF;
 -- Preserve source-before-approval lock order used by the delegated functions.
 CASE source_type
  WHEN 'work_order' THEN PERFORM id FROM public.work_orders WHERE id=source_id FOR UPDATE;
  WHEN 'onboarding_task' THEN PERFORM id FROM public.onboarding_tasks WHERE id=source_id FOR UPDATE;
  WHEN 'financial_request' THEN PERFORM id FROM public.financial_requests WHERE id=source_id FOR UPDATE;
  ELSE RAISE EXCEPTION 'This approval type does not support this response.';
 END CASE;
 IF NOT FOUND THEN RAISE EXCEPTION 'The approval source is no longer available.'; END IF;
 SELECT * INTO request FROM public.approvals WHERE id=_approval_id FOR UPDATE;
 IF NOT FOUND OR request.entity_type IS DISTINCT FROM source_type OR request.entity_id IS DISTINCT FROM source_id
  OR _expected_updated_at IS NULL OR request.updated_at IS DISTINCT FROM _expected_updated_at THEN
  RAISE EXCEPTION 'The approval changed. Review the updated request before responding.';
 END IF;
 CASE source_type
  WHEN 'work_order' THEN RETURN public.record_owner_work_order_response(_approval_id,_owner_id,_approved,_note);
  WHEN 'onboarding_task' THEN RETURN public.record_owner_task_response(_approval_id,_owner_id,_approved,_note);
  WHEN 'financial_request' THEN RETURN public.record_owner_financial_response(_approval_id,_owner_id,_approved,_note);
 END CASE;
END $$;
REVOKE ALL ON FUNCTION public.record_versioned_owner_response(uuid,uuid,timestamptz,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_versioned_owner_response(uuid,uuid,timestamptz,boolean,text) TO service_role;
