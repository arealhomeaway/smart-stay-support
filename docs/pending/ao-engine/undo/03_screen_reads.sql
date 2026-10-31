-- Undo for 03_screen_reads.sql. 03 replaced no live object and wrote no rows, so undo is plain removal.
DROP FUNCTION IF EXISTS public.ao_owner_plan(uuid);
DROP FUNCTION IF EXISTS public.ao_preview_home_automation(uuid,uuid[]);
