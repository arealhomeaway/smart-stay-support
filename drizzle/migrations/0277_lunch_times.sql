-- Routing by time, part 1: lunch hours as real times. Staged only. Not applied until approved.
-- Undo: 01_undo_lunch_times.sql
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.
--
-- Adds two optional columns to coverage_shifts (minutes after midnight, Central,
-- the same unit as start_minute and end_minute) and fills them from the
-- approved lunch text. Nothing else about any shift changes.
--   Guest Experience day and weekend (ge_day)        13:00-14:00 Thursday to Monday
--   Guest Experience evening (ge_evening)             16:00-17:00 Saturday to Wednesday
--   Property Operations weekday day (po_day)          13:00-14:00 Monday to Friday
--   Property Operations evening and weekend (po_evening) 15:00-16:00 Monday to Friday
--   Guest Experience part time (ge_parttime): no lunch. Operations Supervisor: not a
--   coordinator, left empty.

ALTER TABLE public.coverage_shifts ADD COLUMN IF NOT EXISTS lunch_start_minute integer;
ALTER TABLE public.coverage_shifts ADD COLUMN IF NOT EXISTS lunch_end_minute integer;
COMMENT ON COLUMN public.coverage_shifts.lunch_start_minute IS
  'Optional lunch start, minutes after midnight Central. New work skips the role during lunch while another coordinator is on shift.';
COMMENT ON COLUMN public.coverage_shifts.lunch_end_minute IS
  'Optional lunch end, minutes after midnight Central (exclusive).';

UPDATE public.coverage_shifts SET lunch_start_minute = 780, lunch_end_minute = 840
 WHERE role_code = 'ge_day' AND weekday IN (4, 5, 6, 0, 1);
UPDATE public.coverage_shifts SET lunch_start_minute = 960, lunch_end_minute = 1020
 WHERE role_code = 'ge_evening' AND weekday IN (6, 0, 1, 2, 3);
UPDATE public.coverage_shifts SET lunch_start_minute = 780, lunch_end_minute = 840
 WHERE role_code = 'po_day' AND weekday IN (1, 2, 3, 4, 5);
UPDATE public.coverage_shifts SET lunch_start_minute = 900, lunch_end_minute = 960
 WHERE role_code = 'po_evening' AND weekday IN (1, 2, 3, 4, 5);

ALTER TABLE public.coverage_shifts ADD CONSTRAINT coverage_shifts_lunch_chk CHECK (
  (lunch_start_minute IS NULL AND lunch_end_minute IS NULL)
  OR (lunch_start_minute >= 0 AND lunch_end_minute <= 1440 AND lunch_start_minute < lunch_end_minute));
