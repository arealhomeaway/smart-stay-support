-- Undo for 01_full_backups.sql. Removes the backup record table and the three backup readers.
-- The files already saved in the backups storage bucket are not touched.
DROP FUNCTION IF EXISTS public.backup_read_table(text, integer, integer);
DROP FUNCTION IF EXISTS public.backup_list_tables();
DROP FUNCTION IF EXISTS public.backup_secret_column(text);
DROP TABLE IF EXISTS public.full_backups;
