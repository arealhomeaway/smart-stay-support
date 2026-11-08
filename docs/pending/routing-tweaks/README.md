# Routing tweaks

APPLIED Nov 8, 2026 with Emily's written approval. See the note at the end.

Approved by Emily (Nov 8, 2026), answering the open routing questions. Apply only with explicit
approval, after `docs/pending/routing-by-time/01_lunch_times.sql` and `03_coordinator_routing.sql`,
in the order below, and check `sha256.txt` first.

| Order | File | How to apply | Undo (reverse order) |
| --- | --- | --- | --- |
| 1 | `01_quiet_imports_load.sql` | migration tool, byte for byte | `01_undo_quiet_imports_load.sql` (last) |
| 2 | `02_direct_booking_on_call.sql` | migration tool, byte for byte | `02_undo_direct_booking_on_call.sql` |
| 3 | `03_home_eligible_now.sql` | migration tool, byte for byte | `03_undo_home_eligible_now.sql` (first) |

## What each file changes

1. **Quiet imports never count towards load.** `coordinators_on_shift` gains one condition: a
   Notion import that has not been taken or reopened (`external_status` is not
   `reopened_in_resolve`), assigned or not, adds nothing to anyone's open work. Everything else
   in the function is routing-by-time part 3 word for word.
2. **Overnight Direct Bookings alert the person on call.** `direct_booking_on_shift`: when no
   coordinator is working and the moment is inside the saved after hours window (today 10 p.m.
   to 8 a.m.), the person on call tonight (`oncall_user_for_night`, a dated entry wins) is
   alerted with the Operations Supervisor and the Director of Operations. Daytime is unchanged.
3. **Home shows an unstarted request to everyone eligible right now.** New read only
   `direct_booking_eligible_now()` (signed in people only): yes when a new request would alert
   the signed in person right now. Home then lists every unstarted request for them, as well as
   the ones that alerted them, until someone presses Start (app code, `homeStartIds`). Before
   this file is applied Home shows only the alerted people, as today.

Unchanged: the alert trigger and its text, `direct_booking_notify`, Start (first to press it
owns it), ticket routing order, the Director of Operations and no work type paths and their plain
wording, priorities, clocks, SLAs and every work type to role link.

Each undo restores the routing-by-time part 3 definition word for word (the tests compare them).

## Proof

`src/lib/__tests__/routing-tweaks-sql.test.ts` loads today's live helpers, routing-by-time parts 1
and 3, then these three files into an isolated database: import load, overnight alerts with the
weekday pattern and a dated entry, no one on call, daytime unchanged, ticket routing overnight
unchanged, the Home question for eligible and other people, rights, and every undo.

## Applied

- Nov 8, 2026: `sha256.txt` checked first (all files OK). APPLIED byte-for-byte, after
  routing-by-time 0277 and 0278, as migrations 0279 (`01_quiet_imports_load.sql`), 0280
  (`02_direct_booking_on_call.sql`) and 0281 (`03_home_eligible_now.sql`). Each migration file
  matches its staged file exactly.
  Undo order if ever needed: 03, 02, 01, then the routing-by-time undo.
