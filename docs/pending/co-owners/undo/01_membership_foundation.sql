-- Exact absence restoration. Use only before any real membership is added.
DROP POLICY program_members_read ON public.program_members;
DROP FUNCTION private.is_program_member(uuid,uuid);
DROP TABLE public.program_members;