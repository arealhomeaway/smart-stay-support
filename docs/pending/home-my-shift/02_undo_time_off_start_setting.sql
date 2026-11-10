-- Undo for 02_time_off_start_setting.sql: removes only that row. Requests then
-- open on the built in default, Nov 16, 2026.
DELETE FROM public.app_settings WHERE key = 'time_off_requests_start';
