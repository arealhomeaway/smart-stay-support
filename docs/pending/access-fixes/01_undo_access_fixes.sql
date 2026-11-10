-- Undo for 01_access_fixes.sql: puts back every rule exactly as captured live on Nov 10, 2026.
ALTER POLICY "Leadership reads help tickets" ON public.help_tickets
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_director(auth.uid()) OR (submitted_by = auth.uid()));
ALTER POLICY "Leadership updates help tickets" ON public.help_tickets
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_director(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_director(auth.uid()));
ALTER POLICY "Leadership reads help ticket events" ON public.help_ticket_events
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_director(auth.uid()));
ALTER POLICY "Leadership writes help ticket events" ON public.help_ticket_events
  WITH CHECK ((author_id = auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR is_director(auth.uid())));

DROP POLICY IF EXISTS "Director of Onboarding creates Onboarding invites" ON public.team_invites;
DROP POLICY IF EXISTS "Director of Onboarding reads Onboarding invites" ON public.team_invites;
DROP POLICY IF EXISTS "Director of Onboarding updates Onboarding invites" ON public.team_invites;

CREATE OR REPLACE FUNCTION private.home_profile_editor(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT _uid IS NOT NULL
    AND public.is_internal_staff(_uid)
    AND NOT (
      -- Finance only: a finance role and no other work role.
      EXISTS (SELECT 1 FROM public.functional_role_members m WHERE m.user_id = _uid AND m.role_code IN ('finance_lead','accounting'))
      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role IN ('admin','manager'))
      AND NOT EXISTS (SELECT 1 FROM public.functional_role_members m WHERE m.user_id = _uid AND m.role_code NOT IN ('finance_lead','accounting','cfo_owner_liaison'))
    )
    AND NOT (
      -- Utilities only.
      EXISTS (SELECT 1 FROM public.functional_role_members m WHERE m.user_id = _uid AND m.role_code = 'utilities')
      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role IN ('admin','manager','tech'))
      AND NOT EXISTS (SELECT 1 FROM public.functional_role_members m WHERE m.user_id = _uid AND m.role_code <> 'utilities')
    )
$function$;
