-- Routing tweaks, part 3: who sees an unstarted Direct Booking on Home right now.
-- Staged only. Not applied until approved. Needs part 2 first.
-- Undo: 03_undo_home_eligible_now.sql
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.
--
-- Decision (Nov 8, 2026): Home shows an unstarted Direct Booking request to everyone who is
-- eligible for it right now under the routing rule, not only the people alerted when it
-- arrived, until someone presses Start. This adds one read only yes or no question for the
-- signed in person: would a new request alert me right now (direct_booking_on_shift(now())).
-- It reveals nothing about anyone else. Alerts, Start (first to press it owns it) and the
-- requests themselves are unchanged.

CREATE OR REPLACE FUNCTION public.direct_booking_eligible_now()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.direct_booking_on_shift(now()) u WHERE u = auth.uid())
$$;
REVOKE ALL ON FUNCTION public.direct_booking_eligible_now() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direct_booking_eligible_now() TO authenticated, service_role;
