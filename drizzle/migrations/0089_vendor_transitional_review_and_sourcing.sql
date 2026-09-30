-- Existing ARHA Vendor — Transitional Review: a temporary migration flag, NOT a lifecycle status.
ALTER TABLE public.vendor_orgs
  ADD COLUMN IF NOT EXISTS transitional_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transitional_started_on date,
  ADD COLUMN IF NOT EXISTS transitional_deadline date,
  ADD COLUMN IF NOT EXISTS transitional_outcome text,
  ADD COLUMN IF NOT EXISTS transitional_ended_at timestamptz;
ALTER TABLE public.vendor_orgs DROP CONSTRAINT IF EXISTS vendor_orgs_transitional_outcome_chk;
ALTER TABLE public.vendor_orgs ADD CONSTRAINT vendor_orgs_transitional_outcome_chk
  CHECK (transitional_outcome IS NULL OR transitional_outcome IN ('qualification_complete','leadership_review','ended_by_leadership'));

ALTER TABLE public.vendor_import_rows
  ADD COLUMN IF NOT EXISTS transitional_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS breezeway_match_state text,
  ADD COLUMN IF NOT EXISTS breezeway_match_person_id bigint,
  ADD COLUMN IF NOT EXISTS breezeway_match_note text;

-- Guard: Transitional Review is granted only at import of a Notion vendor ARHA currently uses,
-- lasts a fixed window, can never be extended or re-granted, and vendor members cannot touch it.
CREATE OR REPLACE FUNCTION private.vendor_transitional_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.transitional_review THEN
      IF NEW.source_system IS DISTINCT FROM 'notion'
         OR coalesce(NEW.legacy_fields->>'Notion: vendor status','') NOT IN ('Active','Last Resort') THEN
        RAISE EXCEPTION 'Transitional Review is only for existing ARHA vendors migrated from Notion as Active or Last Resort.';
      END IF;
      NEW.transitional_started_on := current_date;
      NEW.transitional_deadline := current_date + 60;
      NEW.transitional_outcome := NULL;
      NEW.transitional_ended_at := NULL;
    ELSE
      NEW.transitional_started_on := NULL; NEW.transitional_deadline := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.transitional_started_on IS DISTINCT FROM OLD.transitional_started_on
     OR NEW.transitional_deadline IS DISTINCT FROM OLD.transitional_deadline THEN
    IF _uid IS NOT NULL THEN RAISE EXCEPTION 'The Transitional Review deadline cannot be changed.'; END IF;
  END IF;
  IF NEW.transitional_review AND NOT OLD.transitional_review THEN
    RAISE EXCEPTION 'Transitional Review cannot be granted again after it has ended.';
  END IF;
  IF NOT NEW.transitional_review AND OLD.transitional_review THEN
    IF _uid IS NOT NULL AND NOT private.is_supervisor(_uid) THEN
      RAISE EXCEPTION 'Only leadership can end Transitional Review.';
    END IF;
    NEW.transitional_ended_at := coalesce(NEW.transitional_ended_at, now());
    NEW.transitional_outcome := coalesce(NEW.transitional_outcome, 'ended_by_leadership');
  ELSIF NEW.transitional_outcome IS DISTINCT FROM OLD.transitional_outcome AND _uid IS NOT NULL THEN
    RAISE EXCEPTION 'The Transitional Review outcome is recorded automatically.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_vendor_transitional_guard ON public.vendor_orgs;
CREATE TRIGGER trg_vendor_transitional_guard BEFORE INSERT OR UPDATE ON public.vendor_orgs
  FOR EACH ROW EXECUTE FUNCTION private.vendor_transitional_guard();

-- One eligibility rule, now including Transitional Review. Expired credentials still block.
CREATE OR REPLACE FUNCTION public.vendor_dispatch_eligible(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_orgs o
    WHERE o.id = _org AND o.is_active
      AND o.status <> 'suspended'
      AND (
        (o.status IN ('pilot','approved','gold','corrective_action')
          AND (o.status NOT IN ('approved','gold') OR (private.vendor_gates_clear(o.id) AND NOT coalesce(o.critical_failure,false))))
        OR (o.transitional_review AND o.transitional_deadline >= current_date AND NOT coalesce(o.critical_failure,false))
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.vendor_gatekeeper_results g
        JOIN public.gatekeeper_requirements q ON q.id = g.requirement_id AND q.active AND q.expiry_required
        WHERE g.org_id = o.id AND g.expires_on IS NOT NULL AND g.expires_on < current_date)
  )
