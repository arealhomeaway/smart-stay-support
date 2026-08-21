ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS market text;

CREATE TABLE IF NOT EXISTS public.cleaning_regions (
  market text PRIMARY KEY,
  manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  manager_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cleaning_regions TO authenticated;
GRANT ALL ON public.cleaning_regions TO service_role;
ALTER TABLE public.cleaning_regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cleaning_regions_select" ON public.cleaning_regions FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "cleaning_regions_write" ON public.cleaning_regions FOR ALL TO authenticated
  USING (private.is_supervisor(auth.uid())) WITH CHECK (private.is_supervisor(auth.uid()));

CREATE TRIGGER cleaning_regions_updated BEFORE UPDATE ON public.cleaning_regions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- First inspection is scheduled 30 days after a property is handed off to operations.
CREATE OR REPLACE FUNCTION public.schedule_first_quarterly_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.handoff_accepted_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.handoff_accepted_at IS DISTINCT FROM NEW.handoff_accepted_at)
     AND NEW.last_quarterly_review_at IS NULL THEN
    NEW.quarterly_review_due_on := (NEW.handoff_accepted_at + interval '30 days')::date;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_first_quarterly_review() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS properties_first_quarterly_review ON public.properties;
CREATE TRIGGER properties_first_quarterly_review
  BEFORE INSERT OR UPDATE OF handoff_accepted_at ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.schedule_first_quarterly_review();

-- Subsequent inspections roll exactly 90 days from completion.
CREATE OR REPLACE FUNCTION public.roll_quarterly_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  wt_name text;
BEGIN
  IF NEW.property_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('resolved','closed') THEN RETURN NEW; END IF;
  IF OLD.status IN ('resolved','closed') THEN RETURN NEW; END IF;

  SELECT name INTO wt_name FROM public.work_types WHERE id = NEW.work_type_id;
  IF wt_name IS DISTINCT FROM 'Quarterly inspection review' THEN RETURN NEW; END IF;

  UPDATE public.properties
     SET last_quarterly_review_at = now(),
         quarterly_review_due_on = (current_date + interval '90 days')::date
   WHERE id = NEW.property_id;

  RETURN NEW;
END;
$$;