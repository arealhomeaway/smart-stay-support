-- Exact rollback of 0170 (all objects new). Only valid immediately after apply.
DROP TABLE IF EXISTS public.handoff_carryovers, public.handoff_step_history, public.home_handoff_decisions, public.handoff_link_suggestions, public.handoff_standard_history, public.handoff_requirements;
DROP FUNCTION IF EXISTS public.preserve_handoff_history();
DROP FUNCTION IF EXISTS public.read_handoff_standard();
DROP FUNCTION IF EXISTS public.confirm_handoff_suggestion(uuid);
DROP FUNCTION IF EXISTS public.save_handoff_requirement(jsonb);
DROP FUNCTION IF EXISTS public.can_edit_handoff_standard();
