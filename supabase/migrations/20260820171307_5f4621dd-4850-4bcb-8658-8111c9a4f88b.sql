ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS ownerrez_property_id text,
  ADD COLUMN IF NOT EXISTS ownerrez_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS properties_ownerrez_property_id_key
  ON public.properties (ownerrez_property_id)
  WHERE ownerrez_property_id IS NOT NULL;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS ownerrez_booking_id text;