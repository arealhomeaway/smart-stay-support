-- Restore 0168 two-step behavior. Does not delete Tickets or erase history.
DROP TRIGGER IF EXISTS handoff_carryover_ticket_completed ON public.tickets;
REVOKE EXECUTE ON FUNCTION public.perform_handoff_step(uuid,text,jsonb,boolean) FROM authenticated;
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

