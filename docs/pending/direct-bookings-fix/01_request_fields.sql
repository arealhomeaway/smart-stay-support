-- Direct Bookings fix, part 1: request fields, follow-up due time and the Approved stage.
-- Staged only. Not applied until approved. Undo: 01_undo_request_fields.sql
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.
-- Additive only: nine nullable columns on leads, one check, one index and a
-- backfill of the follow-up due time for replies already sent. Nothing existing changes.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS asap boolean,
  ADD COLUMN IF NOT EXISTS stay_length text,
  ADD COLUMN IF NOT EXISTS preferred_bedrooms integer,
  ADD COLUMN IF NOT EXISTS near_address text,
  ADD COLUMN IF NOT EXISTS distance_wanted text,
  ADD COLUMN IF NOT EXISTS follow_up_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS partner_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS partner_approved_by uuid,
  ADD COLUMN IF NOT EXISTS partner_approved_note text;

COMMENT ON COLUMN public.leads.asap IS 'Direct Bookings: the partner asked for as soon as possible.';
COMMENT ON COLUMN public.leads.stay_length IS 'Direct Bookings: length of stay as the partner wrote it, for example 3 months.';
COMMENT ON COLUMN public.leads.preferred_bedrooms IS 'Direct Bookings: preferred bedrooms. bedrooms stays the minimum.';
COMMENT ON COLUMN public.leads.near_address IS 'Direct Bookings: the residence address homes should be near.';
COMMENT ON COLUMN public.leads.distance_wanted IS 'Direct Bookings: the distance the partner asked for, as written.';
COMMENT ON COLUMN public.leads.follow_up_due_at IS 'Direct Bookings: when the next follow-up is due (48 hours after the quote or the last follow-up).';
COMMENT ON COLUMN public.leads.partner_approved_at IS 'Direct Bookings: when a coordinator confirmed the partner approved the quote.';

ALTER TABLE public.leads ADD CONSTRAINT leads_preferred_bedrooms_check
  CHECK (preferred_bedrooms IS NULL OR preferred_bedrooms BETWEEN 0 AND 12);

UPDATE public.leads
   SET follow_up_due_at = coalesce(last_follow_up_at, reply_sent_at) + interval '48 hours'
 WHERE kind = 'direct_booking' AND reply_sent_at IS NOT NULL AND follow_up_due_at IS NULL;

CREATE INDEX IF NOT EXISTS leads_direct_booking_follow_up_idx
  ON public.leads (follow_up_due_at)
  WHERE kind = 'direct_booking' AND outcome IS NULL AND follow_up_due_at IS NOT NULL;
