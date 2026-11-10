-- lovable-cron-fallback-reviewed: the arrival check needs a check every minute (1,440 runs a day) so a check is made at 6:00 AM Central, the Supervisor alert lands 30 minutes before the deadline and a missed check is marked at check in, with no screen open.
-- Arrival check queue and Arrival readiness (Build 12; Emily, Nov 10; register BN4, BN10;
-- spec docs/specs/arrival-check.md). Additive only. The switch `arrival_checks` is created OFF.
-- Undo: undo/01_arrival_check.sql. No BEGIN/COMMIT.

-- 0. Scorecard capture accepts one new fact kind. Every existing kind stays.
ALTER TABLE public.scorecard_records DROP CONSTRAINT IF EXISTS scorecard_records_kind_check;
ALTER TABLE public.scorecard_records ADD CONSTRAINT scorecard_records_kind_check CHECK (kind IN
  ('arrival_readiness', 'queue_sweep', 'coaching_cycle', 'weekly_submission', 'corrective_commitment',
   'finance_packet', 'arrival_check'));

-- 1. Reservation facts seen by the existing hourly OwnerRez sync (no new OwnerRez calls).
--    Guest first name only. One row per OwnerRez booking; the decision is made once.
CREATE TABLE IF NOT EXISTS public.arrival_reservations (
  ownerrez_booking_id text PRIMARY KEY,
  ownerrez_property_id text,
  property_id uuid,
  arrival_on date NOT NULL,
  departure_on date,
  check_in_time text,
  status text,
  booking_type text,
  is_block boolean NOT NULL DEFAULT false,
  owner_stay boolean NOT NULL DEFAULT false,
  title text,
  guest_id text,
  guest_first_name text,
  adults integer,
  children integer,
  infants integer,
  pets integer,
  booked_at timestamptz,
  is_test boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  decision text CHECK (decision IN ('created', 'skipped', 'failed')),
  decision_reason text,
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS arrival_reservations_arrival_idx ON public.arrival_reservations (arrival_on);
CREATE INDEX IF NOT EXISTS arrival_reservations_home_idx ON public.arrival_reservations (property_id, departure_on);
GRANT SELECT ON public.arrival_reservations TO authenticated;
GRANT ALL ON public.arrival_reservations TO service_role;
ALTER TABLE public.arrival_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read arrival reservations" ON public.arrival_reservations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. One arrival check per reservation. Written only by the functions below.
CREATE TABLE IF NOT EXISTS public.arrival_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ownerrez_booking_id text NOT NULL UNIQUE,
  property_id uuid,
  ticket_id uuid UNIQUE,
  home_label text NOT NULL,
  arrival_on date NOT NULL,
  check_in_at timestamptz NOT NULL,
  deadline_at timestamptz NOT NULL,
  time_zone text NOT NULL,
  team text NOT NULL DEFAULT 'property_operations',
  owner_stay boolean NOT NULL DEFAULT false,
  late_booking boolean NOT NULL DEFAULT false,
  is_test boolean NOT NULL DEFAULT false,
  guest_first_name text,
  guests integer,
  pets integer,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'complete', 'cancelled')),
  lock_connected boolean,
  lock_note text,
  work_orders_reviewed boolean,
  outcome text CHECK (outcome IN ('ready', 'issue')),
  issue_text text,
  backup_plan text,
  issue_ticket_id uuid,
  completed_by uuid,
  completed_at timestamptz,
  result text CHECK (result IN ('on_time', 'late', 'missed')),
  result_at timestamptz,
  alert_sent_at timestamptz,
  alert_recipient uuid,
  cancelled_at timestamptz,
  cleared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arrival_checks_open_idx ON public.arrival_checks (status, deadline_at);
CREATE INDEX IF NOT EXISTS arrival_checks_arrival_idx ON public.arrival_checks (arrival_on);
GRANT SELECT ON public.arrival_checks TO authenticated;
GRANT ALL ON public.arrival_checks TO service_role;
ALTER TABLE public.arrival_checks ENABLE ROW LEVEL SECURITY;
-- Admin, Directors, the Operations Supervisor and Finance read every real row; a coordinator reads
-- only checks they completed or own; test rows only for the people who run the test plan.
CREATE POLICY "Arrival checks by role" ON public.arrival_checks
  FOR SELECT TO authenticated USING (
    CASE WHEN is_test THEN public.can_view_export_check(auth.uid())
    ELSE (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
          OR public.is_director(auth.uid()) OR public.is_accounting(auth.uid())
          OR public.holds_functional_role(auth.uid(), 'ops_supervisor')
          OR (public.has_role(auth.uid(), 'tech') AND (completed_by = auth.uid()
              OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.assigned_to = auth.uid()))))
    END);

