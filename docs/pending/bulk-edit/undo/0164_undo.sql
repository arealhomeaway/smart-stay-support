-- UNDO for 0164_bulk_template_step_edit.sql
-- Neither function existed before 0164 (verified 2026-10-27 via pg_proc fingerprint: zero rows).
-- Undo therefore drops both new objects. No table or data changes were made by 0164.

DROP FUNCTION IF EXISTS public.bulk_update_onboarding_template_steps(uuid, uuid[], boolean, integer, text, boolean, text, boolean, text, boolean, boolean, boolean, boolean, boolean, text);
DROP FUNCTION IF EXISTS private.write_onboarding_template_bulk_audit(uuid, uuid, text, jsonb, jsonb);
