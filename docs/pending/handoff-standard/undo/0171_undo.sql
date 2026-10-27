-- Exact rollback of 0171 (all objects new).
DROP FUNCTION IF EXISTS public.decide_home_handoff_requirement(uuid,uuid,text,text);
DROP FUNCTION IF EXISTS public.read_home_handoff_standard(uuid);
DROP FUNCTION IF EXISTS public.home_handoff_requirement_states(uuid);
