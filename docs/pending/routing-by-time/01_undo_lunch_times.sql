-- Undo for 01_lunch_times.sql: removes the two lunch columns and their check.
-- Apply only after 03_undo_coordinator_routing.sql (the routing functions read these columns).
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.

ALTER TABLE public.coverage_shifts DROP CONSTRAINT IF EXISTS coverage_shifts_lunch_chk;
ALTER TABLE public.coverage_shifts DROP COLUMN IF EXISTS lunch_end_minute;
ALTER TABLE public.coverage_shifts DROP COLUMN IF EXISTS lunch_start_minute;
