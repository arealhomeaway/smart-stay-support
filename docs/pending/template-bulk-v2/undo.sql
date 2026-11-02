-- Exact undo for 01_bulk_v2.sql. Only the two new functions are removed; nothing was replaced.
DROP FUNCTION IF EXISTS public.template_bulk_v2_ready();
DROP FUNCTION IF EXISTS public.bulk_update_onboarding_template_steps_v2(uuid, uuid[], boolean, jsonb, boolean, text, boolean, boolean);
