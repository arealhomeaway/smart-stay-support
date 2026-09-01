-- 1. Seat availability + invite linkage
ALTER TABLE public.functional_roles
  ADD COLUMN IF NOT EXISTS available boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS unavailable_note text,
  ADD COLUMN IF NOT EXISTS unavailable_until timestamptz;

ALTER TABLE public.team_invites
  ADD COLUMN IF NOT EXISTS seat_role_code text;

-- 2. Temporary coverage overrides (specific date/time, beats recurring schedule)
CREATE TABLE IF NOT EXISTS public.coverage_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code text NOT NULL,
  kind text NOT NULL DEFAULT 'cover' CHECK (kind IN ('cover','off')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coverage_overrides TO authenticated;
GRANT ALL ON public.coverage_overrides TO service_role;
ALTER TABLE public.coverage_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can read coverage overrides"
  ON public.coverage_overrides FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY "Supervisors manage coverage overrides"
  ON public.coverage_overrides FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()))
  WITH CHECK (public.is_supervisor(auth.uid()));

CREATE TRIGGER update_coverage_overrides_updated_at
  BEFORE UPDATE ON public.coverage_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Approved cross-team triage windows
CREATE TABLE IF NOT EXISTS public.coverage_triage_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute integer NOT NULL,
  end_minute integer NOT NULL,
  covers_team text NOT NULL,
  role_code text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coverage_triage_windows TO authenticated;
GRANT ALL ON public.coverage_triage_windows TO service_role;
ALTER TABLE public.coverage_triage_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can read triage windows"
  ON public.coverage_triage_windows FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY "Supervisors manage triage windows"
  ON public.coverage_triage_windows FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()))
  WITH CHECK (public.is_supervisor(auth.uid()));

CREATE TRIGGER update_coverage_triage_windows_updated_at
  BEFORE UPDATE ON public.coverage_triage_windows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.coverage_triage_windows (weekday, start_minute, end_minute, covers_team, role_code, note)
VALUES
  (1, 1020, 1320, 'property_operations', 'ge_evening', 'Monday evening cross-team triage'),
  (2,  480,  780, 'property_operations', 'po_day',     'Tuesday morning cross-team triage'),
  (2, 1020, 1320, 'property_operations', 'ge_evening', 'Tuesday evening cross-team triage'),
  (3, 1020, 1320, 'property_operations', 'ge_evening', 'Wednesday evening cross-team triage'),
  (6,  480,  780, 'property_operations', 'ge_day',     'Saturday morning cross-team triage'),
  (0,  480,  780, 'property_operations', 'ge_day',     'Sunday morning cross-team triage');

-- 4. Seat eligibility helpers used by both the UI and the routing engine
CREATE OR REPLACE FUNCTION public.seat_override_at(_role_code text, _at timestamptz DEFAULT now())
RETURNS TABLE (kind text, user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT o.kind, o.user_id
  FROM public.coverage_overrides o
  WHERE o.role_code = _role_code AND _at >= o.starts_at AND _at < o.ends_at
  ORDER BY o.created_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.seat_eligible_now(_role_code text, _at timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN (SELECT kind FROM public.seat_override_at(_role_code, _at)) = 'off' THEN false
    WHEN (SELECT kind FROM public.seat_override_at(_role_code, _at)) = 'cover' THEN true
    WHEN NOT COALESCE((SELECT r.available FROM public.functional_roles r WHERE r.code = _role_code), true) THEN false
    ELSE public.seat_on_duty(_role_code, _at)
  END
$$;

CREATE OR REPLACE FUNCTION public.seat_holder_at(_role_code text, _at timestamptz DEFAULT now())
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT o.user_id FROM public.seat_override_at(_role_code, _at) o WHERE o.kind = 'cover'),
    (SELECT r.current_seat_holder FROM public.functional_roles r WHERE r.code = _role_code)
  )
$$;

-- 5. Correct the seat configuration to the approved schedule
UPDATE public.functional_roles SET current_seat_name = 'Avy Vergara', current_seat_holder = NULL,
  coverage_window = 'Thursday–Monday 8 a.m.–5 p.m. Central'
  WHERE code = 'ge_day';
UPDATE public.functional_roles SET current_seat_name = 'Mike Cacatain', current_seat_holder = NULL,
  coverage_window = 'Monday–Friday 1 p.m.–10 p.m. Central'
  WHERE code = 'ge_evening';
UPDATE public.functional_roles SET current_seat_name = 'Romeo Canales',
  current_seat_holder = '1a4b8de5-0824-4066-8691-8e6bb912f964',
  coverage_window = 'Monday–Friday 8 a.m.–5 p.m. Central'
  WHERE code = 'po_day';
UPDATE public.functional_roles SET current_seat_name = 'Christine Sendico', current_seat_holder = NULL,
  coverage_window = 'Wednesday 8 a.m.–5 p.m.; Thursday–Sunday 1 p.m.–10 p.m. Central'
  WHERE code = 'po_evening';
UPDATE public.functional_roles SET coverage_window = 'Monday–Friday 8 a.m.–5 p.m. Central'
  WHERE code = 'ops_supervisor';

-- 6. Correct invite metadata and link invites to the seat they are for
UPDATE public.team_invites SET note = 'Seat: Team A — Guest Experience & Reservations Coordinator, Day/Weekend (ge_day)', seat_role_code = 'ge_day' WHERE code = 'AVYV-6H2N';
UPDATE public.team_invites SET note = 'Seat: Team A — Guest Experience & Reservations Coordinator, Evening (ge_evening)', seat_role_code = 'ge_evening' WHERE code = 'MIKC-9R5D';
UPDATE public.team_invites SET note = 'Seat: Team B — Property Operations Coordinator, Weekday Day (po_day)', seat_role_code = 'po_day' WHERE code = 'ROMC-8T3W';
UPDATE public.team_invites SET note = 'Seat: Team B — Property Operations Coordinator, Evening/Weekend (po_evening)', seat_role_code = 'po_evening' WHERE code = 'CHRS-3F8Q';
UPDATE public.team_invites SET seat_role_code = 'ops_supervisor' WHERE code = 'JAMS-4K7P';