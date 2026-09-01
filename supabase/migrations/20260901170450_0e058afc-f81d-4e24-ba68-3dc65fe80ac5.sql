ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS listing_alias text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS tier text,
  ADD COLUMN IF NOT EXISTS min_stay_months integer,
  ADD COLUMN IF NOT EXISTS year_built integer,
  ADD COLUMN IF NOT EXISTS instant_book boolean,
  ADD COLUMN IF NOT EXISTS furniture_package text,
  ADD COLUMN IF NOT EXISTS legacy_handoff_date date,
  ADD COLUMN IF NOT EXISTS operating_notes text,
  ADD COLUMN IF NOT EXISTS facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS parking jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS access jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS utilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS hvac jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS systems jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fireplace jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS storm_shelter jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sprinklers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS grounds jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS waste jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pool_spa jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS hoa jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS amenities jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS security jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS warranty jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS compliance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS external_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS geocode_source text,
  ADD COLUMN IF NOT EXISTS geocode_address_fingerprint text,
  ADD COLUMN IF NOT EXISTS coords_overridden_by uuid,
  ADD COLUMN IF NOT EXISTS coords_overridden_at timestamptz,
  ADD COLUMN IF NOT EXISTS coords_override_reason text;

CREATE TABLE IF NOT EXISTS public.property_external_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text,
  url text NOT NULL,
  context text,
  staff_only boolean NOT NULL DEFAULT true,
  canonical boolean NOT NULL DEFAULT false,
  needs_replacement boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'notion_pid',
  source_field text,
  as_of timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, kind, url)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_external_links TO authenticated;
GRANT ALL ON public.property_external_links TO service_role;

ALTER TABLE public.property_external_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view property links"
  ON public.property_external_links FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Supervisors manage property links"
  ON public.property_external_links FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid()))
  WITH CHECK (public.is_supervisor(auth.uid()));

CREATE INDEX IF NOT EXISTS property_external_links_property_idx
  ON public.property_external_links (property_id, kind);

CREATE TRIGGER update_property_external_links_updated_at
  BEFORE UPDATE ON public.property_external_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();