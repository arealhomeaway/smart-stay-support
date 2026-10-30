-- PENDING UNDO. Exact captured definitions; CREATE OR REPLACE preserves existing ACLs.

BEGIN;

CREATE OR REPLACE FUNCTION private.owns_program(_user_id uuid, _program_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.owner_programs WHERE id = _program_id AND owner_user_id = _user_id)
$function$;

CREATE OR REPLACE FUNCTION private.owner_sees_property(_user_id uuid, _property_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.owner_programs
    where property_id = _property_id and owner_user_id = _user_id
  ) or exists (
    select 1
    from public.owner_program_properties opp
    join public.owner_programs op on op.id = opp.program_id
    where opp.property_id = _property_id
      and op.owner_user_id = _user_id
  )
$function$;

CREATE OR REPLACE FUNCTION private.owner_can_see_property(_user_id uuid, _property_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.owner_program_properties opp
    JOIN public.owner_programs p ON p.id = opp.program_id
    WHERE p.owner_user_id = _user_id
      AND opp.property_id = _property_id
      AND opp.inclusion_status = 'included'
      AND opp.archived_at IS NULL
  )
$function$;

CREATE OR REPLACE FUNCTION public.owner_owns_program(_program_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT EXISTS (SELECT 1 FROM owner_programs p WHERE p.id=_program_id AND p.owner_user_id=auth.uid() AND p.archived_at IS NULL
  AND (p.is_demo=false OR private.demo_owner_link_ok(auth.uid(),p.id)))
$function$;

CREATE OR REPLACE FUNCTION private.owner_program_readable(_actor uuid, _program_id uuid, _preview boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT _actor IS NOT NULL AND EXISTS(
  SELECT 1 FROM auth.users a JOIN public.owner_programs p ON p.id=_program_id
  JOIN public.property_owners o ON o.id=p.owner_record_id AND o.active
  WHERE a.id=_actor AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=now())
   AND p.archived_at IS NULL
   AND ((_preview IS TRUE AND public.has_role(_actor,'admin'))
    OR (_preview IS FALSE AND p.owner_user_id=_actor
     AND (p.is_demo=false OR private.demo_owner_link_ok(_actor,p.id))
     AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor AND role::text='owner')
     AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor AND role::text<>'owner')))
 )
$function$;

CREATE OR REPLACE FUNCTION private.owns_owner_request(_work_item_id uuid, _actor uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _actor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.work_items w JOIN public.owner_programs p ON p.id=w.program_id
     WHERE w.id=_work_item_id AND w.kind='opportunity' AND w.status NOT IN ('draft','archived')
       AND p.archived_at IS NULL AND p.owner_user_id=_actor)
$function$;

ALTER POLICY "Homeowner reads released activity conversations" ON public.owner_request_messages USING ((EXISTS ( SELECT 1
   FROM (owner_reviews r
     JOIN owner_programs p ON ((p.id = r.program_id)))
  WHERE ((r.id = owner_request_messages.review_id) AND (p.owner_user_id = auth.uid()) AND (r.archived_at IS NULL) AND (r.status <> 'prepared'::text)))));

COMMIT;
