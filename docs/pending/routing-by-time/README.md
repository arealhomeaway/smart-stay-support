# Route new work by the time

APPLIED Nov 8, 2026 with Emily's written approval. See the note at the end.

Approved by Emily (Nov 8, 2026). Nothing in this folder has been run against the live
database. Apply only with explicit approval, in this order, after checking `sha256.txt`.

| Order | File | How to apply | Undo (reverse order) |
| --- | --- | --- | --- |
| 1 | `01_lunch_times.sql` | migration tool, byte for byte | `01_undo_lunch_times.sql` (last) |
| 2 | `02_lunch_notes.sql` | data tool (four rows of text) | `02_undo_lunch_notes.sql` |
| 3 | `03_coordinator_routing.sql` | migration tool, byte for byte | `03_undo_coordinator_routing.sql` (first) |

`live-capture/` holds the exact live definitions (Nov 8, 2026) of today's functions. The undo for
part 3 restores `auto_assign_ticket` and `direct_booking_on_shift` from them byte for byte; the
tests load the helper captures verbatim.

## The rule

- Team A = the three Guest Experience roles (`ge_day`, `ge_evening`, `ge_parttime`); Team B = the
  two Property Operations roles (`po_day`, `po_evening`). The ticket's team never changes; only the person.
- On shift = the saved schedule (`seat_eligible_now`): approved time off takes the person off,
  a cover puts the covering person on (`seat_holder_at`), the unavailable switch still applies.
  No clock in.
- Several on shift on the team: lightest open work (Right now 5, Today 3, Routine 1; Waiting,
  closed, archived and demo work do not count), ties to whoever was given work automatically
  longest ago, then a fixed order.
- Lunch: a person at lunch is skipped while another coordinator is on shift, same team first,
  then any coordinator on shift. If only people at lunch are working, they still get it.
- Nobody on the team on shift: the lightest coordinator on the other team. Weekends: the two
  Guest Experience roles have shifts, so they get everything.
- No coordinator working: on call overnight (10 p.m. to 8 a.m., today's pattern), then the
  Operations Supervisor (today's rule), else nobody.
- Director of Operations work types, other roles, tickets with no work type and work types
  waiting for an owner decision keep today's order exactly. Only their note wording changed.
- Direct Bookings: alert every Guest Experience coordinator on shift (skipping lunch while
  others are on shift); else the coordinators working on any team; if only people at lunch are
  working, they still get it; if no coordinator is working, the Operations Supervisor and the
  Director of Operations. First to press Start owns it (unchanged). Home shows the request in
  Needs you now for everyone alerted until Start, then only for the owner (app code, works once
  part 3 is applied; before that it alerts the same people as today).

## What each file changes

1. Adds optional `lunch_start_minute` and `lunch_end_minute` to `coverage_shifts` and fills them:
   Guest Experience day and weekend 13:00 to 14:00 Thursday to Monday; Guest Experience evening
   16:00 to 17:00 Saturday to Wednesday; Property Operations weekday day 13:00 to 14:00 Monday to
   Friday; Property Operations evening and weekend 15:00 to 16:00 Monday to Friday. Part time and
   the Operations Supervisor have none.
2. Rewrites the four saved lunch notes so they say cover takes all new work, not only urgent work.
3. New read only functions `coordinator_role_label`, `coordinator_team_label`,
   `coordinators_on_shift`, `coordinator_for`, `ticket_route_at`, `routing_dry_run`. Replaces
   the body of `auto_assign_ticket` (same trigger, same events; now one call to
   `ticket_route_at(now())`) and of `direct_booking_on_shift` (same signature; read by the
   unchanged `direct_booking_alert_new`). Server only execute rights on all routing functions.

Unchanged: `tickets_auto_assign` trigger, `seat_eligible_now`, `seat_holder_at`, `seat_on_duty`,
`seat_override_at`, `staff_assignable`, `oncall_user_for_night`, the on call pattern,
`functional_role_holders`, `direct_booking_alert_new`, `direct_booking_notify`, priorities,
clocks, SLAs, escalation and every work type to role link.

## Proof

- `src/lib/__tests__/routing-by-time-sql.test.ts`: isolated database with the live helpers and
  the live saved schedule; every rule, lunch, time off, cover, unavailable, weekend, other team,
  nobody working, Waiting not counted, the trigger, unchanged paths compared to today's function,
  Direct Booking alerts, plain notes, read only, rights, undo.
- Live dry run (Nov 8, 2026) inside one step cancelled at the end, nothing kept: parts 1 and 3
  installed (function bodies matched these files), then `routing_dry_run` for the six sample
  times. Results are in the build reply.

## Applied

- Nov 8, 2026: `sha256.txt` checked first (all files OK). APPLIED byte-for-byte as migrations
  0277 (`01_lunch_times.sql`) and 0278 (`03_coordinator_routing.sql`). Each migration file
  matches its staged file exactly. Then the routing tweaks folder (0279 to 0281). Part 2
  (`02_lunch_notes.sql`) was then run with the data tool as its four UPDATE statements: only
  the lunch note text on `ge_day`, `ge_evening`, `po_day` and `po_evening` changed.
  Undo order if ever needed: routing tweaks undo first, then 03, 02 (data tool), 01.
