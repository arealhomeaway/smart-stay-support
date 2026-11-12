CREATE OR REPLACE FUNCTION public.owner_hours_eligibility(_program_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p public.owner_programs;
BEGIN
 SELECT * INTO p FROM owner_programs WHERE id=_program_id;
 IF NOT FOUND OR NOT (private.is_program_member(p.id,auth.uid()) OR coalesce(public.is_internal_staff(auth.uid()),false)) THEN
  RETURN jsonb_build_object('eligible',false,'reason','unavailable');
 END IF;
 IF p.archived_at IS NOT NULL OR p.completed_at IS NOT NULL OR p.status IN ('paused','closed','completed','complete') THEN
  RETURN jsonb_build_object('eligible',false,'reason',CASE WHEN p.status='paused' THEN 'paused' ELSE 'closed' END);
 END IF;
 IF p.status NOT IN ('draft','active','target_reached') OR NOT EXISTS(SELECT 1 FROM property_owners WHERE id=p.owner_record_id AND active)
 OR NOT EXISTS(SELECT 1 FROM owner_program_properties e JOIN properties h ON h.id=e.property_id
   WHERE e.program_id=p.id AND e.inclusion_status='included' AND e.archived_at IS NULL
   AND h.archived_at IS NULL AND h.owner_record_id=p.owner_record_id AND e.is_demo=p.is_demo AND h.is_demo=p.is_demo) THEN
  RETURN jsonb_build_object('eligible',false,'reason','unavailable');
 END IF;
 RETURN jsonb_build_object('eligible',true);
END $function$
;

