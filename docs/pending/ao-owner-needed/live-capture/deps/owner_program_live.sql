CREATE OR REPLACE FUNCTION private.owner_program_live(_status text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT _status IN ('draft', 'waiting_for_closing', 'ready_for_onboarding', 'active', 'target_reached')
$function$

