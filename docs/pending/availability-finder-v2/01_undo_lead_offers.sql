-- Undo for 01_lead_offers.sql. Removes the v2 lead and offer columns and
-- restores the contact_name requirement. Any finder-created lead with no
-- contact name is first given the placeholder "Not recorded" so the restore
-- cannot fail; review those rows before running this.

UPDATE public.leads SET contact_name = 'Not recorded' WHERE contact_name IS NULL;

ALTER TABLE public.leads ALTER COLUMN contact_name SET NOT NULL;

ALTER TABLE public.leads
  DROP COLUMN IF EXISTS search_region,
  DROP COLUMN IF EXISTS desired_check_out,
  DROP COLUMN IF EXISTS guests,
  DROP COLUMN IF EXISTS dogs,
  DROP COLUMN IF EXISTS cats,
  DROP COLUMN IF EXISTS inquiry_source_id,
  DROP COLUMN IF EXISTS next_follow_up_on;

ALTER TABLE public.lead_properties
  DROP CONSTRAINT IF EXISTS lead_properties_outcome_check;

ALTER TABLE public.lead_properties
  DROP COLUMN IF EXISTS quote_total,
  DROP COLUMN IF EXISTS quote_currency,
  DROP COLUMN IF EXISTS outcome,
  DROP COLUMN IF EXISTS outcome_reason,
  DROP COLUMN IF EXISTS outcome_at,
  DROP COLUMN IF EXISTS outcome_by;
