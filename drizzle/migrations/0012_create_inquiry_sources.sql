CREATE TABLE public.inquiry_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_type text,
  corporate_housing_extra numeric,
  discount_percent numeric,
  referral_percent numeric,
  referral_fee numeric,
  referral_rule text,
  utilities_included boolean,
  application_fee numeric,
  cleaning_fee numeric,
  security_deposit numeric,
  pet_fee_per_pet numeric NOT NULL DEFAULT 250,
  pet_fee_notes text,
  pet_deposit_notes text,
  payment_details text,
  booking_documents text,
  pricing_flags text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE UNIQUE INDEX inquiry_sources_name_key ON public.inquiry_sources (lower(name));

GRANT SELECT, INSERT, UPDATE ON public.inquiry_sources TO authenticated;
GRANT ALL ON public.inquiry_sources TO service_role;

ALTER TABLE public.inquiry_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff read inquiry sources"
  ON public.inquiry_sources FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY "Internal staff add inquiry sources"
  ON public.inquiry_sources FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE POLICY "Internal staff edit inquiry sources"
  ON public.inquiry_sources FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid())) WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_inquiry_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER inquiry_sources_touch
  BEFORE UPDATE ON public.inquiry_sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_inquiry_source();

COMMENT ON COLUMN public.inquiry_sources.pet_fee_notes IS 'Reference text from the source sheet, including original formula text. Never executed.';
COMMENT ON COLUMN public.inquiry_sources.pricing_flags IS 'Adjustments whose calculation basis is unclear; surfaced to coordinators instead of being applied.';
