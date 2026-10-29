CREATE OR REPLACE FUNCTION public.read_owner_program_properties(_program_id uuid, _preview boolean DEFAULT false)
 RETURNS TABLE(id uuid, enrollment jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT e.id,jsonb_build_object(
  'id',e.id,'property_id',e.property_id,'closing_date',e.closing_date,'closing_confirmed',e.closing_confirmed,
  'added_on',e.added_on,'inclusion_status',e.inclusion_status,'onboarding_status',e.onboarding_status,
  'launch_status',e.launch_status,'coverage_status',e.coverage_status,'last_owner_activity_at',e.last_owner_activity_at,
  'current_access',coalesce(e.inclusion_status='included' AND e.archived_at IS NULL AND h.archived_at IS NULL
   AND h.owner_record_id=p.owner_record_id AND h.is_demo=p.is_demo,false),
  'properties',CASE WHEN e.inclusion_status='included' AND e.archived_at IS NULL AND h.archived_at IS NULL
   AND h.owner_record_id=p.owner_record_id AND h.is_demo=p.is_demo THEN
    jsonb_build_object('name',h.name,'nickname',h.nickname,'address_line1',h.address_line1,'city',h.city,'state',h.state,'primary_photo_url',h.primary_photo_url)
   ELSE NULL END)
 FROM public.owner_programs p JOIN public.owner_program_properties e ON e.program_id=p.id AND e.is_demo=p.is_demo
 LEFT JOIN public.properties h ON h.id=e.property_id
 WHERE p.id=_program_id AND private.owner_program_readable(auth.uid(),p.id,_preview)
$function$
;