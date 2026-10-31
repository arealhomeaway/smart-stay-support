-- Undo 01. Nothing live was replaced, so undo only drops what 01 created (run undo 02 first).
DROP FUNCTION IF EXISTS public.report_entry_labels(uuid[]);
DROP FUNCTION IF EXISTS public.record_report_wording_use(uuid,text,uuid,text,int);
DROP FUNCTION IF EXISTS public.report_wording_save(jsonb,text);
DROP FUNCTION IF EXISTS public.report_wording_current();
DROP TABLE IF EXISTS public.report_wording_uses;
DROP TABLE IF EXISTS public.report_legacy_card_map;
DROP TABLE IF EXISTS public.report_wording_versions;
