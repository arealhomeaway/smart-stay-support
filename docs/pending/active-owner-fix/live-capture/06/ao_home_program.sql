CREATE OR REPLACE FUNCTION private.ao_home_program(_property uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ids uuid[];
BEGIN
  SELECT array_agg(DISTINCT p.id ORDER BY p.id) INTO ids FROM public.owner_programs p
   WHERE p.status = 'active' AND p.archived_at IS NULL AND NOT p.is_demo
     AND (p.property_id = _property OR EXISTS (
           SELECT 1 FROM public.owner_program_properties e
            WHERE e.program_id = p.id AND e.property_id = _property
              AND e.inclusion_status = 'included' AND e.archived_at IS NULL));
  IF coalesce(array_length(ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('reason', 'This home has no active Active Owner program');
  ELSIF array_length(ids, 1) > 1 THEN
    RETURN jsonb_build_object('reason', 'This home is in more than one homeowner program. Ask an Admin to fix it first.');
  END IF;
  RETURN jsonb_build_object('program_id', ids[1]);
END $function$
;
