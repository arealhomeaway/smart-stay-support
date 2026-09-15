-- Unapplied. Server-only persistence after the authenticated readiness checks.
CREATE FUNCTION public.create_onboarding_handoff(_property_id uuid,_actor_id uuid,_expected_lifecycle text,_request jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE home public.properties%ROWTYPE; new_id uuid; open_ids uuid[]; task_id uuid; task public.onboarding_tasks%ROWTYPE;
BEGIN
 IF _actor_id IS NULL OR NOT coalesce(public.is_onboarding_staff(_actor_id),false) THEN RAISE EXCEPTION 'Only onboarding staff can request handoff.'; END IF;
 SELECT * INTO home FROM public.properties WHERE id=_property_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'That property is not available.'; END IF;
 IF home.lifecycle_status IS DISTINCT FROM _expected_lifecycle OR home.handoff_accepted_at IS NOT NULL OR home.lifecycle_status IN ('handoff_requested','active_operations','offboarded') THEN RAISE EXCEPTION 'The property changed. Refresh its handoff readiness.'; END IF;
 IF EXISTS(SELECT 1 FROM public.property_handoffs WHERE property_id=home.id AND status IN ('requested','accepted_pending_live')) THEN RAISE EXCEPTION 'A handoff is already in review for this home.'; END IF;
 SELECT coalesce(array_agg(value::uuid),'{}'::uuid[]) INTO open_ids FROM jsonb_array_elements_text(coalesce(_request->'openTaskIds','[]'::jsonb));
 IF cardinality(open_ids)>0 AND NOT coalesce((_request->>'carryoverAccepted')::boolean,false) THEN RAISE EXCEPTION 'Open handoff items require accepted carryover.'; END IF;
 FOR task_id IN SELECT DISTINCT unnest(open_ids) ORDER BY 1 LOOP
  SELECT * INTO task FROM public.onboarding_tasks WHERE id=task_id FOR UPDATE;
  IF NOT FOUND OR task.property_id IS DISTINCT FROM home.id OR task.archived_at IS NOT NULL OR task.assigned_to IS NULL OR task.due_on IS NULL OR length(trim(coalesce(task.carryover_reason,'')))=0 THEN
   RAISE EXCEPTION 'Carryover changed. Each item needs this property, an owner, due date, and reason.';
  END IF;
 END LOOP;
 INSERT INTO public.property_handoffs(property_id,status,requested_by,checklist,validation,open_task_ids,carryover_accepted,gate_step,notes,is_demo)
 VALUES(home.id,'requested',_actor_id,_request->'checklist',_request->'validation',open_ids,coalesce((_request->>'carryoverAccepted')::boolean,false),'kati_review',nullif(_request->>'notes',''),coalesce(home.is_demo,false))
 RETURNING id INTO new_id;
 UPDATE public.properties SET lifecycle_status='handoff_requested' WHERE id=home.id;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_onboarding_handoff(uuid,uuid,text,jsonb) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.create_onboarding_handoff(uuid,uuid,text,jsonb) TO service_role;
