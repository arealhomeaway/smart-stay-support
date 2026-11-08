-- Scorecard capture, part 3: a saved routine check cannot be edited. A later correction is a
-- new line. Additive only. No BEGIN/COMMIT.

-- Server time on completion: never the browser's clock.
CREATE OR REPLACE FUNCTION private.stamp_routine_completion()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.completed_at := now();
    NEW.completed_by := coalesce(auth.uid(), NEW.completed_by);
  END IF;
  RETURN NEW;
END $$;

-- Once saved: no edit and no delete. The only change allowed is linking the follow-up ticket
-- the check opened, once, when it has none yet.
CREATE OR REPLACE FUNCTION private.lock_completed_routine_check()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT (OLD.status = 'completed' OR OLD.completed_at IS NOT NULL) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'A saved routine check is permanent. Add a correction instead.' USING ERRCODE = 'P0001';
  END IF;
  IF (to_jsonb(NEW) - 'updated_at' - 'follow_up_ticket_id') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at' - 'follow_up_ticket_id')
     OR (OLD.follow_up_ticket_id IS NOT NULL AND NEW.follow_up_ticket_id IS DISTINCT FROM OLD.follow_up_ticket_id) THEN
    RAISE EXCEPTION 'A saved routine check is permanent. Add a correction instead.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER routine_controls_lock_completed
  BEFORE UPDATE OR DELETE ON public.routine_controls
  FOR EACH ROW EXECUTE FUNCTION private.lock_completed_routine_check();
CREATE TRIGGER routine_controls_stamp_completion
  BEFORE INSERT OR UPDATE OF status ON public.routine_controls
  FOR EACH ROW EXECUTE FUNCTION private.stamp_routine_completion();

-- Corrections: add only.
CREATE TABLE public.routine_check_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_control_id uuid NOT NULL REFERENCES public.routine_controls(id),
  corrected_by uuid NOT NULL,
  corrected_at timestamptz NOT NULL DEFAULT now(),
  note text NOT NULL,
  is_demo boolean NOT NULL DEFAULT false
);
CREATE INDEX routine_check_corrections_check ON public.routine_check_corrections (routine_control_id, corrected_at);

GRANT SELECT ON public.routine_check_corrections TO authenticated;
GRANT SELECT, INSERT ON public.routine_check_corrections TO service_role;
ALTER TABLE public.routine_check_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY routine_check_corrections_read ON public.routine_check_corrections
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

CREATE OR REPLACE FUNCTION private.stamp_routine_correction()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.corrected_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER routine_check_corrections_stamp BEFORE INSERT ON public.routine_check_corrections
  FOR EACH ROW EXECUTE FUNCTION private.stamp_routine_correction();
-- private.refuse_record_change() comes from 01_scorecard_records.sql.
CREATE TRIGGER routine_check_corrections_no_change BEFORE UPDATE OR DELETE ON public.routine_check_corrections
  FOR EACH ROW EXECUTE FUNCTION private.refuse_record_change();
CREATE TRIGGER routine_check_corrections_no_truncate BEFORE TRUNCATE ON public.routine_check_corrections
  FOR EACH STATEMENT EXECUTE FUNCTION private.refuse_record_change();

CREATE OR REPLACE FUNCTION public.add_routine_correction(_routine_id uuid, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _r record;
  _id uuid;
  _at timestamptz;
BEGIN
  IF _me IS NULL OR NOT public.is_internal_staff(_me) THEN
    RAISE EXCEPTION 'Only staff can add a correction.';
  END IF;
  SELECT id, status, completed_at, is_demo INTO _r FROM public.routine_controls WHERE id = _routine_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'This check was not found.'; END IF;
  IF NOT (_r.status = 'completed' OR _r.completed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'This check is not saved yet. Finish it instead.';
  END IF;
  IF length(btrim(coalesce(_note, ''))) < 3 THEN RAISE EXCEPTION 'Write the correction.'; END IF;
  INSERT INTO public.routine_check_corrections (routine_control_id, corrected_by, note, is_demo)
  VALUES (_routine_id, _me, left(btrim(_note), 1000), coalesce(_r.is_demo, false))
  RETURNING id, corrected_at INTO _id, _at;
  RETURN jsonb_build_object('correction_id', _id, 'corrected_at', _at);
END $$;
REVOKE ALL ON FUNCTION public.add_routine_correction(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_routine_correction(uuid, text) TO authenticated;
