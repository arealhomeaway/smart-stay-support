
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
         quarterly_review_due_on = (current_date + interval '3 months')::date
   WHERE id = NEW.property_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tickets_roll_quarterly_review ON public.tickets;
CREATE TRIGGER tickets_roll_quarterly_review
AFTER UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.roll_quarterly_review();
