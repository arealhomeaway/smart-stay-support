-- guest-ready-standards (Operations walkthrough, Nov 24). Requires ticket-due-date applied first (tickets.due_on,
-- private.ticket_due_on_default, set_ticket_due_on). Additive: one new table, one new column, rules replaced in place.
-- 1. public.guest_ready_standards: one row per ticket type (Ticket type, Must be done, Locked or Team can change).
--    Everyone on staff reads it; Supervisors, Directors and Admin save rows only through save_guest_ready_standard
--    (public.can_save_playbooks, the playbook editor rule). Rows are never deleted.
-- 2. tickets.due_locked: true when the ticket's row is Locked.
-- 3. private.ticket_due_on_default: a new ticket's due date follows its row (Locked rows always; Team can change rows
--    with a set rule fill an empty date); no row or Not set keeps the existing rule. Quiet imports are untouched.
--    Arrival check rows keep the existing arrival check deadline (read from arrival_checks when linked).
-- 4. tickets_due_lock_guard: a locked due date changes only through set_ticket_due_on with a reason by a
--    Supervisor, Director or Admin; the reason is added as an update on the ticket with the person.
-- 5. Open tickets whose row is Locked are marked due_locked (their dates are not changed).

CREATE TABLE public.guest_ready_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 120),
  must_be_done text NOT NULL DEFAULT 'Not set' CHECK (length(trim(must_be_done)) BETWEEN 1 AND 200),
  locked boolean NOT NULL DEFAULT false,
  rule text NOT NULL DEFAULT 'not_set' CHECK (rule IN ('not_set','same_day','clean_day_4pm','arrival_deadline','days')),
  rule_days int CHECK (rule_days IS NULL OR rule_days BETWEEN 0 AND 60),
  work_type_id uuid REFERENCES public.work_types(id),
  match_priority text CHECK (match_priority IS NULL OR match_priority = 'p1'),
  lock_note text CHECK (lock_note IS NULL OR length(lock_note) <= 200),
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE UNIQUE INDEX guest_ready_standards_one_per_type ON public.guest_ready_standards(work_type_id) WHERE work_type_id IS NOT NULL;
CREATE UNIQUE INDEX guest_ready_standards_one_p1 ON public.guest_ready_standards(match_priority) WHERE match_priority IS NOT NULL;
GRANT SELECT ON public.guest_ready_standards TO authenticated;
GRANT ALL ON public.guest_ready_standards TO service_role;
ALTER TABLE public.guest_ready_standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read guest-ready standards" ON public.guest_ready_standards FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

INSERT INTO public.guest_ready_standards(label, must_be_done, locked, rule, rule_days, work_type_id, match_priority, lock_note, sort_order) VALUES
 ('Cleaning review', 'Before 4:00 PM on the day of the clean', true, 'clean_day_4pm', NULL,
   (SELECT id FROM public.work_types WHERE name = 'Cleaning Review Log'), NULL, 'Cleaning reviews are always due before 4:00 PM.', 10),
 ('Priority 1, guest-impacting (heat, AC, leaks, power)', 'Same day', true, 'same_day', NULL, NULL, 'p1', 'Priority 1 tickets are always due the same day.', 20),
 ('Arrival check', 'By the arrival check deadline', true, 'arrival_deadline', NULL,
   (SELECT id FROM public.work_types WHERE name = 'Arrival check'), NULL, 'Arrival checks are always due by the arrival check deadline.', 30),
 ('Lawn care review', 'Within 3 to 7 days', false, 'days', 7, NULL, NULL, NULL, 40),
 ('Inspection review', 'Not set', false, 'not_set', NULL,
   (SELECT id FROM public.work_types WHERE name = 'Quarterly inspection review'), NULL, NULL, 50),
 ('Minor items (paint touch-ups, weeds)', 'Not set', false, 'not_set', NULL, NULL, NULL, NULL, 60),
 ('Pest control', 'Not set', false, 'not_set', NULL, NULL, NULL, NULL, 70);

ALTER TABLE public.tickets ADD COLUMN due_locked boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.tickets.due_locked IS 'True when the ticket type is Locked on Guest-ready standards; the due date then changes only through set_ticket_due_on with a reason.';

