-- Undo 02: removes only the overnightClockStart key. The app then falls back to its
-- built-in default of 9:00 AM, so the screen does not change.
UPDATE public.app_settings SET value = value - 'overnightClockStart', updated_at = now()
 WHERE key = 'direct_booking_settings' AND value ? 'overnightClockStart';
