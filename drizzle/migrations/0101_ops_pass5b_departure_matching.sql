CREATE TABLE public.departure_clean_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breezeway_work_order_id uuid NOT NULL UNIQUE REFERENCES public.breezeway_work_orders(id) ON DELETE CASCADE,
  breezeway_task_id bigint,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('matched','no_reservation','multiple_reservations','not_departure','already_linked','missing_data')),
  ownerrez_booking_id text,
  checkout_date date,
  match_method text CHECK (match_method IN ('same_day','late_clean','manual')),
  confidence text CHECK (confidence IN ('high','medium','manual')),
  reason text,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  reservation jsonb,
  is_manual boolean NOT NULL DEFAULT false,
  decided_by uuid,
  decided_at timestamptz,
  last_evaluated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- One designated departure clean per reservation.
CREATE UNIQUE INDEX departure_clean_matches_one_per_booking ON public.departure_clean_matches(ownerrez_booking_id) WHERE state = 'matched';
CREATE INDEX departure_clean_matches_state ON public.departure_clean_matches(state);
GRANT SELECT ON public.departure_clean_matches TO authenticated;
GRANT ALL ON public.departure_clean_matches TO service_role;
ALTER TABLE public.departure_clean_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read clean matches" ON public.departure_clean_matches FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE TRIGGER departure_clean_matches_updated_at BEFORE UPDATE ON public.departure_clean_matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.departure_clean_match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.departure_clean_matches(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_state text, to_state text,
  ownerrez_booking_id text,
  summary text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departure_clean_match_events TO authenticated;
GRANT ALL ON public.departure_clean_match_events TO service_role;
ALTER TABLE public.departure_clean_match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read clean match events" ON public.departure_clean_match_events FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE OR REPLACE FUNCTION public.block_match_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Match history is append-only'; END $$;
CREATE TRIGGER departure_clean_match_events_append_only BEFORE UPDATE OR DELETE ON public.departure_clean_match_events FOR EACH ROW EXECUTE FUNCTION public.block_match_event_mutation();

-- Exact cleaner-finished time vs best available Breezeway update time.
ALTER TABLE public.departure_reviews ADD COLUMN clean_completed_exact boolean NOT NULL DEFAULT false;
UPDATE public.departure_reviews d SET clean_completed_exact = (w.finished_at IS NOT NULL)
  FROM public.breezeway_work_orders w WHERE w.id = d.breezeway_work_order_id;

-- Reservation comes from the work order snapshot (demo) or a saved Matched record. Real homes stay gated.
CREATE OR REPLACE FUNCTION public.create_departure_review_from_clean(_wo_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wo record; prop record; res jsonb; live boolean; new_id uuid; dep date; m record;
BEGIN
  SELECT * INTO wo FROM breezeway_work_orders WHERE id = _wo_id;
  IF wo IS NULL OR wo.property_id IS NULL THEN RETURN NULL; END IF;
  IF wo.department IS DISTINCT FROM 'housekeeping' THEN RETURN NULL; END IF;
  IF lower(coalesce(wo.status,'')) NOT IN ('finished','approved','closed') THEN RETURN NULL; END IF;
  res := wo.reservation_snapshot;
  IF res IS NULL OR res = 'null'::jsonb THEN
    SELECT * INTO m FROM departure_clean_matches WHERE breezeway_work_order_id = wo.id AND state = 'matched';
    IF m IS NULL THEN RETURN NULL; END IF;
    res := coalesce(m.reservation, '{}'::jsonb) || jsonb_build_object('ownerrez_booking_id', m.ownerrez_booking_id, 'departure', m.checkout_date);
  END IF;
  IF (res->>'departure') IS NULL THEN RETURN NULL; END IF;
  dep := (res->>'departure')::date;
  IF dep > (now() AT TIME ZONE 'America/Chicago')::date THEN RETURN NULL; END IF;
  SELECT id, is_demo INTO prop FROM properties WHERE id = wo.property_id;
  SELECT coalesce((value->>'enabled')::boolean, false) INTO live FROM app_settings WHERE key = 'departure_review_live_homes';
  IF NOT coalesce(prop.is_demo, false) AND NOT coalesce(live, false) THEN RETURN NULL; END IF;
  -- One review per reservation even if several cleans exist.
  IF (res->>'ownerrez_booking_id') IS NOT NULL AND EXISTS (
    SELECT 1 FROM departure_reviews WHERE property_id = wo.property_id AND ownerrez_booking_id = res->>'ownerrez_booking_id'
  ) THEN RETURN NULL; END IF;

  INSERT INTO departure_reviews (property_id, breezeway_work_order_id, breezeway_task_id, event_key,
    guest_name, stay_arrival, stay_departure, ownerrez_booking_id, reservation_code, booking_source,
    deposit_payer, deposit_amount, clean_name, clean_completed_at, clean_completed_exact, cleaner_name, clean_photo_count, is_demo)
  VALUES (wo.property_id, wo.id, wo.breezeway_task_id,
    'clean:' || wo.breezeway_task_id || ':' || coalesce(res->>'ownerrez_booking_id', res->>'reservation_code', dep::text),
    res->>'guest_name', (res->>'arrival')::date, dep, res->>'ownerrez_booking_id', res->>'reservation_code', res->>'booking_source',
    res->>'deposit_payer', nullif(res->>'deposit_amount','')::numeric,
    wo.name, coalesce(wo.finished_at, wo.breezeway_updated_at), wo.finished_at IS NOT NULL,
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