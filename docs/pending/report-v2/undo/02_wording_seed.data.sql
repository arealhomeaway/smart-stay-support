-- Undo 02: removes exactly wording version 1, only if no report recorded it and no later version exists.
DELETE FROM public.report_wording_versions WHERE version = 1
  AND NOT EXISTS (SELECT 1 FROM public.report_wording_uses WHERE wording_version = 1)
  AND NOT EXISTS (SELECT 1 FROM public.report_wording_versions WHERE version > 1);
