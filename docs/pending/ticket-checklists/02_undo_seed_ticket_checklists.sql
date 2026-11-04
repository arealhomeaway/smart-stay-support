-- Undo 02 (run before 01 undo). Switches off every category, then removes
-- seeded version-1 checklists that no ticket has used. Used versions are retired, not removed.
UPDATE public.feature_flags SET enabled = false WHERE key IN ('checklist_lockout','checklist_cleaning','checklist_maintenance','checklist_other_complaint','checklist_damage','checklist_booking');
SELECT set_config('resolve.checklist_publish', 'on', true);
UPDATE public.playbooks p SET status = 'retired', retired_at = now()
  WHERE p.checklist IS NOT NULL AND p.version = 1 AND p.source = 'imported' AND p.status = 'approved'
    AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.checklist_playbook_id = p.id);
DELETE FROM public.playbooks p
  WHERE p.checklist IS NOT NULL AND p.version = 1 AND p.source = 'imported'
    AND NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.checklist_playbook_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.playbooks n WHERE n.supersedes_id = p.id);
DELETE FROM public.feature_flags WHERE key IN ('checklist_lockout','checklist_cleaning','checklist_maintenance','checklist_other_complaint','checklist_damage','checklist_booking') AND enabled = false;
