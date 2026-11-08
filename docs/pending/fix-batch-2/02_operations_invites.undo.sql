-- Undo 02: remove the Operations invite policies and helper. Admin policies are untouched.
DROP POLICY IF EXISTS "Operations leadership create Operations invites" ON public.team_invites;
DROP POLICY IF EXISTS "Operations leadership read Operations invites" ON public.team_invites;
DROP POLICY IF EXISTS "Operations leadership update Operations invites" ON public.team_invites;
DROP FUNCTION IF EXISTS public.can_invite_operations_users(uuid);
