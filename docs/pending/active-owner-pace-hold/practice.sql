-- Practice for active-owner-pace-hold: apply.sql unchanged, the cases on DEMO Willow Creek Cottage (demo owner),
-- apply.undo.sql unchanged, read back, all in one transaction that always rolls back
-- (the last statement raises 'PRACTICE ROLLED BACK').
CREATE TEMP TABLE _out (n serial, line text) ON COMMIT DROP;
CREATE TEMP TABLE _counts ON COMMIT DROP AS SELECT
  (SELECT count(*) FROM public.owner_notifications) AS notices, (SELECT count(*) FROM public.email_log) AS emails,
  (SELECT count(*) FROM public.home_chat_messages) AS chat,
  (SELECT count(*) FROM public.owner_time_entries WHERE program_id = '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe') AS shannon_entries;
-- ===== apply.sql (unchanged) =====
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
-- ===== Practice cases =====
DO $practice$
DECLARE P uuid := 'e341b2b0-a6cf-40b3-9d1c-ff7584aec196'; OWNER text := 'b1d78033-d2d4-4e05-8b2d-3c1cbcd8a443';
  S uuid := '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe'; ADMIN uuid := '98bd6696-4018-4965-b645-0471c5ae3925';
  H uuid := 'a0000000-0000-4000-8000-00000000a001'; d date := private.business_today(); e1 uuid; e2 uuid; c1 uuid; h timestamptz;
  held text := 'none';
