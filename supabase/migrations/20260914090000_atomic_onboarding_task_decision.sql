-- Unapplied. Staff-confirmed task decisions update both canonical records atomically.
CREATE FUNCTION public.decide_onboarding_task_approval(
  _task_id uuid, _approved boolean, _note text, _evidence_url text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE task public.onboarding_tasks%ROWTYPE; approval_id uuid; pending_count integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_onboarding_staff(auth.uid()) THEN RAISE EXCEPTION 'You do not have access to record this decision.'; END IF;
 IF length(trim(coalesce(_note,''))) < 3 THEN RAISE EXCEPTION 'Record what the homeowner said and where the answer came from.'; END IF;
 SELECT * INTO task FROM public.onboarding_tasks WHERE id=_task_id FOR UPDATE;
 IF NOT FOUND OR task.archived_at IS NOT NULL THEN RAISE EXCEPTION 'That task is not available.'; END IF;
 IF NOT coalesce(task.requires_owner_approval,false) THEN RAISE EXCEPTION 'This task does not require an owner decision.'; END IF;
 SELECT count(*) INTO pending_count FROM public.approvals WHERE entity_type='onboarding_task' AND entity_id=task.id AND property_id=task.property_id AND status='pending';
 IF pending_count <> 1 THEN RAISE EXCEPTION 'There must be exactly one pending owner request before recording a decision.'; END IF;
 SELECT id INTO approval_id FROM public.approvals WHERE entity_type='onboarding_task' AND entity_id=task.id AND property_id=task.property_id AND status='pending' FOR UPDATE;
 UPDATE public.approvals SET status=CASE WHEN _approved THEN 'approved' ELSE 'declined' END,
 decision_note=trim(_note), decided_at=now(), evidence_url=coalesce(nullif(trim(_evidence_url),''),evidence_url)
 WHERE id=approval_id AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'The owner request changed. Refresh before recording a decision.'; END IF;
 UPDATE public.onboarding_tasks SET owner_approval_status=CASE WHEN _approved THEN 'approved' ELSE 'changes_requested' END WHERE id=task.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'The task decision could not be recorded.'; END IF;
 RETURN approval_id;
END $$;
REVOKE ALL ON FUNCTION public.decide_onboarding_task_approval(uuid,boolean,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_onboarding_task_approval(uuid,boolean,text,text) TO authenticated;
