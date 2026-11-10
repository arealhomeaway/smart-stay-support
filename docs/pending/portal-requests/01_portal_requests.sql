-- Portal requests in Direct Bookings (Emily, Nov 9, register D8).
-- Additive only. Adds to public.leads: the partner portal link, how the
-- request was answered (email or portal) and who answered in the portal, when,
-- with a note. Adds "I answered in the partner's portal" and the Supervisor or
-- Admin correction. Changes one existing function, record_direct_booking_reply,
-- by one line: an emailed reply is marked reply_method = 'email'. Nothing else
-- changes: who may start, send, approve or mark an outcome; the approval
-- period; the 3 minute clock; the 48 hour follow up; every alert text.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS portal_link text,
  ADD COLUMN IF NOT EXISTS reply_method text,
  ADD COLUMN IF NOT EXISTS portal_answered_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_answered_by uuid,
  ADD COLUMN IF NOT EXISTS portal_answer_note text;

ALTER TABLE public.leads ADD CONSTRAINT leads_portal_link_host_check CHECK (
  portal_link IS NULL OR (
    length(portal_link) <= 2000
    AND portal_link ~* '^https?://([a-z0-9-]+\.)*(owlmarketplace\.com|reloquest\.com|travelershaven\.com|aleasetech\.com)(:[0-9]{1,5})?([/?#]|$)'
  ));
ALTER TABLE public.leads ADD CONSTRAINT leads_reply_method_check CHECK (reply_method IS NULL OR reply_method IN ('email', 'portal'));
ALTER TABLE public.leads ADD CONSTRAINT leads_portal_note_check CHECK (portal_answer_note IS NULL OR length(portal_answer_note) <= 200);

COMMENT ON COLUMN public.leads.portal_link IS 'Partner portal request link read from the email at intake; only Owl Marketplace, ReloQuest, Travelers Haven and Realto (aleasetech) hosts.';
COMMENT ON COLUMN public.leads.reply_method IS 'How the first reply was made: email or portal. reply_sent_at is the one reply time for both.';
COMMENT ON COLUMN public.leads.portal_answered_at IS 'When someone recorded "I answered in the partner''s portal".';

-- Sent replies so far were all emailed.
UPDATE public.leads SET reply_method = 'email'
 WHERE kind = 'direct_booking' AND reply_sent_at IS NOT NULL AND reply_method IS NULL;

-- Only Resolve's own actions write these fields. Direct writes from the app
-- (signed in users) may insert the portal link at intake and nothing else.
CREATE OR REPLACE FUNCTION public.guard_lead_portal_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.reply_method IS NOT NULL OR NEW.portal_answered_at IS NOT NULL
       OR NEW.portal_answered_by IS NOT NULL OR NEW.portal_answer_note IS NOT NULL THEN
      RAISE EXCEPTION 'How a request was answered is recorded only by Resolve.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.portal_link IS DISTINCT FROM OLD.portal_link
     OR NEW.reply_method IS DISTINCT FROM OLD.reply_method
     OR NEW.portal_answered_at IS DISTINCT FROM OLD.portal_answered_at
     OR NEW.portal_answered_by IS DISTINCT FROM OLD.portal_answered_by
     OR NEW.portal_answer_note IS DISTINCT FROM OLD.portal_answer_note THEN
    RAISE EXCEPTION 'How a request was answered is recorded only by Resolve.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_lead_portal_fields() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_lead_portal_fields_trg BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.guard_lead_portal_fields();

