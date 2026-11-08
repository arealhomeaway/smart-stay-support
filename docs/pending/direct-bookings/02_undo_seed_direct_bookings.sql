-- Undo for 02_seed_direct_bookings.sql. Removes only the rows that file added.
DELETE FROM public.email_templates WHERE name IN ('Direct booking reply', 'Direct booking follow-up') AND 'direct_booking' = ANY(contexts);
DELETE FROM public.app_settings WHERE key = 'direct_booking_settings';
