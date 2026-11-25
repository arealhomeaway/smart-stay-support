ALTER TABLE public.arrival_checks
  ADD COLUMN IF NOT EXISTS steps jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recheck_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_outside_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_outside_by uuid,
  ADD COLUMN IF NOT EXISTS closed_outside_reason text;

CREATE OR REPLACE FUNCTION private.arrival_check_team_a()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.team := 'guest_experience';
  IF NEW.ticket_id IS NOT NULL THEN
    UPDATE public.tickets SET functional_role_code = 'ge_day' WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS arrival_check_team_a ON public.arrival_checks;
CREATE TRIGGER arrival_check_team_a BEFORE INSERT ON public.arrival_checks
  FOR EACH ROW EXECUTE FUNCTION private.arrival_check_team_a();

CREATE OR REPLACE FUNCTION public.save_arrival_check_step(_check_id uuid, _step text, _done boolean, _recheck boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); c public.arrival_checks;
BEGIN
  IF _me IS NULL OR NOT private.is_staff(_me) THEN RAISE EXCEPTION 'Not allowed.'; END IF;
  IF _step NOT IN ('clean','lock','work_orders','details','home') THEN RAISE EXCEPTION 'Unknown step.'; END IF;
  SELECT * INTO c FROM public.arrival_checks WHERE id = _check_id FOR UPDATE;
  IF NOT FOUND OR c.status <> 'open' THEN RAISE EXCEPTION 'This check is not open.'; END IF;
  PERFORM set_config('resolve.arrival_check_writing', 'on', true);
  UPDATE public.arrival_checks
     SET steps = steps || jsonb_build_object(_step, _done),
         recheck_flag = coalesce(_recheck, recheck_flag)
   WHERE id = _check_id RETURNING * INTO c;
  PERFORM set_config('resolve.arrival_check_writing', '', true);
  RETURN c.steps;
END $$;
REVOKE ALL ON FUNCTION public.save_arrival_check_step(uuid, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_arrival_check_step(uuid, text, boolean, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_close_overdue_arrival_checks()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _n integer; _reason text := 'Completed outside Resolve';
BEGIN
  IF _me IS NULL OR NOT (public.has_role(_me, 'admin') OR private.is_director(_me)
     OR public.is_onboarding_director(_me) OR public.is_supervisor(_me)) THEN
    RAISE EXCEPTION 'Only the Operations Supervisor, Directors and Admin can do this.';
  END IF;
  PERFORM set_config('resolve.arrival_check_writing', 'on', true);
  WITH d AS (
    UPDATE public.arrival_checks
       SET status = 'cancelled', cancelled_at = now(), closed_outside_at = now(),
           closed_outside_by = _me, closed_outside_reason = _reason, recheck_flag = false
     WHERE status = 'open' AND cleared_at IS NULL AND deadline_at < now()
     RETURNING ticket_id)
  , t AS (
    UPDATE public.tickets SET status = 'closed', resolved_at = now(), resolution_notes = _reason,
           closure_evidence = _reason, outcome_type = 'resolved', closure_qa_result = 'not_required'
     WHERE id IN (SELECT ticket_id FROM d) RETURNING id)
  , a AS (
    INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, body, internal)
    SELECT id, _me, 'note', 'arrival_closed_outside', 'Closed as completed outside Resolve.', true FROM t RETURNING 1)
  SELECT count(*) INTO _n FROM d;
  PERFORM set_config('resolve.arrival_check_writing', '', true);
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.bulk_close_overdue_arrival_checks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_close_overdue_arrival_checks() TO authenticated;