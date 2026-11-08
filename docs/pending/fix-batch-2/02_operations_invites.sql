-- Fix batch 2, item 2: the Operations Supervisor and the Director of Operations can
-- create, read and manage invite codes for Operations users only: Property
-- Coordinator (tech) and Supervisor (manager) account types. Admin keeps its existing
-- policies for every account type. The Director of Onboarding keeps the existing
-- Onboarding account path. Additive only: no existing policy is changed.

CREATE OR REPLACE FUNCTION public.can_invite_operations_users(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT public.is_director(_user_id)
      OR public.holds_functional_role(_user_id, 'ops_supervisor')
      OR public.seat_holder_at('ops_supervisor') = _user_id
$function$;
REVOKE ALL ON FUNCTION public.can_invite_operations_users(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_invite_operations_users(uuid) TO authenticated, service_role;

CREATE POLICY "Operations leadership create Operations invites" ON public.team_invites
  FOR INSERT TO authenticated
  WITH CHECK (role IN ('tech'::app_role, 'manager'::app_role) AND public.can_invite_operations_users(auth.uid()));

CREATE POLICY "Operations leadership read Operations invites" ON public.team_invites
  FOR SELECT TO authenticated
  USING (role IN ('tech'::app_role, 'manager'::app_role) AND public.can_invite_operations_users(auth.uid()));

CREATE POLICY "Operations leadership update Operations invites" ON public.team_invites
  FOR UPDATE TO authenticated
  USING (role IN ('tech'::app_role, 'manager'::app_role) AND public.can_invite_operations_users(auth.uid()))
  WITH CHECK (role IN ('tech'::app_role, 'manager'::app_role) AND public.can_invite_operations_users(auth.uid()));
