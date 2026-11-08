-- Routing by time, part 3: one rule for who gets new coordinator work. Staged only.
-- Not applied until approved. Needs 01_lunch_times.sql first.
-- Undo: 03_undo_coordinator_routing.sql
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.
--
-- One rule in one place:
--   coordinators_on_shift(at)  who is on shift at a moment (saved schedule, time off,
--                              cover, the unavailable switch, lunch, open work), read only.
--   coordinator_for(team, at)  the one person new coordinator work goes to, with the role
--                              and a plain note, read only.
--   ticket_route_at(...)       the whole new ticket ladder at a moment, read only. Coordinator
--                              work uses coordinator_for; every other path is today's order.
--   auto_assign_ticket()       the ticket trigger, now a thin wrapper over ticket_route_at(now()).
--   direct_booking_on_shift()  who a new Direct Booking alerts, built on coordinators_on_shift.
--   routing_dry_run(times)     read only: who each active work type would go to at given times.
--
-- Unchanged: priorities, clocks, SLAs, escalation, the work type to role links, the on call
-- pattern and oncall_user_for_night, seat_eligible_now, seat_holder_at, seat_on_duty,
-- seat_override_at, staff_assignable, functional_role_holders, direct_booking_alert_new,
-- direct_booking_notify, the Breezeway path, and the order used for Director of Operations
-- work types, other roles and tickets with no work type. Only their note wording changes.

