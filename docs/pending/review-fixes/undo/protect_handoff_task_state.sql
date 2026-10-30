CREATE OR REPLACE FUNCTION public.protect_handoff_task_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE old_property uuid; new_property uuid;
BEGIN
 IF current_user=(SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=TG_RELID) THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_OP<>'INSERT' THEN old_property:=OLD.property_id; END IF;
 IF TG_OP<>'DELETE' THEN new_property:=NEW.property_id; END IF;
 IF private.onboarding_work_locked(ARRAY[old_property,new_property]) THEN
  RAISE EXCEPTION 'Return the handoff before changing its onboarding work; accepted work is retained in history.';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $function$
