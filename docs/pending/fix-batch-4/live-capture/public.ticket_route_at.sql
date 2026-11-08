CREATE OR REPLACE FUNCTION public.ticket_route_at(_role_code text, _work_type_id uuid, _at timestamp with time zone DEFAULT now())
 RETURNS TABLE(user_id uuid, role_code text, source text, note text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$

