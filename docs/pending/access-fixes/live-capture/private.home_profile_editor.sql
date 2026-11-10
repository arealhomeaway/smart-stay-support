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
$function$