-- 1. Plain names (mirrored by COORDINATOR_ROLE_LABELS in src/lib/coverage-model.ts; a test keeps them equal).
CREATE OR REPLACE FUNCTION public.coordinator_role_label(_code text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _code
    WHEN 'ge_day' THEN 'Guest Experience day and weekend coordinator'
    WHEN 'ge_evening' THEN 'Guest Experience evening coordinator'
    WHEN 'ge_parttime' THEN 'Guest Experience part time coordinator'
    WHEN 'po_day' THEN 'Property Operations weekday day coordinator'
    WHEN 'po_evening' THEN 'Property Operations evening and weekend coordinator'
  END
$$;
REVOKE ALL ON FUNCTION public.coordinator_role_label(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coordinator_role_label(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.coordinator_team_label(_team text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _team
    WHEN 'guest_experience' THEN 'Guest Experience'
    WHEN 'property_operations' THEN 'Property Operations'
  END
$$;
REVOKE ALL ON FUNCTION public.coordinator_team_label(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coordinator_team_label(text) TO authenticated, service_role;

-- 2. Who is on shift. Team A = the three Guest Experience roles, Team B = the two Property
--    Operations roles. On shift = seat_eligible_now (saved schedule, time off, cover, the
--    unavailable switch); the person = seat_holder_at (a cover wins). Load = open work they
--    own counted Right now 5, Today 3, Routine 1; Waiting, closed, archived and demo work never
--    count. last_given = when they were last given work automatically (for ties).
CREATE OR REPLACE FUNCTION public.coordinators_on_shift(_at timestamptz DEFAULT now())
RETURNS TABLE(user_id uuid, role_code text, team text, covering boolean, at_lunch boolean, load integer, last_given timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH l AS (
    SELECT EXTRACT(dow FROM (_at AT TIME ZONE 'America/Chicago'))::int AS wd,
           (EXTRACT(hour FROM (_at AT TIME ZONE 'America/Chicago'))::int * 60
            + EXTRACT(minute FROM (_at AT TIME ZONE 'America/Chicago'))::int) AS m
  ), r AS (
    SELECT fr.code, fr.team,
           public.seat_holder_at(fr.code, _at) AS uid,
           coalesce((SELECT o.kind FROM public.seat_override_at(fr.code, _at) o) = 'cover', false) AS covering
    FROM public.functional_roles fr
    WHERE fr.active
      AND fr.code IN ('ge_day', 'ge_evening', 'ge_parttime', 'po_day', 'po_evening')
      AND public.seat_eligible_now(fr.code, _at)
  )
  SELECT r.uid, r.code, r.team, r.covering,
    EXISTS (
      SELECT 1 FROM public.coverage_shifts s, l
      WHERE s.role_code = r.code AND s.active AND s.weekday = l.wd
        AND s.lunch_start_minute IS NOT NULL
        AND l.m >= s.lunch_start_minute AND l.m < s.lunch_end_minute),
    coalesce((
      SELECT sum(CASE t.priority WHEN 'p1' THEN 5 WHEN 'p2' THEN 3 ELSE 1 END)
      FROM public.tickets t
      WHERE t.current_action_owner = r.uid
        AND t.status NOT IN ('resolved', 'closed', 'waiting')
        AND t.archived_at IS NULL
        AND NOT coalesce(t.is_demo, false)), 0)::int,
    (SELECT max(t.created_at) FROM public.tickets t
      WHERE t.current_action_owner = r.uid
        AND t.assignment_source IN ('automatic', 'breezeway_auto_route'))
  FROM r
  WHERE public.staff_assignable(r.uid)
$$;
REVOKE ALL ON FUNCTION public.coordinators_on_shift(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coordinators_on_shift(timestamptz) TO service_role;

-- 3. The one person for new coordinator work on a team at a moment. Read only.
--    Order: same team on shift and not at lunch (lightest load, then given work longest ago);
--    then the other team on shift and not at lunch; then anyone on shift at lunch, same team
--    first; then overnight (coverage_config window) the person on call tonight; then the
--    Operations Supervisor; else nobody.
CREATE OR REPLACE FUNCTION public.coordinator_for(_team text, _at timestamptz DEFAULT now())
RETURNS TABLE(user_id uuid, role_code text, note text, path text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.coordinator_for(text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coordinator_for(text, timestamptz) TO service_role;

-- 4. The whole new ticket ladder at a moment. Read only.
--    Coordinator work (the five coordinator roles) goes through coordinator_for. Everything
--    else keeps today's order exactly: work type still waiting for an owner decision, then
--    overnight on call, then the owning role and its backup, then the Operations Supervisor,
--    then nobody. Only the note wording is new.
CREATE OR REPLACE FUNCTION public.ticket_route_at(_role_code text, _work_type_id uuid, _at timestamptz DEFAULT now())
RETURNS TABLE(user_id uuid, role_code text, source text, note text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_pending_approval boolean;
  v_role_code text;
  v_role_name text;
  v_backup_code text;
  v_backup_name text;
  v_holder uuid;
  v_local timestamp;
  v_minutes int;
  v_local_date date;
  v_overnight boolean := false;
  v_oncall uuid;
  v_sup_holder uuid;
  v_sup_on_duty boolean;
  v_cfg public.coverage_config%ROWTYPE;
  v_tz text := 'America/Chicago';
  v_pick record;
BEGIN
  SELECT * INTO v_cfg FROM public.coverage_config WHERE id LIMIT 1;
  IF v_cfg.timezone IS NOT NULL THEN
    v_tz := v_cfg.timezone;
  END IF;

  v_local := _at AT TIME ZONE v_tz;
  v_local_date := v_local::date;
  v_minutes := EXTRACT(hour FROM v_local)::int * 60 + EXTRACT(minute FROM v_local)::int;

  IF v_cfg.after_hours_start_minute IS NOT NULL AND v_cfg.after_hours_end_minute IS NOT NULL THEN
    v_overnight := CASE
      WHEN v_cfg.after_hours_start_minute > v_cfg.after_hours_end_minute
        THEN (v_minutes >= v_cfg.after_hours_start_minute OR v_minutes < v_cfg.after_hours_end_minute)
      ELSE (v_minutes >= v_cfg.after_hours_start_minute AND v_minutes < v_cfg.after_hours_end_minute)
    END;
  END IF;

  IF _work_type_id IS NOT NULL THEN
    SELECT wt.pending_approval INTO v_pending_approval FROM public.work_types wt WHERE wt.id = _work_type_id;
  END IF;

  IF v_pending_approval THEN
    user_id := NULL;
    role_code := NULL;
    source := NULL;
    note := 'Not sent to anyone: who owns this work type is not decided yet.';
    RETURN NEXT;
    RETURN;
  END IF;

  v_role_code := _role_code;
  IF v_role_code IS NULL AND _work_type_id IS NOT NULL THEN
    SELECT wt.functional_role_code INTO v_role_code FROM public.work_types wt WHERE wt.id = _work_type_id;
  END IF;

  -- ---------- Coordinator work: routed by the time ----------
  IF v_role_code IN ('ge_day', 'ge_evening', 'ge_parttime', 'po_day', 'po_evening') THEN
    SELECT * INTO v_pick FROM public.coordinator_for(
      CASE WHEN v_role_code LIKE 'ge\_%' THEN 'guest_experience' ELSE 'property_operations' END, _at);
    user_id := v_pick.user_id;
    role_code := v_pick.role_code;
    source := CASE WHEN v_pick.user_id IS NULL THEN NULL ELSE 'automatic' END;
    note := v_pick.note;
    RETURN NEXT;
    RETURN;
  END IF;

  -- ---------- Everything else: today's order ----------
  IF v_overnight THEN
    v_oncall := public.oncall_user_for_night(
      CASE WHEN v_minutes < v_cfg.after_hours_end_minute THEN v_local_date - 1 ELSE v_local_date END);

    IF v_oncall IS NOT NULL AND public.staff_assignable(v_oncall) THEN
      user_id := v_oncall;
      role_code := NULL;
      source := 'automatic';
      note := 'Came in overnight, so it went to the person on call tonight. Urgency is unchanged.';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  IF NOT v_overnight AND v_role_code IS NOT NULL THEN
    SELECT fr.name, fr.backup_role_code
      INTO v_role_name, v_backup_code
    FROM public.functional_roles fr WHERE fr.code = v_role_code AND fr.active;
    v_holder := CASE WHEN FOUND THEN public.seat_holder_at(v_role_code, _at) END;

    IF public.staff_assignable(v_holder) AND public.seat_eligible_now(v_role_code, _at) THEN
      user_id := v_holder;
      role_code := v_role_code;
      source := 'automatic';
      note := CASE
        WHEN (SELECT o.kind FROM public.seat_override_at(v_role_code, _at) o) = 'cover'
          THEN 'Sent to the person covering for the ' || COALESCE(v_role_name, 'role that owns this work') || ' right now.'
        ELSE 'Sent to the ' || COALESCE(v_role_name, 'role that owns this work') || ', who owns this work.'
      END;
      RETURN NEXT;
      RETURN;
    END IF;

    IF v_backup_code IS NOT NULL THEN
      SELECT fr.name INTO v_backup_name
      FROM public.functional_roles fr WHERE fr.code = v_backup_code AND fr.active;
      v_holder := CASE WHEN FOUND THEN public.seat_holder_at(v_backup_code, _at) END;

      IF public.staff_assignable(v_holder) AND public.seat_eligible_now(v_backup_code, _at) THEN
        user_id := v_holder;
        role_code := v_backup_code;
        source := 'automatic';
        note := 'The ' || COALESCE(v_role_name, 'role that owns this work')
          || ' is not available right now, so it went to the ' || COALESCE(v_backup_name, 'backup role') || '.';
        RETURN NEXT;
        RETURN;
      END IF;
    END IF;
  ELSIF v_overnight AND v_role_code IS NOT NULL THEN
    SELECT fr.name INTO v_role_name FROM public.functional_roles fr WHERE fr.code = v_role_code AND fr.active;
  END IF;

  SELECT fr.current_seat_holder INTO v_sup_holder
  FROM public.functional_roles fr WHERE fr.code = 'ops_supervisor' AND fr.active;

  IF public.staff_assignable(v_sup_holder) THEN
    v_sup_on_duty := public.seat_on_duty('ops_supervisor', _at);
    user_id := v_sup_holder;
    role_code := 'ops_supervisor';
    source := 'automatic';
    note := CASE
      WHEN v_overnight THEN 'Came in overnight and no one is on call tonight, so the Operations Supervisor has it. Reassign it in the morning if it belongs to someone else.'
      WHEN v_role_code IS NULL THEN 'No role owns this work, so it went to the Operations Supervisor to place.'
      ELSE 'The ' || COALESCE(v_role_name, 'role that owns this work')
        || ' and its backup are not available right now, so it went to the Operations Supervisor.'
    END
    || CASE WHEN v_sup_on_duty THEN '' ELSE ' The Operations Supervisor is not on shift right now; this only keeps it from having no owner.' END;
    RETURN NEXT;
    RETURN;
  END IF;

  user_id := NULL;
  role_code := NULL;
  source := NULL;
  note := 'Not sent to anyone: no role owns this work and no Operations Supervisor is set up. Assign it by hand.';
  RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.ticket_route_at(text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_route_at(text, uuid, timestamptz) TO service_role;

-- 5. Read only dry run: who each active work type would go to at the given times.
CREATE OR REPLACE FUNCTION public.routing_dry_run(_times timestamptz[])
RETURNS TABLE(at timestamptz, work_type text, team text, user_id uuid, role_code text, note text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.at, wt.name, wt.team, r.user_id, r.role_code, r.note
  FROM unnest(_times) WITH ORDINALITY AS t(at, n)
  CROSS JOIN public.work_types wt
  CROSS JOIN LATERAL public.ticket_route_at(wt.functional_role_code, wt.id, t.at) r
  WHERE wt.active
  ORDER BY t.n, wt.sort_order NULLS LAST, wt.name
$$;
REVOKE ALL ON FUNCTION public.routing_dry_run(timestamptz[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.routing_dry_run(timestamptz[]) TO service_role;

-- 6. The ticket trigger: same trigger, same events, now one call to the ladder above.
CREATE OR REPLACE FUNCTION public.auto_assign_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  IF NEW.status IN ('resolved', 'closed') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO r FROM public.ticket_route_at(NEW.functional_role_code, NEW.work_type_id, now());
  NEW.current_action_owner := r.user_id;
  NEW.assigned_to := r.user_id;
  NEW.assignment_source := r.source;
  NEW.assignment_note := r.note;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.auto_assign_ticket() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_assign_ticket() TO service_role;

-- 7. Who a new Direct Booking alerts (read by the unchanged direct_booking_alert_new trigger).
--    All Guest Experience coordinators on shift, skipping anyone at lunch while others are on
--    shift; if none, the coordinators working on any team; if only people at lunch are working,
--    they still get it (Guest Experience first); if no coordinator is working, the Operations
--    Supervisor and the Director of Operations. The first to press Start owns it (unchanged).
CREATE OR REPLACE FUNCTION public.direct_booking_on_shift(_at timestamp with time zone DEFAULT now())
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH c AS (SELECT * FROM public.coordinators_on_shift(_at)),
  k AS (
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM c WHERE c.team = 'guest_experience' AND NOT c.at_lunch) THEN 1
      WHEN EXISTS (SELECT 1 FROM c WHERE NOT c.at_lunch) THEN 2
      WHEN EXISTS (SELECT 1 FROM c WHERE c.team = 'guest_experience') THEN 3
      WHEN EXISTS (SELECT 1 FROM c) THEN 4
      ELSE 5
    END AS tier
  )
  SELECT c.user_id FROM c, k
   WHERE (k.tier = 1 AND c.team = 'guest_experience' AND NOT c.at_lunch)
      OR (k.tier = 2 AND NOT c.at_lunch)
      OR (k.tier = 3 AND c.team = 'guest_experience')
      OR k.tier = 4
  UNION
  SELECT h.u FROM k,
    (SELECT public.functional_role_holders('ops_supervisor') AS u
     UNION SELECT public.functional_role_holders('director_ops')) h
   WHERE k.tier = 5 AND h.u IS NOT NULL
$function$;
REVOKE ALL ON FUNCTION public.direct_booking_on_shift(timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.direct_booking_on_shift(timestamp with time zone) TO service_role;
