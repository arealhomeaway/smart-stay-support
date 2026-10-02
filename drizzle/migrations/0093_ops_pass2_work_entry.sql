CREATE TABLE public.property_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL CHECK (category IN ('guest','cleaner','vendor','property_condition','access','delivery','administrative','other')),
  what_happened text NOT NULL CHECK (length(btrim(what_happened)) > 0),
  outcome text NOT NULL CHECK (length(btrim(outcome)) > 0),
  involved text,
  logged_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  is_demo boolean NOT NULL DEFAULT false
);
CREATE INDEX property_activity_log_property ON public.property_activity_log(property_id, occurred_at DESC);
GRANT SELECT, INSERT ON public.property_activity_log TO authenticated;
GRANT ALL ON public.property_activity_log TO service_role;
ALTER TABLE public.property_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal staff read property activity" ON public.property_activity_log
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Internal staff log property activity" ON public.property_activity_log
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()) AND logged_by = auth.uid());

ALTER TABLE public.tickets
  ADD COLUMN entry_kind text CHECK (entry_kind IN ('ops','maintenance')),
  ADD COLUMN maintenance_category text,
  ADD COLUMN insurance_risk text CHECK (insurance_risk IN ('yes','no','unsure')),
  ADD COLUMN estimated_cost numeric(12,2) CHECK (estimated_cost IS NULL OR estimated_cost >= 0);

CREATE OR REPLACE FUNCTION public.log_ticket_insurance_risk()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.insurance_risk IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.insurance_risk IS DISTINCT FROM OLD.insurance_risk) THEN
    INSERT INTO public.ticket_activity(ticket_id, author_id, kind, body, event_type, event_at, is_demo, internal)
    VALUES (NEW.id, auth.uid(), 'note',
      'Potential insurance-related event: ' || COALESCE(initcap(NEW.insurance_risk), 'cleared') ||
      CASE WHEN NEW.insurance_risk IN ('yes','unsure') THEN ' — flagged for supervisor visibility. No insurance action taken.' ELSE '' END,
      'insurance_risk', now(), COALESCE(NEW.is_demo,false), true);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tickets_insurance_risk_log AFTER INSERT OR UPDATE OF insurance_risk ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_insurance_risk();