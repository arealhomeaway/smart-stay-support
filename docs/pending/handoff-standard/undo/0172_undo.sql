-- Restores the exact live post-0168 definitions captured 2026-10-27T22:47:45Z before 0172. New 0172 objects are dropped. Does not delete Tickets or history.
DROP TRIGGER IF EXISTS handoff_carryover_ticket_completed ON public.tickets;
-- BEGIN DEF mark_ready_for_operations
CREATE OR REPLACE FUNCTION public.mark_ready_for_operations(_project_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pr public.onboarding_projects;
BEGIN
 SELECT * INTO pr FROM public.onboarding_projects WHERE id=_project_id FOR UPDATE;
 IF pr.id IS NULL THEN RAISE EXCEPTION 'Project not found.'; END IF;
 IF NOT (auth.uid()=public.seat_holder('onboarding_director') OR auth.uid()=pr.director OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Only the Onboarding Director can mark a home Ready for Operations.'; END IF;
 IF pr.handoff_state IN ('ready','accepted') THEN RETURN; END IF;
 IF public.open_handoff_blockers(pr.property_id)>0 THEN RAISE EXCEPTION 'Required handoff Tasks are still open.'; END IF;
 UPDATE public.onboarding_projects SET handoff_state='ready',ready_for_ops_at=now(),ready_for_ops_by=auth.uid() WHERE id=_project_id;
 PERFORM public.complete_handoff_step_tasks(_project_id,'ready');
END $function$

-- END DEF mark_ready_for_operations
;
-- live proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
REVOKE ALL ON FUNCTION public.mark_ready_for_operations(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mark_ready_for_operations(uuid) TO PUBLIC,anon,authenticated,service_role;

-- BEGIN DEF accept_into_operations
CREATE OR REPLACE FUNCTION public.accept_into_operations(_project_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$

-- END DEF accept_into_operations
;
-- live proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
REVOKE ALL ON FUNCTION public.accept_into_operations(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.accept_into_operations(uuid) TO PUBLIC,anon,authenticated,service_role;

DROP FUNCTION IF EXISTS public.complete_handoff_carryover_tasks();
DROP FUNCTION IF EXISTS public.perform_handoff_step(uuid,text,jsonb,boolean);
DROP FUNCTION IF EXISTS public.handoff_open_items(uuid);
