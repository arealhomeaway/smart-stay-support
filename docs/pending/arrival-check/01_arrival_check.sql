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