$$;

-- Deadline reminders (14 / 7 / 1 days) and end-of-window handling.
CREATE TABLE public.vendor_transitional_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.vendor_orgs(id) ON DELETE CASCADE,
  threshold text NOT NULL CHECK (threshold IN ('14_days','7_days','1_day','ended')),
  deadline date NOT NULL,
  recipients uuid[] NOT NULL DEFAULT '{}',
  notified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, threshold, deadline)
);
GRANT SELECT ON public.vendor_transitional_reminders TO authenticated;
GRANT ALL ON public.vendor_transitional_reminders TO service_role;
ALTER TABLE public.vendor_transitional_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY vtr_read ON public.vendor_transitional_reminders FOR SELECT TO authenticated
  USING (private.is_supervisor(auth.uid()));

CREATE OR REPLACE FUNCTION private.vendor_ops_leads(_owner uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT u) FILTER (WHERE u IS NOT NULL), '{}') FROM (
    SELECT fr.current_seat_holder AS u FROM public.functional_roles fr WHERE fr.code = 'director_ops'
    UNION SELECT m.user_id FROM public.functional_role_members m WHERE m.role_code = 'director_ops'
    UNION SELECT _owner
  ) s
$$;

CREATE OR REPLACE FUNCTION public.vendor_transitional_sweep(_today date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; _th text; _id uuid; _rcp uuid[]; _u uuid; _sent int := 0; _ended int := 0; _clear boolean;
BEGIN
  FOR r IN SELECT id, display_name, program_owner, transitional_deadline, is_demo FROM public.vendor_orgs
            WHERE transitional_review AND transitional_deadline IS NOT NULL LOOP
    _rcp := private.vendor_ops_leads(r.program_owner);
    IF r.transitional_deadline < _today THEN
      _clear := private.vendor_gates_clear(r.id);
      UPDATE public.vendor_orgs SET transitional_review = false, transitional_ended_at = now(),
        transitional_outcome = CASE WHEN _clear THEN 'qualification_complete' ELSE 'leadership_review' END
       WHERE id = r.id;
      _th := 'ended'; _ended := _ended + 1;
    ELSE
      _th := CASE r.transitional_deadline - _today WHEN 14 THEN '14_days' WHEN 7 THEN '7_days' WHEN 1 THEN '1_day' END;
      CONTINUE WHEN _th IS NULL;
    END IF;
    INSERT INTO public.vendor_transitional_reminders (org_id, threshold, deadline, recipients)
      VALUES (r.id, _th, r.transitional_deadline, _rcp) ON CONFLICT DO NOTHING RETURNING id INTO _id;
    CONTINUE WHEN _id IS NULL;
    _sent := _sent + 1;
    FOREACH _u IN ARRAY _rcp LOOP
      PERFORM public.notify_staff(_u, 'vendor_transitional_' || _th,
        CASE WHEN _th = 'ended' THEN r.display_name || ': Transitional Review ended'
             ELSE r.display_name || ': Transitional Review ends ' || to_char(r.transitional_deadline, 'FMMM/FMDD/YYYY') END,
        CASE WHEN _th = 'ended' AND _clear THEN 'All Must Pass checks are complete. Set the right Gold Standard status — nothing was changed automatically.'
             WHEN _th = 'ended' THEN 'Must Pass checks are still missing, so this vendor can no longer be chosen for new work. Leadership review needed.'
             ELSE 'Finish the missing Must Pass checks before the deadline, or the vendor can no longer be chosen for new work.' END,
        'vendor', r.id, '/vendors/' || r.id, CASE WHEN _th IN ('1_day','ended') THEN 'urgent' ELSE 'normal' END,
        NULL, false, r.is_demo);
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('reminders', _sent, 'ended', _ended);
END $$;
REVOKE ALL ON FUNCTION public.vendor_transitional_sweep(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_transitional_sweep(date) TO service_role;

-- Vendor sourcing requests (Ticket → "Request New Vendor").
CREATE TABLE public.vendor_sourcing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  market text NOT NULL,
  service_category text NOT NULL,
  state text NOT NULL DEFAULT 'requested'
    CHECK (state IN ('requested','sourcing','candidate_identified','vendor_setup','ready','closed')),
  owner_id uuid,
  requested_by uuid,
  note text,
  resolved_vendor_org_id uuid REFERENCES public.vendor_orgs(id) ON DELETE SET NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE UNIQUE INDEX vendor_sourcing_one_open ON public.vendor_sourcing_requests (ticket_id, market, service_category)
  WHERE state NOT IN ('ready','closed');
GRANT SELECT, UPDATE ON public.vendor_sourcing_requests TO authenticated;
GRANT ALL ON public.vendor_sourcing_requests TO service_role;
ALTER TABLE public.vendor_sourcing_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY vsr_read ON public.vendor_sourcing_requests FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));
CREATE POLICY vsr_update ON public.vendor_sourcing_requests FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR private.is_supervisor(auth.uid()) OR public.is_director(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR private.is_supervisor(auth.uid()) OR public.is_director(auth.uid()));

