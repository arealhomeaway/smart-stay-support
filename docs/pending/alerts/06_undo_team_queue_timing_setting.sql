-- Undo for 06_team_queue_timing_setting.sql (data tool). The minute check and the screen fall
-- back to the same values when the setting is missing.
DELETE FROM public.app_settings WHERE key = 'team_queue_timing';
