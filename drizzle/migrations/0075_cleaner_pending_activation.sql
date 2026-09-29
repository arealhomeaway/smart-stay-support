CREATE TABLE public.cleaner_pending_activations (
  property_id uuid PRIMARY KEY REFERENCES public.properties(id),
  breezeway_home_id text NOT NULL,
  earliest_date date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  activated_task_id bigint,
  activated_from date
);
GRANT SELECT ON public.cleaner_pending_activations TO authenticated;
GRANT ALL ON public.cleaner_pending_activations TO service_role;
ALTER TABLE public.cleaner_pending_activations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership reads pending activations" ON public.cleaner_pending_activations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Single activation path. Service role only. Verifies home + housekeeping + date,
-- designates the property from that clean's date, and alerts leadership in-app.
CREATE OR REPLACE FUNCTION public.cleaner_activate_pending(_home_id text, _task_id bigint, _department text, _scheduled_date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.cleaner_pending_activations; p public.properties; u uuid;
BEGIN
  SELECT * INTO r FROM public.cleaner_pending_activations WHERE breezeway_home_id=_home_id AND activated_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('skipped','no pending activation'); END IF;
  IF coalesce(_department,'') <> 'housekeeping' THEN RETURN jsonb_build_object('skipped','not housekeeping'); END IF;
  IF _scheduled_date IS NULL OR _scheduled_date < r.earliest_date THEN RETURN jsonb_build_object('skipped','before access date'); END IF;
  SELECT * INTO p FROM public.properties WHERE id=r.property_id;
  IF p.breezeway_property_id IS DISTINCT FROM _home_id OR p.breezeway_mapping_state::text <> 'verified' THEN
    RETURN jsonb_build_object('skipped','mapping not verified');
  END IF;
  INSERT INTO public.cleaner_hours_properties(property_id, tracking_from, active, is_fixture, note)
  VALUES (r.property_id, _scheduled_date, true, false,
          format('First scheduled housekeeping clean on/after access (%s): Breezeway Task %s.', r.earliest_date, _task_id))
  ON CONFLICT (property_id) DO NOTHING;
  UPDATE public.cleaner_pending_activations SET activated_at=now(), activated_task_id=_task_id, activated_from=_scheduled_date
   WHERE property_id=r.property_id;
  FOR u IN SELECT * FROM private.cleaner_leadership_ids() LOOP
    INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority)
    VALUES (u, 'cleaner_safeguard_activated',
      format('Cleaner Safeguard activated for %s beginning %s.', p.name, to_char(_scheduled_date,'YYYY-MM-DD')),
      format('Cleaner Safeguard activated for %s beginning %s.', p.name, to_char(_scheduled_date,'YYYY-MM-DD')),
      'property', r.property_id, '/cleaner-hours', 'normal');
  END LOOP;
  RETURN jsonb_build_object('activated', true, 'tracking_from', _scheduled_date, 'task_id', _task_id);
END $$;
REVOKE ALL ON FUNCTION public.cleaner_activate_pending(text,bigint,text,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleaner_activate_pending(text,bigint,text,date) TO service_role;