-- Build 5 of 7: access fixes (Emily, Nov 7 to 9; register A12, A14, A20). Staged in docs/pending/access-fixes/.

-- A20 Help tickets: everyone reads their own reports. Only the Admin reads every report,
-- changes a status and writes the reply thread. The Director of Operations no longer does.
ALTER POLICY "Leadership reads help tickets" ON public.help_tickets
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR submitted_by = auth.uid());
ALTER POLICY "Leadership updates help tickets" ON public.help_tickets
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
ALTER POLICY "Leadership reads help ticket events" ON public.help_ticket_events
  USING (public.has_role(auth.uid(), 'admin'::app_role));
ALTER POLICY "Leadership writes help ticket events" ON public.help_ticket_events
  WITH CHECK (author_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::app_role));

-- A14 Users: the Director of Onboarding adds people to their own department (Onboarding staff
-- account type only). Admin and Operations leadership rules are unchanged.
CREATE POLICY "Director of Onboarding creates Onboarding invites" ON public.team_invites
  FOR INSERT TO authenticated
  WITH CHECK (role = 'onboarding'::app_role AND public.is_onboarding_director(auth.uid()));
CREATE POLICY "Director of Onboarding reads Onboarding invites" ON public.team_invites
  FOR SELECT TO authenticated
  USING (role = 'onboarding'::app_role AND public.is_onboarding_director(auth.uid()));
CREATE POLICY "Director of Onboarding updates Onboarding invites" ON public.team_invites
  FOR UPDATE TO authenticated
  USING (role = 'onboarding'::app_role AND public.is_onboarding_director(auth.uid()))
  WITH CHECK (role = 'onboarding'::app_role AND public.is_onboarding_director(auth.uid()));

-- A12 Properties: Finance views homes. A person whose only work role is Finance on a
-- Supervisor type account (no Operations Supervisor held or covered, no Director, no Admin,
-- no Coordinator or Onboarding account type) no longer edits home details, labels or photos.
-- Everything else in this rule is exactly as captured live on Nov 10, 2026.
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
    AND NOT (
      -- Finance on a Supervisor type account with no other work role (register A12, Nov 10).
      private.is_accounting(_uid)
      AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role = 'manager')
      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role IN ('admin','tech','onboarding'))
      AND NOT private.is_director(_uid)
      AND NOT public.holds_functional_role(_uid, 'ops_supervisor')
      AND public.seat_holder_at('ops_supervisor', now()) IS DISTINCT FROM _uid
      AND NOT public.is_onboarding_director(_uid)
    )
$function$;
