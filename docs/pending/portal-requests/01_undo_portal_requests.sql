-- Undo for 01_portal_requests.sql. Restores record_direct_booking_reply exactly
-- as captured live on Nov 10, 2026 (live-capture/public.record_direct_booking_reply.sql),
-- removes the two new actions and the guard, then the five new columns.
-- Removing the columns drops any portal links and portal answers recorded since;
-- the history lines in lead_activity stay. Roll the app code back first.

DROP FUNCTION IF EXISTS public.correct_direct_booking_portal_answer(uuid, text);
DROP FUNCTION IF EXISTS public.answer_direct_booking_in_portal(uuid, text, jsonb, uuid[]);
DROP TRIGGER IF EXISTS guard_lead_portal_fields_trg ON public.leads;
DROP FUNCTION IF EXISTS public.guard_lead_portal_fields();

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
  UPDATE public.leads SET reply_sent_at = now(), reply_sent_by = auth.uid(), reply_sent_via = _via,
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

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_portal_link_host_check;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_reply_method_check;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_portal_note_check;
ALTER TABLE public.leads
  DROP COLUMN IF EXISTS portal_answer_note,
  DROP COLUMN IF EXISTS portal_answered_by,
  DROP COLUMN IF EXISTS portal_answered_at,
  DROP COLUMN IF EXISTS reply_method,
  DROP COLUMN IF EXISTS portal_link;
