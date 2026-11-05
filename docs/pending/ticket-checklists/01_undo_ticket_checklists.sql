-- Undo 01. Keeps the new columns and every saved answer (marked retired) so
-- no ticket history is lost; removes the publish action and the guards.
DROP FUNCTION IF EXISTS public.publish_ticket_checklist(text, text, jsonb, text, text);
DROP TRIGGER IF EXISTS ticket_steps_checklist_answer ON public.ticket_steps;
DROP TRIGGER IF EXISTS tickets_checklist_pin ON public.tickets;
DROP TRIGGER IF EXISTS playbooks_checklist_guard ON public.playbooks;
DROP FUNCTION IF EXISTS private.guard_checklist_answer();
DROP FUNCTION IF EXISTS private.guard_ticket_checklist_pin();
DROP FUNCTION IF EXISTS private.guard_checklist_playbook();
DROP INDEX IF EXISTS public.ticket_steps_checklist_idx;
DROP INDEX IF EXISTS public.playbooks_one_live_checklist;
COMMENT ON COLUMN public.playbooks.checklist IS 'DEPRECATED: guided ticket checklists turned off';
COMMENT ON COLUMN public.playbooks.checklist_category IS 'DEPRECATED: guided ticket checklists turned off';
COMMENT ON COLUMN public.playbooks.sop_url IS 'DEPRECATED: guided ticket checklists turned off';
COMMENT ON COLUMN public.tickets.checklist_playbook_id IS 'DEPRECATED: guided ticket checklists turned off';
COMMENT ON COLUMN public.tickets.checklist_category IS 'DEPRECATED: guided ticket checklists turned off';
COMMENT ON COLUMN public.ticket_steps.step_key IS 'DEPRECATED: guided ticket checklists turned off';
