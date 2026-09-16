-- Independent launch readiness reuses current project/task links and the recorded
-- authority policy. Accounting settlement does not gate operational Live.
CREATE FUNCTION private.onboarding_independent_readiness(_property uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH project AS (SELECT p.* FROM onboarding_projects p WHERE p.property_id=_property AND p.status<>'cancelled'),
 tasks AS (SELECT t.* FROM onboarding_tasks t WHERE t.property_id=_property AND t.archived_at IS NULL),
 home AS (SELECT * FROM properties WHERE id=_property AND archived_at IS NULL),
 financial AS (
 SELECT f.*,a.status approval_status,a.entity_type approval_entity_type,a.entity_id approval_entity_id,
 a.property_id approval_property_id,a.amount approval_amount,a.approver_role,a.is_demo approval_is_demo,a.decided_at,
 CASE WHEN f.status IN('cancelled','declined') THEN NULL
 WHEN f.estimate_amount IS NULL OR f.estimate_amount<0 OR f.estimate_amount::text IN('NaN','Infinity','-Infinity') THEN 'Record a valid estimate and its authority before launch.'
 WHEN f.authority_tier='proceed' THEN NULL
 WHEN f.authority_tier='emergency' THEN CASE WHEN f.emergency AND length(trim(coalesce(f.emergency_reason,'')))>0 THEN NULL ELSE 'Record the emergency authority and reason before launch.' END
 WHEN f.authority_tier IN('owner','supervisor') THEN CASE WHEN f.approved_at IS NOT NULL AND f.approved_amount>=0 AND f.approved_amount::text NOT IN('NaN','Infinity','-Infinity')
  AND a.status='approved' AND a.entity_type='financial_request' AND a.entity_id=f.id AND a.property_id=f.property_id AND a.approver_role=f.authority_tier AND a.amount=f.estimate_amount AND a.is_demo=f.is_demo THEN NULL
  ELSE CASE WHEN f.authority_tier='owner' THEN 'The homeowner decision for this cost is missing or no longer matches its canonical approval.' ELSE 'The supervisor decision for this cost is missing or no longer matches its canonical approval.' END END
 ELSE 'Review the recorded financial authority before launch.' END issue
 FROM financial_requests f JOIN home ON f.property_id=home.id AND f.is_demo=home.is_demo JOIN project ON
 (f.project_id=project.id OR (f.project_id IS NULL AND f.task_id IN(SELECT id FROM tasks)))
 LEFT JOIN approvals a ON a.id=f.approval_id
 ),
 field_work AS (
 SELECT w.id,w.title,'work_order'::text source_type,w.ticket_id,
 ARRAY(SELECT t.id FROM tasks t WHERE t.linked_ticket_id=w.ticket_id OR EXISTS(SELECT 1 FROM breezeway_outbound_tasks b WHERE b.work_order_id=w.id AND b.onboarding_task_id=t.id) ORDER BY t.id) task_ids,
 jsonb_build_object('closed_at',w.closed_at,'property_id',w.property_id,'is_demo',w.is_demo) receipt,
 CASE WHEN w.closed_at IS NULL THEN 'This linked Resolve Work Order is still open; confirm completion or retain its task as explicit carryover.' END issue
 FROM work_orders w JOIN home ON w.property_id=home.id AND w.is_demo=home.is_demo WHERE EXISTS(SELECT 1 FROM tasks t WHERE t.linked_ticket_id=w.ticket_id OR EXISTS(SELECT 1 FROM breezeway_outbound_tasks b WHERE b.work_order_id=w.id AND b.onboarding_task_id=t.id))
 UNION ALL
 SELECT b.id,b.title,'breezeway_outbound',b.ticket_id,
 ARRAY(SELECT t.id FROM tasks t WHERE t.id=b.onboarding_task_id OR t.linked_ticket_id=b.ticket_id ORDER BY t.id),
 jsonb_build_object('property_id',b.property_id,'work_order_id',b.work_order_id,'breezeway_task_id',b.breezeway_task_id,'delivery',CASE WHEN b.status IN('error','abandoned') THEN 'not_created' WHEN b.status IN('created','synced') THEN 'created' ELSE b.status END,
 'mirror_id',m.id,'mirror_property_id',m.property_id,'field_state',lower(coalesce(m.stage,m.status,''))),
 CASE WHEN b.status IN('error','abandoned') THEN NULL WHEN b.status IN('created','synced') AND m.property_id=_property AND lower(coalesce(m.stage,m.status,'')) IN('closed','approved','deleted','cancelled','canceled','finished') THEN NULL
 WHEN b.status IN('creating','needs_review') THEN 'This field-work dispatch is unresolved; review its actual result or retain its task as explicit carryover.'
 ELSE 'Breezeway delivery is recorded, but linked field completion is not confirmed; complete it or retain its task as explicit carryover.' END
 FROM breezeway_outbound_tasks b JOIN home ON b.property_id=home.id AND NOT home.is_demo
 LEFT JOIN breezeway_work_orders m ON m.breezeway_task_id=b.breezeway_task_id
 WHERE b.work_order_id IS NULL AND EXISTS(SELECT 1 FROM tasks t WHERE t.id=b.onboarding_task_id OR t.linked_ticket_id=b.ticket_id)
 UNION ALL
 SELECT m.id,m.name,'breezeway_work_order',m.linked_ticket_id,
 ARRAY(SELECT t.id FROM tasks t WHERE t.linked_ticket_id=m.linked_ticket_id ORDER BY t.id),
 jsonb_build_object('property_id',m.property_id,'breezeway_task_id',m.breezeway_task_id,'field_state',lower(coalesce(m.stage,m.status,''))),
 CASE WHEN lower(coalesce(m.stage,m.status,'')) IN('closed','approved','deleted','cancelled','canceled','finished') THEN NULL ELSE 'The linked Breezeway field work is still current; complete it or retain its task as explicit carryover.' END
 FROM breezeway_work_orders m JOIN home ON m.property_id=home.id AND NOT home.is_demo
 WHERE EXISTS(SELECT 1 FROM tasks t WHERE t.linked_ticket_id=m.linked_ticket_id)
 AND NOT EXISTS(SELECT 1 FROM work_orders w WHERE w.property_id=_property AND w.ticket_id=m.linked_ticket_id AND w.is_demo=false)
 AND NOT EXISTS(SELECT 1 FROM breezeway_outbound_tasks b WHERE b.property_id=_property AND b.breezeway_task_id=m.breezeway_task_id)
 )
 SELECT jsonb_build_object('propertyId',_property,'pendingFacts',(SELECT count(*) FROM property_fact_proposals WHERE property_id=_property AND status='pending'),
 'financials',coalesce((SELECT jsonb_agg(jsonb_build_object('id',f.id,'title',f.title,'taskIds',CASE WHEN f.task_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(f.task_id) END,'issue',f.issue,
 'receipt',jsonb_build_object('property_id',f.property_id,'project_id',f.project_id,'is_demo',f.is_demo,'authority_tier',f.authority_tier,'authority_policy',to_jsonb(f)->'authority_policy',
 'estimate_amount',f.estimate_amount,'emergency',f.emergency,'emergency_reason',f.emergency_reason,'approval_id',f.approval_id,'approved_amount',f.approved_amount,'approved_at',f.approved_at,
 'approval_amount',f.approval_amount,'approval_status',f.approval_status,'approval_entity_type',f.approval_entity_type,'approval_entity_id',f.approval_entity_id,'approval_property_id',f.approval_property_id,'approver_role',f.approver_role,'approval_is_demo',f.approval_is_demo,'decided_at',f.decided_at,
 'active',f.status NOT IN('cancelled','declined'))) ORDER BY f.id) FROM financial f),'[]'::jsonb),
 'fieldWork',coalesce((SELECT jsonb_agg(jsonb_build_object('id',w.id,'title',w.title,'sourceType',w.source_type,'ticketId',w.ticket_id,'taskIds',to_jsonb(w.task_ids),'issue',w.issue,'receipt',w.receipt) ORDER BY w.source_type,w.id) FROM field_work w),'[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION private.onboarding_independent_readiness(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.onboarding_independent_readiness(uuid) TO service_role;

CREATE FUNCTION public.read_onboarding_independent_readiness(_property_ids uuid[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(private.onboarding_independent_readiness(p.id) ORDER BY p.id),'[]'::jsonb)
 FROM properties p WHERE p.id=ANY(_property_ids) AND p.archived_at IS NULL AND (
 private.onboarding_project_executor(auth.uid(),p.id) OR private.onboarding_gate_reviewer(auth.uid(),'kati_review') OR
 private.onboarding_gate_reviewer(auth.uid(),'micah_review') OR private.onboarding_gate_reviewer(auth.uid(),'operations_acceptance'))
$$;
REVOKE ALL ON FUNCTION public.read_onboarding_independent_readiness(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_onboarding_independent_readiness(uuid[]) TO authenticated;

CREATE FUNCTION private.assert_onboarding_independent_ready(_snapshot jsonb,_applicable uuid[],_carryover uuid[]) RETURNS void
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE row jsonb;
BEGIN
 IF _snapshot IS NULL THEN RAISE EXCEPTION 'Independent readiness is unavailable. Refresh before requesting handoff.'; END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(_snapshot->'financials') LOOP
  IF row->>'issue' IS NOT NULL AND (jsonb_array_length(row->'taskIds')=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(row->'taskIds') id WHERE id::uuid=ANY(_applicable))) THEN
   RAISE EXCEPTION 'Financial readiness blocked: % — %',row->>'title',row->>'issue';
  END IF;
 END LOOP;
 FOR row IN SELECT value FROM jsonb_array_elements(_snapshot->'fieldWork') LOOP
  IF row->>'issue' IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(row->'taskIds') id WHERE id::uuid=ANY(_applicable) AND NOT id::uuid=ANY(_carryover)) THEN
   RAISE EXCEPTION 'Field readiness blocked: % — %',row->>'title',row->>'issue';
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.assert_onboarding_independent_ready(jsonb,uuid[],uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.assert_onboarding_independent_ready(jsonb,uuid[],uuid[]) TO service_role;

-- All existing source writers, including integrations, serialize their relevant
-- changes with readiness. They remain able to progress legitimate work; a later
-- review sees the changed snapshot and requires return/review instead of approving
-- an old record. Accounting-only fields are excluded from the launch snapshot.
CREATE FUNCTION private.lock_onboarding_independent_source() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prior jsonb:=CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
 next_row jsonb:=CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) ELSE '{}'::jsonb END;
BEGIN
 PERFORM p.id FROM properties p WHERE p.id IN (
  SELECT nullif(value,'')::uuid FROM jsonb_array_elements_text(jsonb_build_array(prior->>'property_id',next_row->>'property_id')) ref(value) WHERE value IS NOT NULL
  UNION SELECT t.property_id FROM onboarding_tasks t WHERE t.id IN(nullif(prior->>'onboarding_task_id','')::uuid,nullif(next_row->>'onboarding_task_id','')::uuid,nullif(prior->>'task_id','')::uuid,nullif(next_row->>'task_id','')::uuid)
  UNION SELECT t.property_id FROM tickets t WHERE t.id IN(nullif(prior->>'ticket_id','')::uuid,nullif(next_row->>'ticket_id','')::uuid,nullif(prior->>'linked_ticket_id','')::uuid,nullif(next_row->>'linked_ticket_id','')::uuid)
 ) ORDER BY p.id FOR SHARE;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.lock_onboarding_independent_source() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER serialize_onboarding_financial_readiness BEFORE INSERT OR UPDATE OR DELETE ON financial_requests FOR EACH ROW EXECUTE FUNCTION private.lock_onboarding_independent_source();
CREATE TRIGGER serialize_onboarding_approval_readiness BEFORE INSERT OR UPDATE OR DELETE ON approvals FOR EACH ROW EXECUTE FUNCTION private.lock_onboarding_independent_source();
CREATE TRIGGER serialize_onboarding_work_order_readiness BEFORE INSERT OR UPDATE OR DELETE ON work_orders FOR EACH ROW EXECUTE FUNCTION private.lock_onboarding_independent_source();
CREATE TRIGGER serialize_onboarding_outbound_readiness BEFORE INSERT OR UPDATE OR DELETE ON breezeway_outbound_tasks FOR EACH ROW EXECUTE FUNCTION private.lock_onboarding_independent_source();
CREATE TRIGGER serialize_onboarding_field_mirror_readiness BEFORE INSERT OR UPDATE OR DELETE ON breezeway_work_orders FOR EACH ROW EXECUTE FUNCTION private.lock_onboarding_independent_source();

CREATE OR REPLACE FUNCTION private.onboarding_handoff_snapshot(_property uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('independentReadiness',private.onboarding_independent_readiness(home.id),'property',to_jsonb(home),'project',(
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

CREATE OR REPLACE FUNCTION private.lock_onboarding_readiness(_property uuid) RETURNS void
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
 PERFORM id FROM financial_requests WHERE property_id=_property ORDER BY id FOR UPDATE;
 PERFORM a.id FROM approvals a WHERE a.id IN(SELECT approval_id FROM financial_requests WHERE property_id=_property) ORDER BY a.id FOR UPDATE;
 PERFORM id FROM work_orders WHERE property_id=_property ORDER BY id FOR UPDATE;
 PERFORM b.id FROM breezeway_outbound_tasks b WHERE b.property_id=_property OR b.onboarding_task_id IN(SELECT id FROM onboarding_tasks WHERE property_id=_property) ORDER BY b.id FOR UPDATE;
 PERFORM id FROM breezeway_work_orders WHERE property_id=_property ORDER BY id FOR UPDATE;
END $$;
REVOKE ALL ON FUNCTION private.lock_onboarding_readiness(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.lock_onboarding_readiness(uuid) TO service_role;

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
 PERFORM private.assert_onboarding_independent_ready(snapshot->'independentReadiness',applicable_ids,open_ids);
 INSERT INTO property_handoffs(property_id,status,requested_by,checklist,validation,open_task_ids,carryover_accepted,gate_step,notes,is_demo)
 VALUES(home.id,'requested',_actor_id,_request->'checklist',coalesce(_request->'validation','{}'::jsonb)||jsonb_build_object('readinessSnapshot',snapshot),open_ids,
 cardinality(open_ids)>0,'kati_review',nullif(_request->>'notes',''),coalesce(home.is_demo,false)) RETURNING id INTO new_id;
 UPDATE properties SET lifecycle_status='handoff_requested' WHERE id=home.id;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_onboarding_handoff(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_onboarding_handoff(uuid,uuid,text,jsonb) TO service_role;
-- Policy setting creation/update and cost creation share one transaction lock.
CREATE FUNCTION private.serialize_onboarding_policy() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF (TG_OP<>'INSERT' AND OLD.key='onboarding_authority_policy') OR (TG_OP<>'DELETE' AND NEW.key='onboarding_authority_policy') THEN PERFORM pg_advisory_xact_lock(hashtext('onboarding_authority_policy')); END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.serialize_onboarding_policy() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER serialize_onboarding_policy BEFORE INSERT OR UPDATE OR DELETE ON app_settings FOR EACH ROW EXECUTE FUNCTION private.serialize_onboarding_policy();

CREATE FUNCTION public.create_onboarding_financial_request(_actor_id uuid,_property_id uuid,_request jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE home properties%ROWTYPE; project onboarding_projects%ROWTYPE; request financial_requests%ROWTYPE;
 policy jsonb:=_request->'authority_policy'; stored jsonb; estimate numeric; tier text; emergency boolean; task_id uuid;
BEGIN
 IF NOT private.onboarding_assignment_staff(_actor_id) THEN RAISE EXCEPTION 'Only enabled Onboarding staff can create a financial request.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('onboarding_authority_policy'));
 SELECT value INTO stored FROM app_settings WHERE key='onboarding_authority_policy' FOR SHARE;
 IF coalesce(stored,'null'::jsonb) IS DISTINCT FROM coalesce(_request->'expected_policy','null'::jsonb) THEN RAISE EXCEPTION 'The authority policy changed. Refresh before creating this cost request.'; END IF;
 IF policy IS NULL OR jsonb_typeof(policy)<>'object' OR length(trim(coalesce(policy->>'version','')))=0 OR jsonb_typeof(policy->'supervisorApprovalThreshold') IS DISTINCT FROM 'number' OR jsonb_typeof(policy->'ownerApprovalThreshold') IS DISTINCT FROM 'number'
 OR (policy->>'supervisorApprovalThreshold')::numeric<0 OR (policy->>'ownerApprovalThreshold')::numeric<(policy->>'supervisorApprovalThreshold')::numeric OR (policy->>'ownerApprovalThreshold')::numeric>1000000 THEN RAISE EXCEPTION 'The recorded authority policy is invalid.'; END IF;
 IF stored IS NOT NULL AND policy IS DISTINCT FROM jsonb_build_object('version',trim(stored->>'version'),'supervisorApprovalThreshold',(stored->>'supervisorApprovalThreshold')::numeric,'ownerApprovalThreshold',(stored->>'ownerApprovalThreshold')::numeric) THEN RAISE EXCEPTION 'The authority policy snapshot does not match its source.'; END IF;
 -- A missing setting uses the baseline resolved by the trusted server, never an
 -- unprivileged caller. The locked absence check prevents a policy-creation race.
 estimate:=(_request->>'estimate_amount')::numeric; emergency:=coalesce((_request->>'emergency')::boolean,false);
 IF estimate IS NULL OR estimate<0 OR estimate>1000000 OR estimate::text IN('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Enter a valid estimate.'; END IF;
 IF emergency AND length(trim(coalesce(_request->>'emergency_reason','')))=0 THEN RAISE EXCEPTION 'Record the emergency authority reason.'; END IF;
 tier:=CASE WHEN emergency THEN 'emergency' WHEN estimate<(policy->>'supervisorApprovalThreshold')::numeric THEN 'proceed' WHEN estimate<=(policy->>'ownerApprovalThreshold')::numeric THEN 'supervisor' ELSE 'owner' END;
 SELECT * INTO project FROM onboarding_projects WHERE property_id=_property_id AND status<>'cancelled' FOR SHARE;
 SELECT * INTO home FROM properties WHERE id=_property_id AND archived_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'That property is not available.'; END IF;
 IF project.id IS NOT NULL AND project.is_demo IS DISTINCT FROM home.is_demo THEN RAISE EXCEPTION 'The project property context changed.'; END IF;
 task_id:=nullif(_request->>'task_id','')::uuid;
 IF task_id IS NOT NULL THEN
  PERFORM id FROM onboarding_tasks WHERE id=task_id AND property_id=_property_id AND archived_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That task is not available for this property.'; END IF;
 END IF;
 IF length(trim(coalesce(_request->>'title','')))<3 THEN RAISE EXCEPTION 'Enter a cost request title.'; END IF;
 INSERT INTO financial_requests(property_id,project_id,task_id,kind,title,vendor,description,estimate_amount,authority_tier,authority_policy,emergency,emergency_reason,status,created_by,is_demo)
 VALUES(home.id,project.id,task_id,coalesce(nullif(_request->>'kind',''),'other'),trim(_request->>'title'),nullif(_request->>'vendor',''),nullif(_request->>'description',''),estimate,tier,policy,emergency,nullif(_request->>'emergency_reason',''),'estimate',_actor_id,home.is_demo) RETURNING * INTO request;
 IF project.id IS NOT NULL THEN
  INSERT INTO onboarding_project_events(project_id,property_id,kind,summary,detail,new_value,actor,is_demo)
  VALUES(project.id,home.id,'financial_request_created',request.title||' — estimate recorded',tier,jsonb_build_object('requestId',request.id,'estimate',estimate,'authorityPolicy',policy)::text,_actor_id,home.is_demo);
 END IF;
 RETURN to_jsonb(request);
END $$;
REVOKE ALL ON FUNCTION public.create_onboarding_financial_request(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_onboarding_financial_request(uuid,uuid,jsonb) TO service_role;
REVOKE INSERT,DELETE ON financial_requests FROM authenticated;

CREATE FUNCTION private.can_record_onboarding_financial_decision(_actor uuid,_property uuid,_tier text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(private.onboarding_assignment_staff(_actor) AND CASE _tier
 WHEN 'supervisor' THEN public.has_role(_actor,'admin') OR _actor=private.current_onboarding_review_seat('director_ops') OR _actor=private.current_onboarding_review_seat('ops_supervisor')
 WHEN 'owner' THEN private.onboarding_project_executor(_actor,_property) OR private.onboarding_gate_reviewer(_actor,'kati_review') ELSE false END,false)
$$;
REVOKE ALL ON FUNCTION private.can_record_onboarding_financial_decision(uuid,uuid,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.decide_onboarding_financial_request(_request_id uuid,_approved boolean,_note text,_approved_amount numeric DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE request financial_requests%ROWTYPE; approval approvals%ROWTYPE; home properties%ROWTYPE; amount numeric; source_property uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT private.onboarding_assignment_staff(auth.uid()) THEN RAISE EXCEPTION 'Only enabled Onboarding staff can record this decision.'; END IF;
 IF _approved IS NULL OR length(trim(coalesce(_note,'')))<3 THEN RAISE EXCEPTION 'Record who decided and the evidence for their answer.'; END IF;
 SELECT property_id INTO source_property FROM financial_requests WHERE id=_request_id;
 SELECT * INTO home FROM properties WHERE id=source_property AND archived_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'That request property is not available.'; END IF;
 SELECT * INTO request FROM financial_requests WHERE id=_request_id AND property_id=home.id FOR UPDATE;
 IF NOT FOUND OR request.is_demo IS DISTINCT FROM home.is_demo THEN RAISE EXCEPTION 'That request is not available.'; END IF;
 IF NOT private.can_record_onboarding_financial_decision(auth.uid(),home.id,request.authority_tier) THEN RAISE EXCEPTION 'You do not hold the responsibility required for this financial decision.'; END IF;
 IF request.status IS DISTINCT FROM 'awaiting_approval' OR request.approval_id IS NULL OR request.approved_amount IS NOT NULL OR request.approved_at IS NOT NULL THEN RAISE EXCEPTION 'Prepare a canonical pending approval before recording its decision.'; END IF;
 SELECT * INTO approval FROM approvals WHERE id=request.approval_id FOR UPDATE;
 IF NOT FOUND OR approval.status IS DISTINCT FROM 'pending' OR approval.entity_type IS DISTINCT FROM 'financial_request' OR approval.entity_id IS DISTINCT FROM request.id OR approval.property_id IS DISTINCT FROM home.id OR approval.approver_role IS DISTINCT FROM request.authority_tier OR approval.is_demo IS DISTINCT FROM request.is_demo OR approval.amount IS DISTINCT FROM request.estimate_amount THEN RAISE EXCEPTION 'The canonical approval changed. Refresh before recording its decision.'; END IF;
 IF request.authority_tier='owner' AND NOT (
  (approval.approver_id IS NOT NULL AND private.owner_current_property_for_actor(approval.approver_id,home.id,NULL)) OR
  (approval.owner_email_sent_at IS NOT NULL AND length(trim(coalesce(approval.owner_email_to,'')))>0 AND EXISTS(
   SELECT 1 FROM property_owners o WHERE o.id=home.owner_record_id AND o.active AND lower(trim(o.email))=lower(trim(approval.owner_email_to))))) THEN
  RAISE EXCEPTION 'This approval needs a current canonical owner recipient or a recorded delivery to that owner before staff can transcribe the answer.';
 END IF;
 amount:=CASE WHEN _approved THEN coalesce(_approved_amount,request.estimate_amount) ELSE NULL END;
 IF _approved AND (amount IS NULL OR amount<0 OR amount>approval.amount OR amount>1000000 OR amount::text IN('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Enter a valid approved amount.'; END IF;
 UPDATE approvals SET status=CASE WHEN _approved THEN 'approved' ELSE 'declined' END,decision_note=trim(_note),decided_at=now() WHERE id=approval.id;
 UPDATE financial_requests SET status=CASE WHEN _approved THEN 'approved' ELSE 'declined' END,approved_amount=amount,approved_at=CASE WHEN _approved THEN now() ELSE NULL END,updated_at=now() WHERE id=request.id;
 IF request.project_id IS NOT NULL THEN
  INSERT INTO onboarding_project_events(project_id,property_id,kind,summary,detail,prior_value,new_value,actor,is_demo)
  VALUES(request.project_id,request.property_id,'financial_decision',request.title||' — '||CASE WHEN _approved THEN 'approved' ELSE 'declined' END,trim(_note),request.approved_amount::text,amount::text,auth.uid(),request.is_demo);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.decide_onboarding_financial_request(uuid,boolean,text,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.decide_onboarding_financial_request(uuid,boolean,text,numeric) TO authenticated;

CREATE FUNCTION public.protect_onboarding_financial_decision() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF current_user IN('postgres','service_role') THEN IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
 IF TG_TABLE_NAME='financial_requests' THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preserve the financial request and its decision history.'; END IF;
  IF TG_OP='INSERT' OR (to_jsonb(NEW)->'authority_policy',NEW.authority_tier,NEW.estimate_amount,NEW.emergency,NEW.emergency_reason,NEW.property_id,NEW.project_id,NEW.task_id,NEW.is_demo,NEW.approved_amount,NEW.approved_at)
    IS DISTINCT FROM (to_jsonb(OLD)->'authority_policy',OLD.authority_tier,OLD.estimate_amount,OLD.emergency,OLD.emergency_reason,OLD.property_id,OLD.project_id,OLD.task_id,OLD.is_demo,OLD.approved_amount,OLD.approved_at)
    OR (NEW.status IS DISTINCT FROM OLD.status AND (NEW.status IN('approved','declined') OR OLD.status IN('awaiting_approval','declined') AND NEW.status NOT IN('awaiting_approval','cancelled'))) THEN
   RAISE EXCEPTION 'Use the controlled financial request and decision actions.';
  END IF;
  IF NEW.status IN('invoiced','sent_to_accounting','settled') AND NOT coalesce(
   NEW.authority_tier='proceed' OR (NEW.authority_tier='emergency' AND NEW.emergency AND length(trim(coalesce(NEW.emergency_reason,'')))>0)
   OR (NEW.authority_tier IN('owner','supervisor') AND NEW.approved_at IS NOT NULL AND NEW.approved_amount>=0
    AND NEW.approved_amount::text NOT IN('NaN','Infinity','-Infinity') AND EXISTS(
     SELECT 1 FROM approvals a WHERE a.id=NEW.approval_id AND a.status='approved' AND a.entity_type='financial_request'
      AND a.entity_id=NEW.id AND a.property_id=NEW.property_id AND a.approver_role=NEW.authority_tier
      AND a.amount=NEW.estimate_amount AND a.is_demo=NEW.is_demo)),false) THEN
   RAISE EXCEPTION 'Record the required canonical authority decision before invoicing or accounting.';
  END IF;
 ELSIF (TG_OP<>'INSERT' AND OLD.entity_type='financial_request') OR (TG_OP<>'DELETE' AND NEW.entity_type='financial_request') THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preserve the financial approval and its decision history.'; END IF;
  IF (TG_OP='INSERT' AND (NEW.status IS DISTINCT FROM 'pending' OR NEW.decided_at IS NOT NULL)) OR
   (TG_OP='UPDATE' AND (NEW.status,NEW.decided_at,NEW.decision_note,NEW.entity_type,NEW.entity_id,NEW.property_id,NEW.approver_role,NEW.amount,NEW.is_demo) IS DISTINCT FROM (OLD.status,OLD.decided_at,OLD.decision_note,OLD.entity_type,OLD.entity_id,OLD.property_id,OLD.approver_role,OLD.amount,OLD.is_demo)) THEN RAISE EXCEPTION 'Use the controlled financial decision action.'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_onboarding_financial_decision() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER protect_onboarding_financial_decision BEFORE INSERT OR UPDATE OR DELETE ON financial_requests FOR EACH ROW EXECUTE FUNCTION public.protect_onboarding_financial_decision();
CREATE TRIGGER protect_onboarding_financial_approval BEFORE INSERT OR UPDATE OR DELETE ON approvals FOR EACH ROW EXECUTE FUNCTION public.protect_onboarding_financial_decision();


-- Direct maintenance/service writes must respect retained handoff state.
-- Only the table-owner context of checked transaction functions may change it.
CREATE OR REPLACE FUNCTION public.protect_onboarding_gate_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE onboarding_context boolean;
BEGIN
 IF current_user=(SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=TG_RELID) THEN RETURN NEW; END IF;
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


-- Direct maintenance/service writes must respect retained handoff state.
-- Only the table-owner context of checked transaction functions may change it.
CREATE OR REPLACE FUNCTION public.protect_handoff_task_state() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE old_property uuid; new_property uuid;
BEGIN
 IF current_user=(SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=TG_RELID) THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_OP<>'INSERT' THEN old_property:=OLD.property_id; END IF;
 IF TG_OP<>'DELETE' THEN new_property:=NEW.property_id; END IF;
 IF private.onboarding_work_locked(ARRAY[old_property,new_property]) THEN
  RAISE EXCEPTION 'Return the handoff before changing its onboarding work; accepted work is retained in history.';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

-- The service-only request function validates the actor, readiness and every gate
-- under locks before entering the trusted lifecycle write context.
ALTER FUNCTION public.create_onboarding_handoff(uuid,uuid,text,jsonb) SECURITY DEFINER;
-- Fail fast when checked lifecycle writers would not enter the protected table
-- owner's context. No deployment may silently leave a partially trusted chain.
DO $$
DECLARE expected_owner oid; writer_owner oid; writer regprocedure;
BEGIN
 SELECT relowner INTO expected_owner FROM pg_class WHERE oid='public.properties'::regclass;
 IF pg_get_userbyid(expected_owner) IN('anon','authenticated','service_role') OR EXISTS(
  SELECT 1 FROM pg_class WHERE oid IN('public.onboarding_projects'::regclass,'public.onboarding_tasks'::regclass) AND relowner<>expected_owner) THEN
  RAISE EXCEPTION 'Onboarding gate tables require one trusted migration owner.';
 END IF;
 FOREACH writer IN ARRAY ARRAY['public.create_onboarding_handoff(uuid,uuid,text,jsonb)'::regprocedure,'public.review_onboarding_handoff(uuid,text,text,text,text)'::regprocedure] LOOP
  SELECT proowner INTO writer_owner FROM pg_proc WHERE oid=writer AND prosecdef;
  IF writer_owner IS DISTINCT FROM expected_owner THEN RAISE EXCEPTION 'Onboarding lifecycle writer ownership is not aligned: %',writer; END IF;
 END LOOP;
END $$;
-- The existing delivery claim remains the retry boundary; validate its recipient
-- against canonical identity under locks before any external email is attempted.
CREATE FUNCTION private.guard_onboarding_owner_recipient() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE home properties%ROWTYPE; recipient property_owners%ROWTYPE; claim jsonb;
 new_in_app boolean:=NEW.approver_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.approver_id IS DISTINCT FROM OLD.approver_id);
 new_claim boolean:=coalesce(NEW.onboarding_delivery_attempt->>'state','')='sending' AND (TG_OP='INSERT' OR NEW.onboarding_delivery_attempt IS DISTINCT FROM OLD.onboarding_delivery_attempt);
 recorded_email boolean:=NEW.owner_email_sent_at IS NOT NULL AND (TG_OP='INSERT' OR (NEW.owner_email_to,NEW.owner_email_sent_at) IS DISTINCT FROM (OLD.owner_email_to,OLD.owner_email_sent_at));
BEGIN
 IF NEW.entity_type NOT IN('financial_request','onboarding_task') OR NEW.approver_role IS DISTINCT FROM 'owner' OR NOT(new_in_app OR new_claim OR recorded_email) THEN RETURN NEW; END IF;
 PERFORM 1 FROM auth.users WHERE id=auth.uid() FOR SHARE NOWAIT;
 PERFORM 1 FROM user_roles WHERE user_id=auth.uid() FOR SHARE NOWAIT;
 IF NEW.status IS DISTINCT FROM 'pending' OR NOT private.onboarding_assignment_staff(auth.uid()) THEN RAISE EXCEPTION 'An enabled staff member must route a pending owner request.'; END IF;
 SELECT * INTO home FROM properties WHERE id=NEW.property_id FOR SHARE NOWAIT;
 IF NOT FOUND OR home.archived_at IS NOT NULL OR home.is_demo OR NEW.is_demo IS DISTINCT FROM home.is_demo OR home.owner_record_id IS NULL THEN RAISE EXCEPTION 'Owner delivery needs a current canonical real Property.'; END IF;
 SELECT * INTO recipient FROM property_owners WHERE id=home.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Owner delivery needs an active canonical Owner.'; END IF;
 IF new_in_app THEN
  PERFORM p.id FROM owner_programs p JOIN owner_program_properties e ON e.program_id=p.id AND e.property_id=home.id AND e.inclusion_status='included' AND e.archived_at IS NULL AND e.is_demo=false
   WHERE p.owner_record_id=recipient.id AND p.owner_user_id=NEW.approver_id AND p.archived_at IS NULL AND p.is_demo=false AND p.status NOT IN('closed','completed') FOR SHARE OF p,e NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION 'The in-app recipient is not currently enrolled for this canonical Owner and Property.'; END IF;
  PERFORM 1 FROM auth.users WHERE id=NEW.approver_id FOR SHARE NOWAIT;
  PERFORM 1 FROM user_roles WHERE user_id=NEW.approver_id FOR SHARE NOWAIT;
  IF NOT private.owner_current_property_for_actor(NEW.approver_id,home.id,NULL) THEN RAISE EXCEPTION 'The in-app recipient needs a current enabled owner account.'; END IF;
 END IF;
 claim:=NEW.onboarding_delivery_attempt;
 IF new_claim AND (nullif(trim(recipient.email),'') IS NULL OR lower(trim(claim->>'recipient')) IS DISTINCT FROM lower(trim(recipient.email)) OR claim->>'actor' IS DISTINCT FROM auth.uid()::text) THEN RAISE EXCEPTION 'The canonical Owner email recipient changed. Refresh before attempting delivery.'; END IF;
 IF recorded_email AND (nullif(trim(recipient.email),'') IS NULL OR lower(trim(NEW.owner_email_to)) IS DISTINCT FROM lower(trim(recipient.email)) OR lower(trim(claim->>'recipient')) IS DISTINCT FROM lower(trim(recipient.email))) THEN RAISE EXCEPTION 'The Owner recipient changed; reconcile the external delivery receipt.'; END IF;
 RETURN NEW;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'Owner identity is being updated. Refresh before routing the decision.';
END $$;
REVOKE ALL ON FUNCTION private.guard_onboarding_owner_recipient() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_onboarding_owner_recipient BEFORE INSERT OR UPDATE ON approvals FOR EACH ROW EXECUTE FUNCTION private.guard_onboarding_owner_recipient();
-- Recalculation is preview-first, but a Property anchor can change independently
-- of a Task version. Recheck the derived date under the same Property lock used
-- by handoff readiness before accepting that individual schedule write.
CREATE FUNCTION private.validate_onboarding_recalculated_date() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE home public.properties%ROWTYPE; anchor text; base date;
BEGIN
 IF (NEW.due_on,NEW.due_on_source) IS NOT DISTINCT FROM (OLD.due_on,OLD.due_on_source)
  OR coalesce(NEW.due_on_source,'') !~ '^(planned_closing|actual_closing|actual_access)[+-][0-9]+d$' THEN RETURN NEW; END IF;
 SELECT * INTO home FROM properties WHERE id=NEW.property_id FOR SHARE NOWAIT;
 anchor:=substring(NEW.due_on_source FROM '^(planned_closing|actual_closing|actual_access)');
 base:=(to_jsonb(home)->>(anchor||'_on'))::date;
 IF NOT FOUND OR home.archived_at IS NOT NULL OR NEW.archived_at IS NOT NULL OR NEW.status='complete' OR NEW.due_on_overridden
  OR NEW.schedule_anchor IS DISTINCT FROM anchor OR NEW.schedule_offset_days IS NULL
  OR base IS NULL OR NOT isfinite(base) OR NEW.due_on IS DISTINCT FROM base+NEW.schedule_offset_days
  OR NEW.due_on_source IS DISTINCT FROM (anchor||CASE WHEN NEW.schedule_offset_days>=0 THEN '+' ELSE '' END||NEW.schedule_offset_days::text||'d') THEN
  RAISE EXCEPTION 'Schedule anchors or task eligibility changed. Refresh before recalculating dates.';
 END IF;
 RETURN NEW;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'Property readiness is being updated. Refresh before recalculating dates.';
END $$;
REVOKE ALL ON FUNCTION private.validate_onboarding_recalculated_date() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_onboarding_recalculated_date BEFORE UPDATE ON onboarding_tasks FOR EACH ROW EXECUTE FUNCTION private.validate_onboarding_recalculated_date();
-- Staff email transcription uses the existing typed decision writers in one
-- transaction, including the captured reply and audit receipt. No email is sent.
CREATE FUNCTION public.record_owner_email_decision(_approval_id uuid,_expected_updated_at timestamptz,_decision text,_note text,_response_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE request approvals%ROWTYPE; initial approvals%ROWTYPE; home properties%ROWTYPE; owner property_owners%ROWTYPE;
 project onboarding_projects%ROWTYPE; task onboarding_tasks%ROWTYPE; wo work_orders%ROWTYPE;
 reply approval_email_responses%ROWTYPE; decided timestamptz; actual_approval uuid; note text:=trim(coalesce(_note,''));
BEGIN
 IF auth.uid() IS NULL OR _decision IS NULL OR _decision NOT IN('approved','declined','changes_requested') OR length(note) NOT BETWEEN 3 AND 2000 OR _expected_updated_at IS NULL THEN RAISE EXCEPTION 'Choose a valid owner response and record its evidence.'; END IF;
 PERFORM 1 FROM auth.users WHERE id=auth.uid() AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'An enabled staff account is required.'; END IF;
 PERFORM 1 FROM user_roles WHERE user_id=auth.uid() FOR SHARE NOWAIT;
 IF NOT coalesce(public.is_internal_staff(auth.uid()),false) THEN RAISE EXCEPTION 'Only staff may transcribe an owner reply.'; END IF;
 SELECT * INTO initial FROM approvals WHERE id=_approval_id;
 IF NOT FOUND OR initial.entity_type NOT IN('financial_request','onboarding_task','work_order') OR initial.approver_role IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'Use the supported canonical owner-decision workflow for this request.'; END IF;
 IF initial.entity_type='financial_request' AND _decision='changes_requested' THEN RAISE EXCEPTION 'Financial replies support Approved or Declined. Record requested changes in the note and revise the financial request separately.'; END IF;
 IF initial.entity_type='onboarding_task' THEN
  SELECT * INTO project FROM onboarding_projects WHERE property_id=initial.property_id AND status<>'cancelled' FOR UPDATE NOWAIT;
  IF NOT FOUND OR project.status NOT IN('planning','active') THEN RAISE EXCEPTION 'This onboarding project is not open for an owner decision.'; END IF;
 END IF;
 SELECT * INTO home FROM properties WHERE id=initial.property_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR home.archived_at IS NOT NULL OR home.is_demo OR initial.is_demo IS DISTINCT FROM home.is_demo OR home.owner_record_id IS NULL THEN RAISE EXCEPTION 'A current real canonical Property is required.'; END IF;
 SELECT * INTO owner FROM property_owners WHERE id=home.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'The canonical Owner is not active.'; END IF;
 IF initial.entity_type IN('financial_request','onboarding_task') THEN
  IF NOT private.can_record_onboarding_financial_decision(auth.uid(),home.id,'owner') THEN RAISE EXCEPTION 'Current project PM or protected Director responsibility is required to transcribe this reply.'; END IF;
 ELSE
  IF NOT coalesce(public.is_supervisor(auth.uid()),false) THEN RAISE EXCEPTION 'Supervisor responsibility is required to transcribe Work Order replies.'; END IF;
 END IF;
 CASE initial.entity_type
  WHEN 'financial_request' THEN PERFORM 1 FROM financial_requests WHERE id=initial.entity_id AND property_id=home.id FOR UPDATE NOWAIT;
  WHEN 'onboarding_task' THEN
   IF private.onboarding_work_locked(ARRAY[home.id]) THEN RAISE EXCEPTION 'Return the handoff before changing its onboarding decisions.'; END IF;
   SELECT * INTO task FROM onboarding_tasks WHERE id=initial.entity_id AND property_id=home.id AND archived_at IS NULL FOR UPDATE NOWAIT;
  WHEN 'work_order' THEN SELECT * INTO wo FROM work_orders WHERE id=initial.entity_id AND property_id=home.id FOR UPDATE NOWAIT;
 END CASE;
 IF NOT FOUND THEN RAISE EXCEPTION 'The canonical approval source is no longer available.'; END IF;
 SELECT * INTO request FROM approvals WHERE id=_approval_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR request.status IS DISTINCT FROM 'pending' OR request.updated_at IS DISTINCT FROM _expected_updated_at
  OR request.entity_type IS DISTINCT FROM initial.entity_type OR request.entity_id IS DISTINCT FROM initial.entity_id
  OR request.property_id IS DISTINCT FROM home.id OR request.approver_role IS DISTINCT FROM 'owner' OR request.is_demo THEN RAISE EXCEPTION 'The approval changed. Review its current version before recording the reply.'; END IF;
 IF NOT ((request.approver_id IS NOT NULL AND private.owner_current_property_for_actor(request.approver_id,home.id,NULL))
  OR (request.owner_email_sent_at IS NOT NULL AND nullif(trim(owner.email),'') IS NOT NULL AND lower(trim(request.owner_email_to))=lower(trim(owner.email)))) THEN RAISE EXCEPTION 'This approval is not addressed to the current canonical Owner.'; END IF;
 IF _response_id IS NOT NULL THEN
  SELECT * INTO reply FROM approval_email_responses WHERE id=_response_id FOR UPDATE NOWAIT;
  IF NOT FOUND OR reply.approval_id IS DISTINCT FROM request.id OR reply.status IS DISTINCT FROM 'matched' OR reply.is_demo IS DISTINCT FROM request.is_demo
   OR nullif(trim(owner.email),'') IS NULL OR lower(trim(reply.from_address)) IS DISTINCT FROM lower(trim(owner.email)) THEN RAISE EXCEPTION 'The captured reply does not match this current canonical Owner request.'; END IF;
 END IF;
 CASE request.entity_type
  WHEN 'financial_request' THEN PERFORM decide_onboarding_financial_request(request.entity_id,_decision='approved',note);
  WHEN 'onboarding_task' THEN
   actual_approval:=decide_onboarding_task_approval(task.id,_decision='approved',note,reply.web_link);
   IF actual_approval IS DISTINCT FROM request.id THEN RAISE EXCEPTION 'The task decision changed. Refresh before recording the reply.'; END IF;
  WHEN 'work_order' THEN
   IF wo.approval_id IS DISTINCT FROM request.id THEN RAISE EXCEPTION 'The Work Order decision changed. Refresh before recording the reply.'; END IF;
   PERFORM record_staff_work_order_owner_decision(wo.id,wo.updated_at,CASE WHEN _decision='changes_requested' THEN 'info_requested' ELSE _decision END,CASE WHEN _decision='approved' THEN request.amount ELSE NULL END,note);
 END CASE;
 UPDATE approvals SET recorded_by=auth.uid(),responded_at=now(),response_channel='email' WHERE id=request.id RETURNING decided_at INTO decided;
 IF _response_id IS NOT NULL THEN
  UPDATE approval_email_responses SET status='recorded',linked_by=auth.uid(),linked_at=now() WHERE id=_response_id;
 END IF;
 INSERT INTO audit_log(actor_id,action,entity_type,entity_id,reason,before_value,after_value)
 VALUES(auth.uid(),'owner_email_decision_recorded','approval',request.id,note,to_jsonb(request),jsonb_build_object('decision',_decision,'channel','email','responseId',_response_id,'recordedBy',auth.uid()));
 RETURN jsonb_build_object('ok',true,'approvalId',request.id,'decision',_decision,'decidedAt',decided);
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The approval, source or Owner is being updated. Refresh before recording the reply.';
END $$;
REVOKE ALL ON FUNCTION public.record_owner_email_decision(uuid,timestamptz,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_owner_email_decision(uuid,timestamptz,text,text,uuid) TO authenticated;
DO $$
BEGIN
 IF (SELECT proowner FROM pg_proc WHERE oid='public.record_owner_email_decision(uuid,timestamptz,text,text,uuid)'::regprocedure)
  IS DISTINCT FROM (SELECT relowner FROM pg_class WHERE oid='public.approvals'::regclass) THEN
  RAISE EXCEPTION 'Atomic owner email transcription requires the trusted approval table owner.';
 END IF;
END $$;
