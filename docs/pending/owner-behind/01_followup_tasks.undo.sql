-- Undo 01: removes only the new objects. No live definition was replaced.
DROP FUNCTION IF EXISTS public.close_owner_followup(uuid);
DROP POLICY IF EXISTS owner_followup_tasks_read ON public.owner_followup_tasks;
DROP TABLE IF EXISTS public.owner_followup_tasks;
