CREATE OR REPLACE FUNCTION public.my_spending_approval_authority()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','private' AS $$
  SELECT private.can_approve_spending(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.my_spending_approval_authority() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_spending_approval_authority() TO authenticated;