CREATE OR REPLACE FUNCTION private.guard_arrival_check_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Arrival checks are kept. They are never deleted.';
  END IF;
  IF coalesce(current_setting('resolve.arrival_check_writing', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Arrival checks change only through the arrival check steps.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER arrival_checks_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.arrival_checks
  FOR EACH ROW EXECUTE FUNCTION private.guard_arrival_check_write();

-- 3. Run state for Integrations (one row).
CREATE TABLE IF NOT EXISTS public.arrival_check_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  last_run_at timestamptz,
  last_run jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_ingest_at timestamptz,
  last_ingest jsonb NOT NULL DEFAULT '{}'::jsonb
);
INSERT INTO public.arrival_check_state (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
GRANT ALL ON public.arrival_check_state TO service_role;
ALTER TABLE public.arrival_check_state ENABLE ROW LEVEL SECURITY;

-- 4. The work type the check ticket carries. Not active, so it never shows in the Record work
--    problem list; only the arrival check uses it.
INSERT INTO public.work_types (name, category, bucket, team, functional_role_code, default_priority,
  response_minutes, action_start_minutes, completion_target, required_closure_evidence, active, sort_order)
SELECT 'Arrival check', 'quality', 'same_day_operations', 'property_operations', 'po_day', 'p2', 30, 60,
       'At least 2 hours before check in',
       'Lock checked, Breezeway work orders reviewed, and the home ready or the issue flagged with a backup plan',
       false, 900
 WHERE NOT EXISTS (SELECT 1 FROM public.work_types WHERE name = 'Arrival check');

-- 5. The switch (off) and its forward only start line.
INSERT INTO public.feature_flags (key, label, enabled, description)
VALUES ('arrival_checks', 'Arrival checks', false,
        'Makes one arrival check for each arriving home, only for arrivals at least 2 hours after it is turned on.')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION private.guard_arrival_checks_switch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(current_setting('resolve.arrival_checks_switch', true), '') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'feature_flags' THEN
    IF NEW.key = 'arrival_checks'
       AND ((TG_OP = 'INSERT' AND NEW.enabled)
            OR (TG_OP = 'UPDATE' AND NEW.enabled IS DISTINCT FROM OLD.enabled)) THEN
      RAISE EXCEPTION 'Arrival checks can only be turned on or off with their own switch, so the start line moves with it.';
    END IF;
    RETURN NEW;
  END IF;
  IF (TG_OP = 'DELETE' AND OLD.key = 'arrival_checks_start_line')
     OR (TG_OP = 'INSERT' AND NEW.key = 'arrival_checks_start_line' AND nullif(NEW.value ->> 'at', '') IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND (NEW.key = 'arrival_checks_start_line' OR OLD.key = 'arrival_checks_start_line')
         AND (NEW.value IS DISTINCT FROM OLD.value OR NEW.key IS DISTINCT FROM OLD.key)) THEN
    RAISE EXCEPTION 'The arrival check start line only moves when arrival checks are turned on.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER feature_flags_arrival_checks_guard
  BEFORE INSERT OR UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION private.guard_arrival_checks_switch();
CREATE TRIGGER app_settings_arrival_checks_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION private.guard_arrival_checks_switch();

CREATE OR REPLACE FUNCTION private.arrival_checks_start_line()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nullif(value ->> 'at', '')::timestamptz FROM public.app_settings WHERE key = 'arrival_checks_start_line';
$$;

CREATE OR REPLACE FUNCTION public.set_arrival_checks(_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _me uuid := auth.uid();
  _was boolean;
  _before timestamptz;
  _after timestamptz;
  _line timestamptz := date_trunc('second', clock_timestamp()) + interval '1 second';
BEGIN
  IF _me IS NULL OR NOT private.has_role(_me, 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can turn arrival checks on or off.';
  END IF;
  IF _enabled IS NULL THEN RAISE EXCEPTION 'Choose on or off.'; END IF;
  SELECT enabled INTO _was FROM public.feature_flags WHERE key = 'arrival_checks' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The arrival check switch was not found.'; END IF;
  PERFORM 1 FROM public.app_settings WHERE key = 'arrival_checks_start_line' FOR UPDATE;
  _before := private.arrival_checks_start_line();
  _after := _before;
  IF _was = _enabled THEN
    RETURN jsonb_build_object('enabled', _was, 'changed', false, 'start_line', _before);
  END IF;
  PERFORM set_config('resolve.arrival_checks_switch', 'on', true);
  IF _enabled AND (_before IS NULL OR _before < _line) THEN
    _after := _line;
    INSERT INTO public.app_settings (key, value, updated_by, updated_at)
    VALUES ('arrival_checks_start_line', jsonb_build_object('at', _after, 'by', _me), _me, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = _me, updated_at = now();
  END IF;
  UPDATE public.feature_flags SET enabled = _enabled, updated_by = _me, updated_at = now()
   WHERE key = 'arrival_checks';
  PERFORM set_config('resolve.arrival_checks_switch', '', true);
  INSERT INTO public.integration_events
    (system, direction, operation, status, resolved_by, resolved_at, previous_value, request_payload)
  VALUES ('arrival_checks', 'inbound', 'switch', CASE WHEN _enabled THEN 'on' ELSE 'off' END, _me, now(),
          jsonb_build_object('enabled', _was, 'start_line', _before),
          jsonb_build_object('enabled', _enabled, 'start_line', _after));
  RETURN jsonb_build_object('enabled', _enabled, 'changed', true, 'start_line', _after);
END $$;
REVOKE ALL ON FUNCTION public.set_arrival_checks(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_arrival_checks(boolean) TO authenticated, service_role;

-- 6. Small helpers.
CREATE OR REPLACE FUNCTION private.arrival_is_cancelled(_status text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(coalesce(_status, '')) LIKE 'cancel%';
$$;

CREATE OR REPLACE FUNCTION private.arrival_check_in_at(_arrival date, _booking_time text, _home_time text, _tz text)
RETURNS timestamptz LANGUAGE sql STABLE AS $$
  SELECT ((_arrival::text || ' ' || coalesce(
            substring(btrim(coalesce(_booking_time, '')) from '^[0-9]{1,2}:[0-9]{2}'),
            substring(btrim(coalesce(_home_time, '')) from '^[0-9]{1,2}:[0-9]{2}'),
            '16:00'))::timestamp AT TIME ZONE coalesce(nullif(btrim(_tz), ''), 'America/Chicago'));
$$;

CREATE OR REPLACE FUNCTION private.arrival_home_label(_property_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(public.format_property_label(to_jsonb(p)) ->> 'primary', ''),
                  nullif(btrim(p.address_line1), ''), p.nickname, p.name, 'Home')
    FROM public.properties p WHERE p.id = _property_id;
$$;

CREATE OR REPLACE FUNCTION private.arrival_fmt_time(_at timestamptz, _tz text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT to_char(_at AT TIME ZONE coalesce(nullif(_tz, ''), 'America/Chicago'), 'FMHH12:MI AM');
$$;

-- 7. Store what the sync saw (service only). Never decides anything.
CREATE OR REPLACE FUNCTION public.arrival_ingest_bookings(_bookings jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  b jsonb;
  _id text;
  _type text;
  _block boolean;
  _title text;
  _n integer := 0;
BEGIN
  IF jsonb_typeof(_bookings) IS DISTINCT FROM 'array' THEN RETURN jsonb_build_object('stored', 0); END IF;
  FOR b IN SELECT * FROM jsonb_array_elements(_bookings) LOOP
    _id := nullif(btrim(b ->> 'id'), '');
    IF _id IS NULL OR nullif(b ->> 'arrival', '') IS NULL THEN CONTINUE; END IF;
    _type := lower(nullif(btrim(b ->> 'type'), ''));
    _block := coalesce((b ->> 'is_block')::boolean, false) OR _type = 'block';
    _title := nullif(btrim(b ->> 'title'), '');
    INSERT INTO public.arrival_reservations AS r
      (ownerrez_booking_id, ownerrez_property_id, property_id, arrival_on, departure_on, check_in_time,
       status, booking_type, is_block, owner_stay, title, guest_id, guest_first_name, adults, children,
       infants, pets, booked_at, first_seen_at, last_seen_at)
    VALUES (_id, nullif(b ->> 'property_id', ''),
      (SELECT p.id FROM public.properties p WHERE p.ownerrez_property_id = nullif(b ->> 'property_id', '')
          AND NOT p.is_demo ORDER BY p.archived_at NULLS FIRST, p.created_at LIMIT 1),
      (b ->> 'arrival')::date, nullif(b ->> 'departure', '')::date, nullif(b ->> 'check_in', ''),
      nullif(b ->> 'status', ''), _type, _block,
      coalesce(_type = 'owner', false)
        OR (_block AND coalesce(_title, '') ~* 'owner[[:space:]]*(stay|use|visit|booking|arrival)'),
      _title, nullif(coalesce(b ->> 'guest_id', b -> 'guest' ->> 'id'), ''),
      nullif(btrim(coalesce(b -> 'guest' ->> 'first_name', split_part(coalesce(b ->> 'guest_name', ''), ' ', 1))), ''),
      nullif(b ->> 'adults', '')::integer, nullif(b ->> 'children', '')::integer,
      nullif(b ->> 'infants', '')::integer, nullif(b ->> 'pets', '')::integer,
      nullif(coalesce(b ->> 'booked_utc', b ->> 'created_utc'), '')::timestamptz, now(), now())
    ON CONFLICT (ownerrez_booking_id) DO UPDATE SET
      ownerrez_property_id = EXCLUDED.ownerrez_property_id,
      property_id = EXCLUDED.property_id,
      arrival_on = EXCLUDED.arrival_on,
      departure_on = EXCLUDED.departure_on,
      check_in_time = EXCLUDED.check_in_time,
      status = EXCLUDED.status,
      booking_type = EXCLUDED.booking_type,
      is_block = EXCLUDED.is_block,
      owner_stay = EXCLUDED.owner_stay,
      title = EXCLUDED.title,
      guest_id = EXCLUDED.guest_id,
      guest_first_name = EXCLUDED.guest_first_name,
      adults = EXCLUDED.adults, children = EXCLUDED.children, infants = EXCLUDED.infants, pets = EXCLUDED.pets,
      booked_at = coalesce(r.booked_at, EXCLUDED.booked_at),
      last_seen_at = now()
    WHERE NOT r.is_test;
    _n := _n + 1;
  END LOOP;
  UPDATE public.arrival_check_state SET last_ingest_at = now(),
         last_ingest = jsonb_build_object('stored', _n, 'at', now()) WHERE id;
  RETURN jsonb_build_object('stored', _n);
END $$;
REVOKE ALL ON FUNCTION public.arrival_ingest_bookings(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.arrival_ingest_bookings(jsonb) TO service_role;

-- 8. The one place a reservation is skipped, in this order.
CREATE OR REPLACE FUNCTION private.arrival_check_skip_reason(_booking text, _check_in timestamptz, _line timestamptz)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  r public.arrival_reservations;
  p record;
BEGIN
  SELECT * INTO r FROM public.arrival_reservations WHERE ownerrez_booking_id = _booking;
  IF NOT FOUND THEN RETURN 'not found'; END IF;
  IF private.arrival_is_cancelled(r.status) THEN RETURN 'cancelled'; END IF;
  IF r.is_block AND NOT r.owner_stay THEN RETURN 'a block, not a stay'; END IF;
  IF r.property_id IS NULL THEN RETURN 'not a Resolve home'; END IF;
  SELECT id, name, nickname, active, archived_at, is_demo, breezeway_mapping_state, breezeway_property_id
    INTO p FROM public.properties WHERE id = r.property_id;
  IF NOT FOUND OR p.is_demo OR p.archived_at IS NOT NULL OR p.active IS FALSE
     OR coalesce(p.breezeway_mapping_state, '') <> 'verified' THEN
    RETURN 'not a verified Resolve home';
  END IF;
  IF private.breezeway_is_new_house(p.breezeway_property_id, NULL, p.name, p.nickname) THEN
    RETURN 'New House home';
  END IF;
  IF r.guest_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.arrival_reservations o
        WHERE o.property_id = r.property_id AND o.ownerrez_booking_id <> r.ownerrez_booking_id
          AND o.guest_id = r.guest_id AND o.departure_on = r.arrival_on
          AND NOT private.arrival_is_cancelled(o.status) AND NOT o.is_block) THEN
    RETURN 'an extension of the stay before it';
  END IF;
  IF _line IS NULL OR _check_in < _line + interval '2 hours' THEN
    RETURN 'before the start line';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.arrival_check_skip_reason(text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

-- 9. Make one check and its ordinary ticket (no owner, Team B, normal clocks, due at the deadline).
CREATE OR REPLACE FUNCTION private.arrival_check_create(_booking text, _check_in timestamptz, _late boolean, _at timestamptz)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  r public.arrival_reservations;
  _tz text;
  _label text;
  _wt uuid;
  _ticket uuid;
  _check uuid;
  _deadline timestamptz := _check_in - interval '2 hours';
  _guests integer;
  _desc text;
BEGIN
  SELECT * INTO r FROM public.arrival_reservations WHERE ownerrez_booking_id = _booking FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found.'; END IF;
  SELECT coalesce(nullif(btrim(time_zone), ''), 'America/Chicago') INTO _tz FROM public.properties WHERE id = r.property_id;
  _tz := coalesce(_tz, 'America/Chicago');
  _label := coalesce(private.arrival_home_label(r.property_id), 'Home');
  SELECT id INTO _wt FROM public.work_types WHERE name = 'Arrival check' ORDER BY created_at LIMIT 1;
  _guests := nullif(coalesce(r.adults, 0) + coalesce(r.children, 0) + coalesce(r.infants, 0), 0);
  _desc := 'Guest arrives at ' || private.arrival_fmt_time(_check_in, _tz) || '. Check the home by '
           || private.arrival_fmt_time(_deadline, _tz) || ', or flag the issue with a safe backup plan.';
  INSERT INTO public.tickets
    (record_type, title, description, property_id, priority, suggested_priority, status, source_channel,
     initiator_type, external_source, external_id, reported_at, department_code, functional_role_code,
     work_type_id, is_demo, due_at, next_action, next_action_due_at, guest_in_residence,
     reservation_guest_name, reservation_arrival, reservation_departure, reservation_guest_count,
     reservation_snapshot_at, response_due_at, action_due_at)
  VALUES ('active_task', 'Arrival check: ' || _label || CASE WHEN r.is_test THEN ' (test)' ELSE '' END, _desc,
          CASE WHEN r.is_test THEN NULL ELSE r.property_id END, 'p2', 'p2', 'open', 'ownerrez', 'external',
          'ownerrez', 'arrival:' || _booking, _at, 'operations', 'po_day', _wt, r.is_test, _deadline,
          'Check the home is ready for the guest', _deadline, false, r.guest_first_name, r.arrival_on,
          r.departure_on, _guests, _at, _at + interval '30 minutes', _at + interval '60 minutes')
  RETURNING id INTO _ticket;
  PERFORM set_config('resolve.arrival_check_writing', 'on', true);
  INSERT INTO public.arrival_checks
    (ownerrez_booking_id, property_id, ticket_id, home_label, arrival_on, check_in_at, deadline_at, time_zone,
     team, owner_stay, late_booking, is_test, guest_first_name, guests, pets, created_at)
  VALUES (_booking, r.property_id, _ticket, _label, r.arrival_on, _check_in, _deadline, _tz,
          'property_operations', r.owner_stay, coalesce(_late, false), r.is_test, r.guest_first_name, _guests,
          r.pets, _at)
  RETURNING id INTO _check;
  PERFORM set_config('resolve.arrival_check_writing', '', true);
  UPDATE public.arrival_reservations SET decision = 'created', decision_reason = NULL, decided_at = _at
   WHERE ownerrez_booking_id = _booking;
  RETURN _check;
END $$;
REVOKE ALL ON FUNCTION private.arrival_check_create(text, timestamptz, boolean, timestamptz) FROM PUBLIC, anon, authenticated;

-- 10. The fact the scorecard reads later. Late bookings are recorded but never counted.
CREATE OR REPLACE FUNCTION private.arrival_check_fact(_check uuid, _event text, _refers uuid, _at timestamptz)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  c public.arrival_checks;
  _owner uuid;
  _about uuid;
  _credit text;
  _id uuid;
BEGIN
  SELECT * INTO c FROM public.arrival_checks WHERE id = _check;
  SELECT assigned_to INTO _owner FROM public.tickets WHERE id = c.ticket_id;
  _about := coalesce(c.completed_by, _owner);
  IF _about IS NULL THEN
    _about := public.seat_holder_at('ops_supervisor', least(_at, c.check_in_at));
    _credit := 'ops_supervisor_team_follow_through';
  ELSE
    _credit := 'coordinator_homes_ready';
  END IF;
  INSERT INTO public.scorecard_records
    (kind, recorded_by, recorded_at, about_user_id, property_id, stay_ref, ticket_id, details, refers_to, is_demo)
  VALUES ('arrival_check', coalesce(c.completed_by, _owner, _about, '00000000-0000-0000-0000-000000000000'::uuid),
          _at, _about, c.property_id, c.ownerrez_booking_id, c.ticket_id,
          jsonb_build_object('event', _event, 'check_id', c.id, 'result', c.result, 'outcome', c.outcome,
                             'arrival_on', c.arrival_on, 'check_in_at', c.check_in_at, 'deadline_at', c.deadline_at,
                             'completed_at', c.completed_at, 'completed_by', c.completed_by,
                             'late_booking', c.late_booking, 'counted', NOT c.late_booking AND NOT c.is_test,
                             'counts_for', _credit, 'owner_stay', c.owner_stay, 'team', c.team),
          _refers, c.is_test)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION private.arrival_check_fact(uuid, text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- 11. Complete a check. The person who completes it gets the credit; an unowned check is taken.
CREATE OR REPLACE FUNCTION private.arrival_check_complete(
  _me uuid, _check uuid, _lock_connected boolean, _lock_note text, _work_orders_reviewed boolean,
  _outcome text, _issue text, _backup_plan text, _at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  c public.arrival_checks;
  t record;
  _result text;
  _first uuid;
  _issue_ticket uuid;
  _note text := nullif(btrim(coalesce(_lock_note, '')), '');
  _issue_txt text := nullif(btrim(coalesce(_issue, '')), '');
  _plan text := nullif(btrim(coalesce(_backup_plan, '')), '');
  _summary text;
BEGIN
  IF _me IS NULL OR NOT (private.has_role(_me, 'admin') OR private.has_role(_me, 'manager')
                         OR private.has_role(_me, 'tech')) THEN
    RAISE EXCEPTION 'Only the operations team can complete an arrival check.';
  END IF;
  SELECT * INTO c FROM public.arrival_checks WHERE id = _check FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This arrival check was not found.'; END IF;
  IF c.status <> 'open' OR c.cleared_at IS NOT NULL THEN
    RAISE EXCEPTION 'This arrival check is already done.';
  END IF;
  IF _lock_connected IS NULL THEN RAISE EXCEPTION 'Say whether the lock shows connected.'; END IF;
  IF NOT _lock_connected AND _note IS NULL THEN RAISE EXCEPTION 'Add a short note about the lock.'; END IF;
  IF _work_orders_reviewed IS NOT TRUE THEN RAISE EXCEPTION 'Review the open Breezeway work orders first.'; END IF;
  IF _outcome NOT IN ('ready', 'issue') THEN RAISE EXCEPTION 'Choose ready or issue found.'; END IF;
  IF _outcome = 'issue' AND (_issue_txt IS NULL OR _plan IS NULL) THEN
    RAISE EXCEPTION 'Say what the issue is and the safe backup plan.';
  END IF;
  SELECT id, assigned_to, status, is_demo, property_id INTO t FROM public.tickets WHERE id = c.ticket_id FOR UPDATE;
  IF t.assigned_to IS NOT NULL AND t.assigned_to <> _me
     AND NOT (private.has_role(_me, 'admin') OR private.has_role(_me, 'manager')) THEN
    RAISE EXCEPTION 'Someone else has this arrival check.';
  END IF;
  IF t.assigned_to IS NULL THEN
    UPDATE public.tickets SET assigned_to = _me, acknowledged_at = coalesce(acknowledged_at, _at) WHERE id = c.ticket_id;
    INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, body, internal, is_demo)
    VALUES (c.ticket_id, _me, 'note', 'claimed', 'Took the arrival check.', true, coalesce(t.is_demo, false));
  END IF;

  _result := CASE WHEN c.result = 'missed' THEN 'missed'
                  WHEN _at <= c.deadline_at THEN 'on_time'
                  WHEN _at < c.check_in_at THEN 'late'
                  ELSE 'missed' END;

  IF _outcome = 'issue' THEN
    INSERT INTO public.tickets
      (record_type, title, description, property_id, priority, suggested_priority, status, source_channel,
       initiator_type, external_source, external_id, reported_at, department_code, functional_role_code,
       is_demo, guest_in_residence, response_due_at, action_due_at)
    VALUES ('active_task', 'Arrival issue: ' || c.home_label,
            'Found on the arrival check. Issue: ' || _issue_txt || ' Backup plan: ' || _plan,
            t.property_id, 'p2', 'p2', 'open', 'ownerrez', 'external', 'ownerrez', 'arrival-issue:' || c.ownerrez_booking_id,
            _at, 'operations', 'po_day', coalesce(t.is_demo, false), false,
            _at + interval '30 minutes', _at + interval '60 minutes')
    RETURNING id INTO _issue_ticket;
    INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, body, internal, is_demo)
    VALUES (_issue_ticket, _me, 'note', 'arrival_issue', 'From the arrival check. Backup plan: ' || _plan, true,
            coalesce(t.is_demo, false));
  END IF;

  PERFORM set_config('resolve.arrival_check_writing', 'on', true);
  UPDATE public.arrival_checks
     SET status = 'complete', lock_connected = _lock_connected, lock_note = _note,
         work_orders_reviewed = true, outcome = _outcome, issue_text = _issue_txt, backup_plan = _plan,
         issue_ticket_id = _issue_ticket, completed_by = _me, completed_at = _at,
         result = _result, result_at = coalesce(result_at, _at)
   WHERE id = _check
   RETURNING * INTO c;
  PERFORM set_config('resolve.arrival_check_writing', '', true);

  _summary := 'Arrival check done. Lock ' || CASE WHEN _lock_connected THEN 'connected' ELSE 'not connected: ' || _note END
              || '. Breezeway work orders reviewed. '
              || CASE WHEN _outcome = 'ready' THEN 'Home ready.'
                      ELSE 'Issue: ' || _issue_txt || ' Backup plan: ' || _plan END;
  UPDATE public.tickets
     SET status = 'closed', resolved_at = _at, resolution_notes = _summary, closure_evidence = _summary,
         outcome_type = CASE WHEN _outcome = 'ready' THEN 'no_issue_found' ELSE 'resolved' END,
         closure_qa_result = 'not_required', action_started_at = coalesce(action_started_at, _at),
         acknowledged_at = coalesce(acknowledged_at, _at)
   WHERE id = c.ticket_id;
  INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, body, internal, is_demo)
  VALUES (c.ticket_id, _me, 'note', 'arrival_check_done', _summary, true, coalesce(t.is_demo, false));

  IF c.result_at < _at AND _result = 'missed' THEN
    SELECT id INTO _first FROM public.scorecard_records
     WHERE kind = 'arrival_check' AND details ->> 'check_id' = c.id::text AND refers_to IS NULL
     ORDER BY recorded_at LIMIT 1;
    PERFORM private.arrival_check_fact(c.id, 'completed_after_check_in', _first, _at);
  ELSE
    PERFORM private.arrival_check_fact(c.id, 'result', NULL, _at);
  END IF;
  RETURN jsonb_build_object('check_id', c.id, 'result', _result, 'issue_ticket_id', _issue_ticket);
END $$;
REVOKE ALL ON FUNCTION private.arrival_check_complete(uuid, uuid, boolean, text, boolean, text, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_arrival_check(
  _check_id uuid, _lock_connected boolean, _lock_note text, _work_orders_reviewed boolean,
  _outcome text, _issue text, _backup_plan text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.arrival_check_complete(auth.uid(), _check_id, _lock_connected, _lock_note,
                                        _work_orders_reviewed, _outcome, _issue, _backup_plan, now());
$$;
REVOKE ALL ON FUNCTION public.complete_arrival_check(uuid, boolean, text, boolean, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_arrival_check(uuid, boolean, text, boolean, text, text, text) TO authenticated, service_role;

-- 12. A cancelled reservation closes its open check, out of every count.
CREATE OR REPLACE FUNCTION private.arrival_check_cancel(_check uuid, _at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE c public.arrival_checks;
BEGIN
  PERFORM set_config('resolve.arrival_check_writing', 'on', true);
  UPDATE public.arrival_checks SET status = 'cancelled', cancelled_at = _at
   WHERE id = _check AND status = 'open' RETURNING * INTO c;
  PERFORM set_config('resolve.arrival_check_writing', '', true);
  IF c.id IS NULL THEN RETURN; END IF;
  UPDATE public.tickets
     SET status = 'closed', resolved_at = _at, outcome_type = 'cancelled_by_requestor',
         resolution_notes = 'The reservation was cancelled.', closure_qa_result = 'not_required'
   WHERE id = c.ticket_id AND status NOT IN ('closed', 'resolved');
  INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, body, internal, is_demo)
  VALUES (c.ticket_id, NULL, 'note', 'arrival_check_cancelled', 'The reservation was cancelled. This check is closed.',
          true, c.is_test);
END $$;
REVOKE ALL ON FUNCTION private.arrival_check_cancel(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- 13. One alert per check to whoever holds the Operations Supervisor role, 30 minutes before the deadline.
CREATE OR REPLACE FUNCTION private.arrival_check_alert(_check uuid, _at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  c public.arrival_checks;
  _to uuid := public.seat_holder_at('ops_supervisor', _at);
BEGIN
  PERFORM set_config('resolve.arrival_check_writing', 'on', true);
  UPDATE public.arrival_checks SET alert_sent_at = _at, alert_recipient = _to
   WHERE id = _check AND alert_sent_at IS NULL RETURNING * INTO c;
  PERFORM set_config('resolve.arrival_check_writing', '', true);
  IF c.id IS NULL OR _to IS NULL THEN RETURN false; END IF;
  PERFORM public.notify_staff(
    _to, 'arrival_check_due',
    'Arrival check due at ' || private.arrival_fmt_time(c.deadline_at, c.time_zone) || ' at ' || c.home_label || ', not done yet',
    'The guest arrives at ' || private.arrival_fmt_time(c.check_in_at, c.time_zone) || '.',
    'ticket', c.ticket_id, '/tickets/' || c.ticket_id::text, 'urgent', NULL, true, c.is_test);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION private.arrival_check_alert(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- 14. Not done by check in: missed. The ticket stays open so the work can still be finished.
CREATE OR REPLACE FUNCTION private.arrival_check_mark_missed(_check uuid, _at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE c public.arrival_checks;
BEGIN
  PERFORM set_config('resolve.arrival_check_writing', 'on', true);
  UPDATE public.arrival_checks SET result = 'missed', result_at = _at
   WHERE id = _check AND status = 'open' AND result IS NULL RETURNING * INTO c;
  PERFORM set_config('resolve.arrival_check_writing', '', true);
  IF c.id IS NULL THEN RETURN; END IF;
  PERFORM private.arrival_check_fact(c.id, 'result', NULL, _at);
END $$;
REVOKE ALL ON FUNCTION private.arrival_check_mark_missed(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- 15. The every minute pass. Creation only while the switch is on; test checks keep their
--     alerts and results while it is off.
CREATE OR REPLACE FUNCTION private.arrival_checks_run(_at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _on boolean := coalesce((SELECT enabled FROM public.feature_flags WHERE key = 'arrival_checks'), false);
  _line timestamptz := private.arrival_checks_start_line();
  _today date := (_at AT TIME ZONE 'America/Chicago')::date;
  r record;
  c record;
  _ci timestamptz;
  _late boolean;
  _reason text;
  _created integer := 0;
  _skipped integer := 0;
  _failed integer := 0;
  _cancelled integer := 0;
  _alerts integer := 0;
  _missed integer := 0;
  _out jsonb;
BEGIN
  IF _on AND _line IS NOT NULL THEN
    FOR r IN
      SELECT ar.ownerrez_booking_id, ar.arrival_on, ar.check_in_time, ar.booked_at, p.check_in_time AS home_time, p.time_zone
        FROM public.arrival_reservations ar
        LEFT JOIN public.properties p ON p.id = ar.property_id
       WHERE ar.decision IS NULL AND NOT ar.is_test AND ar.arrival_on BETWEEN _today - 1 AND _today + 1
       ORDER BY ar.arrival_on, ar.ownerrez_booking_id
    LOOP
      BEGIN
        _ci := private.arrival_check_in_at(r.arrival_on, r.check_in_time, r.home_time, r.time_zone);
        _late := r.booked_at IS NOT NULL AND r.booked_at > _ci - interval '2 hours';
        IF NOT _late AND _at < ((r.arrival_on + time '06:00') AT TIME ZONE 'America/Chicago') THEN
          CONTINUE;
        END IF;
        _reason := private.arrival_check_skip_reason(r.ownerrez_booking_id, _ci, _line);
        IF _reason IS NULL AND _at >= _ci THEN
          _reason := 'check in passed before it was seen';
        END IF;
        IF _reason IS NOT NULL THEN
          UPDATE public.arrival_reservations SET decision = 'skipped', decision_reason = _reason, decided_at = _at
           WHERE ownerrez_booking_id = r.ownerrez_booking_id;
          _skipped := _skipped + 1;
        ELSE
          PERFORM private.arrival_check_create(r.ownerrez_booking_id, _ci, _late, _at);
          _created := _created + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        UPDATE public.arrival_reservations
           SET decision = 'failed', decision_reason = left(SQLERRM, 300), decided_at = _at
         WHERE ownerrez_booking_id = r.ownerrez_booking_id;
        _failed := _failed + 1;
      END;
    END LOOP;
  END IF;

  FOR c IN
    SELECT ac.id FROM public.arrival_checks ac
      JOIN public.arrival_reservations ar ON ar.ownerrez_booking_id = ac.ownerrez_booking_id
     WHERE ac.status = 'open' AND ac.cleared_at IS NULL AND private.arrival_is_cancelled(ar.status)
  LOOP
    PERFORM private.arrival_check_cancel(c.id, _at);
    _cancelled := _cancelled + 1;
  END LOOP;

  FOR c IN
    SELECT id FROM public.arrival_checks
     WHERE status = 'open' AND alert_sent_at IS NULL AND cleared_at IS NULL
       AND _at >= deadline_at - interval '30 minutes' AND _at < check_in_at
  LOOP
    IF private.arrival_check_alert(c.id, _at) THEN _alerts := _alerts + 1; END IF;
  END LOOP;

  FOR c IN
    SELECT id FROM public.arrival_checks
     WHERE status = 'open' AND result IS NULL AND cleared_at IS NULL AND _at >= check_in_at
  LOOP
    PERFORM private.arrival_check_mark_missed(c.id, _at);
    _missed := _missed + 1;
  END LOOP;

  _out := jsonb_build_object('at', _at, 'on', _on, 'created', _created, 'skipped', _skipped, 'failed', _failed,
                             'cancelled', _cancelled, 'alerts', _alerts, 'missed', _missed);
  UPDATE public.arrival_check_state SET last_run_at = _at, last_run = _out WHERE id;
  RETURN _out;
END $$;
REVOKE ALL ON FUNCTION private.arrival_checks_run(timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.run_arrival_checks()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$ SELECT private.arrival_checks_run(now()); $$;
REVOKE ALL ON FUNCTION public.run_arrival_checks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_arrival_checks() TO service_role;

-- 16. Everything the ticket page needs for one check (operations team only). Lock brand and the
--     open Breezeway work orders come from existing records; never a code.
CREATE OR REPLACE FUNCTION public.arrival_check_for_ticket(_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _me uuid := auth.uid();
  c public.arrival_checks;
  p record;
BEGIN
  IF _me IS NULL OR NOT (private.has_role(_me, 'admin') OR private.has_role(_me, 'manager')
                         OR private.has_role(_me, 'tech')) THEN
    RETURN NULL;
  END IF;
  SELECT * INTO c FROM public.arrival_checks WHERE ticket_id = _ticket_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF c.is_test AND NOT public.can_view_export_check(_me) THEN RETURN NULL; END IF;
  SELECT id, access, breezeway_property_id INTO p FROM public.properties WHERE id = c.property_id;
  RETURN jsonb_build_object(
    'id', c.id, 'ticket_id', c.ticket_id, 'home', c.home_label, 'arrival_on', c.arrival_on,
    'check_in_at', c.check_in_at, 'deadline_at', c.deadline_at, 'time_zone', c.time_zone,
    'guest_first_name', c.guest_first_name, 'guests', c.guests, 'pets', c.pets, 'owner_stay', c.owner_stay,
    'late_booking', c.late_booking, 'is_test', c.is_test, 'status', c.status, 'result', c.result,
    'outcome', c.outcome, 'lock_connected', c.lock_connected, 'lock_note', c.lock_note,
    'issue_text', c.issue_text, 'backup_plan', c.backup_plan, 'issue_ticket_id', c.issue_ticket_id,
    'completed_at', c.completed_at,
    'completed_by_name', (SELECT coalesce(full_name, email) FROM public.profiles WHERE id = c.completed_by),
    'lock_brand', nullif(btrim(coalesce(p.access ->> 'lock_brand', '')), ''),
    'lock_live', CASE WHEN p.access ? 'yale_integration_live' THEN (p.access ->> 'yale_integration_live') ELSE NULL END,
    'work_orders', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', w.breezeway_task_id, 'name', w.name, 'department', w.department, 'status', w.status,
        'link', coalesce(w.report_url, 'https://app.breezeway.io/task/' || w.breezeway_task_id::text))
        ORDER BY w.breezeway_created_at DESC NULLS LAST)
      FROM public.breezeway_work_orders w
     WHERE w.property_id = c.property_id AND c.property_id IS NOT NULL
       AND lower(coalesce(w.status, '')) IN ('created', 'in progress', 'approved')
       AND coalesce(w.stage, '') NOT IN ('finished', 'deleted')), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.arrival_check_for_ticket(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arrival_check_for_ticket(uuid) TO authenticated, service_role;

-- 17. The true state for Integrations (Admin only).
CREATE OR REPLACE FUNCTION public.arrival_checks_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _me uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'America/Chicago')::date;
  _out jsonb;
BEGIN
  IF _me IS NULL OR NOT private.has_role(_me, 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can read the arrival check status.';
  END IF;
  SELECT jsonb_build_object(
    'enabled', coalesce((SELECT enabled FROM public.feature_flags WHERE key = 'arrival_checks'), false),
    'start_line', private.arrival_checks_start_line(),
    'last_switch', (SELECT jsonb_build_object('status', e.status, 'at', e.resolved_at, 'by', coalesce(pr.full_name, pr.email))
                      FROM public.integration_events e LEFT JOIN public.profiles pr ON pr.id = e.resolved_by
                     WHERE e.system = 'arrival_checks' AND e.operation = 'switch'
                     ORDER BY e.created_at DESC LIMIT 1),
    'last_run_at', (SELECT last_run_at FROM public.arrival_check_state WHERE id),
    'last_run', (SELECT last_run FROM public.arrival_check_state WHERE id),
    'last_ingest_at', (SELECT last_ingest_at FROM public.arrival_check_state WHERE id),
    'created_today', (SELECT count(*) FROM public.arrival_checks
                       WHERE NOT is_test AND (created_at AT TIME ZONE 'America/Chicago')::date = _today),
    'skipped_today', coalesce((SELECT jsonb_object_agg(decision_reason, n) FROM (
                       SELECT decision_reason, count(*) n FROM public.arrival_reservations
                        WHERE decision = 'skipped' AND (decided_at AT TIME ZONE 'America/Chicago')::date = _today
                        GROUP BY decision_reason) s), '{}'::jsonb),
    'failed', (SELECT count(*) FROM public.arrival_reservations WHERE decision = 'failed'),
    'recent_failures', coalesce((SELECT jsonb_agg(f) FROM (
                       SELECT ownerrez_booking_id, decision_reason, decided_at FROM public.arrival_reservations
                        WHERE decision = 'failed' ORDER BY decided_at DESC LIMIT 10) f), '[]'::jsonb),
    'booking_types_seen', coalesce((SELECT jsonb_object_agg(k, n) FROM (
                       SELECT coalesce(booking_type, 'not given') || CASE WHEN is_block THEN ' (block)' ELSE '' END k,
                              count(*) n
                         FROM public.arrival_reservations WHERE NOT is_test GROUP BY 1) t), '{}'::jsonb),
    'owner_stays_seen', (SELECT count(*) FROM public.arrival_reservations WHERE owner_stay AND NOT is_test),
    'tests_open', (SELECT count(*) FROM public.arrival_checks WHERE is_test AND cleared_at IS NULL)
  ) INTO _out;
  RETURN _out;
END $$;
REVOKE ALL ON FUNCTION public.arrival_checks_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arrival_checks_status() TO authenticated, service_role;

-- 18. Test checks on the 9211 Fitzgerald Dr. home. Work while the switch is off, never counted,
--     seen only by the people who run the test plan.
CREATE OR REPLACE FUNCTION public.make_test_arrival_check(_minutes_to_check_in integer DEFAULT 180)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _me uuid := auth.uid();
  _home uuid;
  _id text := 'test-' || replace(gen_random_uuid()::text, '-', '');
  _ci timestamptz;
  _tz text;
  _check uuid;
BEGIN
  IF _me IS NULL OR NOT private.has_role(_me, 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can make a test arrival check.';
  END IF;
  IF _minutes_to_check_in IS NULL OR _minutes_to_check_in < 1 OR _minutes_to_check_in > 1440 THEN
    RAISE EXCEPTION 'Choose a check in between 1 minute and 24 hours from now.';
  END IF;
  SELECT id, coalesce(nullif(btrim(time_zone), ''), 'America/Chicago') INTO _home, _tz
    FROM public.properties
   WHERE NOT is_demo AND archived_at IS NULL AND address_line1 ILIKE '9211 Fitzgerald%'
   ORDER BY created_at LIMIT 1;
  IF _home IS NULL THEN RAISE EXCEPTION 'The test home was not found.'; END IF;
  _ci := date_trunc('minute', now()) + make_interval(mins => _minutes_to_check_in);
  INSERT INTO public.arrival_reservations
    (ownerrez_booking_id, property_id, arrival_on, departure_on, check_in_time, status, booking_type,
     guest_first_name, adults, pets, booked_at, is_test)
  VALUES (_id, _home, (_ci AT TIME ZONE _tz)::date, (_ci AT TIME ZONE _tz)::date + 2,
          to_char(_ci AT TIME ZONE _tz, 'HH24:MI'), 'active', 'test', 'Test guest', 2, 0,
          CASE WHEN _minutes_to_check_in < 120 THEN now() ELSE now() - interval '7 days' END, true);
  _check := private.arrival_check_create(_id, _ci, _minutes_to_check_in < 120, now());
  RETURN jsonb_build_object('check_id', _check,
                            'ticket_id', (SELECT ticket_id FROM public.arrival_checks WHERE id = _check));
END $$;
REVOKE ALL ON FUNCTION public.make_test_arrival_check(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.make_test_arrival_check(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.clear_test_arrival_checks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _me uuid := auth.uid();
  c record;
  _n integer := 0;
BEGIN
  IF _me IS NULL OR NOT private.has_role(_me, 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can clear test arrival checks.';
  END IF;
  FOR c IN SELECT id, ticket_id, issue_ticket_id FROM public.arrival_checks WHERE is_test AND cleared_at IS NULL FOR UPDATE LOOP
    UPDATE public.tickets SET archived_at = now(), archived_by = _me, archive_reason = 'Arrival check test'
     WHERE id IN (c.ticket_id, c.issue_ticket_id) AND is_demo AND archived_at IS NULL;
    INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, body, internal, is_demo)
    SELECT x, _me, 'status', 'archived', 'Archived. Reason: Arrival check test', true, true
      FROM unnest(ARRAY[c.ticket_id, c.issue_ticket_id]) x WHERE x IS NOT NULL;
    PERFORM set_config('resolve.arrival_check_writing', 'on', true);
    UPDATE public.arrival_checks SET cleared_at = now() WHERE id = c.id;
    PERFORM set_config('resolve.arrival_check_writing', '', true);
    _n := _n + 1;
  END LOOP;
  RETURN jsonb_build_object('cleared', _n);
END $$;
REVOKE ALL ON FUNCTION public.clear_test_arrival_checks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_test_arrival_checks() TO authenticated, service_role;

-- 19. The check ticket is internal verification work: it never becomes a homeowner notice or an
--     Active Owner Opportunity. Existing notice and Opportunity steps are unchanged; these two
--     triggers drop only rows for arrival check tickets (an issue found stays ordinary property work).
CREATE OR REPLACE FUNCTION private.skip_arrival_check_owner_rows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.tickets t
        WHERE t.id = NEW.ticket_id AND t.external_source = 'ownerrez' AND t.external_id LIKE 'arrival:%') THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER owner_notifications_skip_arrival_check
  BEFORE INSERT ON public.owner_notifications
  FOR EACH ROW EXECUTE FUNCTION private.skip_arrival_check_owner_rows();
CREATE TRIGGER owner_reviews_skip_arrival_check
  BEFORE INSERT ON public.owner_reviews
  FOR EACH ROW EXECUTE FUNCTION private.skip_arrival_check_owner_rows();

-- 20. The every minute pass. It does nothing but test upkeep while the switch is off.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'arrival-checks';
    PERFORM cron.schedule('arrival-checks', '* * * * *', 'SELECT public.run_arrival_checks()');
  END IF;
END $do$;
