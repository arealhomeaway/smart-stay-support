-- Undo active-owner-pace-hold: removes the rule, its function and the column. Hour entries are untouched.
DROP TRIGGER IF EXISTS owner_time_correction_pace_hold ON public.owner_time_entries;
DROP FUNCTION IF EXISTS private.hold_pace_after_correction();
ALTER TABLE public.owner_programs DROP COLUMN IF EXISTS pace_emails_held_until;
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'active_owner_pace_hold.undo', 'function', 'pace emails held after a correction',
  'Undo of active-owner-pace-hold: pace notices follow the normal rules again.');
