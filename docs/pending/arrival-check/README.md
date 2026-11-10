# Arrival check queue and Arrival readiness (Build 12, Emily Nov 10; register BN4, BN10)

Spec: `docs/specs/arrival-check.md`.

Status: APPLIED after checks as migration 0325 (byte for byte `01_arrival_check.sql`). The switch
`arrival_checks` is OFF and no start line is set. The minute check `arrival-checks` runs every
minute and, while the switch is off, only looks after test checks. No real check, ticket, alert or
fact exists. Nothing was published.

## What 01 adds (additive only)

- `scorecard_records` accepts the new fact kind `arrival_check` (every existing kind stays).
- `arrival_reservations`: what the existing hourly OwnerRez sync already fetched, guest first name
  only, one row per booking, with the one decision made for it (made, skipped with reason, failed).
- `arrival_checks`: one check per reservation; written only by the steps below (guard trigger);
  never deleted. Read: Admin, Directors, the Operations Supervisor and Finance see every real row;
  a coordinator sees only checks they completed or own; test rows only for the test plan leaders.
- `arrival_check_state`: when the minute check last ran and when arrivals were last stored.
- Work type `Arrival check` (not active, so it never shows in the Record work problem list).
- Switch `arrival_checks` (off) and `set_arrival_checks` (Admin only; on moves the forward only
  start line; who and when recorded; guard triggers refuse any other change).
- `arrival_ingest_bookings` (service only), `run_arrival_checks` (the minute check):
  at 6:00 AM Central on the arrival date, one check and one ordinary ticket (no owner, From
  OwnerRez, Team B, Today, normal 30 and 60 minute clocks, due at the deadline) for each arrival on
  a verified Resolve home at least 2 hours after the start line; check in from the reservation,
  then the home, then 4:00 PM, in the home's zone (Central when not set); deadline 2 hours before
  check in. Skipped with a reason: cancelled, a block that is not an owner stay, not a Resolve
  home, not a verified home, New House home, an extension of the stay before it, before the start
  line. Booked less than 2 hours before check in: made at once, marked late booking, never counted.
  One alert to the Operations Supervisor role holder 30 minutes before the deadline. Not done by
  check in: missed (ticket stays open). A cancelled reservation closes its open check, uncounted.
- `complete_arrival_check` (operations team): takes an unowned check, needs the lock answer (and a
  note when not connected), the work orders reviewed and ready or issue with the backup plan; makes
  one ordinary issue ticket for an issue; closes the check ticket; records the result and one fact.
- `arrival_check_for_ticket`, `arrival_checks_status` (Admin), `make_test_arrival_check` and
  `clear_test_arrival_checks` (Admin; test home 9211 Fitzgerald Dr.; demo tickets with no home link).
- Two triggers keep arrival check tickets out of homeowner notices and Active Owner Opportunities
  (the existing notice and Opportunity steps are unchanged; an issue ticket stays ordinary work).

## Practice

- Isolated copy: `src/lib/__tests__/arrival-check-sql.test.ts` (18 checks, including undo).
- Real database, Nov 10, after applying, one transaction ended with an error on purpose
  (`practice_01_arrival_check.sql`): direct switch change refused; 5:59 AM nothing, 6:00 AM one
  check, 6:01 AM nothing; cancelled and block skipped with reasons; check in 4:00 PM Eastern,
  deadline 2:00 PM Eastern; ticket unowned, Today, due at the deadline; completed with an issue:
  on time, ticket closed, one issue ticket, one fact; second check: one alert at 30 minutes before
  ("Arrival check due at 2:00 PM at 9211 Fitzgerald Dr, not done yet"), missed at check in against
  the Supervisor's team; no homeowner rows. Nothing was kept (re-read afterwards: 0 rows).
- Preview, Nov 10: one test check made on the test home, completed on a phone, seen in Databases
  (marked Test, not counted), then cleared. Kept on purpose as hidden test history: 1 cleared test
  check, its 2 archived demo tickets and 1 uncounted demo fact.

## Undo

`undo/01_arrival_check.sql` stops the minute check, removes the steps and triggers and turns the
switch off. Tables, kept records and facts stay, so history still reads back.

## 02 fixes (applied Nov 10 as drizzle/migrations/0326_arrival_check_fixes.sql, byte identical)

Found on the spec re-read and Emily's Nov 10 correction E (docs/specs/bonus-guide-values.md):
1. Ticket text and the Supervisor alert show times in Central time (spec item 2).
2. Completing an unowned check takes it the same way Take it does (owner, record owner, accountable owner).
3. An issue found opens a ticket owned by the person who found it: Right now when the guest arrives within
   2 hours, otherwise Today.
4. Homes ready for guests is one shared team score: every fact carries counts_for team_homes_ready and
   individual_score false; who completed it is still recorded. A check nobody took also counts against the
   Operations Supervisor's team on time follow through.
Undo: run undo/02_arrival_check_fixes.sql (puts back the 01 functions), then undo/01_arrival_check.sql if a full undo is wanted.
Practice (cancelled on purpose, Nov 10): Central 1:00 PM deadline text and alert, issue ticket Today and owned by
the finder, team score fields, owner rows 0. Follow up read: 0 practice rows, switch off, no start line.
