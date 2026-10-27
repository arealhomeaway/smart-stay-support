-- Undo for pending 0165. Neither function existed before (verified read-only Oct 27 2026), so undo drops both.
-- No table, column, trigger, policy or data is created or altered by 0165; audit rows already written are kept as history.
DROP FUNCTION IF EXISTS public.bulk_update_onboarding_home_tasks(uuid, uuid[], boolean, date, boolean, text, boolean, text, boolean, boolean, boolean, boolean, boolean, text);
DROP FUNCTION IF EXISTS private.write_onboarding_task_bulk_audit(uuid, jsonb);
