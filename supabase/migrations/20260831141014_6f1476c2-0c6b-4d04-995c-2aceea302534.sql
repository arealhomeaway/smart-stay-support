-- ============================================================
-- 1. Ticket assignment provenance (from reviewed PR #2)
-- ============================================================
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS assignment_source text,
  ADD COLUMN IF NOT EXISTS assignment_note text;

COMMENT ON COLUMN public.tickets.assignment_source IS
  'How current_action_owner/assigned_to got set: ''automatic'' (trigger), ''manual'' (person), or NULL (never assigned).';
COMMENT ON COLUMN public.tickets.assignment_note IS
  'Human-readable reason for the current assignment state; explains a deliberate unassigned state.';

-- ============================================================
-- 2. Machine-readable seat coverage (America/Chicago, DST-safe)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coverage_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code text NOT NULL REFERENCES public.functional_roles(code) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute integer NOT NULL CHECK (start_minute >= 0 AND start_minute < 1440),
  end_minute integer NOT NULL CHECK (end_minute > 0 AND end_minute <= 1440),
  active boolean NOT NULL DEFAULT true,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_minute > start_minute)
);
COMMENT ON TABLE public.coverage_shifts IS
  'Regular weekly coverage per functional seat. weekday uses Postgres dow (0=Sunday). Minutes are local America/Chicago wall-clock, so DST is handled by evaluating now() AT TIME ZONE ''America/Chicago''. A seat with no active rows is not schedule-gated.';

CREATE INDEX IF NOT EXISTS coverage_shifts_role_weekday_idx
  ON public.coverage_shifts (role_code, weekday) WHERE active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coverage_shifts TO authenticated;
GRANT ALL ON public.coverage_shifts TO service_role;
ALTER TABLE public.coverage_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read coverage" ON public.coverage_shifts
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Supervisors manage coverage" ON public.coverage_shifts
  FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));

CREATE TRIGGER coverage_shifts_updated_at BEFORE UPDATE ON public.coverage_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Approved regular coverage (seat-level; the seat holder is set separately).
INSERT INTO public.coverage_shifts (role_code, weekday, start_minute, end_minute, note)
SELECT * FROM (VALUES
  -- Operations Supervisor seat: Mon-Fri 8a-5p
  ('ops_supervisor', 1, 480, 1020, 'Approved 2026-08-31: Mon-Fri 8a-5p Central'),
  ('ops_supervisor', 2, 480, 1020, 'Approved 2026-08-31: Mon-Fri 8a-5p Central'),
  ('ops_supervisor', 3, 480, 1020, 'Approved 2026-08-31: Mon-Fri 8a-5p Central'),
  ('ops_supervisor', 4, 480, 1020, 'Approved 2026-08-31: Mon-Fri 8a-5p Central'),
  ('ops_supervisor', 5, 480, 1020, 'Approved 2026-08-31: Mon-Fri 8a-5p Central'),
  -- Property Operations, Weekday: Mon-Fri 8a-5p
  ('po_day', 1, 480, 1020, 'Approved 2026-08-31: Mon-Fri 8a-5p Central'),
  ('po_day', 2, 480, 1020, 'Approved 2026-08-31: Mon-Fri 8a-5p Central'),
  ('po_day', 3, 480, 1020, 'Approved 2026-08-31: Mon-Fri 8a-5p Central'),
  ('po_day', 4, 480, 1020, 'Approved 2026-08-31: Mon-Fri 8a-5p Central'),
  ('po_day', 5, 480, 1020, 'Approved 2026-08-31: Mon-Fri 8a-5p Central'),
  -- Guest Experience, Evening Weekday: Mon-Fri 1p-10p
  ('ge_evening', 1, 780, 1320, 'Approved 2026-08-31: Mon-Fri 1p-10p Central'),
  ('ge_evening', 2, 780, 1320, 'Approved 2026-08-31: Mon-Fri 1p-10p Central'),
  ('ge_evening', 3, 780, 1320, 'Approved 2026-08-31: Mon-Fri 1p-10p Central'),
  ('ge_evening', 4, 780, 1320, 'Approved 2026-08-31: Mon-Fri 1p-10p Central'),
  ('ge_evening', 5, 780, 1320, 'Approved 2026-08-31: Mon-Fri 1p-10p Central'),
  -- Guest Experience, Day/Weekend: Thu-Mon 8a-5p
  ('ge_day', 4, 480, 1020, 'Approved 2026-08-31: Thu-Mon 8a-5p Central'),
  ('ge_day', 5, 480, 1020, 'Approved 2026-08-31: Thu-Mon 8a-5p Central'),
  ('ge_day', 6, 480, 1020, 'Approved 2026-08-31: Thu-Mon 8a-5p Central'),
  ('ge_day', 0, 480, 1020, 'Approved 2026-08-31: Thu-Mon 8a-5p Central'),
  ('ge_day', 1, 480, 1020, 'Approved 2026-08-31: Thu-Mon 8a-5p Central'),
  -- Property Operations, Evening/Weekend: Wed 8a-5p; Thu-Sun 1p-10p
  ('po_evening', 3, 480, 1020, 'Approved 2026-08-31: Wednesday 8a-5p Central'),
  ('po_evening', 4, 780, 1320, 'Approved 2026-08-31: Thu-Sun 1p-10p Central'),
  ('po_evening', 5, 780, 1320, 'Approved 2026-08-31: Thu-Sun 1p-10p Central'),
  ('po_evening', 6, 780, 1320, 'Approved 2026-08-31: Thu-Sun 1p-10p Central'),
  ('po_evening', 0, 780, 1320, 'Approved 2026-08-31: Thu-Sun 1p-10p Central')
) AS v(role_code, weekday, start_minute, end_minute, note)
WHERE NOT EXISTS (SELECT 1 FROM public.coverage_shifts);

