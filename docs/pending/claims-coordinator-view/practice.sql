-- claims-coordinator-view (approved plan Nov 18): Airbnb/Vrbo filing deadline default,
-- claim line items feeding submitted_amount, and an append-only platform log.
-- Existing claim stages, waiver routing, Finance ledger and gates (guard_claim_workflow,
-- guard_claim_approval) are not changed. Homeowners and vendors get no access.

-- 1. Filing deadline default: checkout + 14 days for Airbnb and Vrbo.
CREATE OR REPLACE FUNCTION public.claims_default_filing_deadline()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE src text := lower(coalesce(nullif(btrim(NEW.booking_source), ''), NEW.reservation_channel, ''));
        platform boolean := src LIKE '%airbnb%' OR src LIKE '%aircover%' OR src LIKE '%vrbo%' OR src LIKE '%homeaway%';
BEGIN
  -- Only fill or refresh a deadline Resolve set itself; a typed or confirmed deadline is never replaced.
  IF NEW.deadline_on IS NOT NULL AND coalesce(NEW.deadline_source, '') <> 'platform_default' THEN RETURN NEW; END IF;
  IF NEW.deadline_verified THEN RETURN NEW; END IF;
  IF platform AND NEW.stay_departure IS NOT NULL THEN
    NEW.deadline_on := NEW.stay_departure + 14;
    NEW.deadline_source := 'platform_default';
    NEW.deadline_timezone := 'America/Chicago';
  ELSIF NEW.deadline_source = 'platform_default' THEN
    -- Source changed away from Airbnb/Vrbo: the default no longer applies.
    NEW.deadline_on := NULL;
    NEW.deadline_source := NULL;
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER claims_default_filing_deadline
  BEFORE INSERT OR UPDATE OF stay_departure, booking_source, reservation_channel, deadline_on, deadline_verified ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.claims_default_filing_deadline();

-- 2. Line items: issue + amount requested; the total writes claims.submitted_amount before Submitted.
CREATE TABLE public.claim_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id),
  issue text NOT NULL CHECK (length(btrim(issue)) BETWEEN 1 AND 300),
  amount_requested numeric(12,2) NOT NULL CHECK (amount_requested >= 0),
  created_by uuid,
  is_demo boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  archived_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX claim_line_items_claim_idx ON public.claim_line_items (claim_id) WHERE archived_at IS NULL;
