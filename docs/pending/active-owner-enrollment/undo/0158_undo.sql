-- UNDO 0158: restore can_correct_actual_closing without Admin (fingerprint 4d19122ec93f74931a05b6b6572614045eaaaa835753f2bc1e87d7672d285dc1).
CREATE OR REPLACE FUNCTION private.can_correct_actual_closing(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _uid IS NOT NULL AND (public.has_role(_uid,'manager')
    OR public.seat_holder_at('director_ops')=_uid
    OR public.seat_holder_at('director_onboarding')=_uid)
$function$
