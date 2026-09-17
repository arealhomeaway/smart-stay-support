-- Every review uses the protected responsibility seats introduced by migration45.
CREATE FUNCTION private.current_onboarding_review_seat(_code text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.seat_holder_at(_code,now()) FROM public.functional_roles r
 WHERE r.code=_code AND r.active AND private.onboarding_assignment_staff(public.seat_holder_at(_code,now()))
$$;
REVOKE ALL ON FUNCTION private.current_onboarding_review_seat(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.current_onboarding_review_seat(text) TO authenticated,service_role;
CREATE FUNCTION private.onboarding_gate_reviewer(_actor uuid,_gate text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(_gate IN('kati_review','micah_review','operations_acceptance','live_confirmation')
  AND private.onboarding_assignment_staff(_actor) AND (public.has_role(_actor,'admin') OR _actor=private.current_onboarding_review_seat(
   CASE _gate WHEN 'kati_review' THEN 'director_onboarding' WHEN 'micah_review' THEN 'director_ops'
    WHEN 'operations_acceptance' THEN 'ops_supervisor' WHEN 'live_confirmation' THEN 'ops_supervisor' END)),false)
$$;
REVOKE ALL ON FUNCTION private.onboarding_gate_reviewer(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.onboarding_gate_reviewer(uuid,text) TO authenticated,service_role;
CREATE FUNCTION private.onboarding_project_executor(_actor uuid,_property uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT private.onboarding_assignment_staff(_actor) AND EXISTS(
  SELECT 1 FROM onboarding_projects p WHERE p.property_id=_property AND p.status<>'cancelled'
   AND (p.project_manager=_actor OR public.has_role(_actor,'admin')))
$$;
REVOKE ALL ON FUNCTION private.onboarding_project_executor(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.onboarding_project_executor(uuid,uuid) TO authenticated,service_role;
CREATE FUNCTION public.read_onboarding_review_capabilities()
RETURNS TABLE(is_admin boolean,can_review_stages boolean,kati_review boolean,micah_review boolean,operations_acceptance boolean,live_confirmation boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.has_role(auth.uid(),'admin'),private.onboarding_gate_reviewer(auth.uid(),'kati_review'),
  private.onboarding_gate_reviewer(auth.uid(),'kati_review'),private.onboarding_gate_reviewer(auth.uid(),'micah_review'),
  private.onboarding_gate_reviewer(auth.uid(),'operations_acceptance'),private.onboarding_gate_reviewer(auth.uid(),'live_confirmation')
 WHERE auth.uid() IS NOT NULL AND private.onboarding_assignment_staff(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.read_onboarding_review_capabilities() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_onboarding_review_capabilities() TO authenticated;

-- The receipt records availability and the referenced resource, not just a mutable ID.
CREATE FUNCTION private.onboarding_stage_evidence_snapshot(_property uuid,_stage text,_ids jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',ref.id,'entity_type',d.entity_type,'entity_id',d.entity_id,
   'is_demo',d.is_demo,'archived_at',d.archived_at,'deleted_at',d.deleted_at,'upload_status',d.upload_status,
   'storage_path',d.storage_path,'external_url',d.external_url,'updated_at',to_jsonb(d)->'updated_at',
   'uploaded_at',to_jsonb(d)->'uploaded_at','original_filename',to_jsonb(d)->'original_filename',
   'mime_type',to_jsonb(d)->'mime_type','size_bytes',to_jsonb(d)->'size_bytes',
   'available',coalesce(d.id IS NOT NULL AND d.archived_at IS NULL AND d.deleted_at IS NULL AND d.upload_status='stored'
    AND d.is_demo IS NOT DISTINCT FROM home.is_demo
    AND (length(trim(coalesce(d.storage_path,'')))>0 OR length(trim(coalesce(d.external_url,'')))>0)
    AND ((d.entity_type='property' AND d.entity_id=_property) OR (d.entity_type='onboarding_task' AND EXISTS(
     SELECT 1 FROM onboarding_tasks t WHERE t.id=d.entity_id AND t.property_id=_property AND t.stage=_stage AND t.archived_at IS NULL))),false)) ORDER BY ref.id),'[]'::jsonb)
 FROM (SELECT DISTINCT value::uuid id FROM jsonb_array_elements_text(coalesce(_ids,'[]'::jsonb))) ref
 LEFT JOIN documents d ON d.id=ref.id LEFT JOIN properties home ON home.id=_property
$$;
REVOKE ALL ON FUNCTION private.onboarding_stage_evidence_snapshot(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.onboarding_stage_evidence_snapshot(uuid,text,jsonb) TO service_role;

-- One snapshot supplies the existing application readiness model. It is available
-- only to the responsible PM and the protected reviewers, never external owners.
CREATE FUNCTION private.onboarding_handoff_snapshot(_property uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('property',to_jsonb(home),'project',(
  SELECT to_jsonb(p) FROM onboarding_projects p WHERE p.property_id=home.id AND p.status<>'cancelled'),
 'tasks',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM onboarding_tasks t WHERE t.property_id=home.id AND t.archived_at IS NULL),'[]'::jsonb),
 'stageCaptures',coalesce((SELECT jsonb_agg(c.new_value::jsonb ORDER BY c.kind) FROM(
   SELECT DISTINCT ON(e.kind) e.kind,e.new_value FROM onboarding_project_events e
   JOIN onboarding_projects p ON p.id=e.project_id WHERE p.property_id=home.id AND p.status<>'cancelled' AND e.kind LIKE 'stage_capture:%'
   ORDER BY e.kind,(e.new_value::jsonb->>'revision')::integer DESC)c),'[]'::jsonb),
 'stageEvidence',coalesce((SELECT jsonb_agg(jsonb_build_object('stage',c.kind,'evidence',private.onboarding_stage_evidence_snapshot(home.id,c.new_value::jsonb->>'stage',c.new_value::jsonb->'evidenceIds')) ORDER BY c.kind) FROM(
   SELECT DISTINCT ON(e.kind) e.kind,e.new_value FROM onboarding_project_events e JOIN onboarding_projects p ON p.id=e.project_id
   WHERE p.property_id=home.id AND p.status<>'cancelled' AND e.kind LIKE 'stage_capture:%'
   ORDER BY e.kind,(e.new_value::jsonb->>'revision')::integer DESC)c),'[]'::jsonb),
 'pendingFacts',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM property_fact_proposals f WHERE f.property_id=home.id AND f.status='pending'),'[]'::jsonb))
 FROM properties home WHERE home.id=_property AND home.archived_at IS NULL
$$;
REVOKE ALL ON FUNCTION private.onboarding_handoff_snapshot(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.onboarding_handoff_snapshot(uuid) TO service_role;
CREATE FUNCTION public.read_onboarding_handoff_snapshot(_property_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT(private.onboarding_project_executor(auth.uid(),_property_id)
  OR private.onboarding_gate_reviewer(auth.uid(),'kati_review') OR private.onboarding_gate_reviewer(auth.uid(),'micah_review')
  OR private.onboarding_gate_reviewer(auth.uid(),'operations_acceptance')) THEN RAISE EXCEPTION 'This readiness record is not assigned to you.'; END IF;
 RETURN private.onboarding_handoff_snapshot(_property_id);
END $$;
REVOKE ALL ON FUNCTION public.read_onboarding_handoff_snapshot(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_onboarding_handoff_snapshot(uuid) TO authenticated;
CREATE FUNCTION private.comparable_onboarding_snapshot(_snapshot jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT jsonb_set(jsonb_set(_snapshot,'{property}',coalesce(_snapshot->'property','{}'::jsonb)-ARRAY['lifecycle_status','handoff_accepted_at','onboarding_stage','active','updated_at','quarterly_review_due_on']),
 '{project}',coalesce(_snapshot->'project','{}'::jsonb)-ARRAY['status','completed_at','updated_at'])
$$;
REVOKE ALL ON FUNCTION private.comparable_onboarding_snapshot(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.comparable_onboarding_snapshot(jsonb) TO service_role;

-- Trusted transactions lock project -> property -> tasks -> pending facts;
-- referenced documents are next, then the review locks its handoff row.
-- Existing task rows and the property FK prevent an in-flight insert being omitted.
CREATE FUNCTION private.lock_onboarding_readiness(_property uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM id FROM onboarding_projects WHERE property_id=_property AND status<>'cancelled' ORDER BY id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Start onboarding before requesting or reviewing handoff.'; END IF;
 PERFORM id FROM properties WHERE id=_property AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'That property is not available.'; END IF;
 PERFORM id FROM onboarding_tasks WHERE property_id=_property AND archived_at IS NULL ORDER BY id FOR UPDATE;
 PERFORM id FROM property_fact_proposals WHERE property_id=_property AND status='pending' ORDER BY id FOR UPDATE;
 PERFORM d.id FROM documents d WHERE d.id IN (
  SELECT value::uuid FROM (
   SELECT DISTINCT ON(e.kind) e.new_value,e.kind FROM onboarding_project_events e JOIN onboarding_projects p ON p.id=e.project_id
   WHERE p.property_id=_property AND p.status<>'cancelled' AND e.kind LIKE 'stage_capture:%'
   ORDER BY e.kind,(e.new_value::jsonb->>'revision')::integer DESC)c
  CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(c.new_value::jsonb->'evidenceIds','[]'::jsonb)) ref(value)) ORDER BY d.id FOR UPDATE;
END $$;
REVOKE ALL ON FUNCTION private.lock_onboarding_readiness(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.lock_onboarding_readiness(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.record_onboarding_stage_capture(
  _project_id uuid, _actor uuid, _expected_revision integer, _capture jsonb,
  _tasks jsonb, _scope jsonb
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  project public.onboarding_projects%ROWTYPE;
  actual_tasks jsonb;
  actual_evidence jsonb;
  previous text;
  stage_key text := _capture ->> 'stage';
  actual_revision integer;
BEGIN
  IF NOT public.is_onboarding_staff(_actor) THEN RAISE EXCEPTION 'Stage capture requires onboarding staff.'; END IF;
  SELECT * INTO project FROM public.onboarding_projects WHERE id = _project_id FOR UPDATE;
  IF NOT FOUND OR project.status NOT IN ('planning','active') THEN RAISE EXCEPTION 'Onboarding project is not available for stage work.'; END IF;
  IF (_capture->>'actor')::uuid IS DISTINCT FROM _actor OR NOT private.onboarding_assignment_staff(_actor) THEN RAISE EXCEPTION 'Stage capture must record its authorized actor.'; END IF;
  IF stage_key NOT IN ('post_contract','phase1_inspection','phase2_estimates','phase3_work_orders','phase4_purchasing','phase5_monitor','phase6_handoff') THEN RAISE EXCEPTION 'Unknown onboarding stage.'; END IF;
  IF jsonb_build_object('modules', project.modules, 'furnishing_scope', project.furnishing_scope, 'director', project.director)
     IS DISTINCT FROM _scope THEN RAISE EXCEPTION 'Project scope changed. Refresh before saving.'; END IF;
  PERFORM id FROM public.properties WHERE id = project.property_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.properties WHERE id = project.property_id AND
      (handoff_accepted_at IS NOT NULL OR lifecycle_status IN ('active_operations','handoff_requested')))
    THEN RAISE EXCEPTION 'The onboarding plan is locked for handoff.'; END IF;
  SELECT new_value INTO previous FROM public.onboarding_project_events
    WHERE project_id = _project_id AND kind = 'stage_capture:' || stage_key
    ORDER BY (new_value::jsonb ->> 'revision')::integer DESC LIMIT 1;
  actual_revision := coalesce((previous::jsonb ->> 'revision')::integer, 0);
  IF actual_revision IS DISTINCT FROM _expected_revision OR (_capture ->> 'revision')::integer IS DISTINCT FROM actual_revision + 1 THEN
    RAISE EXCEPTION 'This stage changed. Refresh before saving.';
  END IF;
  IF _capture->>'status' IN ('draft','awaiting_review') THEN
    IF coalesce(previous::jsonb->>'status','draft') NOT IN ('draft','correction_required') OR NOT private.onboarding_project_executor(_actor,project.property_id) THEN RAISE EXCEPTION 'Only the current PM can save or submit unlocked stage work.'; END IF;
  ELSIF _capture->>'status' IN ('complete','correction_required') THEN
    IF NOT private.onboarding_gate_reviewer(_actor,'kati_review') THEN RAISE EXCEPTION 'The Director of Onboarding must review this stage.'; END IF;
    IF (_capture->>'status'='complete' AND previous::jsonb->>'status' IS DISTINCT FROM 'awaiting_review') OR
       (_capture->>'status'='correction_required' AND coalesce(previous::jsonb->>'status','') NOT IN ('awaiting_review','complete')) THEN RAISE EXCEPTION 'Submit a stage before reviewing it; only a completed stage can be reopened.'; END IF;
    IF _capture->>'observation' IS DISTINCT FROM previous::jsonb->>'observation' OR coalesce(_capture->'evidenceIds','[]'::jsonb) IS DISTINCT FROM coalesce(previous::jsonb->'evidenceIds','[]'::jsonb) THEN RAISE EXCEPTION 'Preserve the exact submitted findings and evidence when reviewing.'; END IF;
    IF _capture->>'status'='correction_required' AND length(trim(coalesce(_capture->>'reason','')))<3 THEN RAISE EXCEPTION 'Record the corrections needed.'; END IF;
  ELSE RAISE EXCEPTION 'Invalid stage capture state.'; END IF;
  IF _capture->>'status' IN ('awaiting_review','complete') AND length(trim(coalesce(_capture->>'observation','')))<3 THEN RAISE EXCEPTION 'Record the stage findings before submitting.'; END IF;
  PERFORM id FROM public.onboarding_tasks WHERE property_id = project.property_id
    AND stage = stage_key AND archived_at IS NULL ORDER BY id FOR UPDATE;
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) INTO actual_tasks
    FROM public.onboarding_tasks t WHERE property_id = project.property_id AND stage = stage_key AND archived_at IS NULL;
  IF actual_tasks IS DISTINCT FROM _tasks THEN RAISE EXCEPTION 'Stage work changed. Refresh before saving.'; END IF;
  PERFORM d.id FROM documents d WHERE d.id IN(SELECT value::uuid FROM jsonb_array_elements_text(coalesce(_capture->'evidenceIds','[]'::jsonb))) ORDER BY d.id FOR UPDATE;
  actual_evidence:=private.onboarding_stage_evidence_snapshot(project.property_id,stage_key,_capture->'evidenceIds');
  IF _capture->>'status'<>'correction_required' AND EXISTS(SELECT 1 FROM jsonb_array_elements(actual_evidence) e WHERE NOT(e->>'available')::boolean) THEN
    RAISE EXCEPTION 'Evidence must be stored, available, and belong to this property or stage work.';
  END IF;
  IF _capture->>'status'='complete' AND previous::jsonb->'evidenceSnapshot' IS DISTINCT FROM actual_evidence THEN
    RAISE EXCEPTION 'Stage evidence changed. Return the stage and submit its current evidence for a new review.';
  END IF;
  IF _capture ->> 'status' IN ('complete','awaiting_review') AND EXISTS
    (SELECT 1 FROM public.property_fact_proposals WHERE property_id = project.property_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Permanent property facts await review.';
  END IF;
  INSERT INTO public.onboarding_project_events
    (project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
  VALUES (_project_id, project.property_id, 'stage_capture:' || stage_key,
    'Stage ' || stage_key || ': ' || (_capture ->> 'status') || ' (revision ' || (_capture ->> 'revision') || ')',
    _capture ->> 'reason', previous, (_capture||jsonb_build_object('taskSnapshot',actual_tasks,'scopeSnapshot',_scope,'evidenceSnapshot',actual_evidence))::text, _actor, project.is_demo);
END $$;
REVOKE ALL ON FUNCTION public.record_onboarding_stage_capture(uuid, uuid, integer, jsonb, jsonb, jsonb) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.record_onboarding_stage_capture(uuid, uuid, integer, jsonb, jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.create_onboarding_handoff(_property_id uuid,_actor_id uuid,_expected_lifecycle text,_request jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE home properties%ROWTYPE; new_id uuid; open_ids uuid[]; applicable_ids uuid[]; expected_open uuid[]; snapshot jsonb;
BEGIN
 IF NOT private.onboarding_project_executor(_actor_id,_property_id) THEN RAISE EXCEPTION 'Only the current PM can request handoff.'; END IF;
 PERFORM private.lock_onboarding_readiness(_property_id);
 IF NOT private.onboarding_project_executor(_actor_id,_property_id) THEN RAISE EXCEPTION 'Project responsibility changed. Refresh before requesting handoff.'; END IF;
 SELECT * INTO home FROM properties WHERE id=_property_id;
 IF home.lifecycle_status IS DISTINCT FROM _expected_lifecycle OR home.handoff_accepted_at IS NOT NULL OR home.lifecycle_status NOT IN ('onboarding','handoff_corrections') THEN RAISE EXCEPTION 'The property changed. Refresh its handoff readiness.'; END IF;
 IF EXISTS(SELECT 1 FROM onboarding_projects WHERE property_id=home.id AND status<>'cancelled' AND status NOT IN('planning','active')) THEN RAISE EXCEPTION 'This project is not open for a handoff request.'; END IF;
 IF EXISTS(SELECT 1 FROM property_handoffs WHERE property_id=home.id AND status IN('requested','accepted_pending_live') AND archived_at IS NULL) THEN RAISE EXCEPTION 'A handoff is already in review for this home.'; END IF;
 snapshot:=private.onboarding_handoff_snapshot(home.id);
 IF _request->'snapshot' IS NULL OR private.comparable_onboarding_snapshot(snapshot) IS DISTINCT FROM private.comparable_onboarding_snapshot(_request->'snapshot') THEN RAISE EXCEPTION 'Readiness changed. Refresh and review it before requesting handoff.'; END IF;
 SELECT coalesce(array_agg(value::uuid ORDER BY value::uuid),'{}'::uuid[]) INTO open_ids FROM jsonb_array_elements_text(coalesce(_request->'openTaskIds','[]'::jsonb));
 SELECT coalesce(array_agg(value::uuid ORDER BY value::uuid),'{}'::uuid[]) INTO applicable_ids FROM jsonb_array_elements_text(coalesce(_request->'applicableTaskIds','[]'::jsonb));
 SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO expected_open FROM onboarding_tasks WHERE id=ANY(applicable_ids) AND property_id=home.id AND archived_at IS NULL AND status<>'complete';
 IF open_ids IS DISTINCT FROM expected_open THEN RAISE EXCEPTION 'The handoff must retain every applicable carryover item.'; END IF;
 IF cardinality(open_ids)>0 AND NOT coalesce((_request->>'carryoverAccepted')::boolean,false) THEN RAISE EXCEPTION 'Open handoff items require explicit accepted carryover.'; END IF;
 IF EXISTS(SELECT 1 FROM onboarding_tasks t WHERE id=ANY(open_ids) AND (assigned_to IS NULL OR due_on IS NULL OR length(trim(coalesce(carryover_reason,'')))=0)) THEN RAISE EXCEPTION 'Carryover needs an owner, a due date and a reason.'; END IF;
 IF EXISTS(SELECT 1 FROM onboarding_tasks t WHERE id=ANY(applicable_ids) AND (property_id IS DISTINCT FROM home.id OR archived_at IS NOT NULL
  OR (requires_owner_approval AND owner_approval_status<>'approved') OR (evidence_required AND length(trim(coalesce(evidence_note,'')))=0)
  OR length(trim(coalesce(blocker,'')))>0 OR (blocks_handoff AND status NOT IN('complete','carryover')))) THEN RAISE EXCEPTION 'Required work, approvals, evidence or blockers prevent handoff.'; END IF;
 IF EXISTS(SELECT 1 FROM property_fact_proposals WHERE property_id=home.id AND status='pending') THEN RAISE EXCEPTION 'Permanent property facts await review.'; END IF;
 IF EXISTS(SELECT 1 FROM (SELECT DISTINCT stage FROM onboarding_tasks WHERE id=ANY(applicable_ids)) t WHERE NOT EXISTS(
  SELECT 1 FROM jsonb_array_elements(snapshot->'stageCaptures') c WHERE c->>'stage'=t.stage AND c->>'status'='complete'
   AND c->'scopeSnapshot'=jsonb_build_object('modules',snapshot->'project'->'modules','furnishing_scope',snapshot->'project'->'furnishing_scope','director',snapshot->'project'->'director')
   AND c->'evidenceSnapshot'=private.onboarding_stage_evidence_snapshot(home.id,t.stage,c->'evidenceIds')
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(private.onboarding_stage_evidence_snapshot(home.id,t.stage,c->'evidenceIds')) evidence WHERE NOT(evidence->>'available')::boolean)
   AND c->'taskSnapshot'=(SELECT coalesce(jsonb_agg(to_jsonb(work) ORDER BY work.id),'[]'::jsonb) FROM onboarding_tasks work WHERE work.property_id=home.id AND work.stage=t.stage AND work.archived_at IS NULL))) THEN RAISE EXCEPTION 'Every applicable stage needs a Director review of its current work and scope.'; END IF;
 INSERT INTO property_handoffs(property_id,status,requested_by,checklist,validation,open_task_ids,carryover_accepted,gate_step,notes,is_demo)
 VALUES(home.id,'requested',_actor_id,_request->'checklist',coalesce(_request->'validation','{}'::jsonb)||jsonb_build_object('readinessSnapshot',snapshot),open_ids,
 cardinality(open_ids)>0,'kati_review',nullif(_request->>'notes',''),coalesce(home.is_demo,false)) RETURNING id INTO new_id;
 UPDATE properties SET lifecycle_status='handoff_requested' WHERE id=home.id;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_onboarding_handoff(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_onboarding_handoff(uuid,uuid,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.review_onboarding_handoff(
  _handoff_id uuid, _expected_step text, _decision text, _note text DEFAULT '', _exception text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE handoff public.property_handoffs%ROWTYPE; step_after text; status_after text; home_id uuid; snapshot jsonb; expected_snapshot jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to record a handoff review.'; END IF;
  SELECT property_id INTO home_id FROM property_handoffs WHERE id=_handoff_id AND archived_at IS NULL;
  IF home_id IS NULL THEN RAISE EXCEPTION 'That handoff is not available.'; END IF;
  IF NOT private.onboarding_gate_reviewer(auth.uid(),_expected_step) THEN RAISE EXCEPTION 'You do not have responsibility for this review gate.'; END IF;
  PERFORM private.lock_onboarding_readiness(home_id);
  SELECT * INTO handoff FROM public.property_handoffs WHERE id = _handoff_id AND property_id=home_id AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That handoff is not available.'; END IF;
  IF handoff.status NOT IN ('requested','accepted_pending_live') THEN RAISE EXCEPTION 'This handoff was already closed.'; END IF;
  IF handoff.gate_step <> _expected_step THEN RAISE EXCEPTION 'The handoff advanced. Refresh before reviewing the next gate.'; END IF;
  IF NOT private.onboarding_gate_reviewer(auth.uid(),handoff.gate_step) THEN RAISE EXCEPTION 'Review responsibility changed. Refresh before deciding.'; END IF;
  IF handoff.is_demo IS DISTINCT FROM (SELECT is_demo FROM properties WHERE id=home_id) THEN RAISE EXCEPTION 'Handoff property context changed.'; END IF;
  IF _decision IS NULL OR _decision NOT IN ('accepted','returned') THEN RAISE EXCEPTION 'Invalid review decision.'; END IF;
  IF _decision = 'returned' AND length(trim(_note)) < 3 THEN RAISE EXCEPTION 'Record the corrections needed.'; END IF;
  IF _decision='accepted' THEN
    IF EXISTS(SELECT 1 FROM properties WHERE id=home_id AND lifecycle_status<>'handoff_requested') OR EXISTS(
     SELECT 1 FROM onboarding_projects WHERE property_id=home_id AND status<>'cancelled' AND status NOT IN('planning','active','handoff')) THEN RAISE EXCEPTION 'The lifecycle changed. Return the handoff for corrections.'; END IF;
    snapshot:=private.onboarding_handoff_snapshot(home_id);
    expected_snapshot:=CASE WHEN handoff.gate_step='live_confirmation' THEN handoff.validation->'acceptedReadinessSnapshot' ELSE handoff.validation->'readinessSnapshot' END;
    IF expected_snapshot IS NULL OR private.comparable_onboarding_snapshot(snapshot) IS DISTINCT FROM private.comparable_onboarding_snapshot(expected_snapshot) THEN RAISE EXCEPTION 'The submitted readiness record changed. Return the handoff for corrections.'; END IF;
  END IF;
  step_after := CASE handoff.gate_step WHEN 'kati_review' THEN 'micah_review'
    WHEN 'micah_review' THEN 'operations_acceptance' WHEN 'operations_acceptance' THEN 'live_confirmation'
    WHEN 'live_confirmation' THEN 'complete' ELSE NULL END;
  IF step_after IS NULL THEN RAISE EXCEPTION 'Invalid handoff gate.'; END IF;
  INSERT INTO public.handoff_reviews(handoff_id, property_id, step, decision, reviewer_id, note, exception_reason, is_demo)
    VALUES (handoff.id, handoff.property_id, handoff.gate_step, _decision, auth.uid(), nullif(_note,''), nullif(_exception,''), handoff.is_demo);
  IF _decision = 'returned' THEN
    UPDATE public.property_handoffs SET status = 'returned', reviewed_by = auth.uid(), reviewed_at = now(), corrections = _note WHERE id = handoff.id;
    UPDATE public.properties SET lifecycle_status = 'handoff_corrections', handoff_accepted_at = NULL WHERE id = handoff.property_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'The property correction state could not be recorded.'; END IF;
    RETURN jsonb_build_object('ok', true, 'step', handoff.gate_step, 'status', 'returned', 'propertyId', handoff.property_id);
  END IF;
  status_after := CASE handoff.gate_step WHEN 'operations_acceptance' THEN 'accepted_pending_live'
    WHEN 'live_confirmation' THEN 'accepted' ELSE 'requested' END;
  UPDATE public.property_handoffs SET gate_step = step_after, status = status_after,
    exceptions = CASE WHEN length(_exception) > 0 THEN coalesce(exceptions,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('step',handoff.gate_step,'reason',_exception,'by',auth.uid(),'at',now())) ELSE exceptions END,
    kati_reviewer = CASE WHEN handoff.gate_step = 'kati_review' THEN auth.uid() ELSE kati_reviewer END,
    kati_decision = CASE WHEN handoff.gate_step = 'kati_review' THEN 'approved' ELSE kati_decision END,
    kati_note = CASE WHEN handoff.gate_step = 'kati_review' THEN _note ELSE kati_note END,
    kati_at = CASE WHEN handoff.gate_step = 'kati_review' THEN now() ELSE kati_at END,
    micah_reviewer = CASE WHEN handoff.gate_step = 'micah_review' THEN auth.uid() ELSE micah_reviewer END,
    micah_decision = CASE WHEN handoff.gate_step = 'micah_review' THEN 'approved' ELSE micah_decision END,
    micah_note = CASE WHEN handoff.gate_step = 'micah_review' THEN _note ELSE micah_note END,
    micah_at = CASE WHEN handoff.gate_step = 'micah_review' THEN now() ELSE micah_at END,
    accepted_by = CASE WHEN handoff.gate_step = 'operations_acceptance' THEN auth.uid() ELSE accepted_by END,
    accepted_at = CASE WHEN handoff.gate_step = 'operations_acceptance' THEN now() ELSE accepted_at END,
    reviewed_by = auth.uid(), reviewed_at = now(),
    live_confirmed_by = CASE WHEN handoff.gate_step = 'live_confirmation' THEN auth.uid() ELSE live_confirmed_by END,
    live_confirmed_at = CASE WHEN handoff.gate_step = 'live_confirmation' THEN now() ELSE live_confirmed_at END
  WHERE id = handoff.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'The handoff decision could not be recorded.'; END IF;
  IF handoff.gate_step = 'operations_acceptance' THEN
    UPDATE public.properties SET onboarding_stage = 'pending_live_confirmation', handoff_accepted_at = now() WHERE id = handoff.property_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Operations acceptance could not be recorded.'; END IF;
    UPDATE public.onboarding_tasks SET status = 'carryover' WHERE property_id = handoff.property_id
      AND id = ANY(handoff.open_task_ids) AND status IN ('open','blocked');
  END IF;
  IF handoff.gate_step='operations_acceptance' THEN
    UPDATE property_handoffs SET validation=coalesce(validation,'{}'::jsonb)||jsonb_build_object('acceptedReadinessSnapshot',private.onboarding_handoff_snapshot(home_id)) WHERE id=handoff.id;
  END IF;
  IF handoff.gate_step = 'live_confirmation' THEN
    UPDATE public.properties SET lifecycle_status = 'active_operations', active = true WHERE id = handoff.property_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Live confirmation could not be recorded.'; END IF;
    UPDATE public.onboarding_projects SET status = 'complete', completed_at = now()
      WHERE property_id = handoff.property_id AND status <> 'cancelled';
  END IF;
  RETURN jsonb_build_object('ok', true, 'step', handoff.gate_step, 'status', status_after, 'propertyId', handoff.property_id);
END $$;
REVOKE ALL ON FUNCTION public.review_onboarding_handoff(uuid, text, text, text, text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_onboarding_handoff(uuid, text, text, text, text) TO authenticated;
-- Authenticated clients cannot write a decision/history row independently of
-- its verified transaction. Internal readers retain their existing policies.
DROP POLICY "Onboarding staff request handoffs" ON public.property_handoffs;
DROP POLICY "Supervisors review handoffs" ON public.property_handoffs;
DROP POLICY "Reviewers record decisions" ON public.handoff_reviews;
REVOKE INSERT,UPDATE,DELETE ON public.property_handoffs FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.handoff_reviews FROM authenticated;

CREATE FUNCTION public.protect_onboarding_gate_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE onboarding_context boolean;
BEGIN
 IF current_user IN('postgres','service_role') THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='onboarding_projects' THEN
  IF TG_OP='INSERT' THEN
   IF NEW.status NOT IN('planning','active') OR NEW.completed_at IS NOT NULL THEN RAISE EXCEPTION 'Use the handoff review chain to complete an Onboarding Project.'; END IF;
  ELSIF NEW.completed_at IS DISTINCT FROM OLD.completed_at OR
   (NEW.status IS DISTINCT FROM OLD.status AND (NEW.status IN('handoff','complete') OR OLD.status IN('handoff','complete') OR EXISTS(
     SELECT 1 FROM property_handoffs h WHERE h.property_id=OLD.property_id AND h.status IN('requested','accepted_pending_live') AND h.archived_at IS NULL))) THEN
   RAISE EXCEPTION 'Use the handoff review chain to change this project lifecycle.';
  END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.handoff_accepted_at IS NOT NULL OR NEW.lifecycle_status IN('handoff_requested','handoff_corrections') THEN RAISE EXCEPTION 'Use the handoff review chain to record acceptance.'; END IF;
  RETURN NEW;
 END IF;
 SELECT EXISTS(SELECT 1 FROM onboarding_projects p WHERE p.property_id=OLD.id AND p.status<>'cancelled') INTO onboarding_context;
 IF NEW.handoff_accepted_at IS DISTINCT FROM OLD.handoff_accepted_at OR
   (onboarding_context AND NEW.onboarding_stage IS DISTINCT FROM OLD.onboarding_stage) OR
   (onboarding_context AND NEW.active AND NEW.active IS DISTINCT FROM OLD.active AND OLD.lifecycle_status<>'active_operations') OR
   (onboarding_context AND NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status AND
    (OLD.handoff_accepted_at IS NOT NULL OR OLD.lifecycle_status IN('handoff_requested','handoff_corrections','active_operations') OR NEW.lifecycle_status IN('handoff_requested','handoff_corrections','active_operations'))) THEN
  RAISE EXCEPTION 'Use stage capture and the handoff review chain for this transition.';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_onboarding_gate_fields() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER protect_onboarding_gate_fields BEFORE INSERT OR UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.protect_onboarding_gate_fields();
CREATE TRIGGER protect_onboarding_project_gate_fields BEFORE INSERT OR UPDATE ON public.onboarding_projects FOR EACH ROW EXECUTE FUNCTION public.protect_onboarding_gate_fields();

-- The narrow helper checks lifecycle under a lock without requiring owner
-- approval writers to regain raw Property SELECT access.
CREATE FUNCTION private.onboarding_work_locked(_properties uuid[]) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE home properties%ROWTYPE;
BEGIN
 FOR home IN SELECT * FROM properties WHERE id=ANY(_properties) ORDER BY id FOR SHARE LOOP
  IF home.handoff_accepted_at IS NOT NULL OR home.lifecycle_status='handoff_requested' OR EXISTS(
   SELECT 1 FROM property_handoffs h WHERE h.property_id=home.id AND h.status IN('requested','accepted_pending_live') AND h.archived_at IS NULL) THEN RETURN true; END IF;
 END LOOP;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION private.onboarding_work_locked(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.onboarding_work_locked(uuid[]) TO authenticated,service_role;
CREATE FUNCTION public.protect_handoff_task_state() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE old_property uuid; new_property uuid;
BEGIN
 IF current_user IN('postgres','service_role') THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_OP<>'INSERT' THEN old_property:=OLD.property_id; END IF;
 IF TG_OP<>'DELETE' THEN new_property:=NEW.property_id; END IF;
 IF private.onboarding_work_locked(ARRAY[old_property,new_property]) THEN
  RAISE EXCEPTION 'Return the handoff before changing its onboarding work; accepted work is retained in history.';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE ALL ON FUNCTION public.protect_handoff_task_state() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER protect_handoff_task_state BEFORE INSERT OR UPDATE OR DELETE ON public.onboarding_tasks FOR EACH ROW EXECUTE FUNCTION public.protect_handoff_task_state();
