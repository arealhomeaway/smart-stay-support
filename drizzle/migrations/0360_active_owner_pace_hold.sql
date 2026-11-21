-- active-owner-pace-hold: hold pace emails for 7 days after the team or a data fix changes a homeowner's
-- counted hours. Adds one column on owner_programs and one rule on owner_time_entries. Nothing else changes.
-- The five-minute pass (src/lib/pace-hold.ts) skips pace, checkpoint, milestone and quiet notices while
-- pace_emails_held_until is in the future; celebration and final days notices and team follow-ups still run.

-- 1. The date.
ALTER TABLE public.owner_programs ADD COLUMN IF NOT EXISTS pace_emails_held_until timestamptz;
COMMENT ON COLUMN public.owner_programs.pace_emails_held_until IS
  'Pace, checkpoint, milestone and quiet-week owner notices are not sent until this time. Set to now + 7 days when anyone other than the homeowner herself records a correction, an amends link or a correction reason on her hours.';

-- 2. The rule. A correction entry, an amends link or a correction reason, written by anyone other than the
-- homeowner who owns the entry (the team, a server action, or a data fix with no signed-in user), sets the
-- hold to 7 days from now. Her own log, edit, add more or resubmit is signed in as her and never sets it.
CREATE OR REPLACE FUNCTION private.hold_pace_after_correction()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.amends_entry_id IS NULL AND NEW.correction_reason IS NULL THEN RETURN NULL; END IF;
  ELSIF NEW.amends_entry_id IS NOT DISTINCT FROM OLD.amends_entry_id
        AND NEW.correction_reason IS NOT DISTINCT FROM OLD.correction_reason THEN
    RETURN NULL;
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.owner_user_id THEN RETURN NULL; END IF;
  UPDATE public.owner_programs SET pace_emails_held_until = now() + interval '7 days' WHERE id = NEW.program_id;
  RETURN NULL;
END $function$;
REVOKE ALL ON FUNCTION private.hold_pace_after_correction() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER owner_time_correction_pace_hold
  AFTER INSERT OR UPDATE OF amends_entry_id, correction_reason ON public.owner_time_entries
  FOR EACH ROW EXECUTE FUNCTION private.hold_pace_after_correction();

INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'active_owner_pace_hold.apply', 'function', 'pace emails held after a correction',
  'A team or data correction of homeowner hours holds pace, checkpoint, milestone and quiet notices for 7 days. Undo: docs/pending/active-owner-pace-hold/apply.undo.sql.');
