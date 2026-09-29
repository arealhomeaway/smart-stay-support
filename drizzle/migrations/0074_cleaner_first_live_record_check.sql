CREATE OR REPLACE FUNCTION public.cleaner_first_live_record_check()
RETURNS TABLE (
  property_id uuid, property_name text, tracking_from date, breezeway_home_id text, mapping_state text,
  first_ledger_id uuid, breezeway_task_id bigint, completion_date date, calendar_year int,
  worker_id uuid, breezeway_person_id bigint, worker_name text, worker_classification text,
  raw_elapsed_minutes numeric, attributed_minutes numeric, original_minutes numeric,
  attribution_method text, review_state text, counted boolean, before_tracking_start boolean,
  open_review_items int, safeguard jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT c.property_id, p.name, c.tracking_from, p.breezeway_property_id, p.breezeway_mapping_state::text,
    l.id, l.breezeway_task_id, l.completion_date, extract(year from l.completion_date)::int,
    l.worker_id, l.breezeway_person_id, w.display_name, w.account_type,
    round(l.raw_elapsed_seconds/60.0,1), l.attributed_minutes, l.original_minutes,
    l.attribution_method, l.review_state, l.counted, (l.completion_date < c.tracking_from),
    (SELECT count(*)::int FROM public.cleaner_review_items r WHERE r.property_id=c.property_id AND r.status='open' AND NOT r.is_fixture
       AND (r.breezeway_task_id = l.breezeway_task_id OR r.ledger_entry_id = l.id)),
    CASE WHEN l.worker_id IS NOT NULL THEN private.cleaner_safeguard_eval(c.property_id, l.worker_id, l.completion_date, 0) END
  FROM public.cleaner_hours_properties c
  JOIN public.properties p ON p.id=c.property_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.cleaner_exposure_ledger x
    WHERE x.property_id=c.property_id AND NOT x.is_fixture AND x.breezeway_task_id IS NOT NULL
    ORDER BY x.created_at ASC LIMIT 1
  ) l ON true
  LEFT JOIN public.cleaner_workers w ON w.id=l.worker_id
  WHERE c.active AND NOT c.is_fixture
  ORDER BY p.name;
END $$;
REVOKE ALL ON FUNCTION public.cleaner_first_live_record_check() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cleaner_first_live_record_check() TO authenticated;