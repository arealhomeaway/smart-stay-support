-- Undo for 01_databases.sql. History lines already written stay (nothing is deleted
-- from claim or refund history). The menu switch row is removed, so Guest Claims &
-- Refunds counts as off until the row is added again.
DROP FUNCTION IF EXISTS public.databases_save_claim_or_refund(text, uuid, jsonb, timestamptz);
DROP FUNCTION IF EXISTS public.can_edit_claims_in_databases(uuid);
DELETE FROM public.feature_flags WHERE key = 'claims_menu';
