CREATE OR REPLACE FUNCTION public.save_direct_booking_settings(_value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.holds_functional_role(auth.uid(), 'ops_supervisor') OR public.holds_functional_role(auth.uid(), 'director_ops')) THEN
    RAISE EXCEPTION 'Only the Operations Supervisor or the Director of Operations can change these settings.';
  END IF;
  INSERT INTO public.app_settings(key, value, updated_by, updated_at)
  VALUES ('direct_booking_settings', _value, auth.uid(), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_label, after_value)
  VALUES (auth.uid(), 'direct_booking_settings_changed', 'app_settings', 'Direct Bookings settings', _value);
  RETURN public.direct_booking_settings();
END $function$
