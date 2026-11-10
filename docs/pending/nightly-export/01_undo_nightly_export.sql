-- Undo for 01_nightly_export.sql. Removes the two new jobs, the functions, policies, tables and the
-- new backup_runs fields. The existing nightly backup jobs, backup_runs rows and their Admin read
-- rule are left exactly as they were.
DO $do$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('nightly-export-continue', 'nightly-export-missed-check');
END $do$;
DROP FUNCTION IF EXISTS private.nightly_export_missed_check(timestamptz);
DROP FUNCTION IF EXISTS public.nightly_export_alert(text, text, text);
DROP FUNCTION IF EXISTS public.backup_list_files();
DROP POLICY IF EXISTS "Export check readers read backup runs" ON public.backup_runs;
DROP TABLE IF EXISTS public.backup_export_alerts;
DROP TABLE IF EXISTS public.backup_file_copies;
DROP FUNCTION IF EXISTS public.can_view_export_check(uuid);
DROP INDEX IF EXISTS public.backup_runs_one_export_per_night;
ALTER TABLE public.backup_runs DROP CONSTRAINT IF EXISTS backup_runs_verify_status_check;
ALTER TABLE public.backup_runs DROP CONSTRAINT IF EXISTS backup_runs_phase_check;
ALTER TABLE public.backup_runs DROP CONSTRAINT IF EXISTS backup_runs_kind_check;
ALTER TABLE public.backup_runs
  DROP COLUMN IF EXISTS verified_at,
  DROP COLUMN IF EXISTS verify_result,
  DROP COLUMN IF EXISTS verify_reasons,
  DROP COLUMN IF EXISTS verify_status,
  DROP COLUMN IF EXISTS manifest_sha256,
  DROP COLUMN IF EXISTS bytes_copied,
  DROP COLUMN IF EXISTS files_copied,
  DROP COLUMN IF EXISTS files_inventoried,
  DROP COLUMN IF EXISTS total_rows,
  DROP COLUMN IF EXISTS table_count,
  DROP COLUMN IF EXISTS sharepoint_path,
  DROP COLUMN IF EXISTS lease_until,
  DROP COLUMN IF EXISTS progress,
  DROP COLUMN IF EXISTS phase,
  DROP COLUMN IF EXISTS weekly,
  DROP COLUMN IF EXISTS kind;
