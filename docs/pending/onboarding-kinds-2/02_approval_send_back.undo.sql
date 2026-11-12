-- Undo for 02. Removes the two functions; notes, history and notifications already written stay.
DROP FUNCTION IF EXISTS public.approval_task_send_back(uuid, text);
DROP FUNCTION IF EXISTS public.approval_task_reviewer(uuid);
