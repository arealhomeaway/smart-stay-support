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

-- 4. Filing alerts (Nov 23 addition): when a claim's filing deadline date changes, its unretracted
-- filing reminder and overdue alerts for any other date are cancelled (hidden from the inbox, kept as
-- history). The new date then gets its own reminder and overdue alert from the five-minute pass.
-- AFTER UPDATE with no column list, so a deadline moved by the default trigger above also counts.
CREATE OR REPLACE FUNCTION public.claims_retract_filing_alerts()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.staff_notifications
     SET retracted_at = now(), retracted_by = auth.uid(), retracted_reason = 'The filing deadline changed.'
   WHERE entity_type = 'claim' AND entity_id = NEW.id
     AND kind IN ('claim_filing_reminder', 'claim_filing_overdue')
     AND retracted_at IS NULL
     AND (NEW.deadline_on IS NULL OR coalesce(link_path, '') NOT LIKE '%file_by=' || NEW.deadline_on::text || '%');
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.claims_retract_filing_alerts() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER claims_retract_filing_alerts
  AFTER UPDATE ON public.claims
  FOR EACH ROW WHEN (OLD.deadline_on IS DISTINCT FROM NEW.deadline_on)
  EXECUTE FUNCTION public.claims_retract_filing_alerts();

INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, after_value)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'claims_coordinator_view.apply', 'table', 'claims coordinator view',
  'Airbnb/Vrbo filing deadline default, claim line items feeding the submitted amount, append-only platform log, filing alerts cancelled when the deadline date changes. Undo: docs/pending/claims-coordinator-view/apply.undo.sql.',
  jsonb_build_object('adds', jsonb_build_array('claims_default_filing_deadline', 'claim_line_items', 'claim_platform_log', 'claims_retract_filing_alerts')));
