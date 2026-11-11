CREATE OR REPLACE FUNCTION private.ao_task_completed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  IF NEW.status = 'complete' AND OLD.status IS DISTINCT FROM 'complete' THEN
    FOR r IN SELECT pc.id FROM public.ao_home_plan_cards pc
      JOIN public.ao_home_plan_settings s ON s.property_id = pc.property_id AND s.automated
      WHERE pc.linked_task_id = NEW.id AND pc.join_outcome = 'locked' AND pc.unlocked_at IS NULL
    LOOP PERFORM private.ao_unlock(r.id, NEW.completed_by); END LOOP;
  END IF;
  RETURN NULL;
END $function$
;