-- ============================================================
-- 3. Overnight on-call roster (10p-8a Central), admin-managed
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS oncall_eligible boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.profiles.oncall_eligible IS
  'Approved to appear in the overnight on-call roster picker. Set by an administrator only.';

CREATE TABLE IF NOT EXISTS public.oncall_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  label text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);
COMMENT ON TABLE public.oncall_roster IS
  'Who is on call for the 10 p.m.-8 a.m. America/Chicago overnight window, per dated period. Exactly one person per period; no default, nothing inferred.';

CREATE INDEX IF NOT EXISTS oncall_roster_period_idx ON public.oncall_roster (starts_on, ends_on);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oncall_roster TO authenticated;
GRANT ALL ON public.oncall_roster TO service_role;
ALTER TABLE public.oncall_roster ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read on-call roster" ON public.oncall_roster
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Supervisors manage on-call roster" ON public.oncall_roster
  FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));

CREATE TRIGGER oncall_roster_updated_at BEFORE UPDATE ON public.oncall_roster
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Only approved people may be rostered, and periods may not overlap.
CREATE OR REPLACE FUNCTION public.validate_oncall_roster()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.user_id AND p.oncall_eligible) THEN
    RAISE EXCEPTION 'That person is not approved for overnight on-call.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.oncall_roster r
    WHERE r.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NEW.starts_on <= r.ends_on AND NEW.ends_on >= r.starts_on
  ) THEN
    RAISE EXCEPTION 'That period overlaps an existing on-call entry.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER oncall_roster_validate BEFORE INSERT OR UPDATE ON public.oncall_roster
  FOR EACH ROW EXECUTE FUNCTION public.validate_oncall_roster();

-- ============================================================
-- 4. General property -> designated primary owner directory
-- ============================================================
CREATE TABLE IF NOT EXISTS public.property_owner_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_name text,
  owner_email text,
  owner_phone text,
  source text NOT NULL,
  source_id text,
  match_status text NOT NULL DEFAULT 'matched'
    CHECK (match_status IN ('matched', 'ambiguous', 'unmatched', 'source_error')),
  candidate_count integer NOT NULL DEFAULT 1,
  detail text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.property_owner_contacts IS
  'Normalized designated primary owner per property. Independent of Active Owner Program enrollment. Records source, source identifier and last sync so staleness and source failure are distinguishable from "no mapped owner".';

