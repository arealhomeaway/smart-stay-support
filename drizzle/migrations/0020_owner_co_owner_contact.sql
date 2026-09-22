ALTER TABLE public.property_owners
  ADD COLUMN IF NOT EXISTS co_owner_name text,
  ADD COLUMN IF NOT EXISTS co_owner_email text,
  ADD COLUMN IF NOT EXISTS co_owner_phone text;

COMMENT ON COLUMN public.property_owners.co_owner_name IS 'Second person on the home, recorded alongside the owner of record.';