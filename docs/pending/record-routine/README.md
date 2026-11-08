# Record routine work

APPLIED Nov 8, 2026 with Emily's written approval (see the note at the end),
in this order. The migration tool runs each file in one transaction, so none
has BEGIN/COMMIT lines.

## 1. `01_record_routine.sql` (schema, additive)

- Adds `routine_controls.answers` (jsonb, default `{}`) and
  `routine_controls.guest_feedback_id` (nullable, links a Guest review check to
  the synced OwnerRez review).
- Adds trigger `routine_controls_no_new_retired`: no new Cleaning Review rows.
  Checkout is already blocked by the existing trigger. Old rows stay.
- Adds `public.record_routine_check(_check jsonb)`, caller-authenticated (staff
  only), which in one step:
  - refuses retired checks, and Survey reviews while the switch is off;
  - checks the answers (Guest review: what we replied, where it was posted,
    repeat issue; found issue: what to fix and which team);
  - saves who, when, the home and the answers;
  - when an issue is found, opens a ticket in the chosen team's queue and links
    it both ways (`routine_controls.follow_up_ticket_id`, ticket history line).
    The ticket type comes from the existing work type catalog, which decides
    the team role, priority and clocks:
    - Work order review sent to Team B: "Maintenance and landscaping work-order review"
    - Guest or Survey review sent to Team A: "Guest review, survey and rating logs"
    - Anything else sent to Team A: "Current or past guest request"
    - Anything else sent to Team B: "Ongoing maintenance"
  - a second save of the same check returns the first result, so a double click
    never opens two tickets.

Undo: `01_undo_record_routine.sql` drops the function and the trigger. It keeps
the two columns on purpose so saved answers are never lost.

## 2. `02_survey_switch.sql` (one settings row)

Adds the switch `survey_review_check`, off. It then shows in Admin, Workflow
controls. While the row is missing the panel treats the switch as off.

Undo: `02_undo_survey_switch.sql` removes the row while it is still off.

## 3. `03_close_legacy_rows.sql` (data change)

Closes the 7 stale legacy routine rows (2 Checkout, 3 Cleaning Review, 2 Guest
Review, created Sep 4 to Nov 3 2026, never worked): status `cancelled`, note
"Closed: legacy test row". It stops and changes nothing unless all 7 are still
open with no notes. No row is deleted.

Undo: `03_undo_close_legacy_rows.sql` puts each row back (six "due", one "in_progress", no notes).

## Before this is applied

The panel works today. Checks save the way routine checks save now, under the
person's own access, with the answers written as plain notes. When an issue is
found the usual ticket form opens next, already linked to the check.

## Tests

`src/lib/__tests__/record-routine-sql.test.ts` runs every file and undo here in
an isolated PostgreSQL (PGlite). Checksums are in `sha256.txt`.

## Applied

- Nov 8, 2026: APPLIED byte-for-byte as migrations 0265 (`01_record_routine.sql`), 0266 (`02_survey_switch.sql`) and 0267 (`03_close_legacy_rows.sql`). Exactly the 7 legacy rows were closed. Undo order if ever needed: 03, 02, 01.
