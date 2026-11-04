-- Undo for 01_notion_ticket_import.sql. Run only if no import has been run, or after
-- archiving imported tickets; dropping columns removes the list and comment-author data.
DROP FUNCTION IF EXISTS public.import_notion_ticket_file(uuid, jsonb);
DROP FUNCTION IF EXISTS public.import_notion_ticket_comments(uuid, jsonb);
DROP FUNCTION IF EXISTS public.import_notion_ticket(jsonb);

-- Restore trigger definitions exactly as captured live on Nov 4, 2026.
DROP TRIGGER tickets_auto_assign ON public.tickets;
CREATE TRIGGER tickets_auto_assign BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION auto_assign_ticket();
DROP TRIGGER tickets_audit_auto_assign ON public.tickets;
CREATE TRIGGER tickets_audit_auto_assign AFTER INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION audit_ticket_auto_assign();
DROP TRIGGER tickets_priority_authority ON public.tickets;
CREATE TRIGGER tickets_priority_authority BEFORE INSERT OR UPDATE OF priority ON public.tickets FOR EACH ROW EXECUTE FUNCTION enforce_ticket_priority_authority();
DROP TRIGGER notify_ticket_events_trg ON public.tickets;
CREATE TRIGGER notify_ticket_events_trg AFTER INSERT OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION notify_ticket_events();
DROP TRIGGER notify_ticket_flow_events_trg ON public.tickets;
CREATE TRIGGER notify_ticket_flow_events_trg AFTER UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION notify_ticket_flow_events();
DROP TRIGGER sync_ticket_work_item ON public.tickets;
CREATE TRIGGER sync_ticket_work_item AFTER INSERT OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION sync_ticket_work_item();
DROP TRIGGER tickets_notify_owner ON public.tickets;
CREATE TRIGGER tickets_notify_owner AFTER INSERT OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION notify_owner_of_ticket();
DROP TRIGGER tickets_owner_opportunity ON public.tickets;
CREATE TRIGGER tickets_owner_opportunity AFTER INSERT OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION sync_ticket_opportunity_trigger();
DROP TRIGGER tickets_insurance_risk_log ON public.tickets;
CREATE TRIGGER tickets_insurance_risk_log AFTER INSERT OR UPDATE OF insurance_risk ON public.tickets FOR EACH ROW EXECUTE FUNCTION log_ticket_insurance_risk();
DROP TRIGGER tickets_feedback_linked_work ON public.tickets;
CREATE TRIGGER tickets_feedback_linked_work AFTER INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION log_feedback_linked_work();
DROP TRIGGER tickets_roll_quarterly_review ON public.tickets;
CREATE TRIGGER tickets_roll_quarterly_review AFTER UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION roll_quarterly_review();
DROP TRIGGER handoff_carryover_ticket_completed ON public.tickets;
CREATE TRIGGER handoff_carryover_ticket_completed AFTER UPDATE OF status ON public.tickets FOR EACH ROW EXECUTE FUNCTION complete_handoff_carryover_tasks();

DROP INDEX IF EXISTS public.ticket_activity_external_once;
ALTER TABLE public.ticket_activity DROP COLUMN IF EXISTS external_id;
ALTER TABLE public.ticket_activity DROP COLUMN IF EXISTS external_author_name;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_import_hold_chk;
ALTER TABLE public.tickets DROP COLUMN IF EXISTS import_hold;
-- tickets_external_unique pre-existed and is intentionally kept.
