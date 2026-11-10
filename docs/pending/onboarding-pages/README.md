# Onboarding pages (Build 11)

Status: APPLIED on Nov 10 as `drizzle/migrations/0324_onboarding_pages_fields.sql`
(byte-for-byte the same as `01_onboarding_project_fields.sql`), after one isolated
PostgreSQL test file and one cancelled practice run on live data that rolled back.

## What it adds (additive only)
- Optional Notion fields on `onboarding_projects`: Owner Type, Status (Notion's 12),
  Greater Area, Weekly status, PMA Status, Invoice Status, Designer, Staging Team.
- Committed Handoff Date: `committed_handoff_on` with who/when. Set once by the Project
  Manager, Director of Onboarding or Admin, then locked by a trigger. Only the Operations
  Supervisor or Admin corrects it, with a reason, through `correct_committed_handoff_date`;
  every set and correction is a `onboarding_project_events` row.
- `save_onboarding_project_details`: one caller-authenticated save for those fields.
- Six Design folder categories for documents.
- `run_handoff_reminders` reads the Committed Handoff Date first, then the estimate.
  The function body before this change is kept in `before_run_handoff_reminders.sql`.

Nothing is backfilled. No existing row is changed.

## Undo
Run `undo/01_onboarding_project_fields.sql`. It restores the previous
`run_handoff_reminders`, drops the two new functions and the lock trigger, and drops the
new columns last (which removes any values saved in them), and restores the old document
category list. Files filed under a Design folder must be moved to another folder first, or
the old category list refuses them. Run only with approval.

## Practice
`practice_01_onboarding_project_fields.sql` ran inside one transaction that raised at the
end on purpose, so nothing was kept. Results: second set refused, Project Manager
correction refused, four history rows, Design folder save accepted.
