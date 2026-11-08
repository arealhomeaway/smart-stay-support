-- Fix batch 2, item 10: Admin can also save Direct Bookings settings (approval dates,
-- rates, the after period switch). Quote approval is unchanged.
-- Only the permission check changes; the rest is the live definition.

CREATE OR REPLACE FUNCTION public.save_direct_booking_settings(_value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.holds_functional_role(auth.uid(), 'ops_supervisor') OR public.holds_functional_role(auth.uid(), 'director_ops') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Only the Operations Supervisor, the Director of Operations or Admin can change these settings.';
  END IF;
  INSERT INTO public.app_settings(key, value, updated_by, updated_at)
  VALUES ('direct_booking_settings', _value, auth.uid(), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_label, after_value)
  VALUES (auth.uid(), 'direct_booking_settings_changed', 'app_settings', 'Direct Bookings settings', _value);
  RETURN public.direct_booking_settings();
END $function$;
