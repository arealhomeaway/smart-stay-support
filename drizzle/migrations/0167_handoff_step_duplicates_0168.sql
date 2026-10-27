-- PENDING ONLY. No template edits, no flag edits and no completion at application time.
-- Explicit IDs cover the four unlinked legacy homes. Stable template IDs cover future linked Tasks.
CREATE OR REPLACE FUNCTION public.handoff_step_for_task(_task_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
 SELECT CASE
 WHEN template_task_id='0ef1fa2b-42fd-401f-98f8-d42f9ef67abf' OR id IN ('f77dce27-5952-42cf-96f4-a85b04028f78','019f07c2-89cf-468b-8e68-1dff2cdfa728','7295fccb-2b0e-4e13-bfc3-beaf092c0b93','a10ffc87-640d-483f-9216-27e0760e916c') OR tags @> ARRAY['handoff_step:ready'] THEN 'ready'
 WHEN template_task_id IN ('df862b6a-9965-47dd-994a-4df7c720bef4','edb8f71a-0ffa-4ec9-8383-ae17864fc0d3','c31d5275-1fa0-4762-b1d3-0cedfc16d58d') OR id IN (
 '909ccdcc-99b3-4303-9fff-4f280e62ffa0','8027f018-33f2-49ae-a74f-ed848de5ca2b','4103914d-4962-4848-8087-b2794dcbc463',
 'f1a0e24f-6175-4225-8426-ee49d98fb81e','5689dbc2-46b2-4ec9-a3bd-ff1d2f7fbcd5','473236fa-fab4-49e3-a8f1-5c63fb17ba3f',
 '5ae1bfc3-0783-469b-b8cb-8258c5e3eb4b','90562c0d-4bf3-41b9-b555-9783c6193150','da712714-b736-46aa-93a3-43d2d4854f4d',
 'bc10ad9f-b4e0-4051-8ec4-45324a862ded','08b2e77d-70ca-4559-b196-4642d98013ad','9a9f2dc0-3139-4a35-a2e8-9c18da49ddeb') OR tags @> ARRAY['handoff_step:accepted'] THEN 'accepted' END
 FROM public.onboarding_tasks WHERE id=_task_id
$$;
REVOKE ALL ON FUNCTION public.handoff_step_for_task(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.handoff_step_for_task(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.open_handoff_blockers(_property_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT count(*)::int FROM public.onboarding_tasks WHERE property_id=_property_id AND archived_at IS NULL
 AND blocks_handoff AND is_required AND status NOT IN ('complete','done') AND public.handoff_step_for_task(id) IS NULL
$$;

CREATE OR REPLACE FUNCTION public.complete_handoff_step_tasks(_project_id uuid,_step text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pr public.onboarding_projects; t public.onboarding_tasks;
BEGIN
 SELECT * INTO pr FROM public.onboarding_projects WHERE id=_project_id FOR UPDATE;
 IF auth.uid() IS NULL OR pr.id IS NULL OR NOT (
 (_step='ready' AND pr.handoff_state='ready' AND pr.ready_for_ops_by=auth.uid()) OR
 (_step='accepted' AND pr.handoff_state='accepted' AND pr.ops_accepted_by=auth.uid())) THEN RAISE EXCEPTION 'The matching handoff step must be completed by its authorized caller.'; END IF;
 FOR t IN SELECT * FROM public.onboarding_tasks WHERE property_id=pr.property_id AND archived_at IS NULL
 AND status NOT IN ('complete','done') AND public.handoff_step_for_task(id)=_step FOR UPDATE LOOP
 UPDATE public.onboarding_tasks SET status='complete',completed_at=now(),completed_by=auth.uid() WHERE id=t.id;
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,entity_label,before_value,after_value)
 VALUES(auth.uid(),'onboarding_task_completed_by_handoff','onboarding_task',t.id,t.title,jsonb_build_object('status',t.status),jsonb_build_object('status','complete','handoff_step',_step,'project_id',pr.id));
 INSERT INTO public.onboarding_project_events(project_id,property_id,kind,summary,detail,prior_value,new_value,actor,is_demo)
 VALUES(pr.id,pr.property_id,'handoff_task_completed','Task completed by the handoff step',t.title,t.status,'complete',auth.uid(),coalesce(t.is_demo,false));
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.complete_handoff_step_tasks(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_handoff_step_tasks(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_ready_for_operations(_project_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pr public.onboarding_projects;
BEGIN
 SELECT * INTO pr FROM public.onboarding_projects WHERE id=_project_id FOR UPDATE;
 IF pr.id IS NULL THEN RAISE EXCEPTION 'Project not found.'; END IF;
 IF NOT (auth.uid()=public.seat_holder('onboarding_director') OR auth.uid()=pr.director OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Only the Onboarding Director can mark a home Ready for Operations.'; END IF;
 IF pr.handoff_state IN ('ready','accepted') THEN RETURN; END IF;
 IF public.open_handoff_blockers(pr.property_id)>0 THEN RAISE EXCEPTION 'Required handoff Tasks are still open.'; END IF;
 UPDATE public.onboarding_projects SET handoff_state='ready',ready_for_ops_at=now(),ready_for_ops_by=auth.uid() WHERE id=_project_id;
 PERFORM public.complete_handoff_step_tasks(_project_id,'ready');
END $$;

CREATE OR REPLACE FUNCTION public.accept_into_operations(_project_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pr public.onboarding_projects;
BEGIN
 SELECT * INTO pr FROM public.onboarding_projects WHERE id=_project_id FOR UPDATE;
 IF pr.id IS NULL OR pr.handoff_state<>'ready' THEN RAISE EXCEPTION 'This home has not been marked Ready for Operations.'; END IF;
 IF NOT(auth.uid()=public.seat_holder('director_ops') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Only the Operations Director can accept a home into operations.'; END IF;
 IF public.open_handoff_blockers(pr.property_id)>0 THEN RAISE EXCEPTION 'Deficiency Tasks are still open. Accept once they are resolved.'; END IF;
 -- Complete duplicate Tasks before the project lock becomes complete. All changes remain atomic.
 UPDATE public.onboarding_projects SET handoff_state='accepted',ops_accepted_at=now(),ops_accepted_by=auth.uid() WHERE id=_project_id;
 PERFORM public.complete_handoff_step_tasks(_project_id,'accepted');
 UPDATE public.onboarding_projects SET status='complete',completed_at=now() WHERE id=_project_id;
 UPDATE public.properties SET lifecycle_status='active' WHERE id=pr.property_id;
END $$;

CREATE OR REPLACE FUNCTION public.handoff_duplicate_task_ids(_property_id uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
 SELECT id FROM public.onboarding_tasks WHERE property_id=_property_id AND public.handoff_step_for_task(id) IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.handoff_duplicate_task_ids(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.handoff_duplicate_task_ids(uuid) TO authenticated,service_role;