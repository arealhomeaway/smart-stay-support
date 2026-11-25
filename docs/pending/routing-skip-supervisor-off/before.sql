CREATE OR REPLACE FUNCTION public.coordinator_for(_team text, _at timestamp with time zone DEFAULT now())
 RETURNS TABLE(user_id uuid, role_code text, note text, path text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  c record;
  v_team_label text := public.coordinator_team_label(_team);
  v_on_team int;
  v_on_team_free int;
  v_lunch_role text;
  v_who text;
  v_cfg public.coverage_config%ROWTYPE;
  v_tz text := 'America/Chicago';
  v_local timestamp;
  v_minutes int;
  v_overnight boolean := false;
  v_oncall uuid;
  v_sup uuid;
BEGIN
  IF v_team_label IS NULL THEN
    RAISE EXCEPTION 'Unknown team.';
  END IF;

  SELECT count(*) FILTER (WHERE s.team = _team),
         count(*) FILTER (WHERE s.team = _team AND NOT s.at_lunch)
    INTO v_on_team, v_on_team_free
  FROM public.coordinators_on_shift(_at) s;

  -- Same team, not at lunch.
  SELECT s.* INTO c FROM public.coordinators_on_shift(_at) s
   WHERE s.team = _team AND NOT s.at_lunch
   ORDER BY s.load, s.last_given NULLS FIRST, s.user_id
   LIMIT 1;
  IF FOUND THEN
    SELECT s.role_code INTO v_lunch_role FROM public.coordinators_on_shift(_at) s
     WHERE s.team = _team AND s.at_lunch ORDER BY s.role_code LIMIT 1;
    v_who := CASE WHEN c.covering THEN 'the person covering for the ' ELSE 'the ' END
             || public.coordinator_role_label(c.role_code);
    user_id := c.user_id;
    role_code := c.role_code;
    path := 'team';
    note := CASE
        WHEN v_lunch_role IS NOT NULL
          THEN 'The ' || public.coordinator_role_label(v_lunch_role) || ' is at lunch, so it was sent to ' || v_who || ' on shift.'
        ELSE 'Sent to ' || v_who || ' on shift.'
      END
      || CASE WHEN v_on_team_free > 1 THEN ' They had the least open work.' ELSE '' END;
    RETURN NEXT;
    RETURN;
  END IF;

  -- The other team, not at lunch.
  SELECT s.* INTO c FROM public.coordinators_on_shift(_at) s
   WHERE s.team <> _team AND NOT s.at_lunch
   ORDER BY s.load, s.last_given NULLS FIRST, s.user_id
   LIMIT 1;
  IF FOUND THEN
    v_who := CASE WHEN c.covering THEN 'the person covering for the ' ELSE 'the ' END
             || public.coordinator_role_label(c.role_code);
    user_id := c.user_id;
    role_code := c.role_code;
    path := 'other_team';
    note := CASE
        WHEN v_on_team = 0
          THEN 'No one on ' || v_team_label || ' was on shift, so it went to ' || v_who || ', who is working.'
        ELSE 'Everyone on ' || v_team_label || ' who is on shift is at lunch, so it went to ' || v_who || ', who is working.'
      END;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Only people at lunch are working: they still get it, same team first.
  SELECT s.* INTO c FROM public.coordinators_on_shift(_at) s
   ORDER BY (s.team <> _team), s.load, s.last_given NULLS FIRST, s.user_id
   LIMIT 1;
  IF FOUND THEN
    v_who := CASE WHEN c.covering THEN 'the person covering for the ' ELSE 'the ' END
             || public.coordinator_role_label(c.role_code);
    user_id := c.user_id;
    role_code := c.role_code;
    path := 'lunch_only';
    note := 'Sent to ' || v_who || ' on shift. They are at lunch, but no other coordinator is working.';
    RETURN NEXT;
    RETURN;
  END IF;

  -- No coordinator working: today's order, on call overnight, then the Operations Supervisor.
  SELECT * INTO v_cfg FROM public.coverage_config WHERE id LIMIT 1;
  IF v_cfg.timezone IS NOT NULL THEN
    v_tz := v_cfg.timezone;
  END IF;
  v_local := _at AT TIME ZONE v_tz;
  v_minutes := EXTRACT(hour FROM v_local)::int * 60 + EXTRACT(minute FROM v_local)::int;
  IF v_cfg.after_hours_start_minute IS NOT NULL AND v_cfg.after_hours_end_minute IS NOT NULL THEN
    v_overnight := CASE
      WHEN v_cfg.after_hours_start_minute > v_cfg.after_hours_end_minute
        THEN (v_minutes >= v_cfg.after_hours_start_minute OR v_minutes < v_cfg.after_hours_end_minute)
      ELSE (v_minutes >= v_cfg.after_hours_start_minute AND v_minutes < v_cfg.after_hours_end_minute)
    END;
  END IF;

  IF v_overnight THEN
    v_oncall := public.oncall_user_for_night(
      CASE WHEN v_minutes < v_cfg.after_hours_end_minute THEN v_local::date - 1 ELSE v_local::date END);
    IF v_oncall IS NOT NULL AND public.staff_assignable(v_oncall) THEN
      user_id := v_oncall;
      role_code := NULL;
      path := 'on_call';
      note := 'No coordinator was on shift overnight, so it went to the person on call tonight. Urgency is unchanged.';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  SELECT fr.current_seat_holder INTO v_sup
  FROM public.functional_roles fr WHERE fr.code = 'ops_supervisor' AND fr.active;
  IF public.staff_assignable(v_sup) THEN
    user_id := v_sup;
    role_code := 'ops_supervisor';
    path := 'supervisor';
    note := CASE
        WHEN v_overnight THEN 'No coordinator was on shift and no one is on call tonight, so it went to the Operations Supervisor.'
        ELSE 'No coordinator was on shift, so it went to the Operations Supervisor.'
      END
      || CASE WHEN public.seat_on_duty('ops_supervisor', _at) THEN ''
              ELSE ' The Operations Supervisor is not on shift right now; reassign it when a coordinator starts.' END;
    RETURN NEXT;
    RETURN;
  END IF;

  user_id := NULL;
  role_code := NULL;
  path := 'nobody';
  note := 'No coordinator was on shift and no Operations Supervisor is set up, so no one has it yet. Assign it by hand.';
  RETURN NEXT;
END $function$;