GRANT SELECT, INSERT, UPDATE ON public.claim_line_items TO authenticated;
GRANT ALL ON public.claim_line_items TO service_role;
REVOKE ALL ON public.claim_line_items FROM anon;
ALTER TABLE public.claim_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal staff read claim line items" ON public.claim_line_items
  FOR SELECT TO authenticated USING (is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff add claim line items" ON public.claim_line_items
  FOR INSERT TO authenticated WITH CHECK (is_internal_staff(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Internal staff edit claim line items" ON public.claim_line_items
  FOR UPDATE TO authenticated USING (is_internal_staff(auth.uid())) WITH CHECK (is_internal_staff(auth.uid()));
CREATE POLICY "Synthetic accounts: demo records only" ON public.claim_line_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((NOT (SELECT private.is_synthetic_account())) OR is_demo) WITH CHECK ((NOT (SELECT private.is_synthetic_account())) OR is_demo);

CREATE OR REPLACE FUNCTION public.claim_line_items_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c public.claims;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Line items are kept. Remove one instead.'; END IF;
  SELECT * INTO c FROM public.claims WHERE id = NEW.claim_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'This claim is not available.'; END IF;
  IF c.stage NOT IN ('potential', 'gathering', 'costing', 'ready_to_submit') THEN
    RAISE EXCEPTION 'This claim was already submitted, so its amounts are fixed.';
  END IF;
  NEW.is_demo := coalesce(c.is_demo, false);
  IF TG_OP = 'UPDATE' THEN
    IF NEW.claim_id <> OLD.claim_id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'Only the issue and amount can change.';
    END IF;
    IF OLD.archived_at IS NOT NULL THEN RAISE EXCEPTION 'This line item was removed.'; END IF;
    IF NEW.archived_at IS NOT NULL THEN NEW.archived_by := auth.uid(); END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER claim_line_items_guard BEFORE INSERT OR UPDATE OR DELETE ON public.claim_line_items
  FOR EACH ROW EXECUTE FUNCTION public.claim_line_items_guard();

CREATE OR REPLACE FUNCTION public.claim_line_items_total()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE total numeric;
BEGIN
  SELECT coalesce(sum(amount_requested), 0) INTO total FROM public.claim_line_items
   WHERE claim_id = NEW.claim_id AND archived_at IS NULL;
  UPDATE public.claims SET submitted_amount = nullif(total, 0) WHERE id = NEW.claim_id
    AND submitted_amount IS DISTINCT FROM nullif(total, 0);
  INSERT INTO public.claim_activity(claim_id, author_id, event_type, body, detail, is_demo)
  VALUES (NEW.claim_id, auth.uid(), 'amount',
          CASE WHEN TG_OP = 'INSERT' THEN 'Line item added: ' WHEN NEW.archived_at IS NOT NULL THEN 'Line item removed: ' ELSE 'Line item changed: ' END
            || NEW.issue || ' $' || to_char(NEW.amount_requested, 'FM999999990.00') || ' · total $' || to_char(total, 'FM999999990.00'),
          jsonb_build_object('line_item_id', NEW.id, 'total', total), NEW.is_demo);
  RETURN NEW;
END $function$;
CREATE TRIGGER claim_line_items_total AFTER INSERT OR UPDATE ON public.claim_line_items
  FOR EACH ROW EXECUTE FUNCTION public.claim_line_items_total();

-- 3. Platform log: dated entries, append only, separate from claim history.
CREATE TABLE public.claim_platform_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id),
  entry_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Chicago')::date,
  author_id uuid NOT NULL,
  platform_said text NOT NULL CHECK (length(btrim(platform_said)) BETWEEN 1 AND 5000),
  we_did text CHECK (we_did IS NULL OR length(we_did) <= 5000),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX claim_platform_log_claim_idx ON public.claim_platform_log (claim_id, entry_on DESC, created_at DESC);
GRANT SELECT, INSERT ON public.claim_platform_log TO authenticated;
GRANT ALL ON public.claim_platform_log TO service_role;
REVOKE ALL ON public.claim_platform_log FROM anon;
ALTER TABLE public.claim_platform_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal staff read the platform log" ON public.claim_platform_log
  FOR SELECT TO authenticated USING (is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff add to the platform log" ON public.claim_platform_log
  FOR INSERT TO authenticated WITH CHECK (is_internal_staff(auth.uid()) AND author_id = auth.uid());
CREATE POLICY "Synthetic accounts: demo records only" ON public.claim_platform_log
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((NOT (SELECT private.is_synthetic_account())) OR is_demo) WITH CHECK ((NOT (SELECT private.is_synthetic_account())) OR is_demo);

CREATE OR REPLACE FUNCTION public.claim_platform_log_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Platform log entries are kept as written.'; END IF;
  SELECT coalesce(is_demo, false) INTO NEW.is_demo FROM public.claims WHERE id = NEW.claim_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'This claim is not available.'; END IF;
  IF NEW.entry_on > (now() AT TIME ZONE 'America/Chicago')::date THEN RAISE EXCEPTION 'The date cannot be in the future.'; END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER claim_platform_log_guard BEFORE INSERT OR UPDATE OR DELETE ON public.claim_platform_log
  FOR EACH ROW EXECUTE FUNCTION public.claim_platform_log_guard();

INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, after_value)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'claims_coordinator_view.apply', 'table', 'claims coordinator view',
  'Airbnb/Vrbo filing deadline default, claim line items feeding the submitted amount, append-only platform log. Undo: docs/pending/claims-coordinator-view/apply.undo.sql.',
  jsonb_build_object('adds', jsonb_build_array('claims_default_filing_deadline', 'claim_line_items', 'claim_platform_log')));

-- Practice checks on demo claims only; everything rolls back.
DO $t$
DECLARE p uuid := 'a0000000-0000-4000-8000-0000000ab0f1'; a uuid; v uuid; d uuid; out text := ''; amt numeric; ok boolean;
BEGIN
  INSERT INTO public.claims(claim_type, stage, title, property_id, booking_source, stay_departure, is_demo)
    VALUES ('channel_aircover', 'gathering', 'PRACTICE Airbnb', p, 'Airbnb', '2026-11-16', true) RETURNING id INTO a;
  INSERT INTO public.claims(claim_type, stage, title, property_id, reservation_channel, stay_departure, is_demo)
    VALUES ('channel_vrbo', 'gathering', 'PRACTICE Vrbo', p, 'vrbo', '2026-11-20', true) RETURNING id INTO v;
  INSERT INTO public.claims(claim_type, stage, title, property_id, booking_source, stay_departure, is_demo)
    VALUES ('guest_damage', 'gathering', 'PRACTICE Direct', p, 'Direct', '2026-11-16', true) RETURNING id INTO d;
  out := out || format('airbnb=%s/%s vrbo=%s direct=%s; ',
    (SELECT deadline_on FROM claims WHERE id=a), (SELECT deadline_source FROM claims WHERE id=a),
    (SELECT deadline_on FROM claims WHERE id=v), coalesce((SELECT deadline_on::text FROM claims WHERE id=d), 'needs verification'));
  UPDATE public.claims SET stay_departure = '2026-11-18' WHERE id = a;
  out := out || format('airbnb after checkout change=%s; ', (SELECT deadline_on FROM claims WHERE id=a));
  UPDATE public.claims SET deadline_on = '2026-11-25', deadline_verified = true WHERE id = d;
  UPDATE public.claims SET booking_source = 'Airbnb' WHERE id = d;
  out := out || format('confirmed direct kept=%s; ', (SELECT deadline_on FROM claims WHERE id=d));
  INSERT INTO public.claim_line_items(claim_id, issue, amount_requested) VALUES (a, 'Stained rug', 120.10), (a, 'Broken lamp', 45);
  UPDATE public.claim_line_items SET archived_at = now() WHERE claim_id = a AND issue = 'Broken lamp';
  SELECT submitted_amount INTO amt FROM claims WHERE id = a;
  out := out || format('line total=%s recovered=%s; ', amt, coalesce((SELECT recovered_amount FROM claims WHERE id=a)::text,'null'));
  BEGIN DELETE FROM public.claim_line_items WHERE claim_id = a; out := out || 'DELETE ALLOWED (bad); ';
  EXCEPTION WHEN others THEN out := out || 'delete refused; '; END;
  BEGIN UPDATE public.claims SET stage = 'submitted' WHERE id = a; out := out || 'GATE OPEN (bad); ';
  EXCEPTION WHEN others THEN out := out || 'submit gate still blocks; '; END;
  UPDATE public.claims SET stage = 'submitted', submitted_on = '2026-11-18', external_reference = 'PR-1',
    submission_document_ids = ARRAY[gen_random_uuid()] WHERE id = v;
  BEGIN INSERT INTO public.claim_line_items(claim_id, issue, amount_requested) VALUES (v, 'Late', 5); out := out || 'POST-SUBMIT ITEM (bad); ';
  EXCEPTION WHEN others THEN out := out || 'post-submit item refused; '; END;
  INSERT INTO public.claim_platform_log(claim_id, author_id, platform_said, we_did)
    VALUES (a, '98bd6696-4018-4965-b645-0471c5ae3925', 'Airbnb asked for receipts', 'Sent two receipts');
  BEGIN UPDATE public.claim_platform_log SET we_did = 'x' WHERE claim_id = a; out := out || 'LOG EDIT (bad); ';
  EXCEPTION WHEN others THEN out := out || 'log edit refused; '; END;
  out := out || format('log rows=%s history rows=%s; ', (SELECT count(*) FROM claim_platform_log WHERE claim_id=a),
    (SELECT count(*) FROM claim_activity WHERE claim_id=a));
  out := out || format('homeowner/vendor grants: anon line=%s anon log=%s',
    has_table_privilege('anon', 'public.claim_line_items', 'SELECT'), has_table_privilege('anon', 'public.claim_platform_log', 'SELECT'));
  RAISE EXCEPTION 'PRACTICE ROLLED BACK: %', out;
END $t$;
