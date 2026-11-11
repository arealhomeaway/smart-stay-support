CREATE OR REPLACE FUNCTION private.owner_current_property_for_actor(_actor uuid, _property_id uuid, _program_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT EXISTS(
  SELECT 1 FROM public.owner_programs p
  JOIN public.owner_program_properties e ON e.program_id=p.id AND e.property_id=_property_id
   AND e.inclusion_status='included' AND e.archived_at IS NULL AND e.is_demo=p.is_demo
  JOIN public.properties h ON h.id=e.property_id AND h.owner_record_id=p.owner_record_id
   AND h.archived_at IS NULL AND h.is_demo=p.is_demo
  WHERE (_program_id IS NULL OR p.id=_program_id) AND private.owner_program_readable(_actor,p.id,false)
 )
$function$
;
