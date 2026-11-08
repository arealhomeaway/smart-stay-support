-- Undo for 05_discount_sources.sql: removes the saved record list. No BEGIN/COMMIT.
-- The app then falls back to the same three records it uses today.

UPDATE public.app_settings
   SET value = value - 'discountSourceIds', updated_at = now()
 WHERE key = 'direct_booking_settings';
