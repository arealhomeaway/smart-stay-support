-- Availability Finder v2: lead offers (staged Nov 5 2026; apply only with Emily's approval).
-- Adds the lead stay fields and the per-offer outcome columns the finder-to-lead
-- flow writes. No existing row is changed or deleted; every new column is nullable.
-- NOTE: contact_name becomes nullable so a finder-created lead can be saved before
-- any who-details are known. That is a DROP NOT NULL and will ask for confirmation
-- when applied.

ALTER TABLE public.leads ALTER COLUMN contact_name DROP NOT NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS search_region text,
  ADD COLUMN IF NOT EXISTS desired_check_out date,
  ADD COLUMN IF NOT EXISTS guests integer,
  ADD COLUMN IF NOT EXISTS dogs integer,
  ADD COLUMN IF NOT EXISTS cats integer,
  ADD COLUMN IF NOT EXISTS inquiry_source_id uuid REFERENCES public.inquiry_sources(id),
  ADD COLUMN IF NOT EXISTS next_follow_up_on date;

ALTER TABLE public.lead_properties
  ADD COLUMN IF NOT EXISTS quote_total numeric,
  ADD COLUMN IF NOT EXISTS quote_currency text,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS outcome_reason text,
  ADD COLUMN IF NOT EXISTS outcome_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS outcome_by uuid;

ALTER TABLE public.lead_properties
  ADD CONSTRAINT lead_properties_outcome_check
  CHECK (outcome IS NULL OR outcome IN ('waiting', 'declined', 'accepted'));

COMMENT ON COLUMN public.leads.contact_name IS 'Optional since Nov 2026: finder-created leads may have no who-details yet. Shows as "Not recorded yet" until filled in.';
COMMENT ON COLUMN public.leads.search_region IS 'The place typed into the Availability Finder search this lead came from.';
COMMENT ON COLUMN public.lead_properties.quote_total IS 'Quote total snapshot exactly as shown when the home was offered.';
COMMENT ON COLUMN public.lead_properties.outcome IS 'waiting, declined or accepted. NULL on rows that predate offers; read as waiting.';
