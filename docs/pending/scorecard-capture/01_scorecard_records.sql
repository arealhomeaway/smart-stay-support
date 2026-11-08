-- Scorecard capture, part 1: one permanent record table and the functions that write it.
-- Additive only. No BEGIN/COMMIT: the migration tool runs this file in one transaction.
-- Roles only: every check reads a role, never a person.

-- ---------------------------------------------------------------------------
-- Role checks (one rule each, reused by every record function)
-- ---------------------------------------------------------------------------

-- The COO is a role like the others. It starts with nobody in it.
INSERT INTO public.functional_roles (code, name, team, sort_order, active)
SELECT 'coo', 'COO', 'leadership',
       coalesce((SELECT sort_order FROM public.functional_roles WHERE code = 'ceo'), 0), true
WHERE NOT EXISTS (SELECT 1 FROM public.functional_roles WHERE code = 'coo');

CREATE OR REPLACE FUNCTION private.sc_holds(_uid uuid, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    public.holds_functional_role(_uid, _code)
    OR public.seat_holder_at(_code) IS NOT DISTINCT FROM _uid
  )
$$;

-- Operations Supervisor: holds or is covering the ops_supervisor role.
CREATE OR REPLACE FUNCTION private.sc_is_ops_supervisor(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.sc_holds(_uid, 'ops_supervisor')
$$;

-- Director of Operations: the existing rule (holder or cover, or Admin).
CREATE OR REPLACE FUNCTION private.sc_is_ops_director(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND private.is_director(_uid)
$$;

CREATE OR REPLACE FUNCTION private.sc_is_coo(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.sc_holds(_uid, 'coo')
$$;

-- Operations staff (coordinators, supervisors, Admin). Never onboarding, vendor or owner.
CREATE OR REPLACE FUNCTION private.sc_is_ops_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role::text IN ('admin', 'manager', 'tech')
  )
$$;

-- Leaders who may read every record.
CREATE OR REPLACE FUNCTION private.sc_is_leader(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    private.is_supervisor(_uid) OR private.sc_is_ops_supervisor(_uid)
    OR private.sc_is_ops_director(_uid) OR private.sc_is_coo(_uid) OR private.sc_holds(_uid, 'ceo')
  )
$$;

-- A guest issue ticket: guest category, a guest work type, or linked to a guest review.
CREATE OR REPLACE FUNCTION private.sc_is_guest_issue(_ticket_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tickets t
    LEFT JOIN public.work_types w ON w.id = t.work_type_id
    WHERE t.id = _ticket_id
      AND (t.category = 'guest' OR w.category = 'guest' OR t.linked_feedback_id IS NOT NULL)
  )
$$;

REVOKE ALL ON FUNCTION private.sc_holds(uuid, text), private.sc_is_ops_supervisor(uuid),
  private.sc_is_ops_director(uuid), private.sc_is_coo(uuid), private.sc_is_ops_staff(uuid),
  private.sc_is_leader(uuid), private.sc_is_guest_issue(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.sc_holds(uuid, text), private.sc_is_ops_supervisor(uuid),
  private.sc_is_ops_director(uuid), private.sc_is_coo(uuid), private.sc_is_ops_staff(uuid),
  private.sc_is_leader(uuid), private.sc_is_guest_issue(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The permanent record table
-- ---------------------------------------------------------------------------

CREATE TABLE public.scorecard_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN (
    'arrival_readiness', 'queue_sweep', 'coaching_cycle',
    'weekly_submission', 'corrective_commitment', 'finance_packet')),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  about_user_id uuid,
  property_id uuid,
  stay_ref text,
  ticket_id uuid,
  note text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  refers_to uuid REFERENCES public.scorecard_records(id),
  about_imported_ticket boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false
);
COMMENT ON TABLE public.scorecard_records IS
  'Permanent scorecard facts. Add only: updates and deletes are refused by trigger and RLS.';
COMMENT ON COLUMN public.scorecard_records.about_imported_ticket IS
  'True when the record is about a ticket imported from Notion. Filter it out of every count.';

CREATE INDEX scorecard_records_kind_time ON public.scorecard_records (kind, recorded_at);
CREATE INDEX scorecard_records_ticket ON public.scorecard_records (ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX scorecard_records_property ON public.scorecard_records (property_id) WHERE property_id IS NOT NULL;
CREATE INDEX scorecard_records_refers ON public.scorecard_records (refers_to) WHERE refers_to IS NOT NULL;

GRANT SELECT ON public.scorecard_records TO authenticated;
GRANT SELECT, INSERT ON public.scorecard_records TO service_role;
ALTER TABLE public.scorecard_records ENABLE ROW LEVEL SECURITY;

-- Reads only. There is no insert, update or delete policy: writes go through the functions below.
CREATE POLICY scorecard_records_read ON public.scorecard_records
  FOR SELECT TO authenticated
  USING (
    auth.uid() = recorded_by
    OR auth.uid() = about_user_id
    OR (kind IN ('arrival_readiness', 'corrective_commitment') AND private.sc_is_ops_staff(auth.uid()))
    OR private.sc_is_leader(auth.uid())
  );

-- Server time and the Notion flag are set here, never taken from the caller.
CREATE OR REPLACE FUNCTION private.scorecard_record_stamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.recorded_at := now();
  IF NEW.recorded_by IS NULL THEN
    RAISE EXCEPTION 'A scorecard record needs the person who recorded it.';
  END IF;
  IF NEW.ticket_id IS NOT NULL THEN
    SELECT coalesce(t.external_source = 'notion', false), coalesce(t.is_demo, false) OR NEW.is_demo
      INTO NEW.about_imported_ticket, NEW.is_demo
      FROM public.tickets t WHERE t.id = NEW.ticket_id;
    NEW.about_imported_ticket := coalesce(NEW.about_imported_ticket, false);
    NEW.is_demo := coalesce(NEW.is_demo, false);
  END IF;
  IF NEW.property_id IS NOT NULL THEN
    NEW.is_demo := NEW.is_demo OR coalesce((SELECT p.is_demo FROM public.properties p WHERE p.id = NEW.property_id), false);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION private.refuse_record_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'This record is permanent. Add a new line instead.' USING ERRCODE = 'P0001';
END $$;

CREATE TRIGGER scorecard_records_stamp BEFORE INSERT ON public.scorecard_records
  FOR EACH ROW EXECUTE FUNCTION private.scorecard_record_stamp();
CREATE TRIGGER scorecard_records_no_change BEFORE UPDATE OR DELETE ON public.scorecard_records
  FOR EACH ROW EXECUTE FUNCTION private.refuse_record_change();
CREATE TRIGGER scorecard_records_no_truncate BEFORE TRUNCATE ON public.scorecard_records
  FOR EACH STATEMENT EXECUTE FUNCTION private.refuse_record_change();

-- Records that may count: not demo, not about a Notion import, not about an archived ticket.
CREATE VIEW public.scorecard_records_countable WITH (security_invoker = true) AS
  SELECT r.* FROM public.scorecard_records r
  LEFT JOIN public.tickets t ON t.id = r.ticket_id
  WHERE NOT r.is_demo AND NOT r.about_imported_ticket AND t.archived_at IS NULL;
GRANT SELECT ON public.scorecard_records_countable TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Record functions. Each checks the caller's role and uses server time.
-- ---------------------------------------------------------------------------

-- a. A home is ready for an arrival. Keeps the stay's check-in time for lead time later.
CREATE OR REPLACE FUNCTION public.record_arrival_readiness(
  _property_id uuid, _arrival_on date, _stay_ref text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _p record;
  _tz text;
  _today date;
  _check_in timestamptz;
  _existing public.scorecard_records;
  _id uuid;
  _at timestamptz;
BEGIN
  IF NOT private.sc_is_ops_staff(_me) THEN
    RAISE EXCEPTION 'Only Operations staff can mark a home ready.';
  END IF;
  SELECT id, check_in_time, time_zone, is_demo INTO _p FROM public.properties WHERE id = _property_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'This home was not found.'; END IF;
  IF _arrival_on IS NULL THEN RAISE EXCEPTION 'Choose the arrival date.'; END IF;
  _tz := coalesce(nullif(btrim(_p.time_zone), ''), 'America/Chicago');
  _today := (now() AT TIME ZONE _tz)::date;
  IF _arrival_on < _today - 1 OR _arrival_on > _today + 30 THEN
    RAISE EXCEPTION 'That arrival date is not close enough to mark ready.';
  END IF;
  IF _p.check_in_time ~ '^\s*\d{1,2}:\d{2}' THEN
    _check_in := (_arrival_on + btrim(_p.check_in_time)::time) AT TIME ZONE _tz;
  END IF;

  SELECT * INTO _existing FROM public.scorecard_records
   WHERE kind = 'arrival_readiness' AND property_id = _property_id
     AND details->>'arrival_on' = _arrival_on::text
   ORDER BY recorded_at LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('record_id', _existing.id, 'recorded_at', _existing.recorded_at, 'already_recorded', true);
  END IF;

  INSERT INTO public.scorecard_records (kind, recorded_by, property_id, stay_ref, note, details)
  VALUES ('arrival_readiness', _me, _property_id, nullif(btrim(coalesce(_stay_ref, '')), ''),
          nullif(btrim(coalesce(_note, '')), ''),
          jsonb_build_object('arrival_on', _arrival_on, 'check_in_at', _check_in,
                             'check_in_known', _check_in IS NOT NULL, 'time_zone', _tz))
  RETURNING id, recorded_at INTO _id, _at;
  RETURN jsonb_build_object('record_id', _id, 'recorded_at', _at, 'already_recorded', false);
END $$;

-- b. Queue sweep: logged automatically when the Operations Supervisor opens the Team Queue
-- or the Supervisor check. Anyone else is not logged. No button calls this.
CREATE OR REPLACE FUNCTION public.log_queue_open(_source text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _id uuid;
  _at timestamptz;
BEGIN
  IF _source NOT IN ('team_queue', 'supervisor_check', 'oversight') THEN
    RAISE EXCEPTION 'Unknown page.';
  END IF;
  IF NOT private.sc_is_ops_supervisor(_me) THEN
    RETURN jsonb_build_object('recorded', false);
  END IF;
  -- One line per page open; a quick refresh within 5 minutes is the same open.
  IF EXISTS (SELECT 1 FROM public.scorecard_records
              WHERE kind = 'queue_sweep' AND recorded_by = _me AND details->>'source' = _source
                AND recorded_at > now() - interval '5 minutes') THEN
    RETURN jsonb_build_object('recorded', false, 'recent', true);
  END IF;
  INSERT INTO public.scorecard_records (kind, recorded_by, details)
  VALUES ('queue_sweep', _me, jsonb_build_object(
    'source', _source, 'automatic', true,
    'workday', (now() AT TIME ZONE 'America/Chicago')::date,
    'sweep_number', NULL))
  RETURNING id, recorded_at INTO _id, _at;
  RETURN jsonb_build_object('recorded', true, 'record_id', _id, 'recorded_at', _at);
END $$;

-- c. Coaching conversation with a coordinator for the month.
CREATE OR REPLACE FUNCTION public.record_coaching_conversation(
  _coordinator uuid, _strength text, _improvement text, _follow_up text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _id uuid;
  _at timestamptz;
BEGIN
  IF NOT private.sc_is_ops_supervisor(_me) THEN
    RAISE EXCEPTION 'Only the Operations Supervisor can record a coaching conversation.';
  END IF;
  IF _coordinator IS NULL OR _coordinator = _me
     OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _coordinator AND role::text = 'tech') THEN
    RAISE EXCEPTION 'Choose the coordinator you coached.';
  END IF;
  IF length(btrim(coalesce(_strength, ''))) < 3 THEN RAISE EXCEPTION 'Add what went well.'; END IF;
  IF length(btrim(coalesce(_improvement, ''))) < 3 THEN RAISE EXCEPTION 'Add what to grow next.'; END IF;
  INSERT INTO public.scorecard_records (kind, recorded_by, about_user_id, details)
  VALUES ('coaching_cycle', _me, _coordinator, jsonb_build_object(
    'month', date_trunc('month', now() AT TIME ZONE 'America/Chicago')::date,
    'strength', left(btrim(_strength), 1000),
    'improvement', left(btrim(_improvement), 1000),
    'follow_up', nullif(left(btrim(coalesce(_follow_up, '')), 1000), '')))
  RETURNING id, recorded_at INTO _id, _at;
  RETURN jsonb_build_object('record_id', _id, 'recorded_at', _at);
END $$;

-- e. Corrective commitment on a guest issue ticket, by the Supervisor or Director of Operations.
CREATE OR REPLACE FUNCTION public.record_corrective_commitment(
  _ticket_id uuid, _commitment text, _due_on date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _id uuid;
  _at timestamptz;
BEGIN
  IF NOT (private.sc_is_ops_supervisor(_me) OR private.sc_is_ops_director(_me)) THEN
    RAISE EXCEPTION 'Only the Operations Supervisor or Director of Operations can add a commitment.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tickets WHERE id = _ticket_id AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'This ticket was not found.';
  END IF;
  IF NOT private.sc_is_guest_issue(_ticket_id) THEN
    RAISE EXCEPTION 'Commitments are for guest issue tickets.';
  END IF;
  IF length(btrim(coalesce(_commitment, ''))) < 5 THEN RAISE EXCEPTION 'Write what we commit to.'; END IF;
  IF _due_on IS NULL OR _due_on < (now() AT TIME ZONE 'America/Chicago')::date THEN
    RAISE EXCEPTION 'Choose a due date from today on.';
  END IF;
  INSERT INTO public.scorecard_records (kind, recorded_by, ticket_id, note, details)
  VALUES ('corrective_commitment', _me, _ticket_id, left(btrim(_commitment), 1000),
          jsonb_build_object('action', 'commitment', 'due_on', _due_on))
  RETURNING id, recorded_at INTO _id, _at;
  RETURN jsonb_build_object('record_id', _id, 'recorded_at', _at);
END $$;

-- e. The COO approves a commitment. A new line that points at the commitment.
CREATE OR REPLACE FUNCTION public.approve_corrective_commitment(_record_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _c public.scorecard_records;
  _existing public.scorecard_records;
  _id uuid;
  _at timestamptz;
BEGIN
  IF NOT private.sc_is_coo(_me) THEN
    RAISE EXCEPTION 'Only the COO can approve a commitment.';
  END IF;
  SELECT * INTO _c FROM public.scorecard_records
   WHERE id = _record_id AND kind = 'corrective_commitment' AND details->>'action' = 'commitment';
  IF NOT FOUND THEN RAISE EXCEPTION 'This commitment was not found.'; END IF;
  SELECT * INTO _existing FROM public.scorecard_records
   WHERE refers_to = _record_id AND details->>'action' = 'coo_approval' LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('record_id', _existing.id, 'recorded_at', _existing.recorded_at, 'already_recorded', true);
  END IF;
  INSERT INTO public.scorecard_records (kind, recorded_by, ticket_id, refers_to, details)
  VALUES ('corrective_commitment', _me, _c.ticket_id, _c.id, jsonb_build_object('action', 'coo_approval'))
  RETURNING id, recorded_at INTO _id, _at;
  RETURN jsonb_build_object('record_id', _id, 'recorded_at', _at, 'already_recorded', false);
END $$;

-- f. The Friday finance packet was delivered.
CREATE OR REPLACE FUNCTION public.record_finance_packet(
  _week_ending date, _complete boolean, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _id uuid;
  _at timestamptz;
BEGIN
  IF NOT (private.sc_is_ops_supervisor(_me) OR private.sc_is_ops_director(_me)) THEN
    RAISE EXCEPTION 'Only the Operations Supervisor or Director of Operations can record this.';
  END IF;
  IF _week_ending IS NULL OR _week_ending > (now() AT TIME ZONE 'America/Chicago')::date + 7 THEN
    RAISE EXCEPTION 'Choose the week this packet is for.';
  END IF;
  IF _complete IS NULL THEN RAISE EXCEPTION 'Say whether the packet was complete.'; END IF;
  IF NOT _complete AND length(btrim(coalesce(_note, ''))) < 3 THEN
    RAISE EXCEPTION 'Add what was missing.';
  END IF;
  INSERT INTO public.scorecard_records (kind, recorded_by, note, details)
  VALUES ('finance_packet', _me, nullif(left(btrim(coalesce(_note, '')), 1000), ''),
          jsonb_build_object('week_ending', _week_ending, 'complete', _complete))
  RETURNING id, recorded_at INTO _id, _at;
  RETURN jsonb_build_object('record_id', _id, 'recorded_at', _at);
END $$;

-- d. weekly_submission is an allowed kind for the auto-built weekly scorecard.
-- No function writes it yet: the Supervisor never types the numbers.

REVOKE ALL ON FUNCTION public.record_arrival_readiness(uuid, date, text, text),
  public.log_queue_open(text),
  public.record_coaching_conversation(uuid, text, text, text),
  public.record_corrective_commitment(uuid, text, date),
  public.approve_corrective_commitment(uuid),
  public.record_finance_packet(date, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_arrival_readiness(uuid, date, text, text),
  public.log_queue_open(text),
  public.record_coaching_conversation(uuid, text, text, text),
  public.record_corrective_commitment(uuid, text, date),
  public.approve_corrective_commitment(uuid),
  public.record_finance_packet(date, boolean, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Review channels that count for the Director's guest rating
-- ---------------------------------------------------------------------------

INSERT INTO public.app_settings (key, value)
VALUES ('guest_rating_channels', '{"channels": ["airbnb", "vrbo"]}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_guest_rating_channels(_channels text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _clean text[];
  _before jsonb;
  _after jsonb;
BEGIN
  IF NOT (private.sc_is_ops_supervisor(_me) OR private.sc_is_ops_director(_me)) THEN
    RAISE EXCEPTION 'Only the Operations Supervisor or Director of Operations can change this.';
  END IF;
  SELECT coalesce(array_agg(DISTINCT c ORDER BY c), '{}') INTO _clean
    FROM unnest(coalesce(_channels, '{}')) AS c;
  IF cardinality(_clean) = 0 THEN RAISE EXCEPTION 'Choose at least one channel.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(_clean) c WHERE c NOT IN ('airbnb', 'vrbo', 'booking_com', 'direct', 'google')) THEN
    RAISE EXCEPTION 'Unknown channel.';
  END IF;
  SELECT value INTO _before FROM public.app_settings WHERE key = 'guest_rating_channels';
  _after := jsonb_build_object('channels', to_jsonb(_clean));
  INSERT INTO public.app_settings (key, value, updated_by, updated_at)
  VALUES ('guest_rating_channels', _after, _me, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_label, before_value, after_value)
  VALUES (_me, 'guest_rating_channels_changed', 'setting', 'guest_rating_channels', _before, _after);
  RETURN _after;
END $$;
REVOKE ALL ON FUNCTION public.set_guest_rating_channels(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_guest_rating_channels(text[]) TO authenticated;
