-- Alerts and approvals, data step: the Team Queue timing setting (Emily, Nov 7, 2026).
-- Undo: 06_undo_team_queue_timing_setting.sql. Applied with the data tool, not as a migration.
--
-- Read by the minute check (supervisor and director minutes) and by the Team Queue screen (red
-- times). Today: red 2 hours before the day shift ends (5 PM) and again 2 hours before the night
-- shift ends (10 PM). Routine: red when it passes its problem type's start standard, else 24 hours.
-- A later edit on the Logic page needs no code change.

INSERT INTO public.app_settings(key, value)
VALUES ('team_queue_timing', jsonb_build_object(
  'right_now_red_minutes', 3,
  'supervisor_minutes', 10,
  'director_minutes', 15,
  'today_day_shift_ends', '17:00',
  'today_night_shift_ends', '22:00',
  'today_red_minutes_before', 120,
  'routine_default_hours', 24
))
ON CONFLICT (key) DO NOTHING;
