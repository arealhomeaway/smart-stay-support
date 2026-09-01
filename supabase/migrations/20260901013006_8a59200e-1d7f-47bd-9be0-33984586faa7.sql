CREATE OR REPLACE FUNCTION public.auto_assign_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
BEGIN
  IF NEW.status IN ('resolved', 'closed') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_cfg FROM public.coverage_config WHERE id LIMIT 1;
  IF v_cfg.timezone IS NOT NULL THEN
    v_tz := v_cfg.timezone;
  END IF;

  v_local := now() AT TIME ZONE v_tz;
  v_local_date := v_local::date;
  v_minutes := EXTRACT(hour FROM v_local)::int * 60 + EXTRACT(minute FROM v_local)::int;

  IF v_cfg.after_hours_start_minute IS NOT NULL AND v_cfg.after_hours_end_minute IS NOT NULL THEN
    v_overnight := CASE
      WHEN v_cfg.after_hours_start_minute > v_cfg.after_hours_end_minute
        THEN (v_minutes >= v_cfg.after_hours_start_minute OR v_minutes < v_cfg.after_hours_end_minute)
      ELSE (v_minutes >= v_cfg.after_hours_start_minute AND v_minutes < v_cfg.after_hours_end_minute)
    END;
  END IF;

  IF NEW.work_type_id IS NOT NULL THEN
    SELECT pending_approval INTO v_pending_approval FROM public.work_types WHERE id = NEW.work_type_id;
  END IF;

  IF v_pending_approval THEN
    NEW.current_action_owner := NULL;
    NEW.assigned_to := NULL;
    NEW.assignment_source := NULL;
    NEW.assignment_note := 'Not auto-assigned: this work type''s ownership is still pending approval.';
    RETURN NEW;
  END IF;

  -- ---------- After-hours window (configured, DST-safe) ----------
  IF v_overnight THEN
    SELECT r.user_id INTO v_oncall
    FROM public.oncall_roster r
    WHERE (CASE WHEN v_minutes < v_cfg.after_hours_end_minute THEN v_local_date - 1 ELSE v_local_date END)
          BETWEEN r.starts_on AND r.ends_on
    LIMIT 1;

    IF v_oncall IS NOT NULL AND public.staff_assignable(v_oncall) THEN
      NEW.current_action_owner := v_oncall;
      NEW.assigned_to := v_oncall;
      NEW.assignment_source := 'automatic';
      NEW.assignment_note := 'Created during the after-hours window; routed to the rostered on-call person for '
        || to_char(CASE WHEN v_minutes < v_cfg.after_hours_end_minute THEN v_local_date - 1 ELSE v_local_date END, 'YYYY-MM-DD')
        || '. Priority is unchanged — after-hours does not mean P1.';
      RETURN NEW;
    END IF;
    -- No usable on-call entry: fall through to the seat / supervisor ladder
    -- below rather than leaving the ticket unowned.
  END IF;

  -- ---------- Seat that owns the work type ----------
  v_role_code := NEW.functional_role_code;
  IF v_role_code IS NULL AND NEW.work_type_id IS NOT NULL THEN
    SELECT functional_role_code INTO v_role_code FROM public.work_types WHERE id = NEW.work_type_id;
  END IF;

  IF NOT v_overnight AND v_role_code IS NOT NULL THEN
    SELECT fr.current_seat_holder, fr.name, fr.backup_role_code
      INTO v_holder, v_role_name, v_backup_code
    FROM public.functional_roles fr WHERE fr.code = v_role_code AND fr.active;

    IF public.staff_assignable(v_holder) AND public.seat_on_duty(v_role_code) THEN
      NEW.current_action_owner := v_holder;
      NEW.assigned_to := v_holder;
      NEW.assignment_source := 'automatic';
      NEW.assignment_note := 'Routed to the ' || COALESCE(v_role_name, v_role_code) || ' seat, on duty now (Central).';
      RETURN NEW;
    END IF;

    IF v_backup_code IS NOT NULL THEN
      SELECT fr.current_seat_holder, fr.name INTO v_holder, v_backup_name
      FROM public.functional_roles fr WHERE fr.code = v_backup_code AND fr.active;

      IF public.staff_assignable(v_holder) AND public.seat_on_duty(v_backup_code) THEN
        NEW.current_action_owner := v_holder;
        NEW.assigned_to := v_holder;
        NEW.assignment_source := 'automatic';
        NEW.assignment_note := 'The ' || COALESCE(v_role_name, v_role_code)
          || ' seat is not covered right now; routed to its backup seat ' || COALESCE(v_backup_name, v_backup_code) || '.';
        RETURN NEW;
      END IF;
    END IF;
  ELSIF v_overnight AND v_role_code IS NOT NULL THEN
    SELECT fr.name INTO v_role_name FROM public.functional_roles fr WHERE fr.code = v_role_code AND fr.active;
  END IF;

  -- ---------- Last resort: the Operations Supervisor always catches ----------
  SELECT fr.current_seat_holder INTO v_sup_holder
  FROM public.functional_roles fr WHERE fr.code = 'ops_supervisor' AND fr.active;

  IF public.staff_assignable(v_sup_holder) THEN
    v_sup_on_duty := public.seat_on_duty('ops_supervisor');
    NEW.current_action_owner := v_sup_holder;
    NEW.assigned_to := v_sup_holder;
    NEW.assignment_source := 'automatic';
    NEW.assignment_note := CASE
      WHEN v_overnight THEN 'No usable on-call roster entry for this after-hours window; held by the Operations Supervisor so it is never unowned. Reassign in the morning if it belongs to a seat.'
      WHEN v_role_code IS NULL THEN 'No owning seat is recorded for this work; routed to the Operations Supervisor for triage.'
      ELSE 'Neither the ' || COALESCE(v_role_name, v_role_code)
        || ' seat nor its backup has an available holder right now; routed to the Operations Supervisor for triage.'
    END
    || CASE WHEN v_sup_on_duty THEN '' ELSE ' The Supervisor seat is outside its scheduled hours — this is a safety catch, not an expectation of an immediate response.' END;
    RETURN NEW;
  END IF;

  NEW.current_action_owner := NULL;
  NEW.assigned_to := NULL;
  NEW.assignment_source := NULL;
  NEW.assignment_note := 'Not auto-assigned: no owning seat and no eligible Operations Supervisor. Needs a manual assignment.';
  RETURN NEW;
END;
$function$;