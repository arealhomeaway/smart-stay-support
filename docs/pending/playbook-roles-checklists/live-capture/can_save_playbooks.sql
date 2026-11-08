CREATE OR REPLACE FUNCTION public.can_save_playbooks(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT public.can_manage_playbooks(_user_id)
      OR public.holds_functional_role(_user_id, 'ops_supervisor')
      OR public.seat_holder_at('ops_supervisor') = _user_id
$function$

