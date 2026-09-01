CREATE TABLE public.property_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'ownerrez',
  source_owner_id text NOT NULL,
  name text,
  email text,
  phone text,
  city text,
  state text,
  postal_code text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_owner_id)
);

GRANT SELECT ON public.property_owners TO authenticated;
GRANT ALL ON public.property_owners TO service_role;
ALTER TABLE public.property_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read owner records"
  ON public.property_owners FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER property_owners_updated_at
  BEFORE UPDATE ON public.property_owners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS owner_record_id uuid REFERENCES public.property_owners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ownerrez_owner_id text,
  ADD COLUMN IF NOT EXISTS primary_photo_url text,
  ADD COLUMN IF NOT EXISTS primary_photo_medium_url text,
  ADD COLUMN IF NOT EXISTS primary_photo_thumb_url text,
  ADD COLUMN IF NOT EXISTS primary_photo_source text,
  ADD COLUMN IF NOT EXISTS primary_photo_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS bedrooms integer,
  ADD COLUMN IF NOT EXISTS bathrooms numeric,
  ADD COLUMN IF NOT EXISTS max_guests integer,
  ADD COLUMN IF NOT EXISTS living_area_sqft integer,
  ADD COLUMN IF NOT EXISTS property_type text,
  ADD COLUMN IF NOT EXISTS check_in_time text,
  ADD COLUMN IF NOT EXISTS check_out_time text,
  ADD COLUMN IF NOT EXISTS time_zone text,
  ADD COLUMN IF NOT EXISTS listing_public_url text;

CREATE INDEX IF NOT EXISTS properties_owner_record_id_idx ON public.properties (owner_record_id);

CREATE TABLE public.property_field_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  value_source text NOT NULL,
  source_record_id text,
  as_of timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, field_key)
);

GRANT SELECT ON public.property_field_provenance TO authenticated;
GRANT ALL ON public.property_field_provenance TO service_role;
ALTER TABLE public.property_field_provenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read field provenance"
  ON public.property_field_provenance FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER property_field_provenance_updated_at
  BEFORE UPDATE ON public.property_field_provenance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS property_field_provenance_property_idx
  ON public.property_field_provenance (property_id);