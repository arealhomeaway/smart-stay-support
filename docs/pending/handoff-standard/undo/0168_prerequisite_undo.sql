-- Restores the exact live definitions captured 2026-10-27T22:44:33Z before 0168. New 0168 objects are dropped. Completed history is never erased.
DROP FUNCTION IF EXISTS public.handoff_duplicate_task_ids(uuid);
-- BEGIN DEF open_handoff_blockers
CREATE OR REPLACE FUNCTION public.open_handoff_blockers(_property_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*)::int FROM onboarding_tasks
   WHERE property_id=_property_id AND archived_at IS NULL AND blocks_handoff AND is_required
     AND status NOT IN ('complete','done')
$function$

-- END DEF open_handoff_blockers
;
-- live proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
REVOKE ALL ON FUNCTION public.open_handoff_blockers(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.open_handoff_blockers(uuid) TO PUBLIC,anon,authenticated,service_role;

-- BEGIN DEF mark_ready_for_operations
CREATE OR REPLACE FUNCTION public.mark_ready_for_operations(_project_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pr onboarding_projects;
BEGIN
  SELECT * INTO pr FROM onboarding_projects WHERE id=_project_id FOR UPDATE;
  IF pr.id IS NULL THEN RAISE EXCEPTION 'Project not found.'; END IF;
  IF NOT (auth.uid() = public.seat_holder('onboarding_director') OR auth.uid() = pr.director OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only the Onboarding Director can mark a home Ready for Operations.';
  END IF;
  IF public.open_handoff_blockers(pr.property_id) > 0 THEN
    RAISE EXCEPTION 'Required handoff Tasks are still open.';
  END IF;
  UPDATE onboarding_projects SET handoff_state='ready', ready_for_ops_at=now(), ready_for_ops_by=auth.uid() WHERE id=_project_id;
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
DECLARE pr onboarding_projects;
BEGIN
  SELECT * INTO pr FROM onboarding_projects WHERE id=_project_id FOR UPDATE;
  IF pr.id IS NULL OR pr.handoff_state <> 'ready' THEN RAISE EXCEPTION 'This home has not been marked Ready for Operations.'; END IF;
  IF NOT (auth.uid() = public.seat_holder('director_ops') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only the Operations Director can accept a home into operations.';
  END IF;
  IF public.open_handoff_blockers(pr.property_id) > 0 THEN
    RAISE EXCEPTION 'Deficiency Tasks are still open. Accept once they are resolved.';
  END IF;
  UPDATE onboarding_projects SET handoff_state='accepted', ops_accepted_at=now(), ops_accepted_by=auth.uid(),
    status='complete', completed_at=now() WHERE id=_project_id;
  UPDATE properties SET lifecycle_status='active' WHERE id=pr.property_id;
END $function$

-- END DEF accept_into_operations
;
-- live proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
REVOKE ALL ON FUNCTION public.accept_into_operations(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.accept_into_operations(uuid) TO PUBLIC,anon,authenticated,service_role;

DROP FUNCTION IF EXISTS public.complete_handoff_step_tasks(uuid,text);
DROP FUNCTION IF EXISTS public.handoff_step_for_task(uuid);