GRANT SELECT ON public.property_owner_contacts TO authenticated;
GRANT ALL ON public.property_owner_contacts TO service_role;
ALTER TABLE public.property_owner_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read primary owner contacts" ON public.property_owner_contacts
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TRIGGER property_owner_contacts_updated_at BEFORE UPDATE ON public.property_owner_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. Schedule-aware automatic assignment
-- ============================================================
CREATE OR REPLACE FUNCTION public.seat_on_duty(_role_code text, _at timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.coverage_shifts c WHERE c.role_code = _role_code AND c.active)
      THEN true   -- seat is not schedule-gated (e.g. leadership / oversight by exception)
    ELSE EXISTS (
      SELECT 1 FROM public.coverage_shifts c
      WHERE c.role_code = _role_code AND c.active
        AND c.weekday = EXTRACT(dow FROM (_at AT TIME ZONE 'America/Chicago'))::int
        AND (EXTRACT(hour FROM (_at AT TIME ZONE 'America/Chicago'))::int * 60
             + EXTRACT(minute FROM (_at AT TIME ZONE 'America/Chicago'))::int)
            >= c.start_minute
        AND (EXTRACT(hour FROM (_at AT TIME ZONE 'America/Chicago'))::int * 60
             + EXTRACT(minute FROM (_at AT TIME ZONE 'America/Chicago'))::int)
            < c.end_minute
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.staff_assignable(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role::text IN ('admin','manager','onboarding','tech')
  )
$$;

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
  v_overnight boolean;
  v_oncall uuid;
  v_sup_holder uuid;
BEGIN
  -- Never touches an existing row: BEFORE INSERT only, so a manual
  -- reassignment or an accepted handoff can never be overwritten.
  IF NEW.status IN ('resolved', 'closed') THEN
    RETURN NEW;
  END IF;

  v_local := now() AT TIME ZONE 'America/Chicago';
  v_local_date := v_local::date;
  v_minutes := EXTRACT(hour FROM v_local)::int * 60 + EXTRACT(minute FROM v_local)::int;
  v_overnight := (v_minutes >= 1320 OR v_minutes < 480);

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

  -- ---------- Overnight (10 p.m.-8 a.m. Central) ----------
  IF v_overnight THEN
    SELECT r.user_id INTO v_oncall
    FROM public.oncall_roster r
    WHERE v_local_date BETWEEN r.starts_on AND r.ends_on
    LIMIT 1;

    IF v_oncall IS NOT NULL AND public.staff_assignable(v_oncall) THEN
      NEW.current_action_owner := v_oncall;
      NEW.assigned_to := v_oncall;
      NEW.assignment_source := 'automatic';
      NEW.assignment_note := 'Created during the overnight window (10 p.m.-8 a.m. Central); routed to the rostered on-call person for '
        || to_char(v_local_date, 'YYYY-MM-DD') || '.';
      RETURN NEW;
    END IF;

    NEW.current_action_owner := NULL;
    NEW.assigned_to := NULL;
    NEW.assignment_source := NULL;
    NEW.assignment_note := CASE
      WHEN v_oncall IS NULL THEN 'Not auto-assigned: no overnight on-call roster entry exists for '
        || to_char(v_local_date, 'YYYY-MM-DD') || '. Existing overnight escalation procedures apply.'
      ELSE 'Not auto-assigned: the rostered overnight on-call person no longer holds an assignable staff role.'
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

    -- Documented secondary coverage: the seat's own backup seat, also only
    -- when that backup seat is actually on duty.
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

  -- ---------- Daytime fallback: Operations Supervisor ----------
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

DROP TRIGGER IF EXISTS tickets_auto_assign ON public.tickets;
CREATE TRIGGER tickets_auto_assign
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_ticket();

CREATE OR REPLACE FUNCTION public.audit_ticket_auto_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, body, internal)
  VALUES (
    NEW.id, NULL, 'assignment',
    CASE WHEN NEW.assigned_to IS NOT NULL THEN 'auto_assigned' ELSE 'auto_assign_skipped' END,
    CASE WHEN NEW.assigned_to IS NOT NULL THEN 'Automatically assigned: ' || NEW.assignment_note
         ELSE COALESCE(NEW.assignment_note, 'Not auto-assigned.') END,
    false
  );

  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason, after_value)
  VALUES (
    NULL,
    CASE WHEN NEW.assigned_to IS NOT NULL THEN 'ticket_auto_assigned' ELSE 'ticket_auto_assign_skipped' END,
    'ticket', NEW.id, NEW.title, NEW.assignment_note,
    jsonb_build_object(
      'assigned_to', NEW.assigned_to,
      'current_action_owner', NEW.current_action_owner,
      'assignment_source', NEW.assignment_source,
      'functional_role_code', NEW.functional_role_code
    )
  );
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS tickets_audit_auto_assign ON public.tickets;
CREATE TRIGGER tickets_audit_auto_assign
  AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.audit_ticket_auto_assign();