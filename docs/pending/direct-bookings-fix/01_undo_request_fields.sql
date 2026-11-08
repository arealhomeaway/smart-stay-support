-- Undo for 01_request_fields.sql. Apply only after 02_undo_guarded_actions.sql
-- (the new functions read these columns). No BEGIN/COMMIT.
-- Removes only what part 1 added. Values typed into these fields are lost.

DROP INDEX IF EXISTS public.leads_direct_booking_follow_up_idx;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_preferred_bedrooms_check;
ALTER TABLE public.leads
  DROP COLUMN IF EXISTS partner_approved_note,
  DROP COLUMN IF EXISTS partner_approved_by,
  DROP COLUMN IF EXISTS partner_approved_at,
  DROP COLUMN IF EXISTS follow_up_due_at,
  DROP COLUMN IF EXISTS distance_wanted,
  DROP COLUMN IF EXISTS near_address,
  DROP COLUMN IF EXISTS preferred_bedrooms,
  DROP COLUMN IF EXISTS stay_length,
  DROP COLUMN IF EXISTS asap;