-- The row for a ticket: its own ticket type first, else the Priority 1 row for a P1 ticket.
CREATE OR REPLACE FUNCTION private.guest_ready_row(_work_type_id uuid, _priority text)
 RETURNS public.guest_ready_standards LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.* FROM public.guest_ready_standards s
  WHERE (s.work_type_id IS NOT NULL AND s.work_type_id = _work_type_id)
     OR (s.match_priority = 'p1' AND lower(coalesce(_priority,'')) = 'p1'
         AND NOT EXISTS (SELECT 1 FROM public.guest_ready_standards o WHERE o.work_type_id = _work_type_id))
  ORDER BY (s.work_type_id IS NULL), s.sort_order LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.guest_ready_row(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.ticket_due_on_default()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  s public.guest_ready_standards;
  _today date := (now() AT TIME ZONE 'America/Chicago')::date;
  _ruled date;
BEGIN
  IF coalesce(current_setting('resolve.import_quiet', true), '') <> 'on' THEN
    s := private.guest_ready_row(NEW.work_type_id, NEW.priority);
    IF s.id IS NOT NULL THEN
      _ruled := CASE s.rule
        WHEN 'same_day' THEN _today
        WHEN 'clean_day_4pm' THEN _today
        WHEN 'days' THEN _today + coalesce(s.rule_days, 7)
        ELSE NULL END;
      IF s.locked THEN
        NEW.due_locked := true;
        IF _ruled IS NOT NULL THEN NEW.due_on := _ruled; END IF;
      ELSIF NEW.due_on IS NULL AND _ruled IS NOT NULL THEN
        NEW.due_on := _ruled;
      END IF;
    END IF;
  END IF;
  IF NEW.due_on IS NULL THEN
    NEW.due_on := CASE lower(coalesce(NEW.priority, ''))
      WHEN 'p1' THEN _today WHEN 'p2' THEN _today WHEN 'p3' THEN _today + 7 ELSE NULL END;
  END IF;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION private.ticket_due_on_default() FROM PUBLIC, anon, authenticated;

-- A locked date never changes except through set_ticket_due_on with a reason.
CREATE OR REPLACE FUNCTION private.ticket_due_lock_guard()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF OLD.due_locked AND NEW.due_on IS DISTINCT FROM OLD.due_on
     AND coalesce(current_setting('resolve.due_lock_reason_ok', true), '') <> 'on'
     AND coalesce(current_setting('resolve.import_quiet', true), '') <> 'on' THEN
    RAISE EXCEPTION 'This due date is locked.';
  END IF;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION private.ticket_due_lock_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER tickets_due_lock_guard BEFORE UPDATE OF due_on ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION private.ticket_due_lock_guard();

-- set_ticket_due_on gains an optional reason. Unlocked: unchanged behavior. Locked: Supervisor, Director or Admin
-- only, reason required, added as an update on the ticket with the person.
DROP FUNCTION public.set_ticket_due_on(uuid, date);
CREATE FUNCTION public.set_ticket_due_on(_ticket_id uuid, _due_on date, _reason text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $function$
DECLARE
  _actor uuid := auth.uid();
  _old date;
  _locked boolean;
  _found boolean;
  _year text := to_char((now() AT TIME ZONE 'America/Chicago')::date, 'YYYY');
  _line text;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Sign in to change the due date.'; END IF;
  IF _due_on IS NULL THEN RAISE EXCEPTION 'Pick a date.'; END IF;
  SELECT true, due_on, due_locked INTO _found, _old, _locked FROM public.tickets WHERE id = _ticket_id;
  IF _found IS NULL THEN RAISE EXCEPTION 'That ticket could not be found.'; END IF;
  IF _old IS NOT DISTINCT FROM _due_on THEN
    RETURN jsonb_build_object('changed', false, 'due_on', _due_on);
  END IF;
  IF _locked THEN
    IF NOT public.can_save_playbooks(_actor) THEN RAISE EXCEPTION 'This due date is locked.'; END IF;
    IF length(trim(coalesce(_reason, ''))) < 3 THEN RAISE EXCEPTION 'Write a short reason.'; END IF;
    PERFORM set_config('resolve.due_lock_reason_ok', 'on', true);
  END IF;
  UPDATE public.tickets SET due_on = _due_on WHERE id = _ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'You cannot change this ticket.'; END IF;
  PERFORM set_config('resolve.due_lock_reason_ok', '', true);
  _line := CASE WHEN _old IS NULL THEN 'Due date set to ' ELSE 'Due date changed from '
      || to_char(_old, 'Mon FMDD') || CASE WHEN to_char(_old, 'YYYY') <> _year THEN to_char(_old, ', YYYY') ELSE '' END
      || ' to ' END
    || to_char(_due_on, 'Mon FMDD') || CASE WHEN to_char(_due_on, 'YYYY') <> _year THEN to_char(_due_on, ', YYYY') ELSE '' END;
  IF _locked THEN
    INSERT INTO public.ticket_activity(ticket_id, author_id, kind, event_type, internal, body)
    VALUES (_ticket_id, _actor, 'note', 'due_date_changed', false, _line || '. Reason: ' || trim(_reason));
  ELSE
    INSERT INTO public.ticket_activity(ticket_id, author_id, kind, event_type, internal, body)
    VALUES (_ticket_id, _actor, 'status', 'due_date_changed', false, _line);
  END IF;
  RETURN jsonb_build_object('changed', true, 'due_on', _due_on, 'previous', _old);
END $function$;
REVOKE ALL ON FUNCTION public.set_ticket_due_on(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_ticket_due_on(uuid, date, text) TO authenticated, service_role;

-- Save one row (add when _id is null). Supervisors, Directors and Admin only. Rows are never deleted.
CREATE OR REPLACE FUNCTION public.save_guest_ready_standard(
  _id uuid, _label text, _must_be_done text, _locked boolean, _rule text, _rule_days int,
  _work_type_id uuid, _lock_note text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _actor uuid := auth.uid(); _row uuid;
BEGIN
  IF _actor IS NULL OR NOT public.can_save_playbooks(_actor) THEN
    RAISE EXCEPTION 'Only Supervisors, Directors and Admin can change this page.';
  END IF;
  IF _id IS NULL THEN
    INSERT INTO public.guest_ready_standards(label, must_be_done, locked, rule, rule_days, work_type_id, lock_note, sort_order, updated_by)
    VALUES (trim(_label), coalesce(nullif(trim(_must_be_done), ''), 'Not set'), coalesce(_locked, false), coalesce(_rule, 'not_set'),
      _rule_days, _work_type_id, nullif(trim(_lock_note), ''),
      coalesce((SELECT max(sort_order) FROM public.guest_ready_standards), 0) + 10, _actor)
    RETURNING id INTO _row;
  ELSE
    UPDATE public.guest_ready_standards SET label = trim(_label),
      must_be_done = coalesce(nullif(trim(_must_be_done), ''), 'Not set'), locked = coalesce(_locked, false),
      rule = coalesce(_rule, 'not_set'), rule_days = _rule_days,
      work_type_id = CASE WHEN match_priority IS NOT NULL THEN NULL ELSE _work_type_id END,
      lock_note = nullif(trim(_lock_note), ''), updated_at = now(), updated_by = _actor
    WHERE id = _id RETURNING id INTO _row;
    IF _row IS NULL THEN RAISE EXCEPTION 'That row could not be found.'; END IF;
  END IF;
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label)
  VALUES (_actor, CASE WHEN _id IS NULL THEN 'guest_ready_standard.added' ELSE 'guest_ready_standard.saved' END,
    'guest_ready_standard', _row, trim(_label));
  RETURN _row;
END $function$;
REVOKE ALL ON FUNCTION public.save_guest_ready_standard(uuid, text, text, boolean, text, int, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_guest_ready_standard(uuid, text, text, boolean, text, int, uuid, text) TO authenticated, service_role;

-- Mark open tickets whose row is Locked (dates unchanged), quietly.
SELECT set_config('resolve.import_quiet', 'on', true);
ALTER TABLE public.tickets DISABLE TRIGGER tickets_updated;
UPDATE public.tickets t SET due_locked = true
WHERE t.status NOT IN ('resolved', 'closed') AND t.archived_at IS NULL
  AND (private.guest_ready_row(t.work_type_id, t.priority)).locked;
ALTER TABLE public.tickets ENABLE TRIGGER tickets_updated;
SELECT set_config('resolve.import_quiet', '', true);
