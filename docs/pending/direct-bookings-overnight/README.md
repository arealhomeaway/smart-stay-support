# Direct Bookings overnight: wait in the Team Queue for the morning

Emily's decision, Nov 8, 2026. Reverses the overnight alert built in routing tweaks part 2
(migration 0280). Register D2 and K2 updated the same day.

## The rule

1. A new Direct Booking request that arrives inside the saved after hours window
   (coverage_config, today 10 PM to 8 AM Central) alerts nobody: not the person on call, not
   the Operations Supervisor, not the Director of Operations. On call stays for new tickets only.
2. It waits, unowned, at the top of the Team Queue as Right now for Team A.
3. When the window ends (8:00 AM), the existing 20 second job alerts the people a new request
   would alert at that moment under the normal rule: every Team A coordinator on shift, else
   the coordinators working on any team, else the Operations Supervisor and the Director of
   Operations. Once per request. Needs you now shows it to everyone eligible; the first to press
   Start owns it.
4. Default, not a stated decision: the 3 minute clock for an overnight request starts at 8:00 AM
   (or when someone pressed Start, if earlier). The request still shows its real arrival time.
5. Daytime is unchanged.

## File

| File | How | What |
|---|---|---|
| `01_overnight_queue.sql` | migration | Adds `leads.overnight_until` and `leads.morning_alerted_at` (nullable). Adds `direct_booking_overnight_until`, `direct_booking_hold_overnight` (BEFORE INSERT trigger `direct_booking_hold_overnight_trg` on leads) and `release_overnight_direct_bookings`. Replaces `direct_booking_on_shift`. Re-saves the cron job `direct-booking-approval-escalation` with the same name and 20 second cadence, running the unchanged Director check first and the morning check second. |
| `01_undo_overnight_queue.sql` | migration | Puts back the job command, `direct_booking_on_shift` exactly as `live-capture/`, drops the three new functions and the trigger. The two columns stay (marked no longer used) so no saved request loses data. |

## Before and after

- `public.direct_booking_on_shift` (function). Before: daytime tiers; overnight with nobody
  working, the Supervisor, the Director and the person on call. After: daytime tiers exactly the
  same; inside the after hours window, nobody. The on call branch is removed (it only ever
  applied overnight). Same signature, security, search path and grants.
- Cron job `direct-booking-approval-escalation`. Before: `SELECT public.escalate_direct_booking_approvals()`
  every 20 seconds. After: the same call, then `SELECT public.release_overnight_direct_bookings();`,
  every 20 seconds. No extra wake-ups. The morning check never raises, so it cannot stop the
  Director check.
- Table `public.leads`: two new nullable columns and one new BEFORE INSERT trigger. The existing
  AFTER INSERT trigger `direct_booking_alert_new_trg` and its function are not changed; it simply
  finds nobody overnight.

Not changed: `direct_booking_alert_new` and its wording, `direct_booking_notify`,
`direct_booking_eligible_now`, `start_direct_booking`, `escalate_direct_booking_approvals`,
`auto_assign_ticket`, `coordinator_for`, `coordinators_on_shift`, `oncall_user_for_night`, every
other trigger and job.

## Proof before applying

`src/lib/__tests__/direct-bookings-overnight-sql.test.ts` (isolated database, live captures,
live schedule) and `src/lib/__tests__/direct-bookings-overnight.test.ts` (clock, chip, Team Queue).

## Applied

See the end of this file once applied.
