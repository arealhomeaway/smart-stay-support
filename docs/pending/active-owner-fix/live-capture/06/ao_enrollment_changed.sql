CREATE OR REPLACE FUNCTION private.ao_enrollment_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE prog public.owner_programs; h uuid;
BEGIN
  IF TG_TABLE_NAME = 'owner_program_properties' THEN
    PERFORM private.ao_label_sync(NEW.property_id, auth.uid());
    IF NEW.inclusion_status = 'included' AND NEW.archived_at IS NULL AND NOT NEW.is_demo
       AND (TG_OP = 'INSERT' OR OLD.inclusion_status IS DISTINCT FROM 'included' OR OLD.archived_at IS NOT NULL) THEN
      SELECT * INTO prog FROM public.owner_programs WHERE id = NEW.program_id;
      IF prog.status = 'active' AND prog.archived_at IS NULL AND NOT prog.is_demo THEN
        PERFORM private.ao_start_on_enrollment(NEW.property_id, auth.uid());
      END IF;
    END IF;
  ELSE
    FOR h IN SELECT DISTINCT property_id FROM public.owner_program_properties WHERE program_id = NEW.id LOOP
      PERFORM private.ao_label_sync(h, auth.uid());
    END LOOP;
    IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' AND OLD.status IS DISTINCT FROM 'closed'
       AND NEW.archived_at IS NULL AND NOT NEW.is_demo THEN
      FOR h IN SELECT property_id FROM public.owner_program_properties
                WHERE program_id = NEW.id AND inclusion_status = 'included' AND archived_at IS NULL ORDER BY property_id LOOP
        PERFORM private.ao_start_on_enrollment(h, auth.uid());
      END LOOP;
    END IF;
  END IF;
  RETURN NULL;
END $function$
;