-- Unchanged except one line: reply_method = 'email' when the clock stops by email.
CREATE OR REPLACE FUNCTION public.record_direct_booking_reply(_lead_id uuid, _via text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  UPDATE public.leads SET reply_sent_at = now(), reply_sent_by = auth.uid(), reply_sent_via = _via, reply_method = 'email',
         quote_sent_at = coalesce(quote_sent_at, now()), last_contact_at = now(), stage = 'engaged', updated_at = now(),
         follow_up_due_at = now() + interval '48 hours'
   WHERE id = _lead_id RETURNING reply_sent_at INTO _sent;
  IF NOT _approved THEN
    -- After the approval period: the Operations Supervisor gets a copy.
    PERFORM public.direct_booking_notify(ARRAY(SELECT public.functional_role_holders('ops_supervisor')),
      'direct_booking_sent_copy', 'A direct booking reply was sent', coalesce(_lead.reply_subject, ''), _lead_id);
  END IF;
  RETURN _sent;
END $function$;

-- "I answered in the partner's portal". The same reply time as an emailed
-- reply (reply_sent_at, the press time), the same move to Quote sent and the
-- same 48 hour follow up. During the approval period only after the quote was
-- approved, the same approval test record_direct_booking_reply uses.
CREATE OR REPLACE FUNCTION public.answer_direct_booking_in_portal(
  _lead_id uuid, _note text, _reply jsonb DEFAULT NULL, _property_ids uuid[] DEFAULT NULL)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _lead public.leads; _approved boolean; _note1 text; _at timestamptz := now();
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Direct Bookings are for ARHA staff only.'; END IF;
  _note1 := left(btrim(regexp_replace(coalesce(_note, ''), '\s+', ' ', 'g')), 200);
  IF _note1 = '' THEN RAISE EXCEPTION 'Add a short note, for example the portal quote number.'; END IF;
  SELECT * INTO _lead FROM public.leads WHERE id = _lead_id AND kind = 'direct_booking' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This request was not found.'; END IF;
  IF _lead.outcome IS NOT NULL THEN RAISE EXCEPTION 'This request is already finished.'; END IF;
  -- Pressed twice: nothing changes.
  IF _lead.portal_answered_at IS NOT NULL THEN RETURN coalesce(_lead.reply_sent_at, _lead.portal_answered_at); END IF;
  SELECT EXISTS (SELECT 1 FROM public.direct_booking_approvals WHERE lead_id = _lead_id AND decision = 'approved'
                  AND decided_at >= coalesce((SELECT max(requested_at) FROM public.direct_booking_approvals WHERE lead_id = _lead_id), '-infinity'))
    INTO _approved;

  IF _lead.reply_sent_at IS NOT NULL THEN
    -- Already emailed: the clock stopped then and stays as it is.
    IF NOT (_lead.owned_by = auth.uid() OR public.holds_functional_role(auth.uid(), 'ops_supervisor')
            OR public.holds_functional_role(auth.uid(), 'director_ops')) THEN
      RAISE EXCEPTION 'Only the person who started this request can record this.';
    END IF;
    UPDATE public.leads SET portal_answered_at = _at, portal_answered_by = auth.uid(), portal_answer_note = _note1, updated_at = _at
     WHERE id = _lead_id;
    INSERT INTO public.lead_activity(lead_id, channel, outcome, note, actor_id, occurred_at)
    VALUES (_lead_id, 'system', 'Answered in the partner''s portal', _note1, auth.uid(), _at);
    RETURN _lead.reply_sent_at;
  END IF;

  IF NOT _approved THEN
    IF public.direct_booking_approval_required(_at) THEN
      RAISE EXCEPTION 'A supervisor must OK this quote before you answer in the partner''s portal.';
    END IF;
    IF _lead.owned_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the person who started this request can answer it.'; END IF;
    IF coalesce(array_length(_property_ids, 1), 0) < 1 THEN RAISE EXCEPTION 'Pick at least one home first.'; END IF;
    IF array_length(_property_ids, 1) > 3 THEN RAISE EXCEPTION 'Pick up to 3 homes.'; END IF;
    UPDATE public.leads SET reply_to = coalesce(nullif(_reply->>'to', ''), reply_to),
           reply_subject = coalesce(_reply->>'subject', reply_subject), reply_body = coalesce(_reply->>'body', reply_body),
           offered_property_ids = _property_ids
     WHERE id = _lead_id RETURNING * INTO _lead;
  ELSIF NOT (_lead.owned_by = auth.uid() OR public.holds_functional_role(auth.uid(), 'ops_supervisor')
             OR public.holds_functional_role(auth.uid(), 'director_ops')) THEN
    RAISE EXCEPTION 'Only the person who started this request can answer it.';
  END IF;
  -- Active Owner homes are never offered, checked again here.
  IF EXISTS (SELECT 1 FROM public.direct_booking_active_owner_homes(_lead.offered_property_ids)) THEN
    RAISE EXCEPTION 'A home you picked is in the Active Owner program and cannot be offered. Remove it and pick another home.';
  END IF;

  UPDATE public.leads SET reply_sent_at = _at, reply_sent_by = auth.uid(), reply_method = 'portal',
         quote_sent_at = coalesce(quote_sent_at, _at), last_contact_at = _at, stage = 'engaged', updated_at = _at,
         follow_up_due_at = _at + interval '48 hours',
         portal_answered_at = _at, portal_answered_by = auth.uid(), portal_answer_note = _note1
   WHERE id = _lead_id;
  INSERT INTO public.lead_activity(lead_id, channel, outcome, note, actor_id, occurred_at)
  VALUES (_lead_id, 'system', 'Answered in the partner''s portal', _note1, auth.uid(), _at);
  IF NOT _approved THEN
    -- After the approval period: the Operations Supervisor gets a copy, as for an emailed reply.
    PERFORM public.direct_booking_notify(ARRAY(SELECT public.functional_role_holders('ops_supervisor')),
      'direct_booking_sent_copy', 'A direct booking request was answered in the partner''s portal',
      coalesce(_lead.reply_subject, ''), _lead_id);
  END IF;
  RETURN _at;
END $$;
REVOKE ALL ON FUNCTION public.answer_direct_booking_in_portal(uuid, text, jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.answer_direct_booking_in_portal(uuid, text, jsonb, uuid[]) TO authenticated, service_role;

-- The coordinator cannot undo it. The Operations Supervisor or an Admin can
-- correct it with a reason, before a follow up, the partner's approval or an
-- outcome is recorded. History keeps both lines.
CREATE OR REPLACE FUNCTION public.correct_direct_booking_portal_answer(_lead_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _lead public.leads; _reason1 text;
BEGIN
  IF NOT (public.holds_functional_role(auth.uid(), 'ops_supervisor') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Only the Operations Supervisor or an Admin can correct this.';
  END IF;
  _reason1 := left(btrim(coalesce(_reason, '')), 500);
  IF length(_reason1) < 3 THEN RAISE EXCEPTION 'Give a short reason.'; END IF;
  SELECT * INTO _lead FROM public.leads WHERE id = _lead_id AND kind = 'direct_booking' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This request was not found.'; END IF;
  IF _lead.portal_answered_at IS NULL THEN RAISE EXCEPTION 'This request was not answered in the partner''s portal.'; END IF;
  IF _lead.outcome IS NOT NULL THEN RAISE EXCEPTION 'This request is already finished.'; END IF;
  IF _lead.reply_method = 'portal' THEN
    IF _lead.partner_approved_at IS NOT NULL OR _lead.last_follow_up_at IS NOT NULL THEN
      RAISE EXCEPTION 'A follow-up or the partner''s approval is already recorded, so this cannot be corrected.';
    END IF;
    UPDATE public.leads SET reply_sent_at = NULL, reply_sent_by = NULL, reply_method = NULL, follow_up_due_at = NULL,
           quote_sent_at = CASE WHEN quote_sent_at = _lead.reply_sent_at THEN NULL ELSE quote_sent_at END,
           stage = CASE WHEN stage = 'engaged' THEN 'new'::public.lead_stage ELSE stage END,
           portal_answered_at = NULL, portal_answered_by = NULL, portal_answer_note = NULL, updated_at = now()
     WHERE id = _lead_id;
  ELSE
    UPDATE public.leads SET portal_answered_at = NULL, portal_answered_by = NULL, portal_answer_note = NULL, updated_at = now()
     WHERE id = _lead_id;
  END IF;
  INSERT INTO public.lead_activity(lead_id, channel, outcome, note, actor_id, occurred_at)
  VALUES (_lead_id, 'system', 'Portal answer corrected', _reason1, auth.uid(), now());
END $$;
REVOKE ALL ON FUNCTION public.correct_direct_booking_portal_answer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_direct_booking_portal_answer(uuid, text) TO authenticated, service_role;
