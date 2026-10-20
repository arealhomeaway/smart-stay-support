-- UNAPPLIED UNDO for 0155_email_job_run_audit.sql.
-- Reverses ONLY the owner-notification callback condition change made by 0155:
-- removes "NEW.email_job_run_id IS NULL AND " from the pending-email condition in
-- private.dispatch_owner_notification_email(), restoring the pre-0155 behavior.
-- The email_job_runs table, audit columns and run RPCs are intentionally kept
-- (audit data is preserved); only the callback gate is restored.
-- Safe find-and-replace: refuses to run unless the 0155-added text is found
-- exactly once in the current function definition.
DO $undo$
DECLARE
  def text;
  added text := 'IF NEW.email_job_run_id IS NULL AND NEW.email_status = ''pending'' AND NOT coalesce(NEW.is_demo,false) THEN';
  restored text := 'IF NEW.email_status = ''pending'' AND NOT coalesce(NEW.is_demo,false) THEN';
  occurrences int;
BEGIN
  def := pg_get_functiondef('private.dispatch_owner_notification_email()'::regprocedure);
  occurrences := (length(def) - length(replace(def, added, ''))) / length(added);
  IF occurrences <> 1 THEN
    RAISE EXCEPTION 'Undo refused: expected the 0155 condition exactly once in private.dispatch_owner_notification_email, found %', occurrences;
  END IF;
  EXECUTE replace(def, added, restored);
END $undo$;
