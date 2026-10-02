ALTER TABLE public.breezeway_work_orders ADD COLUMN IF NOT EXISTS reservation_snapshot jsonb;
ALTER TABLE public.breezeway_work_orders ADD COLUMN IF NOT EXISTS finished_at timestamptz;
COMMENT ON COLUMN public.breezeway_work_orders.reservation_snapshot IS 'Reservation this clean turns over: {guest_name, arrival, departure, ownerrez_booking_id, reservation_code, booking_source, deposit_payer, deposit_amount}. Filled by sync/matching; demo fixtures set it directly.';

CREATE TABLE public.departure_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  breezeway_work_order_id uuid REFERENCES public.breezeway_work_orders(id) ON DELETE SET NULL,
  breezeway_task_id bigint NOT NULL,
  event_key text NOT NULL,
  team text NOT NULL DEFAULT 'property_operations',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed')),
  claimed_by uuid,
  claimed_at timestamptz,
  guest_name text, stay_arrival date, stay_departure date,
  ownerrez_booking_id text, reservation_code text, booking_source text,
  deposit_payer text, deposit_amount numeric,
  clean_name text, clean_completed_at timestamptz, cleaner_name text, clean_photo_count int,
  clean_reviewed_at timestamptz, clean_reviewed_by uuid,
  property_attention text CHECK (property_attention IN ('no','yes')),
  property_notes text,
  damage_screen text CHECK (damage_screen IN ('no','yes','unsure')),
  damage_categories text[] NOT NULL DEFAULT '{}',
  damage_description text, damage_estimate numeric, damage_notes text,
  claim_id uuid REFERENCES public.claims(id) ON DELETE SET NULL,
  outreach_decision text CHECK (outreach_decision IN ('yes','no','already_reviewed','unable')),
  outreach_reason text,
  outreach_status text CHECK (outreach_status IN ('requested','not_requested','unable','already_reviewed')),
  host_review text CHECK (host_review IN ('completed','not_completed','not_applicable','unable')),
  notes text,
  attachment_document_ids uuid[] NOT NULL DEFAULT '{}',
  completed_at timestamptz, completed_by uuid,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX departure_reviews_event_key_idx ON public.departure_reviews(event_key);
CREATE INDEX departure_reviews_open_idx ON public.departure_reviews(status, team);
CREATE INDEX departure_reviews_property_idx ON public.departure_reviews(property_id);
GRANT SELECT, INSERT, UPDATE ON public.departure_reviews TO authenticated;
GRANT ALL ON public.departure_reviews TO service_role;
ALTER TABLE public.departure_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read departure reviews" ON public.departure_reviews FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff update departure reviews" ON public.departure_reviews FOR UPDATE TO authenticated USING (public.is_internal_staff(auth.uid())) WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE TABLE public.cleaning_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  departure_review_id uuid NOT NULL UNIQUE REFERENCES public.departure_reviews(id) ON DELETE RESTRICT,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  breezeway_task_id bigint, ownerrez_booking_id text, reservation_code text,
  cleaner_name text,
  reviewed_by uuid, reviewed_at timestamptz,
  outcome text CHECK (outcome IN ('accepted','follow_up_needed')),
  property_issues_found boolean, damage_found boolean,
  notes text,
  photo_document_ids uuid[] NOT NULL DEFAULT '{}',
  linked_ticket_ids uuid[] NOT NULL DEFAULT '{}',
  linked_claim_id uuid REFERENCES public.claims(id) ON DELETE SET NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.cleaning_reviews TO authenticated;
GRANT ALL ON public.cleaning_reviews TO service_role;
ALTER TABLE public.cleaning_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read cleaning reviews" ON public.cleaning_reviews FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff insert cleaning reviews" ON public.cleaning_reviews FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff update cleaning reviews" ON public.cleaning_reviews FOR UPDATE TO authenticated USING (public.is_internal_staff(auth.uid())) WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE TABLE public.departure_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  departure_review_id uuid NOT NULL REFERENCES public.departure_reviews(id) ON DELETE CASCADE,
  property_id uuid NOT NULL,
  event_type text NOT NULL,
  summary text NOT NULL,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX departure_review_events_review_idx ON public.departure_review_events(departure_review_id, created_at);
