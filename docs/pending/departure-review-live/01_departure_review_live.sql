-- departure-review-live (Emily, Nov 25, change 2 answer 1). Uses the existing Departure Review rule
-- (create_departure_review_from_clean) for real homes. Adds one Admin-only switch with a forward start line:
-- cleans finished before the switch was turned on never create a review. Demo homes are unchanged.

CREATE OR REPLACE FUNCTION public.set_departure_review_live(_on boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); v jsonb;
BEGIN
  IF _me IS NULL OR NOT public.has_role(_me, 'admin') THEN RAISE EXCEPTION 'Only Admin can change this.'; END IF;
  v := CASE WHEN _on THEN jsonb_build_object('enabled', true, 'started_at', now(), 'by', _me)
            ELSE jsonb_build_object('enabled', false, 'stopped_at', now(), 'by', _me) END;
  INSERT INTO public.app_settings(key, value) VALUES ('departure_review_live_homes', v)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_label, after_value)
  VALUES (_me, CASE WHEN _on THEN 'departure_review_live.on' ELSE 'departure_review_live.off' END, 'app_setting', 'departure_review_live_homes', v);
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.set_departure_review_live(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_departure_review_live(boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.create_departure_review_from_clean(_wo_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  wo record; prop record; res jsonb; live boolean; new_id uuid; dep date; m record; started timestamptz;
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
  SELECT coalesce((value->>'enabled')::boolean, false), nullif(value->>'started_at','')::timestamptz INTO live, started
    FROM app_settings WHERE key = 'departure_review_live_homes';
  IF NOT coalesce(prop.is_demo, false) THEN
    IF NOT coalesce(live, false) THEN RETURN NULL; END IF;
    -- Forward only: a real home's clean finished before the switch was turned on never creates a review.
    IF started IS NULL OR coalesce(wo.finished_at, wo.breezeway_updated_at) IS NULL
       OR coalesce(wo.finished_at, wo.breezeway_updated_at) < started THEN RETURN NULL; END IF;
  END IF;
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
END $function$;
