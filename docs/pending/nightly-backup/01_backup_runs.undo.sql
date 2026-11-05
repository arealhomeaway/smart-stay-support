-- Undo Step 1. Removes the run history (backups already in SharePoint stay there).
DROP TABLE IF EXISTS public.backup_runs;
