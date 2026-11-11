-- Build 17 (Emily, Nov 10): findings 8 and 9. Additive.
ALTER TABLE public.guest_feedback ADD COLUMN IF NOT EXISTS published_date_known boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.guest_feedback.published_date_known IS
  'False when OwnerRez gave no publish date: the review is history and starts no check or follow up (Build 17).';

CREATE OR REPLACE FUNCTION public.can_manage_project_team(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT _user_id IS NOT NULL AND private.is_onboarding_staff(_user_id)
     AND (coalesce(public.is_supervisor(_user_id), false) OR private.can_assign_onboarding_responsibility(_user_id))
$$;
REVOKE ALL ON FUNCTION public.can_manage_project_team(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_project_team(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_onboarding_project_role(_project_id uuid, _role_code text, _user_id uuid, _reassign_pending boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE pr public.onboarding_projects; previous uuid; assignments jsonb; moved integer:=0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_project_team(auth.uid()) THEN
    RAISE EXCEPTION 'Only the Onboarding Director or leadership can change the Onboarding team.';
  END IF;
  IF _role_code IS NULL OR _role_code IN ('property_coordinator','owner','onboarding_director') THEN
    RAISE EXCEPTION 'That role is not assigned from the Project Team.';
  END IF;
  SELECT * INTO pr FROM public.onboarding_projects WHERE id=_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That onboarding project was not found.'; END IF;
  assignments:=coalesce(pr.role_assignments,'{}'::jsonb);
  previous:=CASE _role_code WHEN 'onboarding_project_manager' THEN pr.project_manager
                            WHEN 'utilities' THEN pr.utility_manager
                            ELSE nullif(assignments->>_role_code,'')::uuid END;
  IF previous IS NOT DISTINCT FROM _user_id THEN
    RETURN jsonb_build_object('ok',true,'changed',false,'moved',0);
  END IF;
  IF _role_code='onboarding_project_manager' THEN
    UPDATE public.onboarding_projects SET project_manager=_user_id WHERE id=pr.id;
  ELSIF _role_code='utilities' THEN
    UPDATE public.onboarding_projects SET utility_manager=_user_id WHERE id=pr.id;
  ELSE
    assignments:=CASE WHEN _user_id IS NULL THEN assignments-_role_code ELSE assignments||jsonb_build_object(_role_code,_user_id) END;
    UPDATE public.onboarding_projects SET role_assignments=assignments WHERE id=pr.id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'The project assignment could not be saved.'; END IF;
  -- SECURITY INVOKER retains all current row policies and responsibility triggers.
  IF _reassign_pending OR _role_code='onboarding_project_manager' THEN
    UPDATE public.onboarding_tasks SET assigned_to=_user_id
    WHERE property_id=pr.property_id AND assigned_seat=_role_code
      AND status IN ('open','in_progress','blocked') AND archived_at IS NULL AND exception_at IS NULL;
    GET DIAGNOSTICS moved=ROW_COUNT;
  END IF;
  PERFORM private.write_project_team_change_audit(pr.id,_role_code,previous,_user_id,moved);
  RETURN jsonb_build_object('ok',true,'changed',true,'moved',moved);
END $function$;