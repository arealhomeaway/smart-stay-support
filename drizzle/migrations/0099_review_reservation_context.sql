ALTER TABLE public.guest_feedback
  ADD COLUMN IF NOT EXISTS reviewer_display_name text,
  ADD COLUMN IF NOT EXISTS reservation_guest_name text,
  ADD COLUMN IF NOT EXISTS reservation_guest_first_name text,
  ADD COLUMN IF NOT EXISTS reservation_guest_last_name text,
  ADD COLUMN IF NOT EXISTS reservation_confirmation text,
  ADD COLUMN IF NOT EXISTS reservation_enriched_at timestamptz;
UPDATE public.guest_feedback SET reviewer_display_name = guest_name
  WHERE feedback_type = 'external_review' AND reviewer_display_name IS NULL AND guest_name IS NOT NULL;
COMMENT ON COLUMN public.guest_feedback.reviewer_display_name IS 'Name/handle supplied by the review source; never the reservation guest.';
COMMENT ON COLUMN public.guest_feedback.reservation_guest_name IS 'Guest name from the matched OwnerRez reservation.';