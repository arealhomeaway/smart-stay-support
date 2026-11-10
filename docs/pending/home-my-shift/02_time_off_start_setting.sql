-- The Request time off start date (register S4): Nov 16, 2026. A data step, applied
-- with the database data tool. The app and request_time_off already default to
-- Nov 16 when this row is missing, so it changes nothing today; it makes the date
-- a visible setting an Admin can move. Undo: 02_undo_time_off_start_setting.sql.
INSERT INTO public.app_settings(key, value)
VALUES ('time_off_requests_start', to_jsonb('2026-11-16'::text))
ON CONFLICT (key) DO NOTHING;
