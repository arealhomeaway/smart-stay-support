-- Undo for 01_home_my_shift.sql. Roll the app code back first.
-- Restores run_ticket_timed_alerts exactly as captured live (live-capture/), puts
-- the alert kinds back, removes the five new functions and the two new tables.
-- Handoffs created by End my shift stay: they are ordinary handoffs and keep
-- their Accept and Decline. The 15 minute alert lines already sent stay too.

DROP FUNCTION IF EXISTS public.decide_time_off(uuid, text, text);
DROP FUNCTION IF EXISTS public.request_time_off(date, date, text, boolean);
DROP FUNCTION IF EXISTS public.end_my_shift(text, timestamptz, jsonb, boolean, boolean);
DROP FUNCTION IF EXISTS public.shift_handoff_defaults(timestamptz);

-- Paste live-capture/public.run_ticket_timed_alerts.sql here, unchanged, then:
\ir live-capture/public.run_ticket_timed_alerts.sql

DELETE FROM public.ticket_timed_alerts WHERE kind IN ('handoff_receiver', 'handoff_supervisor');
ALTER TABLE public.ticket_timed_alerts DROP CONSTRAINT ticket_timed_alerts_kind_check;
ALTER TABLE public.ticket_timed_alerts ADD CONSTRAINT ticket_timed_alerts_kind_check
  CHECK (kind = ANY (ARRAY['team_queue_supervisor'::text, 'team_queue_director'::text, 'waiting_return'::text]));

DROP TABLE IF EXISTS public.time_off_requests;
DROP TABLE IF EXISTS public.shift_end_records;
