CREATE OR REPLACE FUNCTION private.ao_enrolled_rows()
 RETURNS TABLE(property_id uuid, home text, program_id uuid, stage text, open integer, locked integer, already_covered integer, skipped integer, reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE hid uuid; hp jsonb;
BEGIN
  FOR hid IN
    SELECT DISTINCT x.pid FROM (
      SELECT e.property_id AS pid FROM public.owner_program_properties e JOIN public.owner_programs p ON p.id = e.program_id
       WHERE e.inclusion_status = 'included' AND e.archived_at IS NULL AND p.status = 'active' AND p.archived_at IS NULL AND NOT p.is_demo
      UNION SELECT p.property_id FROM public.owner_programs p WHERE p.status = 'active' AND p.archived_at IS NULL AND NOT p.is_demo AND p.property_id IS NOT NULL
    ) x JOIN public.properties h ON h.id = x.pid
    WHERE NOT h.is_demo AND h.archived_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.ao_home_plan_settings s WHERE s.property_id = x.pid)
  LOOP
    property_id := hid;
    SELECT public.format_property_label(to_jsonb(h)) ->> 'primary' INTO home FROM public.properties h WHERE h.id = hid;
    stage := private.ao_home_stage(hid);
    hp := private.ao_home_program(hid);
    IF hp ? 'reason' THEN
      program_id := NULL; open := NULL; locked := NULL; already_covered := NULL; skipped := NULL; reason := hp ->> 'reason';
    ELSE
      program_id := (hp ->> 'program_id')::uuid; reason := NULL;
      SELECT count(*) FILTER (WHERE o.outcome = 'open'), count(*) FILTER (WHERE o.outcome = 'locked'),
             count(*) FILTER (WHERE o.outcome = 'already_covered'), count(*) FILTER (WHERE o.outcome = 'skipped_passed')
        INTO open, locked, already_covered, skipped FROM private.ao_plan_outcomes(hid) o;
    END IF;
    RETURN NEXT;
  END LOOP;
END $function$
;

