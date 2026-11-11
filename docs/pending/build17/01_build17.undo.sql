-- Undo for Build 17: puts back the live Project Team save exactly (from migration 0208) and removes the new rule.
-- The guest_feedback.published_date_known column is kept (dropping it loses which reviews had no date); drop it only if the code is rolled back too:
-- ALTER TABLE public.guest_feedback DROP COLUMN published_date_known;

CREATE OR REPLACE FUNCTION public.set_onboarding_project_role(_project_id uuid, _role_code text, _user_id uuid, _reassign_pending boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO public, private, pg_temp AS $function$
DECLARE pr public.onboarding_projects; previous uuid; assignments jsonb; moved integer:=0;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_supervisor(auth.uid()) OR public.is_onboarding_director(auth.uid()),false) THEN
    RAISE EXCEPTION 'Only the Onboarding Director or leadership can change the Onboarding team.';
  END IF;
  IF _role_code IS NULL OR _role_code IN ('property_coordinator','owner','onboarding_director') THEN
    RAISE EXCEPTION 'That role is not assigned from the Project Team.';
  END IF;
  SELECT * INTO pr FROM public.onboarding_projects WHERE id=_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That onboarding project was not found.'; END IF;
  assignments:=coalesce(pr.role_assignments,'{}'::jsonb);
  IF _role_code='onboarding_project_manager' THEN
    previous:=pr.project_manager;
    UPDATE public.onboarding_projects SET project_manager=_user_id WHERE id=pr.id;
  ELSIF _role_code='utilities' THEN
    previous:=pr.utility_manager;
    UPDATE public.onboarding_projects SET utility_manager=_user_id WHERE id=pr.id;
  ELSE
    previous:=nullif(assignments->>_role_code,'')::uuid;
    assignments:=CASE WHEN _user_id IS NULL THEN assignments-_role_code ELSE assignments||jsonb_build_object(_role_code,_user_id) END;
    UPDATE public.onboarding_projects SET role_assignments=assignments WHERE id=pr.id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'The project assignment could not be saved.'; END IF;
  -- SECURITY INVOKER retains all current row policies and responsibility triggers.
  IF _reassign_pending THEN
    UPDATE public.onboarding_tasks SET assigned_to=_user_id
    WHERE property_id=pr.property_id AND assigned_seat=_role_code
      AND status IN ('open','in_progress','blocked') AND archived_at IS NULL AND exception_at IS NULL;
    GET DIAGNOSTICS moved=ROW_COUNT;
  END IF;
  PERFORM private.write_project_team_change_audit(pr.id,_role_code,previous,_user_id,moved);
  RETURN jsonb_build_object('ok',true,'moved',moved);
END $function$;

DROP FUNCTION IF EXISTS public.can_manage_project_team(uuid);
