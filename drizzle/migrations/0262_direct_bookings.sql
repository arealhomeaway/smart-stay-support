-- Direct Bookings: additive schema, approvals, alerts and guarded actions.
-- Staged only. Not applied until approved. Undo: 01_undo_direct_bookings.sql
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.

-- 1. Request fields on leads (all nullable, nothing existing changes).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS partner_name text,
  ADD COLUMN IF NOT EXISTS min_bathrooms numeric,
  ADD COLUMN IF NOT EXISTS owned_by uuid,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS reply_to text,
  ADD COLUMN IF NOT EXISTS reply_cc text[],
  ADD COLUMN IF NOT EXISTS reply_subject text,
  ADD COLUMN IF NOT EXISTS reply_body text,
  ADD COLUMN IF NOT EXISTS offered_property_ids uuid[],
  ADD COLUMN IF NOT EXISTS reply_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reply_sent_by uuid,
  ADD COLUMN IF NOT EXISTS reply_sent_via text,
  ADD COLUMN IF NOT EXISTS last_follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS outcome_at timestamptz,
  ADD COLUMN IF NOT EXISTS outcome_by uuid,
  ADD COLUMN IF NOT EXISTS booked_property_id uuid REFERENCES public.properties(id),
  ADD COLUMN IF NOT EXISTS booked_move_in date,
  ADD COLUMN IF NOT EXISTS not_booked_reason text,
  ADD COLUMN IF NOT EXISTS not_booked_note text;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_kind_check CHECK (kind IS NULL OR kind = 'direct_booking'),
  ADD CONSTRAINT leads_reply_via_check CHECK (reply_sent_via IS NULL OR reply_sent_via IN ('mailbox','manual')),
  ADD CONSTRAINT leads_db_outcome_check CHECK (outcome IS NULL OR outcome IN ('booked','not_booked')),
  ADD CONSTRAINT leads_not_booked_reason_check CHECK (
    not_booked_reason IS NULL OR not_booked_reason IN
    ('Stayed with family','Chose another home','No reply from the partner','Price was too high','No home was available','Other'));

CREATE INDEX IF NOT EXISTS leads_direct_booking_open_idx
  ON public.leads (created_at DESC) WHERE kind = 'direct_booking';

-- 2. Approvals: one row per quote sent for approval.
CREATE TABLE public.direct_booking_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reply jsonb NOT NULL,
  property_ids uuid[] NOT NULL DEFAULT '{}',
  escalated_at timestamptz,
  decision text CHECK (decision IS NULL OR decision IN ('approved','sent_back')),
  decided_by uuid,
  decided_at timestamptz,
  decided_as text CHECK (decided_as IS NULL OR decided_as IN ('ops_supervisor','director_ops')),
  note text
);
CREATE UNIQUE INDEX direct_booking_one_pending
  ON public.direct_booking_approvals (lead_id) WHERE decision IS NULL;

GRANT SELECT ON public.direct_booking_approvals TO authenticated;
GRANT ALL ON public.direct_booking_approvals TO service_role;
ALTER TABLE public.direct_booking_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view direct booking approvals" ON public.direct_booking_approvals
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
-- No insert/update/delete policies: writes go only through the functions below.

-- 3. Role checks (functional roles; never a person).
CREATE OR REPLACE FUNCTION public.holds_functional_role(_user_id uuid, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.functional_roles WHERE code = _code AND active AND current_seat_holder = _user_id)
      OR EXISTS (SELECT 1 FROM public.functional_role_members WHERE role_code = _code AND user_id = _user_id);
