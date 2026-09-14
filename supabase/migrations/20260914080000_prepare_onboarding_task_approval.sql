-- Unapplied: serialize approval preparation on the existing task row.
-- Existing authenticated table permissions and RLS remain in force.
CREATE FUNCTION public.prepare_onboarding_task_approval(
  _task_id uuid, _property_id uuid, _detail text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE task public.onboarding_tasks%ROWTYPE; approval_id uuid; pending_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_onboarding_staff(auth.uid()) THEN
    RAISE EXCEPTION 'You do not have access to request this decision.';
  END IF;
  SELECT * INTO task FROM public.onboarding_tasks WHERE id = _task_id AND property_id = _property_id FOR UPDATE;
  IF NOT FOUND OR task.archived_at IS NOT NULL THEN RAISE EXCEPTION 'That task is not available for this property.'; END IF;
  IF NOT coalesce(task.requires_owner_approval,false) OR task.owner_approval_status = 'approved' THEN
    RAISE EXCEPTION 'This task does not need a new owner decision.';
  END IF;
  SELECT count(*) INTO pending_count FROM public.approvals
    WHERE entity_type = 'onboarding_task' AND entity_id = task.id AND property_id = task.property_id AND status = 'pending';
  IF pending_count > 1 THEN RAISE EXCEPTION 'Multiple pending decisions exist. Reconcile them before sending.'; END IF;
  SELECT id INTO approval_id FROM public.approvals
    WHERE entity_type = 'onboarding_task' AND entity_id = task.id AND property_id = task.property_id AND status = 'pending' FOR UPDATE;
  IF approval_id IS NULL THEN
    INSERT INTO public.approvals(entity_type,entity_id,property_id,kind,title,detail,requested_by,approver_role,status,due_on,is_demo)
      VALUES ('onboarding_task',task.id,task.property_id,'onboarding_task',task.title,nullif(_detail,''),auth.uid(),'owner','pending',task.due_on,task.is_demo)
      RETURNING id INTO approval_id;
  END IF;
  UPDATE public.onboarding_tasks SET owner_approval_status = 'awaiting_owner' WHERE id = task.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'The approval could not be linked to its task.'; END IF;
  RETURN approval_id;
END $$;
REVOKE ALL ON FUNCTION public.prepare_onboarding_task_approval(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_onboarding_task_approval(uuid,uuid,text) TO authenticated;
