-- Alerts and approvals, part 2: new note alert and mentions (Emily, Nov 7, 2026).
-- Undo: 02_undo_note_alerts.sql. No BEGIN/COMMIT.
--
-- When a person adds a note to a ticket (ticket_activity kind 'note', event 'note' or
-- 'internal_note', with an author), alert in app and email:
--   - everyone mentioned (the ids saved in ticket_activity.mentions, staff only): "You were mentioned";
--   - the ticket owner and the people involved (assigned to, action owner, record owner,
--     accountable owner, who created it, a pending handoff receiver), staff only: "New note".
-- Nobody is alerted twice for one note and the author is never alerted. Mentions are recorded
-- in ticket_activity.mentions, which already exists. System lines (for example the insurance
-- risk line) and quiet imports never alert.

CREATE OR REPLACE FUNCTION private.notify_ticket_note()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _t record;
  _ref text;
  _link text;
  _excerpt text;
  _who uuid;
  _mentioned uuid[];
BEGIN
  IF NEW.author_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT id, ref, title, is_demo, assigned_to, current_action_owner, record_owner,
         accountable_owner, created_by, pending_handoff_to
    INTO _t
    FROM public.tickets WHERE id = NEW.ticket_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  _ref := coalesce('#' || _t.ref::text || ' ', '');
  _link := '/tickets/' || _t.id::text;
  _excerpt := left(regexp_replace(btrim(coalesce(NEW.body, '')), '\s+', ' ', 'g'), 280);

  SELECT coalesce(array_agg(DISTINCT m), '{}'::uuid[]) INTO _mentioned
    FROM unnest(coalesce(NEW.mentions, '{}'::uuid[])) m
   WHERE m IS NOT NULL AND m <> NEW.author_id AND private.is_staff(m);

  FOREACH _who IN ARRAY _mentioned LOOP
    PERFORM public.notify_staff(
      _who, 'note_mention',
      'You were mentioned: ' || _ref || coalesce(_t.title, 'Ticket'),
      _excerpt, 'ticket', _t.id, _link, 'normal', NEW.author_id, true, coalesce(_t.is_demo, false));
  END LOOP;

  FOR _who IN
    SELECT DISTINCT x
      FROM unnest(ARRAY[_t.assigned_to, _t.current_action_owner, _t.record_owner,
                        _t.accountable_owner, _t.created_by, _t.pending_handoff_to]) x
     WHERE x IS NOT NULL AND x <> NEW.author_id AND NOT (x = ANY(_mentioned)) AND private.is_staff(x)
  LOOP
    PERFORM public.notify_staff(
      _who, 'ticket_note',
      'New note: ' || _ref || coalesce(_t.title, 'Ticket'),
      _excerpt, 'ticket', _t.id, _link, 'normal', NEW.author_id, true, coalesce(_t.is_demo, false));
  END LOOP;

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.notify_ticket_note() FROM PUBLIC;

CREATE TRIGGER ticket_activity_note_alerts
  AFTER INSERT ON public.ticket_activity
  FOR EACH ROW
  WHEN (NEW.kind = 'note' AND NEW.event_type IN ('note', 'internal_note')
        AND current_setting('resolve.import_quiet', true) IS DISTINCT FROM 'on')
  EXECUTE FUNCTION private.notify_ticket_note();
