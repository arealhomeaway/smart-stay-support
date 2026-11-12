CREATE OR REPLACE FUNCTION private.ao_start_on_enrollment(_property uuid, _actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE hp jsonb; r jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ao_home_plan_settings WHERE property_id = _property) THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id = _property) THEN RETURN NULL; END IF;
  hp := private.ao_home_program(_property);
  IF hp ? 'reason' THEN
    INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, reason)
      VALUES (_actor, 'ao_plan_not_started', 'property', _property, 'Automated homeowner plan', hp ->> 'reason');
    RETURN hp;
  END IF;
  r := private.ao_start_home_plan(_property, _actor);
  PERFORM private.ao_plan_ready_notice((r ->> 'program_id')::uuid, ARRAY[_property], (r ->> 'open')::int);
  RETURN r;
END $function$
;

