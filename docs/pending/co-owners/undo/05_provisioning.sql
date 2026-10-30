-- Undo for 05_provisioning.sql. Restores the exact live practice-home check and removes the four new functions. No CASCADE.
CREATE OR REPLACE FUNCTION private.demo_owner_link_ok(_actor uuid, _program_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT _actor IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.owner_programs p JOIN auth.users a ON a.id=_actor
  WHERE p.id=_program_id AND p.is_demo AND p.archived_at IS NULL AND p.owner_user_id=_actor
   AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=now())
   AND a.email_confirmed_at IS NOT NULL AND lower(a.email) LIKE '%@resolve-test.invalid'
   AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor AND role::text='owner')
   AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor AND role::text<>'owner')
   AND NOT EXISTS(SELECT 1 FROM public.owner_programs o WHERE o.owner_user_id=_actor AND o.id<>p.id)
   AND EXISTS(SELECT 1 FROM public.owner_program_properties pp WHERE pp.program_id=p.id)
   AND NOT EXISTS(SELECT 1 FROM public.owner_program_properties pp LEFT JOIN public.properties h ON h.id=pp.property_id
     WHERE pp.program_id=p.id AND (pp.is_demo IS NOT TRUE OR h.is_demo IS NOT TRUE))
   AND (SELECT l.action='owner_program.demo_account_linked' AND l.after_value->>'owner_user_id'=_actor::text
        FROM public.audit_log l WHERE l.entity_type='owner_program' AND l.entity_id=p.id
         AND l.action IN ('owner_program.demo_account_linked','owner_program.demo_account_unlinked')
         AND public.has_role(l.actor_id,'admin')
        ORDER BY l.created_at DESC LIMIT 1) IS TRUE)
$function$;
DROP FUNCTION public.read_program_attribution(uuid);
DROP FUNCTION public.read_program_homeowners(uuid);
DROP FUNCTION public.remove_program_co_owner(uuid,uuid);
DROP FUNCTION public.add_program_co_owner(uuid,text,text,uuid);