CREATE OR REPLACE FUNCTION public.request_new_vendor(_ticket uuid, _market text, _category text, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _owner uuid; _owners uuid[]; _dir uuid[]; _id uuid; _u uuid; _demo boolean;
BEGIN
  IF _uid IS NULL OR NOT public.is_internal_staff(_uid) THEN RAISE EXCEPTION 'Not allowed.'; END IF;
  IF coalesce(trim(_market),'') = '' OR coalesce(trim(_category),'') = '' THEN
    RAISE EXCEPTION 'Choose the market and service needed.';
  END IF;
  SELECT coalesce(is_demo,false) INTO _demo FROM public.tickets WHERE id = _ticket;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found.'; END IF;

  SELECT id INTO _id FROM public.vendor_sourcing_requests
   WHERE ticket_id = _ticket AND market = _market AND service_category = _category AND state NOT IN ('ready','closed');
  IF _id IS NOT NULL THEN RETURN _id; END IF;

  -- The Program Owner for this market + service, when exactly one is configured; otherwise the Director.
  SELECT array_agg(DISTINCT v.program_owner) INTO _owners
    FROM public.vendor_market_coverage c JOIN public.vendor_orgs v ON v.id = c.org_id
   WHERE c.market = _market AND c.service_category = _category AND v.program_owner IS NOT NULL;
  _dir := private.vendor_ops_leads(NULL);
  _owner := CASE WHEN coalesce(array_length(_owners,1),0) = 1 THEN _owners[1] ELSE _dir[1] END;

  INSERT INTO public.vendor_sourcing_requests (ticket_id, market, service_category, owner_id, requested_by, note, is_demo)
  VALUES (_ticket, _market, _category, _owner, _uid, nullif(trim(_note),''), _demo) RETURNING id INTO _id;

  INSERT INTO public.ticket_activity (ticket_id, author_id, kind, body, event_type, is_demo)
  VALUES (_ticket, _uid, 'note', 'No eligible vendor found — requested a new ' || _category || ' vendor for ' || _market || '.', 'note', _demo);

  FOREACH _u IN ARRAY (SELECT array_agg(DISTINCT x) FROM unnest(_dir || _owner) x WHERE x IS NOT NULL) LOOP
    PERFORM public.notify_staff(_u, 'vendor_sourcing_request', 'New vendor needed: ' || _category || ' in ' || _market,
      'A coordinator could not find an eligible vendor on a Ticket.', 'vendor_sourcing', _id,
      '/vendors?tab=coverage', 'normal', _uid, false, _demo);
  END LOOP;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.request_new_vendor(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_new_vendor(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION private.vendor_sourcing_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.state IN ('ready','closed') AND OLD.state NOT IN ('ready','closed') THEN NEW.closed_at := now(); END IF;
  IF NEW.ticket_id IS DISTINCT FROM OLD.ticket_id OR NEW.market IS DISTINCT FROM OLD.market
     OR NEW.service_category IS DISTINCT FROM OLD.service_category OR NEW.requested_by IS DISTINCT FROM OLD.requested_by THEN
    RAISE EXCEPTION 'Only the status, owner, note and resolved vendor can change.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_vendor_sourcing_touch BEFORE UPDATE ON public.vendor_sourcing_requests
  FOR EACH ROW EXECUTE FUNCTION private.vendor_sourcing_touch();