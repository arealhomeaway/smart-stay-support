COMMENT ON TABLE public.program_members IS NULL;
REVOKE ALL ON public.program_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.program_members TO authenticated;
GRANT ALL ON public.program_members TO service_role;

CREATE FUNCTION private.is_program_member(_program_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO public, private, pg_temp AS $function$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.owner_programs p WHERE p.id=_program_id
      AND (p.owner_user_id=_user_id OR EXISTS (
        SELECT 1 FROM public.program_members m
        WHERE m.program_id=p.id AND m.user_id=_user_id AND m.removed_at IS NULL
      ))
  )
$function$;
REVOKE ALL ON FUNCTION private.is_program_member(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_program_member(uuid,uuid) TO authenticated, service_role;

CREATE POLICY program_members_read ON public.program_members FOR SELECT TO authenticated
USING (private.is_program_member(program_id,auth.uid())
  OR public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid()));