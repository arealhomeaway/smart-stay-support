-- Practice on the real database, run as ONE transaction ended with ROLLBACK on purpose.
-- Fake booking numbers only (practice-*), the 9211 Fitzgerald Dr. home, nothing kept.
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id::text FROM public.user_roles WHERE role = 'admin' LIMIT 1), 'role', 'authenticated')::text, true);
-- 1. The switch cannot be moved directly.
-- 2. Turn on through the switch (start line = now), then store three fake bookings seen by the sync.
-- 3. Run at 6:00 AM Central of a day after the start line: one check, one cancelled skip, one block skip.
-- 4. Complete the check on time with an issue: ticket closed, issue ticket made, one fact.
-- 5. Make a second check, run past its deadline less 30 minutes: one alert; past check in: missed.
-- The exact statements are in the README run log; the transaction ends:
ROLLBACK;
