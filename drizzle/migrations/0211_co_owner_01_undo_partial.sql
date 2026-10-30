DROP POLICY program_members_read ON public.program_members;
DROP FUNCTION private.is_program_member(uuid,uuid);
COMMENT ON TABLE public.program_members IS 'DEPRECATED: rolled back co-owner 01; empty, RLS on, no policies. Drop pending approval.';