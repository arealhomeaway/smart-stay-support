ALTER TABLE public.onboarding_projects
  DROP CONSTRAINT IF EXISTS onboarding_projects_furnishing_check;

ALTER TABLE public.onboarding_projects
  ADD CONSTRAINT onboarding_projects_furnishing_check
  CHECK (furnishing_scope = ANY (ARRAY['full_furnishing'::text, 'owner_furnished'::text, 'no_furnishing'::text]));

ALTER TABLE public.onboarding_projects
  ADD COLUMN IF NOT EXISTS pool_location TEXT NOT NULL DEFAULT 'none';

ALTER TABLE public.onboarding_projects
  DROP CONSTRAINT IF EXISTS onboarding_projects_pool_location_check;

ALTER TABLE public.onboarding_projects
  ADD CONSTRAINT onboarding_projects_pool_location_check
  CHECK (pool_location = ANY (ARRAY['none'::text, 'neighborhood'::text, 'property'::text]));

COMMENT ON COLUMN public.onboarding_projects.pool_location IS
  'none | neighborhood (shared amenity, no service work) | property (pool or hot tub at the home). Existing rows read as property when the pool module is on.';