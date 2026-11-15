CREATE OR REPLACE FUNCTION public.ao_unlock_now(_plan_card uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ok boolean;
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501'; END IF;
  ok := private.ao_unlock(_plan_card, auth.uid());
  IF ok THEN
    INSERT INTO public.ao_home_plan_settings_history(property_id, automated, changed_by)
    SELECT property_id, true, auth.uid() FROM public.ao_home_plan_cards WHERE id = _plan_card;
  END IF;
  RETURN ok;
END $function$

