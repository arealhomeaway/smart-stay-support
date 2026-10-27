REVOKE EXECUTE ON FUNCTION public.read_home_handoff_standard(uuid),public.decide_home_handoff_requirement(uuid,uuid,text,text) FROM authenticated;
-- Keep helper and tables for historical links, not accessible as user actions.
