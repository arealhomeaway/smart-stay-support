-- Direct Bookings: Overnight reply clock starts at, default 9:00 AM Central (Emily, Nov 8, 2026;
-- register D3 and K2). Data only: adds one key to the existing direct_booking_settings value.
-- Every other key is kept exactly. The app reads it everywhere the reply clock is read.
-- Runs once: does nothing if the key is already there.
WITH before AS (
  SELECT value FROM public.app_settings WHERE key = 'direct_booking_settings' AND NOT (value ? 'overnightClockStart')
), upd AS (
  UPDATE public.app_settings s
     SET value = s.value || jsonb_build_object('overnightClockStart', '09:00'), updated_at = now()
    FROM before
   WHERE s.key = 'direct_booking_settings'
  RETURNING s.value
)
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, before_value, after_value)
SELECT NULL, 'Direct Bookings setup', 'direct_booking_settings_changed', 'app_settings', 'Direct Bookings settings',
       'Overnight reply clock starts at 9:00 AM (register D3)', (SELECT value FROM before), upd.value
  FROM upd;
