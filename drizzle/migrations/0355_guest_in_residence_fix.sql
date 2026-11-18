-- guest-in-residence-fix (Emily, Nov 17). Vacant homes stop owing guest updates.
-- Source: docs/pending/guest-in-residence-fix/apply.sql (sha256 dbe720c160e8c8d4ebcb42f0a867c9cae8e229e27b4e0760c689180871a802ce), applied unchanged on "Approved: apply guest-in-residence-fix".
-- 1. tickets.guest_in_residence defaults to false. The create rule lives in src/lib/guest-impact.ts
--    (guestInResidenceFor): true only when the home is occupied or a guest is affected.
-- 2. A resolved or closed ticket never carries a guest update clock: a BEFORE trigger clears
--    next_guest_update_at (mirror of guestClockAllowed in src/lib/guest-impact.ts).
-- 3. Backfill: vacant homes with no guest impact get guest_in_residence = false and no guest
--    update clock; resolved or closed tickets lose any guest update clock. Occupied tickets are
--    left alone. Ticket triggers are held during the backfill so no history lines, alerts,
--    reassignment or updated_at changes happen; one audit row keeps every prior value for undo.
-- Touches no bonus function. Undo: apply.undo.sql.
ALTER TABLE public.tickets ALTER COLUMN guest_in_residence SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.ticket_no_guest_clock_when_done()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  -- Mirror of guestClockAllowed (src/lib/guest-impact.ts): resolved and closed tickets owe no guest update.
  IF NEW.status IN ('resolved', 'closed') AND NEW.next_guest_update_at IS NOT NULL THEN
    NEW.next_guest_update_at := NULL;
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.ticket_no_guest_clock_when_done() FROM PUBLIC, anon, authenticated;

DO $bf$
DECLARE
  actor constant uuid := '98bd6696-4018-4965-b645-0471c5ae3925';
  before jsonb; n_vacant int; n_done int;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'ref', t.ref, 'guest_in_residence', t.guest_in_residence,
           'next_guest_update_at', t.next_guest_update_at) ORDER BY t.ref), '[]')
    INTO before
    FROM public.tickets t
   WHERE (t.occupancy_status = 'vacant' AND t.guest_impact = 'none' AND (t.guest_in_residence OR t.next_guest_update_at IS NOT NULL))
      OR (t.status IN ('resolved', 'closed') AND t.next_guest_update_at IS NOT NULL);

  ALTER TABLE public.tickets DISABLE TRIGGER USER;
  UPDATE public.tickets t SET guest_in_residence = false, next_guest_update_at = NULL
   WHERE t.occupancy_status = 'vacant' AND t.guest_impact = 'none' AND (t.guest_in_residence OR t.next_guest_update_at IS NOT NULL);
  GET DIAGNOSTICS n_vacant = ROW_COUNT;
  UPDATE public.tickets t SET next_guest_update_at = NULL
   WHERE t.status IN ('resolved', 'closed') AND t.next_guest_update_at IS NOT NULL;
  GET DIAGNOSTICS n_done = ROW_COUNT;
  ALTER TABLE public.tickets ENABLE TRIGGER USER;

  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, before_value, after_value)
  VALUES (actor, 'Admin', 'guest_in_residence_fix.apply', 'tickets', 'Guest in residence',
    'Vacant homes with no guest impact no longer say a guest is in the home or run a guest update clock; resolved and closed tickets carry no guest update clock; default is now false. Undo: docs/pending/guest-in-residence-fix/apply.undo.sql.',
    jsonb_build_object('default', 'true', 'tickets', before),
    jsonb_build_object('default', 'false', 'vacant_no_impact_fixed', n_vacant, 'done_clock_cleared', n_done,
                       'rows', jsonb_array_length(before)));
END $bf$;

CREATE TRIGGER tickets_no_guest_clock_when_done
  BEFORE INSERT OR UPDATE OF status, next_guest_update_at ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.ticket_no_guest_clock_when_done();