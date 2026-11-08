-- Direct Bookings fix, part 3: the Director of Operations' 2 minute alert runs on the server.
-- Staged only. Not applied until approved. Undo: 03_undo_escalation_schedule.sql
-- No BEGIN/COMMIT. Needs the pg_cron extension (installed, version 1.6).
--
-- Every 20 seconds the database runs the existing escalate_direct_booking_approvals():
-- a quote still waiting for the Operations Supervisor after the 2 minute wait alerts
-- the Director of Operations once (escalated_at is set, so it never repeats).
-- It runs whether or not anyone has a screen open. The function itself is unchanged.
-- No web address, key or secret is involved; the job is plain SQL inside the database.

SELECT cron.schedule(
  'direct-booking-approval-escalation',
  '20 seconds',
  $$SELECT public.escalate_direct_booking_approvals()$$
);