$$;
REVOKE ALL ON FUNCTION public.holds_functional_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.holds_functional_role(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.functional_role_holders(_code text)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT current_seat_holder FROM public.functional_roles WHERE code = _code AND active AND current_seat_holder IS NOT NULL
  UNION
  SELECT user_id FROM public.functional_role_members WHERE role_code = _code;
$$;
REVOKE ALL ON FUNCTION public.functional_role_holders(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.functional_role_holders(text) TO service_role;

-- 4. Settings (one app_settings row, read with defaults).
CREATE OR REPLACE FUNCTION public.direct_booking_settings()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'approvalStart', '2026-11-09', 'approvalEnd', '2026-11-23',
    'requireApprovalAfterEnd', false, 'approvalWaitMinutes', 2, 'replyTargetMinutes', 3)
    || coalesce((SELECT value FROM public.app_settings WHERE key = 'direct_booking_settings'), '{}'::jsonb);
$$;
REVOKE ALL ON FUNCTION public.direct_booking_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direct_booking_settings() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.direct_booking_approval_required(_at timestamptz DEFAULT now())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH s AS (SELECT public.direct_booking_settings() v), d AS (SELECT (_at AT TIME ZONE 'America/Chicago')::date AS day)
  SELECT CASE
    WHEN d.day BETWEEN (s.v->>'approvalStart')::date AND (s.v->>'approvalEnd')::date THEN true
    ELSE coalesce((s.v->>'requireApprovalAfterEnd')::boolean, false) END
  FROM s, d;
$$;
REVOKE ALL ON FUNCTION public.direct_booking_approval_required(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direct_booking_approval_required(timestamptz) TO authenticated, service_role;

-- Only the Operations Supervisor and Director of Operations roles change settings.
CREATE OR REPLACE FUNCTION public.save_direct_booking_settings(_value jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.holds_functional_role(auth.uid(), 'ops_supervisor') OR public.holds_functional_role(auth.uid(), 'director_ops')) THEN
    RAISE EXCEPTION 'Only the Operations Supervisor or the Director of Operations can change these settings.';
  END IF;
  INSERT INTO public.app_settings(key, value, updated_by, updated_at)
  VALUES ('direct_booking_settings', _value, auth.uid(), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_label, after_value)
  VALUES (auth.uid(), 'direct_booking_settings_changed', 'app_settings', 'Direct Bookings settings', _value);
  RETURN public.direct_booking_settings();
END $$;
REVOKE ALL ON FUNCTION public.save_direct_booking_settings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_direct_booking_settings(jsonb) TO authenticated;

-- 5. Alerts.
CREATE OR REPLACE FUNCTION public.direct_booking_notify(_users uuid[], _kind text, _title text, _body text, _lead uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority, is_demo)
  SELECT DISTINCT u, _kind, _title, _body, 'lead', _lead, '/direct-bookings/' || _lead, 'high',
         coalesce((SELECT is_demo FROM public.leads WHERE id = _lead), false)
  FROM unnest(_users) u WHERE u IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.direct_booking_notify(uuid[], text, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- Who is on shift for Guest Experience and Reservations (day and evening).
-- Weekends: whoever is on shift, because that person covers both teams.
CREATE OR REPLACE FUNCTION public.direct_booking_on_shift(_at timestamptz DEFAULT now())
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH t AS (
    SELECT extract(dow FROM _at AT TIME ZONE 'America/Chicago')::int AS wd,
           (extract(hour FROM _at AT TIME ZONE 'America/Chicago') * 60 + extract(minute FROM _at AT TIME ZONE 'America/Chicago'))::int AS m)
  SELECT DISTINCT fr.current_seat_holder
  FROM public.coverage_shifts cs
  JOIN public.functional_roles fr ON fr.code = cs.role_code AND fr.active AND fr.current_seat_holder IS NOT NULL
  CROSS JOIN t
  WHERE cs.active AND cs.weekday = t.wd AND t.m >= cs.start_minute AND t.m < cs.end_minute
    AND (t.wd IN (0, 6) OR cs.role_code IN ('ge_day', 'ge_evening'));
$$;
REVOKE ALL ON FUNCTION public.direct_booking_on_shift(timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.direct_booking_alert_new()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'direct_booking' AND NEW.owned_by IS NULL THEN
    PERFORM public.direct_booking_notify(
      ARRAY(SELECT public.direct_booking_on_shift(now())),
      'direct_booking_new',
      'New direct booking request',
      coalesce(NEW.partner_name, NEW.company, 'A partner') || ' is waiting. Press Start to own it and reply within 3 minutes.',
      NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER direct_booking_alert_new_trg AFTER INSERT ON public.leads
  FOR EACH ROW WHEN (NEW.kind = 'direct_booking') EXECUTE FUNCTION public.direct_booking_alert_new();

-- 6. New request by hand (phone or walk-in).
CREATE OR REPLACE FUNCTION public.create_direct_booking(_details jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Direct Bookings are for ARHA staff only.'; END IF;
  INSERT INTO public.leads(kind, contact_name, company, partner_name, email, phone, preferred_channel, source,
                           subject, market, search_region, desired_move_in, desired_check_out, bedrooms,
                           min_bathrooms, guests, dogs, cats, requirements, inquiry_source_id, stage, created_by)
  VALUES ('direct_booking', nullif(_details->>'contact_name',''), nullif(_details->>'company',''),
          nullif(_details->>'partner_name',''), nullif(_details->>'email',''), nullif(_details->>'phone',''),
          coalesce(nullif(_details->>'channel','')::lead_channel, 'call'), 'referral',
          nullif(_details->>'subject',''), nullif(_details->>'location',''), nullif(_details->>'location',''),
          nullif(_details->>'move_in','')::date, nullif(_details->>'move_out','')::date,
          nullif(_details->>'bedrooms','')::int, nullif(_details->>'bathrooms','')::numeric,
          nullif(_details->>'guests','')::int, coalesce(nullif(_details->>'dogs','')::int, 0),
          coalesce(nullif(_details->>'cats','')::int, 0), nullif(_details->>'requirements',''),
          nullif(_details->>'inquiry_source_id','')::uuid, 'new', auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.create_direct_booking(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_direct_booking(jsonb) TO authenticated;

-- 7. Start: the first press wins, in one statement.
CREATE OR REPLACE FUNCTION public.start_direct_booking(_lead_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Direct Bookings are for ARHA staff only.'; END IF;
  UPDATE public.leads SET owned_by = auth.uid(), assigned_to = auth.uid(), started_at = now(), updated_at = now()
   WHERE id = _lead_id AND kind = 'direct_booking' AND owned_by IS NULL
  RETURNING owned_by INTO _owner;
  IF _owner IS NULL THEN
    SELECT owned_by INTO _owner FROM public.leads WHERE id = _lead_id AND kind = 'direct_booking';
    IF NOT FOUND THEN RAISE EXCEPTION 'This request was not found.'; END IF;
    RETURN jsonb_build_object('won', _owner = auth.uid(), 'owner', _owner,
      'owner_name', (SELECT full_name FROM public.profiles WHERE id = _owner));
  END IF;
  INSERT INTO public.lead_activity(lead_id, channel, outcome, note, actor_id, occurred_at)
  VALUES (_lead_id, 'system', 'Started', 'Owns this request', auth.uid(), now());
  RETURN jsonb_build_object('won', true, 'owner', auth.uid(),
    'owner_name', (SELECT full_name FROM public.profiles WHERE id = auth.uid()));
END $$;
REVOKE ALL ON FUNCTION public.start_direct_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_direct_booking(uuid) TO authenticated;

-- 8. Send for approval (or record that no approval is needed).
CREATE OR REPLACE FUNCTION public.request_direct_booking_approval(_lead_id uuid, _reply jsonb, _property_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _lead public.leads; _approval uuid;
BEGIN
  SELECT * INTO _lead FROM public.leads WHERE id = _lead_id AND kind = 'direct_booking' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This request was not found.'; END IF;
  IF _lead.owned_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the person who started this request can send the reply.'; END IF;
  IF _lead.reply_sent_at IS NOT NULL THEN RAISE EXCEPTION 'The reply was already sent.'; END IF;
  IF coalesce(array_length(_property_ids, 1), 0) > 3 THEN RAISE EXCEPTION 'Pick up to 3 homes.'; END IF;
  UPDATE public.leads SET reply_to = _reply->>'to', reply_subject = _reply->>'subject', reply_body = _reply->>'body',
         reply_cc = ARRAY(SELECT jsonb_array_elements_text(coalesce(_reply->'cc', '[]'::jsonb))),
         offered_property_ids = _property_ids, updated_at = now()
   WHERE id = _lead_id;
  IF NOT public.direct_booking_approval_required(now()) THEN
    RETURN jsonb_build_object('approval_required', false);
  END IF;
  INSERT INTO public.direct_booking_approvals(lead_id, requested_by, reply, property_ids)
  VALUES (_lead_id, auth.uid(), _reply, _property_ids)
  ON CONFLICT (lead_id) WHERE decision IS NULL DO UPDATE SET reply = EXCLUDED.reply, property_ids = EXCLUDED.property_ids
  RETURNING id INTO _approval;
  PERFORM public.direct_booking_notify(ARRAY(SELECT public.functional_role_holders('ops_supervisor')),
    'direct_booking_approval', 'A direct booking reply needs your approval',
    'Check the homes and the reply. The clock is running.', _lead_id);
  RETURN jsonb_build_object('approval_required', true, 'approval_id', _approval);
END $$;
REVOKE ALL ON FUNCTION public.request_direct_booking_approval(uuid, jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_direct_booking_approval(uuid, jsonb, uuid[]) TO authenticated;

-- 9. Escalation: after the wait, alert the Director of Operations once.
CREATE OR REPLACE FUNCTION public.escalate_direct_booking_approvals()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row record; n integer := 0; _wait int := coalesce((public.direct_booking_settings()->>'approvalWaitMinutes')::int, 2);
BEGIN
  FOR _row IN SELECT id, lead_id FROM public.direct_booking_approvals
     WHERE decision IS NULL AND escalated_at IS NULL AND requested_at <= now() - make_interval(mins => _wait)
     FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.direct_booking_approvals SET escalated_at = now() WHERE id = _row.id;
    PERFORM public.direct_booking_notify(ARRAY(SELECT public.functional_role_holders('director_ops')),
      'direct_booking_escalated', 'A direct booking reply is still waiting',
      'No approval after ' || _wait || ' minutes. You can approve it now.', _row.lead_id);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.escalate_direct_booking_approvals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.escalate_direct_booking_approvals() TO authenticated, service_role;

-- 10. Approve or send back. The database decides who may.
CREATE OR REPLACE FUNCTION public.decide_direct_booking_approval(_lead_id uuid, _decision text, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a public.direct_booking_approvals; _as text; _wait int := coalesce((public.direct_booking_settings()->>'approvalWaitMinutes')::int, 2);
BEGIN
  IF _decision NOT IN ('approved','sent_back') THEN RAISE EXCEPTION 'Choose approve or send back.'; END IF;
  SELECT * INTO _a FROM public.direct_booking_approvals WHERE lead_id = _lead_id AND decision IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nothing is waiting for approval on this request.'; END IF;
  IF public.holds_functional_role(auth.uid(), 'ops_supervisor') THEN _as := 'ops_supervisor';
  ELSIF public.holds_functional_role(auth.uid(), 'director_ops')
        AND (_a.escalated_at IS NOT NULL OR _a.requested_at <= now() - make_interval(mins => _wait)) THEN _as := 'director_ops';
  ELSE RAISE EXCEPTION 'Only the Operations Supervisor can approve now. The Director of Operations can approve after % minutes.', _wait;
  END IF;
  IF _decision = 'sent_back' AND coalesce(trim(_note), '') = '' THEN RAISE EXCEPTION 'Say what to change.'; END IF;
  UPDATE public.direct_booking_approvals SET decision = _decision, decided_by = auth.uid(), decided_at = now(), decided_as = _as, note = _note
   WHERE id = _a.id;
  IF _decision = 'sent_back' THEN
    PERFORM public.direct_booking_notify(ARRAY[_a.requested_by], 'direct_booking_sent_back',
      'Your direct booking reply needs a change', coalesce(_note, ''), _lead_id);
  END IF;
  RETURN jsonb_build_object('approval_id', _a.id, 'decided_as', _as, 'reply', _a.reply);
END $$;
REVOKE ALL ON FUNCTION public.decide_direct_booking_approval(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_direct_booking_approval(uuid, text, text) TO authenticated;

-- 11. Record that the reply went out (mailbox or "I sent it"). Stops the clock once.
CREATE OR REPLACE FUNCTION public.record_direct_booking_reply(_lead_id uuid, _via text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _lead public.leads; _approved boolean; _sent timestamptz;
BEGIN
  IF _via NOT IN ('mailbox','manual') THEN RAISE EXCEPTION 'Unknown send method.'; END IF;
  SELECT * INTO _lead FROM public.leads WHERE id = _lead_id AND kind = 'direct_booking' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This request was not found.'; END IF;
  IF _lead.reply_sent_at IS NOT NULL THEN RETURN _lead.reply_sent_at; END IF;
  SELECT EXISTS (SELECT 1 FROM public.direct_booking_approvals WHERE lead_id = _lead_id AND decision = 'approved'
                  AND decided_at >= coalesce((SELECT max(requested_at) FROM public.direct_booking_approvals WHERE lead_id = _lead_id), '-infinity'))
    INTO _approved;
  IF NOT _approved THEN
    IF public.direct_booking_approval_required(now()) THEN RAISE EXCEPTION 'This reply needs approval before it sends.'; END IF;
    IF _lead.owned_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the person who started this request can send the reply.'; END IF;
  ELSIF NOT (_lead.owned_by = auth.uid() OR public.holds_functional_role(auth.uid(), 'ops_supervisor')
             OR public.holds_functional_role(auth.uid(), 'director_ops')) THEN
    RAISE EXCEPTION 'You cannot send this reply.';
  END IF;
  UPDATE public.leads SET reply_sent_at = now(), reply_sent_by = auth.uid(), reply_sent_via = _via,
         quote_sent_at = coalesce(quote_sent_at, now()), last_contact_at = now(), stage = 'engaged', updated_at = now()
   WHERE id = _lead_id RETURNING reply_sent_at INTO _sent;
  IF NOT _approved THEN
    -- After the approval period: the Operations Supervisor gets a copy.
    PERFORM public.direct_booking_notify(ARRAY(SELECT public.functional_role_holders('ops_supervisor')),
      'direct_booking_sent_copy', 'A direct booking reply was sent', coalesce(_lead.reply_subject, ''), _lead_id);
  END IF;
  RETURN _sent;
END $$;
REVOKE ALL ON FUNCTION public.record_direct_booking_reply(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_direct_booking_reply(uuid, text) TO authenticated;

-- 12. Follow up (same thread, recorded) and outcomes.
CREATE OR REPLACE FUNCTION public.record_direct_booking_follow_up(_lead_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Direct Bookings are for ARHA staff only.'; END IF;
  UPDATE public.leads SET last_follow_up_at = now(), last_contact_at = now(), updated_at = now()
   WHERE id = _lead_id AND kind = 'direct_booking' AND reply_sent_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Send the first reply before a follow-up.'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.record_direct_booking_follow_up(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_direct_booking_follow_up(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_direct_booking_outcome(_lead_id uuid, _outcome text, _property_id uuid DEFAULT NULL,
  _move_in date DEFAULT NULL, _reason text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _lead public.leads;
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Direct Bookings are for ARHA staff only.'; END IF;
  SELECT * INTO _lead FROM public.leads WHERE id = _lead_id AND kind = 'direct_booking' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This request was not found.'; END IF;
  IF _lead.reply_sent_at IS NULL THEN RAISE EXCEPTION 'Send the reply first.'; END IF;
  IF _outcome = 'booked' THEN
    IF _property_id IS NOT NULL AND NOT (_property_id = ANY(coalesce(_lead.offered_property_ids, '{}'))) THEN
      RAISE EXCEPTION 'Choose one of the offered homes.'; END IF;
    UPDATE public.leads SET outcome = 'booked', outcome_at = now(), outcome_by = auth.uid(),
           booked_property_id = _property_id, booked_move_in = _move_in, stage = 'converted',
           converted_at = now(), converted_by = auth.uid(), converted_property_id = _property_id, updated_at = now()
     WHERE id = _lead_id;
  ELSIF _outcome = 'not_booked' THEN
    IF coalesce(trim(_note), '') = '' THEN RAISE EXCEPTION 'Add a short note.'; END IF;
    UPDATE public.leads SET outcome = 'not_booked', outcome_at = now(), outcome_by = auth.uid(),
           not_booked_reason = _reason, not_booked_note = left(_note, 500), stage = 'lost', lost_at = now(),
           lost_note = left(_note, 500), updated_at = now()
     WHERE id = _lead_id;
  ELSE RAISE EXCEPTION 'Choose booked or not booked.';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.mark_direct_booking_outcome(uuid, text, uuid, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_direct_booking_outcome(uuid, text, uuid, date, text, text) TO authenticated;

-- 13. Daily list of sent quotes for the Operations Supervisor, once per Central day.
CREATE OR REPLACE FUNCTION public.direct_booking_daily_summary(_at timestamptz DEFAULT now())
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _day date := ((_at AT TIME ZONE 'America/Chicago')::date - 1); _count int; _body text;
BEGIN
  IF extract(hour FROM _at AT TIME ZONE 'America/Chicago') < 7 THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.staff_notifications WHERE kind = 'direct_booking_daily' AND title LIKE '%' || to_char(_day, 'Mon FMDD') || '%') THEN RETURN 0; END IF;
  SELECT count(*), string_agg(coalesce(partner_name, company, 'Partner') || ': ' || coalesce(reply_subject, ''), E'\n' ORDER BY reply_sent_at)
    INTO _count, _body
    FROM public.leads WHERE kind = 'direct_booking' AND (reply_sent_at AT TIME ZONE 'America/Chicago')::date = _day;
  IF _count = 0 THEN RETURN 0; END IF;
  INSERT INTO public.staff_notifications(user_id, kind, title, body, link_path, priority)
  SELECT u, 'direct_booking_daily', 'Direct booking replies sent ' || to_char(_day, 'Mon FMDD') || ': ' || _count, _body, '/direct-bookings', 'normal'
    FROM public.functional_role_holders('ops_supervisor') u;
  RETURN _count;
END $$;
REVOKE ALL ON FUNCTION public.direct_booking_daily_summary(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.direct_booking_daily_summary(timestamptz) TO service_role;
