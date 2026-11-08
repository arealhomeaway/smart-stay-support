# Direct Bookings fix: match the approved mockup and close the audit findings

Staged only. Nothing here is applied. Apply only with Emily's approval, in this order,
and check `sha256.txt` first (`sha256sum -c sha256.txt` from this folder).

| Order | File | Kind | What it does | Undo |
|---|---|---|---|---|
| 1 | `01_request_fields.sql` | migration | Adds nine optional fields on `leads`: as soon as possible, length of stay, preferred bedrooms, near this address, distance wanted, follow-up due time, partner approved (time, by, note). Backfills the follow-up time for quotes already sent. | `01_undo_request_fields.sql` (run after undo 2) |
| 2 | `02_guarded_actions.sql` | migration | Adds `direct_booking_active_owner_homes`, `direct_booking_cc_emails`, `mark_direct_booking_partner_approved`. Replaces five functions: the send for OK and the approval refuse Active Owner homes and force the Cc to the two roles; recording the reply and each follow-up store the next follow-up 48 hours later; not booked needs a reason from the list (the note rule stays). | `02_undo_guarded_actions.sql` restores the five from `live-capture/` byte for byte and drops the three new ones |
| 3 | `03_escalation_schedule.sql` | migration | Schedules the existing `escalate_direct_booking_approvals()` every 20 seconds inside the database, so the Director of Operations is alerted once after 2 minutes with no screen open. | `03_undo_escalation_schedule.sql` |
| 4 | `04_reply_template.sql` | data (one row) | Replaces the saved "Direct booking reply" template with the approved format. | `04_undo_reply_template.sql` restores the captured row |
| 5 | `05_discount_sources.sql` | data (one row) | Saves the three discounted referral source records by record id in the Direct Bookings settings. | `05_undo_discount_sources.sql` |

## What does not change
Who may start, send, approve or mark an outcome; the approval period (Nov 9 to Nov 23, 2026);
the 3 minute clock; the 2 minute wait; the rent maths; the order of homes; every alert text;
who is alerted for a new request and how it routes (that is the routing-by-time build).

## Before each part is applied
The app already works without these parts:
- Section 1's new fields show but are not saved until part 1 (the screen says so when saving).
- Follow-ups due use 48 hours after the quote (or the last follow-up) until part 1 stores the time.
- The Approved stage needs parts 1 and 2; until then "The partner approved it" says the step is still being set up.
- The Cc and the Active Owner refusal are already enforced by the server functions; part 2 repeats them in the database.
- The 5 percent discount already uses the three records; part 5 moves the list into the saved settings.
- The reply uses the saved template until part 4 replaces it.

## Proof
`src/lib/__tests__/direct-bookings-fix-sql.test.ts` loads today's functions from `live-capture/` and the
applied helpers from `drizzle/migrations/0262_direct_bookings.sql` into an isolated database, applies
parts 1 and 2, checks every rule, then runs both undo files and confirms the five functions are
identical to today's and everything added is gone. Part 3 cannot run there (no scheduler); its text is checked.