CREATE INDEX departure_review_events_property_idx ON public.departure_review_events(property_id, created_at);
GRANT SELECT, INSERT ON public.departure_review_events TO authenticated;
GRANT ALL ON public.departure_review_events TO service_role;
ALTER TABLE public.departure_review_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read departure review events" ON public.departure_review_events FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff add departure review events" ON public.departure_review_events FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()) AND actor_id = auth.uid());

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS departure_review_id uuid REFERENCES public.departure_reviews(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tickets_departure_review_idx ON public.tickets(departure_review_id) WHERE departure_review_id IS NOT NULL;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS departure_review_id uuid REFERENCES public.departure_reviews(id) ON DELETE SET NULL;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS damage_categories text[];
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS evidence_document_ids uuid[];
CREATE UNIQUE INDEX IF NOT EXISTS claims_departure_review_once ON public.claims(departure_review_id) WHERE departure_review_id IS NOT NULL;

-- One authoritative trigger rule: a finished-or-later departure clean whose reservation has ended.
CREATE OR REPLACE FUNCTION public.create_departure_review_from_clean(_wo_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wo record; prop record; res jsonb; live boolean; new_id uuid; dep date;
BEGIN
  SELECT * INTO wo FROM breezeway_work_orders WHERE id = _wo_id;
  IF wo IS NULL OR wo.property_id IS NULL THEN RETURN NULL; END IF;
  IF wo.department IS DISTINCT FROM 'housekeeping' THEN RETURN NULL; END IF;
  IF lower(coalesce(wo.status,'')) NOT IN ('finished','approved','closed') THEN RETURN NULL; END IF;
  res := wo.reservation_snapshot;
  IF res IS NULL OR res = 'null'::jsonb OR (res->>'departure') IS NULL THEN RETURN NULL; END IF;
  dep := (res->>'departure')::date;
  IF dep > (now() AT TIME ZONE 'America/Chicago')::date THEN RETURN NULL; END IF;
  SELECT id, is_demo INTO prop FROM properties WHERE id = wo.property_id;
  SELECT coalesce((value->>'enabled')::boolean, false) INTO live FROM app_settings WHERE key = 'departure_review_live_homes';
  IF NOT coalesce(prop.is_demo, false) AND NOT coalesce(live, false) THEN RETURN NULL; END IF;

  INSERT INTO departure_reviews (property_id, breezeway_work_order_id, breezeway_task_id, event_key,
    guest_name, stay_arrival, stay_departure, ownerrez_booking_id, reservation_code, booking_source,
    deposit_payer, deposit_amount, clean_name, clean_completed_at, cleaner_name, clean_photo_count, is_demo)
  VALUES (wo.property_id, wo.id, wo.breezeway_task_id,
    'clean:' || wo.breezeway_task_id || ':' || coalesce(res->>'ownerrez_booking_id', res->>'reservation_code', dep::text),
    res->>'guest_name', (res->>'arrival')::date, dep, res->>'ownerrez_booking_id', res->>'reservation_code', res->>'booking_source',
    res->>'deposit_payer', nullif(res->>'deposit_amount','')::numeric,
    wo.name, coalesce(wo.finished_at, wo.breezeway_updated_at, now()),
    (SELECT string_agg(coalesce(a->>'name', trim(coalesce(a->>'first_name','') || ' ' || coalesce(a->>'last_name',''))), ', ')
       FROM jsonb_array_elements(CASE WHEN jsonb_typeof(wo.assignees)='array' THEN wo.assignees ELSE '[]'::jsonb END) a),
    wo.photo_count, coalesce(prop.is_demo, false))
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO new_id;

  IF new_id IS NOT NULL THEN
    INSERT INTO cleaning_reviews (departure_review_id, property_id, breezeway_task_id, ownerrez_booking_id, reservation_code, cleaner_name, is_demo)
    SELECT id, property_id, breezeway_task_id, ownerrez_booking_id, reservation_code, cleaner_name, is_demo FROM departure_reviews WHERE id = new_id;
    INSERT INTO departure_review_events (departure_review_id, property_id, event_type, summary)
    VALUES (new_id, wo.property_id, 'created', 'Departure Review created — departure clean completed in Breezeway');
  END IF;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_departure_review_from_clean(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_departure_review_from_clean(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_departure_review_on_clean()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_departure_review_from_clean(NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER breezeway_clean_departure_review
AFTER INSERT OR UPDATE OF status, reservation_snapshot ON public.breezeway_work_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_departure_review_on_clean();

-- Staff can re-run the check for one clean (idempotent); real homes stay gated by the setting.
CREATE OR REPLACE FUNCTION public.rerun_departure_review_trigger(_wo_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN public.create_departure_review_from_clean(_wo_id);
END $$;
GRANT EXECUTE ON FUNCTION public.rerun_departure_review_trigger(uuid) TO authenticated;

CREATE TRIGGER departure_reviews_updated_at BEFORE UPDATE ON public.departure_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER cleaning_reviews_updated_at BEFORE UPDATE ON public.cleaning_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();