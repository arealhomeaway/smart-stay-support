-- Define the already-used Onboarding seat without guessing or assigning a person.
INSERT INTO public.functional_roles(code,name,team,sort_order)
VALUES('director_onboarding','Director of Onboarding','onboarding',7)
ON CONFLICT(code) DO NOTHING;

CREATE FUNCTION private.sensitive_onboarding_seat(_code text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT coalesce(_code IN ('director_onboarding','director_ops','ops_supervisor'),false)
$$;
REVOKE ALL ON FUNCTION private.sensitive_onboarding_seat(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.sensitive_onboarding_seat(text) TO authenticated,service_role;

CREATE FUNCTION private.onboarding_assignment_staff(_actor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(public.is_onboarding_staff(_actor),false) AND EXISTS(
  SELECT 1 FROM auth.users u WHERE u.id=_actor AND u.deleted_at IS NULL
   AND (u.banned_until IS NULL OR u.banned_until<=now()))
$$;
REVOKE ALL ON FUNCTION private.onboarding_assignment_staff(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.onboarding_assignment_staff(uuid) TO authenticated,service_role;

-- The user initiating a sensitive assignment must be a platform administrator.
-- Credential-only service writes cannot silently claim a leadership seat.
CREATE FUNCTION public.protect_onboarding_responsibility_seats() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE before_code text; after_code text; assignee uuid;
BEGIN
 IF TG_OP<>'INSERT' THEN
  IF TG_TABLE_NAME='functional_roles' THEN before_code:=OLD.code; ELSE before_code:=OLD.role_code; END IF;
 END IF;
 IF TG_OP<>'DELETE' THEN
  IF TG_TABLE_NAME='functional_roles' THEN after_code:=NEW.code; ELSE after_code:=NEW.role_code; END IF;
 END IF;
 IF NOT private.sensitive_onboarding_seat(before_code) AND NOT private.sensitive_onboarding_seat(after_code) THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF auth.uid() IS NULL OR NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN
  RAISE EXCEPTION 'Only a platform administrator can change Onboarding or Operations responsibility seats and their cover.';
 END IF;
 IF TG_OP<>'DELETE' THEN
  IF TG_TABLE_NAME='functional_roles' THEN assignee:=NEW.current_seat_holder;
  ELSIF NEW.kind='cover' THEN assignee:=NEW.user_id; END IF;
  IF assignee IS NOT NULL AND NOT private.onboarding_assignment_staff(assignee) THEN
   RAISE EXCEPTION 'Responsibility seats require an existing Onboarding or supervisory staff account.';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE ALL ON FUNCTION public.protect_onboarding_responsibility_seats() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER protect_onboarding_responsibility_seats BEFORE INSERT OR UPDATE OR DELETE ON public.functional_roles
 FOR EACH ROW EXECUTE FUNCTION public.protect_onboarding_responsibility_seats();
CREATE TRIGGER protect_onboarding_responsibility_cover BEFORE INSERT OR UPDATE OR DELETE ON public.coverage_overrides
 FOR EACH ROW EXECUTE FUNCTION public.protect_onboarding_responsibility_seats();

CREATE FUNCTION private.current_onboarding_director() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT holder.id FROM public.functional_roles seat
 CROSS JOIN LATERAL (SELECT public.seat_holder_at('director_onboarding',now()) AS id) holder
 WHERE seat.code='director_onboarding' AND seat.active
 AND holder.id IS NOT NULL AND private.onboarding_assignment_staff(holder.id)
$$;
REVOKE ALL ON FUNCTION private.current_onboarding_director() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.current_onboarding_director() TO authenticated,service_role;

CREATE FUNCTION private.can_assign_onboarding_responsibility(_actor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _actor IS NOT NULL AND private.onboarding_assignment_staff(_actor)
 AND (coalesce(public.has_role(_actor,'admin'),false) OR _actor=private.current_onboarding_director())
$$;
REVOKE ALL ON FUNCTION private.can_assign_onboarding_responsibility(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_assign_onboarding_responsibility(uuid) TO authenticated,service_role;

CREATE FUNCTION public.read_onboarding_assignment_authority()
RETURNS TABLE(director_id uuid,can_assign boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT private.current_onboarding_director(),coalesce(private.can_assign_onboarding_responsibility(auth.uid()),false)
 WHERE auth.uid() IS NOT NULL AND public.is_onboarding_staff(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.read_onboarding_assignment_authority() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_onboarding_assignment_authority() TO authenticated;

CREATE FUNCTION public.protect_onboarding_project_assignments() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE authority boolean; assigned_director uuid; assignments_changed boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_onboarding_staff(auth.uid()),false) THEN
  RAISE EXCEPTION 'Onboarding project changes require a signed-in Onboarding staff account.';
 END IF;
 authority:=coalesce(private.can_assign_onboarding_responsibility(auth.uid()),false);
 IF TG_OP='INSERT' THEN
  IF NOT authority THEN
   assigned_director:=private.current_onboarding_director();
   IF NEW.project_manager IS NOT NULL AND NEW.project_manager IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only Onboarding leadership can assign another project manager.';
   END IF;
   IF NEW.director IS NOT NULL AND NEW.director IS DISTINCT FROM assigned_director THEN
    RAISE EXCEPTION 'The Onboarding Director comes from the protected responsibility seat.';
   END IF;
   NEW.project_manager:=auth.uid();
   NEW.director:=assigned_director;
  END IF;
  IF NEW.started_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Project creation must record its signed-in actor.'; END IF;
  assignments_changed:=true;
 ELSE
  assignments_changed:=NEW.project_manager IS DISTINCT FROM OLD.project_manager OR NEW.director IS DISTINCT FROM OLD.director
   OR NEW.property_id IS DISTINCT FROM OLD.property_id;
  IF assignments_changed AND NOT authority THEN
   RAISE EXCEPTION 'Only a platform administrator or the trusted Onboarding Director can change project responsibility.';
  END IF;
  IF NEW.started_by IS DISTINCT FROM OLD.started_by OR NEW.started_at IS DISTINCT FROM OLD.started_at THEN
   RAISE EXCEPTION 'Preserve the original project creation record.';
  END IF;
 END IF;
 IF assignments_changed THEN
  IF (NEW.project_manager IS NOT NULL AND NOT private.onboarding_assignment_staff(NEW.project_manager))
   OR (NEW.director IS NOT NULL AND NOT private.onboarding_assignment_staff(NEW.director)) THEN
   RAISE EXCEPTION 'Project responsibility requires existing Onboarding or supervisory staff accounts.';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_onboarding_project_assignments() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER protect_onboarding_project_assignments BEFORE INSERT OR UPDATE ON public.onboarding_projects
 FOR EACH ROW EXECUTE FUNCTION public.protect_onboarding_project_assignments();

DROP POLICY "Onboarding staff manage onboarding projects" ON public.onboarding_projects;
CREATE POLICY "Onboarding staff start projects" ON public.onboarding_projects FOR INSERT TO authenticated
 WITH CHECK(public.is_onboarding_staff(auth.uid()));
CREATE POLICY "Responsible staff update onboarding projects" ON public.onboarding_projects FOR UPDATE TO authenticated
 USING(public.is_onboarding_staff(auth.uid()) AND (public.is_supervisor(auth.uid()) OR project_manager=auth.uid()
  OR director=auth.uid() OR private.can_assign_onboarding_responsibility(auth.uid())))
 WITH CHECK(public.is_onboarding_staff(auth.uid()) AND (public.is_supervisor(auth.uid()) OR project_manager=auth.uid()
  OR director=auth.uid() OR private.can_assign_onboarding_responsibility(auth.uid())));
CREATE POLICY "Platform administrators remove onboarding projects" ON public.onboarding_projects FOR DELETE TO authenticated
 USING(public.has_role(auth.uid(),'admin'));
