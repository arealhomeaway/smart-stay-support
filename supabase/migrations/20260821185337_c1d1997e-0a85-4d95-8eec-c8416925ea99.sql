-- Territory (ZIP) based vendor coverage
CREATE TABLE public.vendor_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.vendor_orgs(id) ON DELETE CASCADE,
  service_category text NOT NULL,
  postal_code text NOT NULL,
  territory_label text,
  coverage_priority text NOT NULL DEFAULT 'primary',
  travel_note text,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, service_category, postal_code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_service_areas TO authenticated;
GRANT ALL ON public.vendor_service_areas TO service_role;
ALTER TABLE public.vendor_service_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_areas_read" ON public.vendor_service_areas
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_vendor_member(auth.uid(), org_id));

CREATE POLICY "service_areas_write" ON public.vendor_service_areas
  FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()))
  WITH CHECK (public.is_supervisor(auth.uid()));

CREATE INDEX vendor_service_areas_zip_idx ON public.vendor_service_areas (postal_code, service_category);

CREATE TRIGGER vendor_service_areas_updated
  BEFORE UPDATE ON public.vendor_service_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- A property-level coverage row can say "this vendor is excluded here", which
-- always beats whatever the territory says.
ALTER TABLE public.property_vendor_coverage
  ADD COLUMN IF NOT EXISTS excluded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclusion_reason text;

-- Identity documents are verified, then discarded. Record HOW it was checked,
-- never the document itself.
ALTER TABLE public.vendor_gatekeeper_results
  ADD COLUMN IF NOT EXISTS verification_method text;

CREATE OR REPLACE FUNCTION public.block_identity_document_retention()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.doc_type IN ('identity', 'identity_document', 'drivers_license', 'passport', 'ssn_card')
     AND (NEW.storage_path IS NOT NULL OR NEW.external_url IS NOT NULL) THEN
    RAISE EXCEPTION 'Identity documents are verified and discarded. Record the verification, not the image.';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER vendor_documents_no_identity_retention
  BEFORE INSERT OR UPDATE ON public.vendor_documents
  FOR EACH ROW EXECUTE FUNCTION public.block_identity_document_retention();