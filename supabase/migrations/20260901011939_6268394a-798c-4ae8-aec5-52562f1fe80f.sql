-- 1. Configurable after-hours coverage window (single row)
CREATE TABLE IF NOT EXISTS public.coverage_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  after_hours_start_minute int,
  after_hours_end_minute int,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  note text,
  configured_by uuid REFERENCES auth.users(id),
  configured_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.coverage_config TO authenticated;
GRANT ALL ON public.coverage_config TO service_role;

ALTER TABLE public.coverage_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read coverage config" ON public.coverage_config;
CREATE POLICY "Staff can read coverage config"
  ON public.coverage_config FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Supervisors can change coverage config" ON public.coverage_config;
CREATE POLICY "Supervisors can change coverage config"
  ON public.coverage_config FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()))
  WITH CHECK (public.is_supervisor(auth.uid()));

GRANT INSERT, UPDATE ON public.coverage_config TO authenticated;

INSERT INTO public.coverage_config (id, after_hours_start_minute, after_hours_end_minute, timezone, note, configured_at)
VALUES (true, 1320, 480, 'America/Chicago',
  'Approved after-hours coverage: 10:00 p.m. through 8:00 a.m. Central, daylight-saving aware.', now())
ON CONFLICT (id) DO UPDATE
  SET after_hours_start_minute = EXCLUDED.after_hours_start_minute,
      after_hours_end_minute = EXCLUDED.after_hours_end_minute,
      timezone = EXCLUDED.timezone,
      note = EXCLUDED.note,
      configured_at = now(),
      updated_at = now();

-- 2. Routing reads the configured window instead of hardcoded hours
CREATE OR REPLACE FUNCTION public.auto_assign_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    -- The roster day is the calendar date the window started on.
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

    NEW.current_action_owner := NULL;
    NEW.assigned_to := NULL;
    NEW.assignment_source := NULL;
    NEW.assignment_note := CASE
      WHEN v_oncall IS NULL THEN 'Not auto-assigned: no on-call roster entry covers this after-hours window. Existing escalation procedures apply.'
      ELSE 'Not auto-assigned: the rostered on-call person no longer holds an assignable staff role.'
    END;
    RETURN NEW;
  END IF;

  -- ---------- Daytime: seat that owns the work type ----------
  v_role_code := NEW.functional_role_code;
  IF v_role_code IS NULL AND NEW.work_type_id IS NOT NULL THEN
    SELECT functional_role_code INTO v_role_code FROM public.work_types WHERE id = NEW.work_type_id;
  END IF;

  IF v_role_code IS NOT NULL THEN
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
  END IF;

  SELECT fr.current_seat_holder INTO v_sup_holder
  FROM public.functional_roles fr WHERE fr.code = 'ops_supervisor' AND fr.active;

  IF public.staff_assignable(v_sup_holder) AND public.seat_on_duty('ops_supervisor') THEN
    NEW.current_action_owner := v_sup_holder;
    NEW.assigned_to := v_sup_holder;
    NEW.assignment_source := 'automatic';
    NEW.assignment_note := CASE
      WHEN v_role_code IS NULL THEN 'No owning seat is recorded for this work; routed to the Operations Supervisor for triage.'
      ELSE 'Neither the ' || COALESCE(v_role_name, v_role_code)
        || ' seat nor its backup is covered right now; routed to the Operations Supervisor for triage.'
    END;
    RETURN NEW;
  END IF;

  NEW.current_action_owner := NULL;
  NEW.assigned_to := NULL;
  NEW.assignment_source := NULL;
  NEW.assignment_note := CASE
    WHEN v_role_code IS NULL THEN 'Not auto-assigned: no owning seat is recorded, and the Operations Supervisor seat has no eligible holder on duty. Needs a manual assignment.'
    ELSE 'Not auto-assigned: the ' || COALESCE(v_role_name, v_role_code)
      || ' seat, its backup and the Operations Supervisor seat all have no eligible holder on duty. Needs a manual assignment.'
  END;
  RETURN NEW;
END;
$function$;

-- 3. Initial Operations beta seat assignments (configurable, name-independent)
UPDATE public.functional_roles SET current_seat_name = 'James Almario',
  current_seat_holder = (SELECT id FROM public.profiles WHERE email = 'james.almario@arealhomeaway.com')
  WHERE code = 'ops_supervisor';
UPDATE public.functional_roles SET current_seat_name = 'Romeo Canales',
  current_seat_holder = (SELECT id FROM public.profiles WHERE email = 'romeo.canales@arealhomeaway.com')
  WHERE code = 'ge_day';
UPDATE public.functional_roles SET current_seat_name = 'Mike Cacatain', current_seat_holder = NULL WHERE code = 'ge_evening';
UPDATE public.functional_roles SET current_seat_name = 'Avy Vergara', current_seat_holder = NULL WHERE code = 'po_day';
UPDATE public.functional_roles SET current_seat_name = 'Christine Sendico', current_seat_holder = NULL WHERE code = 'po_evening';