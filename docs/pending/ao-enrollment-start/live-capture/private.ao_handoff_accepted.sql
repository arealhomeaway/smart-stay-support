CREATE OR REPLACE FUNCTION private.ao_handoff_accepted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.handoff_state = 'accepted' AND OLD.handoff_state IS DISTINCT FROM 'accepted' THEN
    PERFORM private.ao_on_handoff(NEW.property_id, auth.uid());
  END IF;
  RETURN NULL;
END $function$
;

