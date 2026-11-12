# Plan catch-up: update many Tasks at once (staged Nov 12, NOT applied)

Approved by the Admin, Nov 12. Property page, Onboarding view, Plan tab.
Nothing here has been run on the live database.

## Files
| File | What it does |
|---|---|
| 00_preflight.sql | Stops if the live bulk complete changed since it was captured (md5 c47d225ed1e250669433b70e8f1c9c35) or a function it uses is missing. Run first, same transaction. |
| apply.sql | Adds the Undo receipt table onboarding_task_batches, private helpers, a new body for the existing bulk_complete_onboarding_tasks (same 6 arguments: skip and save, Earlier on owner approval Tasks, covered owner cards, Undo receipt), plan_catch_up_tasks (Not needed, Assign, Change due date, Reopen) and undo_onboarding_task_batch. |
| apply.undo.sql | Puts the captured Nov 12 bulk_complete_onboarding_tasks back exactly and removes the new functions. Receipts and saved Task changes stay (nothing is deleted); use Undo on screen within 10 minutes to reverse a save. |
| live-capture/bulk_complete_onboarding_tasks.sql | The live function as captured Nov 12, used by the undo file. |
| checksums.sha256 | sha256 of every file above. |

## How to apply (only with approval)
One transaction: `BEGIN; \i 00_preflight.sql \i apply.sql COMMIT;`

## Rules it enforces
- Who: Admin and Director of Onboarding on every home; the home's Project Manager on that home; Utilities and Design only on Tasks assigned to them or their role; Operations roles never. Checked in the database on every call.
- Each Task is saved completely or not at all; blocked Tasks are listed with the reason and skipped, the rest save (decision O8 as amended Nov 12).
- Proof: one note of at least 5 characters, plus one optional file, saved as the evidence on every Task.
- Earlier: the date may go back two years. Owner approval Tasks are recorded as approved, with "Approved outside Resolve: <proof note>", who and when; nothing is sent to the owner (no approval, owner item, notice or email). With Today they keep the normal approval rule and are listed as not marked. A Task the owner was already asked about in Resolve is not marked.
- Owner cards: cards on the home's plan that are still locked and linked to a selected Task (directly or through the card's linked template step, as ao_plan_outcomes links them) become already covered, so they are never sent. When the plan has not started, the done Task already counts as covered when it starts.
- Not needed: the existing Void ("Voided — not needed: <reason>"), out of progress and overdue counts; its owner card is covered with reason task_not_needed.
- Reopen keeps the existing rule (Admin, Director of Onboarding or the person who finished it) and asks for a reason.
- Undo: the person who saved, within 10 minutes, once. Restores status, evidence, approval state, assignment, due date and covered cards for exactly those Tasks; a Task changed since is left as it is and listed.
- Every change writes onboarding_project_events (Activity tab) and audit_log.

## Practice runs
- Isolated copy: src/lib/__tests__/plan-catch-up-sql.test.ts on PGlite with src/lib/__tests__/fixtures/plan-catch-up-schema.sql (18 tests, all pass).
- Real database, cancelled transaction: refused before running; the sandbox connection has no access to the private schema. The preflight's first check (function unchanged) passed before the refusal. Nothing was kept.
