-- Undo for 03_home_eligible_now.sql: removes the yes or no question. Home goes back to
-- showing an unstarted request only to the people it alerted.
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.

DROP FUNCTION IF EXISTS public.direct_booking_eligible_now();
