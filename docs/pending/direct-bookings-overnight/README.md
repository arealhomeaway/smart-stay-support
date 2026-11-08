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

- Nov 8, 2026, approved by Emily. `sha256.txt` checked first (all OK); the live
  `direct_booking_on_shift` matched `live-capture/` exactly.
- APPLIED byte-for-byte as migration 0295 (`drizzle/migrations/0295_direct_booking_overnight_queue.sql`,
  identical to `01_overnight_queue.sql`).
- Read back: the four functions are security definer with grants to service_role only; leads has
  the new BEFORE INSERT trigger beside the unchanged alert and updated-at triggers; the job runs
  every 20 seconds with the new command, active, 9 runs in the first 3 minutes, all succeeded.
- These live rules are byte-identical before and after (md5 of their definitions):
  auto_assign_ticket, coordinator_for, coordinators_on_shift, oncall_user_for_night,
  direct_booking_alert_new, direct_booking_notify, direct_booking_eligible_now,
  start_direct_booking, escalate_direct_booking_approvals.
- Cancelled live check (nothing kept, checked afterwards):
  - A request inserted inside the window: 0 alerts, marked to wait.
  - Arrived 11 PM Sunday: would alert nobody, waits until Mon 8:00 AM, shows in the Team Queue, 0 alerts.
  - 7:59 AM: nothing released. 8:00 AM: released, one alert, to the Property Operations weekday
    coordinator; again at 8:00:20: nothing more. Eligible for Needs you now at 8:00: the same person.
  - Wednesday 2 PM: not held, alerts the Guest Experience evening coordinator (as before).
  - Sunday 9 AM: not held, alerts the Operations Supervisor and the Director of Operations (as before).
  - Afterwards: leads 1, Direct Booking requests 0, staff alerts 584, tickets 42, settings 11,
    after hours window 10 PM to 8 AM. Same as before.

## Change: the overnight reply clock starts at 9:00 AM (Emily, Nov 8, 2026)

Replaces the earlier default (clock from 8:00 AM, or from an earlier Start). Register D3 and K2.

- The clock is timed only in the app (no database rule times replies), so the only database
  step is data: `02_overnight_clock_setting.sql` adds `overnightClockStart: "09:00"` to the
  existing `direct_booking_settings` value, keeping every other key, with one history line.
  APPLIED Nov 8, 2026 through the database query tool (data, not a migration). Undo:
  `02_undo_overnight_clock_setting.sql` (removes the key; the app default is also 9:00 AM).
- The app reads the setting on the Direct Bookings list (chips and tiles), the request page
  (chip and time taken) and the Team Queue overnight group.
- Until the clock starts: the real arrival time and "Reply clock starts at 9:00 AM.", no red,
  no late count. A Start before 9:00 AM does not move the clock earlier. If the setting is ever
  earlier than the end of the overnight window, the clock starts when the window ends.
- Not changed: the 8:00 AM morning alert, who it goes to, the Team Queue group, daytime clocks.
- Out of date wording left as is (changing it needs a database change): migration 0295's
  header and the comment on `leads.overnight_until` still say the clock starts there.
- Cancelled live check (nothing kept): an 11 PM Sunday request saved overnight_until 8:00 AM
  Monday and 0 alerts; with the live setting it shows "Arrived overnight at 11:00 PM. Reply
  clock starts at 9:00 AM." at 11:30 PM, 8:00 AM and 8:45 AM (not late); "3 minutes left." at
  9:00 AM; red "Waiting 3 minutes. Reply now." at 9:03 AM. A Wednesday 2 PM request: no
  overnight mark, "Opened just now. 3 minutes left." at 2:00 PM, red at 2:03 PM. Afterwards
  leads 1, Direct Booking requests 0, alerts 584, tickets 42, settings 11, window 10 PM to 8 AM.