BEGIN
  SELECT pace_emails_held_until INTO h FROM public.owner_programs WHERE id = P;
  INSERT INTO _out(line) VALUES ('0 start: demo hold ' || coalesce(h::text, 'none'));

  -- 1 and 2: the homeowner logs and then edits her own entry, signed in as her.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', OWNER, 'role', 'authenticated')::text, true);
  e1 := public.log_owner_time_entry(jsonb_build_object('programId', P, 'phase', 'ongoing', 'entryDate', d, 'minutes', 30,
    'activity', 'Practice pace hold check', 'attachmentPaths', '[]'::jsonb, 'confirmed', true), ARRAY[H]);
  SELECT pace_emails_held_until INTO h FROM public.owner_programs WHERE id = P;
  INSERT INTO _out(line) VALUES ('1 homeowner log: hold ' || coalesce(h::text, 'none'));
  e2 := public.owner_update_time_entry(e1, '{"mode":"edit","minutes":"35"}'::jsonb);
  SELECT pace_emails_held_until INTO h FROM public.owner_programs WHERE id = P;
  INSERT INTO _out(line) VALUES ('2 homeowner edit (amends ' || ((SELECT amends_entry_id FROM public.owner_time_entries WHERE id = e2) = e1)::text
    || '): hold ' || coalesce(h::text, 'none'));
  PERFORM set_config('request.jwt.claims', '', true);

  -- 3: a team correction through the existing action.
  c1 := public.correct_owner_time_entry('e3b87270-f840-4e01-b350-d5b54c87aca9', ADMIN, 40, 'Practice team correction');
  SELECT pace_emails_held_until INTO h FROM public.owner_programs WHERE id = P;
  INSERT INTO _out(line) VALUES ('3 team correction: hold set ' || (h IS NOT NULL)::text || ', 7 days from now '
    || (abs(extract(epoch FROM h - (now() + interval '7 days'))) < 1)::text || ', resumes ' || to_char(h AT TIME ZONE 'America/Chicago', 'Mon FMDD'));

  -- 4: a data fix that sets an amends link (no signed-in user), like shannon-hours-links.
  UPDATE public.owner_programs SET pace_emails_held_until = NULL WHERE id = P;
  EXECUTE 'ALTER TABLE public.owner_time_entries DISABLE TRIGGER owner_time_write_guard';
  UPDATE public.owner_time_entries SET amends_entry_id = '2b1f3c53-9819-4625-be92-fc01e44523d5',
         correction_reason = 'Practice data fix' WHERE id = '527d569b-de67-4f6f-b45e-8792060f293b';
  EXECUTE 'ALTER TABLE public.owner_time_entries ENABLE TRIGGER owner_time_write_guard';
  SELECT pace_emails_held_until INTO h FROM public.owner_programs WHERE id = P;
  INSERT INTO _out(line) VALUES ('4 data fix amends link: hold set ' || (h IS NOT NULL)::text);

  -- 5: a data fix that sets only a correction reason.
  UPDATE public.owner_programs SET pace_emails_held_until = NULL WHERE id = P;
  EXECUTE 'ALTER TABLE public.owner_time_entries DISABLE TRIGGER owner_time_write_guard';
  UPDATE public.owner_time_entries SET correction_reason = 'Practice reason only' WHERE id = c1;
  EXECUTE 'ALTER TABLE public.owner_time_entries ENABLE TRIGGER owner_time_write_guard';
  SELECT pace_emails_held_until INTO h FROM public.owner_programs WHERE id = P;
  INSERT INTO _out(line) VALUES ('5 data fix correction reason: hold set ' || (h IS NOT NULL)::text);

  -- 6: a review decision (no link, no reason change) never sets it.
  UPDATE public.owner_programs SET pace_emails_held_until = NULL WHERE id = P;
  EXECUTE 'ALTER TABLE public.owner_time_entries DISABLE TRIGGER owner_time_write_guard';
  UPDATE public.owner_time_entries SET review_note = 'Practice note' WHERE id = c1;
  EXECUTE 'ALTER TABLE public.owner_time_entries ENABLE TRIGGER owner_time_write_guard';
  SELECT pace_emails_held_until INTO h FROM public.owner_programs WHERE id = P;
  INSERT INTO _out(line) VALUES ('6 other field change: hold ' || coalesce(h::text, 'none'));

  INSERT INTO _out(line) SELECT format('7 Shannon: hold %s, entries %s, counted %s, minutes %s',
    coalesce((SELECT pace_emails_held_until::text FROM public.owner_programs WHERE id = S), 'none'),
    (SELECT count(*) FROM public.owner_time_entries WHERE program_id = S),
    (SELECT count(*) FROM public.owner_time_entries e WHERE program_id = S AND NOT EXISTS (SELECT 1 FROM public.owner_time_entries a WHERE a.amends_entry_id = e.id)),
    (SELECT sum(minutes) FROM public.owner_time_entries e WHERE program_id = S AND NOT EXISTS (SELECT 1 FROM public.owner_time_entries a WHERE a.amends_entry_id = e.id)));
  INSERT INTO _out(line) SELECT format('8 new owner notices %s, new emails %s, new chat lines %s, hours lock on %s',
    (SELECT count(*) FROM public.owner_notifications) - c.notices, (SELECT count(*) FROM public.email_log) - c.emails,
    (SELECT count(*) FROM public.home_chat_messages) - c.chat,
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.owner_time_entries'::regclass AND tgname = 'owner_time_write_guard' AND tgenabled = 'O'))
    FROM _counts c;
END $practice$;
-- ===== apply.undo.sql (unchanged) =====
-- Undo active-owner-pace-hold: removes the rule, its function and the column. Hour entries are untouched.
DROP TRIGGER IF EXISTS owner_time_correction_pace_hold ON public.owner_time_entries;
DROP FUNCTION IF EXISTS private.hold_pace_after_correction();
ALTER TABLE public.owner_programs DROP COLUMN IF EXISTS pace_emails_held_until;
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'active_owner_pace_hold.undo', 'function', 'pace emails held after a correction',
  'Undo of active-owner-pace-hold: pace notices follow the normal rules again.');
DO $check$
BEGIN
  INSERT INTO _out(line) SELECT format('after undo: column gone %s, rule gone %s, trigger gone %s',
    NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'owner_programs' AND column_name = 'pace_emails_held_until'),
    NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'private' AND p.proname = 'hold_pace_after_correction'),
    NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.owner_time_entries'::regclass AND tgname = 'owner_time_correction_pace_hold'));
  RAISE EXCEPTION 'PRACTICE ROLLED BACK: %', (SELECT string_agg(line, ' | ' ORDER BY n) FROM _out);
END $check$;
