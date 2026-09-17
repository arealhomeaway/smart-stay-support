-- Unapplied. Replace the existing elevated task mirror with one server-only transaction.
-- No owner receives permission to edit task records or call this function directly.
CREATE FUNCTION public.record_owner_task_response(
 _approval_id uuid, _owner_id uuid, _approved boolean, _note text
) RETURNS timestamptz LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE request public.approvals%ROWTYPE; task public.onboarding_tasks%ROWTYPE; decided timestamptz := now();
BEGIN
 SELECT * INTO request FROM public.approvals WHERE id=_approval_id;
 IF NOT FOUND OR request.entity_type IS DISTINCT FROM 'onboarding_task' OR request.approver_id IS DISTINCT FROM _owner_id OR _owner_id IS NULL THEN
  RAISE EXCEPTION 'That task approval is not addressed to this owner.';
 END IF;
 -- Same lock order as staff decision and request preparation.
 SELECT * INTO task FROM public.onboarding_tasks WHERE id=request.entity_id AND property_id=request.property_id FOR UPDATE;
 IF NOT FOUND OR task.archived_at IS NOT NULL OR NOT coalesce(task.requires_owner_approval,false) THEN RAISE EXCEPTION 'That task no longer accepts an owner response.'; END IF;
 SELECT * INTO request FROM public.approvals WHERE id=_approval_id FOR UPDATE;
 IF request.status IS DISTINCT FROM 'pending' OR request.approver_id IS DISTINCT FROM _owner_id OR request.entity_type IS DISTINCT FROM 'onboarding_task' OR request.entity_id IS DISTINCT FROM task.id OR request.property_id IS DISTINCT FROM task.property_id THEN
  RAISE EXCEPTION 'The approval changed. Refresh before responding.';
 END IF;
 IF NOT _approved AND length(trim(coalesce(_note,'')))=0 THEN RAISE EXCEPTION 'Explain what you would like changed.'; END IF;
 UPDATE public.approvals SET status=CASE WHEN _approved THEN 'approved' ELSE 'declined' END, decision_note=nullif(trim(_note),''),decided_at=decided WHERE id=_approval_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'The response could not be recorded.'; END IF;
 UPDATE public.onboarding_tasks SET owner_approval_status=CASE WHEN _approved THEN 'approved' ELSE 'changes_requested' END WHERE id=task.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'The task response could not be recorded.'; END IF;
 RETURN decided;
END $$;
REVOKE ALL ON FUNCTION public.record_owner_task_response(uuid,uuid,boolean,text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.record_owner_task_response(uuid,uuid,boolean,text) TO service_role;
