-- Undo for 02_flag_snapshot_table.sql. Run only after 03's undo (it reads this table). No BEGIN/COMMIT.
DROP TABLE IF EXISTS public.onboarding_flag_snapshots;
