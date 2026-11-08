-- Undo for 01_direct_bookings.sql. Run 02_undo first.
-- Removes the new functions, trigger, table and columns. Existing lead rows keep
-- every value they had before 01; values written only into the new columns are lost.
DROP TRIGGER IF EXISTS direct_booking_alert_new_trg ON public.leads;
DROP FUNCTION IF EXISTS public.direct_booking_alert_new();
DROP FUNCTION IF EXISTS public.direct_booking_daily_summary(timestamptz);
DROP FUNCTION IF EXISTS public.mark_direct_booking_outcome(uuid, text, uuid, date, text, text);
DROP FUNCTION IF EXISTS public.record_direct_booking_follow_up(uuid);
DROP FUNCTION IF EXISTS public.record_direct_booking_reply(uuid, text);
DROP FUNCTION IF EXISTS public.decide_direct_booking_approval(uuid, text, text);
DROP FUNCTION IF EXISTS public.escalate_direct_booking_approvals();
DROP FUNCTION IF EXISTS public.request_direct_booking_approval(uuid, jsonb, uuid[]);
DROP FUNCTION IF EXISTS public.start_direct_booking(uuid);
DROP FUNCTION IF EXISTS public.create_direct_booking(jsonb);
DROP FUNCTION IF EXISTS public.direct_booking_on_shift(timestamptz);
DROP FUNCTION IF EXISTS public.direct_booking_notify(uuid[], text, text, text, uuid);
DROP FUNCTION IF EXISTS public.save_direct_booking_settings(jsonb);
DROP FUNCTION IF EXISTS public.direct_booking_approval_required(timestamptz);
DROP FUNCTION IF EXISTS public.direct_booking_settings();
DROP FUNCTION IF EXISTS public.functional_role_holders(text);
DROP FUNCTION IF EXISTS public.holds_functional_role(uuid, text);
DROP TABLE IF EXISTS public.direct_booking_approvals;
DROP INDEX IF EXISTS public.leads_direct_booking_open_idx;
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_kind_check,
  DROP CONSTRAINT IF EXISTS leads_reply_via_check,
  DROP CONSTRAINT IF EXISTS leads_db_outcome_check,
  DROP CONSTRAINT IF EXISTS leads_not_booked_reason_check,
  DROP COLUMN IF EXISTS kind, DROP COLUMN IF EXISTS subject, DROP COLUMN IF EXISTS partner_name,
  DROP COLUMN IF EXISTS min_bathrooms, DROP COLUMN IF EXISTS owned_by, DROP COLUMN IF EXISTS started_at,
  DROP COLUMN IF EXISTS reply_to, DROP COLUMN IF EXISTS reply_cc, DROP COLUMN IF EXISTS reply_subject,
  DROP COLUMN IF EXISTS reply_body, DROP COLUMN IF EXISTS offered_property_ids, DROP COLUMN IF EXISTS reply_sent_at,
  DROP COLUMN IF EXISTS reply_sent_by, DROP COLUMN IF EXISTS reply_sent_via, DROP COLUMN IF EXISTS last_follow_up_at,
  DROP COLUMN IF EXISTS outcome, DROP COLUMN IF EXISTS outcome_at, DROP COLUMN IF EXISTS outcome_by,
  DROP COLUMN IF EXISTS booked_property_id, DROP COLUMN IF EXISTS booked_move_in,
  DROP COLUMN IF EXISTS not_booked_reason, DROP COLUMN IF EXISTS not_booked_note;
