-- Where each onboarding task sits in the eight operational stages, and how it
-- got there: the phase it came from, who owned it at the time, and every later
-- remapping. Append-only history, staff-only, written by a trigger so no write
-- path can move a task between stages without leaving a record.
ALTER TABLE public.onboarding_tasks ADD COLUMN IF NOT EXISTS legacy_stage text;

CREATE TABLE IF NOT EXISTS public.onboarding_task_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  property_id uuid,
  from_stage text,
  to_stage text NOT NULL,
  legacy_stage text,
  assigned_seat text,
  assigned_to uuid,
  changed_by uuid,
  reason text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_task_stage_history_task_idx
  ON public.onboarding_task_stage_history(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS onboarding_task_stage_history_property_idx
  ON public.onboarding_task_stage_history(property_id, created_at DESC);

GRANT SELECT ON public.onboarding_task_stage_history TO authenticated;
GRANT ALL ON public.onboarding_task_stage_history TO service_role;

ALTER TABLE public.onboarding_task_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read task stage history"
  ON public.onboarding_task_stage_history FOR SELECT
  TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.record_onboarding_task_stage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage IS NOT DISTINCT FROM OLD.stage THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.onboarding_task_stage_history(
    task_id, property_id, from_stage, to_stage, legacy_stage,
    assigned_seat, assigned_to, changed_by, reason, is_demo)
  VALUES (
    NEW.id, NEW.property_id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage ELSE NULL END,
    NEW.stage,
    coalesce(NEW.legacy_stage, CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage ELSE NULL END),
    NEW.assigned_seat, NEW.assigned_to, auth.uid(),
    CASE WHEN TG_OP = 'UPDATE' THEN 'Stage reassigned' ELSE 'Task created' END,
    coalesce(NEW.is_demo, false));
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS onboarding_task_stage_recorded ON public.onboarding_tasks;
CREATE TRIGGER onboarding_task_stage_recorded
  AFTER INSERT OR UPDATE OF stage ON public.onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.record_onboarding_task_stage();

COMMENT ON TABLE public.onboarding_task_stage_history IS
  'Append-only record of which operational stage each onboarding task sits in, its prior phase, its owner at the time, and every remapping.';