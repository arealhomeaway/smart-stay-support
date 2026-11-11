# Build 15: Kati's three onboarding tickets (help tickets 65, 66, 67)

Nothing here was published. Nothing was written to Breezeway or sent to a homeowner.

## Applied (Nov 10, after the isolated database test passed)
- `01_kati_tickets.sql` = `drizzle/migrations/0329_kati_tickets_bulk_complete_breezeway.sql` (byte for byte).
  Adds `bulk_complete_onboarding_tasks` (one shared note or one file, optional Done before Resolve date,
  all or nothing, a dry run preview, per task audit_log row and file links), the Breezeway section tables
  `onboarding_task_breezeway_links` and add only `onboarding_task_breezeway_events`, the save function
  `save_onboarding_task_breezeway` (Work order tasks only), and the switch `onboarding_breezeway_send` OFF.
- `01b_review_blocker_fix.sql` = `drizzle/migrations/0330_kati_bulk_complete_review_blocker_fix.sql`.
  The real database practice found that bulk complete called a review check signed in teammates may not
  call. A staff only wrapper `private.onboarding_bulk_review_blocker` now answers it; nothing else changed.

## Staged only (needs Emily's approval)
- `02_standard_plan_v5.sql`: Standard plan version 5. Replaces "Share the mood boards and floor plans with the
  owner" with two Lead Designer steps needing owner approval ("Share the mood boards with the owner", "Share the
  floor plans with the owner"). Every other step is identical. Homes already started (624 Daniel Court included)
  are untouched. Refuses to run if version 4 or the old step changed since Nov 10.

## Undo
- `undo/01b_undo.sql` then `undo/01_undo.sql` remove the applied additions. Completed tasks and their history stay.
- `undo/02_undo.sql` removes version 5 if it is ever applied.

## Practice (real database, cancelled, nothing kept)
- `practice_kati_tickets.sql`: as the Director of Onboarding on 624 Daniel Court, a dry run showed 5 ready and the
  mood boards task held ("Needs the homeowner's approval first"); a 4 character note was refused; 5 tasks completed
  with one note and Done before Resolve Nov 2 (each saved who, the Nov 2 date and the note; 5 audit rows); the
  mood boards owner review went to the homeowner as pending; an added Lead Designer task saved; the Breezeway
  section saved Leave unassigned, then a person and a pasted link that matched a mirrored work order; a non Work
  order task was refused; the send switch read OFF. A read afterwards found every row back as before.
- `practice_02_plan_v5.sql`: version 5 published with 145 steps (version 4 has 144), the two new steps on the Lead
  Designer role with owner approval, the old step absent, the other 143 steps identical, 624 Daniel Court still on
  its own version. A read afterwards found the plan back on version 4 and the old step active.
