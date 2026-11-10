-- Undo for 02_export_settings.sql.
DELETE FROM public.app_settings WHERE key = 'nightly_export_settings';
