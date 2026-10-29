-- Undo for 01_plan_and_schedule.sql. Apply undo-perform_handoff_step.sql FIRST.
DROP FUNCTION IF EXISTS public.after_handoff_schedule_add_one_off(uuid,uuid,text,uuid,text,date,text);
DROP FUNCTION IF EXISTS public.after_handoff_schedule_update(uuid,text,date,text);
DROP FUNCTION IF EXISTS private.schedule_after_handoff(uuid,uuid);
DROP FUNCTION IF EXISTS public.after_handoff_plan_reorder(uuid[]);
DROP FUNCTION IF EXISTS public.after_handoff_plan_set_active(uuid,boolean);
DROP FUNCTION IF EXISTS public.after_handoff_plan_save(uuid,text,text,uuid,integer,text);
DROP FUNCTION IF EXISTS private.after_handoff_source_title(text,uuid);
DROP FUNCTION IF EXISTS public.after_handoff_access();
DROP FUNCTION IF EXISTS private.after_handoff_followup_manager();
DROP FUNCTION IF EXISTS private.after_handoff_plan_editor();
DELETE FROM public.coverage_overrides WHERE role_code='active_owner_followup';
DELETE FROM public.functional_roles WHERE code='active_owner_followup';
DROP TABLE IF EXISTS public.after_handoff_schedule_events;
DROP TABLE IF EXISTS public.after_handoff_schedule;
DROP TABLE IF EXISTS public.after_handoff_plan_events;
DROP TABLE IF EXISTS public.after_handoff_plan_items;
DROP FUNCTION IF EXISTS private.block_after_handoff_history_change();
