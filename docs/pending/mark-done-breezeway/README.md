# mark-done-breezeway (staged, not applied)

Lets the onboarding team mark a Task done in Mark done (Plan catch-up) after its Breezeway work order was sent.

## What it changes
- `public.bulk_complete_onboarding_tasks`: removes only the hold "A Breezeway work order was already sent for it."
  Adds a `breezeway` list (ready Tasks that have a sent or linked Breezeway work order) to the preview and the
  result, so the dialog shows: "This marks the Resolve Task done. The Breezeway work order is not changed."
- Every other hold is unchanged: already done, not needed, not yours, homeowner approval, Blocked, needs review,
  waiting on review, stage under review. Not needed still holds a Task with a sent work order (different function).
- Nothing reads or writes Breezeway. Owner and grants are kept (CREATE OR REPLACE). Completions are audited as today
  (`onboarding_task_bulk_completed`, one row per Task). One audit row `mark_done_breezeway.apply`.
- Later Breezeway "Finished": `complete_onboarding_from_breezeway` already returns false for a done Task and changes
  nothing (no reopen, no error, completer and time kept). No change needed.

## Files
- `preflight.sql` read only. Expect 24 open Tasks on 3 homes, live still holds them, md5 df428d93e7af3945e5b8d488f525f97d.
- `apply.sql` the change. `apply.undo.sql` restores `live-capture/bulk_complete_onboarding_tasks.sql`.
- `practice.sql` 3400 N Fern Avenue as the Director of Onboarding, always rolls back. Insert apply.sql at `-- @@APPLY@@`.

## Practice result (Nov 18, live database, rolled back)
- Before: 0 Tasks will be marked done; held: A Breezeway work order was already sent for it.
- After: 4 Tasks will be marked done; Breezeway note on 4; held 0. Mark done: 4 completed by the Director of Onboarding,
  4 audit rows, Breezeway rows unchanged. Later Breezeway Finished on all 4: 0 changed, no error, completer and time kept.
- Afterwards preflight unchanged: 24 open on 3 homes, still held, no audit row.

## Apply
Only on `Approved: apply mark-done-breezeway`: preflight, checksums, apply.sql in one transaction, then preflight
shows the hold gone.
