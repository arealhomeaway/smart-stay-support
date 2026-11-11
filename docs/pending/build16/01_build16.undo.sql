-- Undo for Build 16: puts back the live rules exactly as they were on Nov 11.
DROP TRIGGER IF EXISTS breezeway_finished_check_step ON public.breezeway_work_orders;
DROP FUNCTION IF EXISTS private.breezeway_finished_check_step();

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

-- The two switches are left in place (off) so no screen ever reads a missing switch as on;
-- remove them only if the screens are rolled back too:
-- DELETE FROM public.feature_flags WHERE key IN ('arrival_ready_button', 'finance_packet_button');
