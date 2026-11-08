-- Clean slate, optional part 1b (needs Emily's separate yes). STAGED ONLY.
-- Run only after 01. Removes the permanent audit log lines about tickets that no longer exist
-- (853 on Nov 8) and the integration log lines about them (397). Without this step those lines
-- stay, pointing at tickets that are gone; they are also in the backup.
-- Switches off the audit log block only inside this step. Undo: restore from the backup.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.full_backups
     WHERE status = 'succeeded' AND verify_ok IS TRUE AND finished_at >= now() - interval '2 hours'
  ) THEN
    RAISE EXCEPTION 'Clean slate refused: no checked full backup in the last 2 hours. Press Back up everything, then Verify, then try again.';
  END IF;
END $$;

ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_immutable;
DELETE FROM public.audit_log
 WHERE entity_type = 'ticket' AND entity_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = audit_log.entity_id);
ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_immutable;
DELETE FROM public.integration_events
 WHERE entity_type = 'ticket' AND entity_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = integration_events.entity_id);
