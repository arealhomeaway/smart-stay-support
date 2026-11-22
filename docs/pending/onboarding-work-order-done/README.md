# onboarding-work-order-done (staged, not applied)

Onboarding Task work orders in Breezeway: a Task is done once its work order is created, keeps showing the
Breezeway status, and reopens for the Project Manager if the work order is canceled or passes its date unfinished.

## Needs first
`mark-done-breezeway` (staged Nov 18, never applied: live Mark done still holds Tasks with a sent work order).
Completion reuses the canonical `bulk_complete_onboarding_tasks`, so that hold must be gone. Preflight stops otherwise.

## What it adds
- `breezeway_outbound_tasks.instructions_set_at`, `instructions_error`: the result of writing the Task's text as the
  work order's instructions right after it is created (code change; Breezeway lets a template replace the text sent on create).
- `onboarding_task_work_order_watch`: one row per work order that completed its Task. Staff read; writes only through the two functions.
- `complete_task_on_work_order_created(outbound id)`: caller-authenticated. Only the sender, the Director of Onboarding or an
  Admin. Calls Mark done with the proof "Breezeway work order <number> created." Every Mark done hold still applies
  (homeowner approval, Blocked, needs review, not yours, stage under review). Repeat calls do nothing.
- `reopen_tasks_for_work_orders()`: service only, run by the five-minute job. Reads the synced Breezeway copy. Canceled
  (Breezeway shows Deleted) or date passed in the home's time zone (Central if none) while not finished: the Task reopens,
  the reason is kept and shown, one history line and one audit row. Finished (Finished, Approved, Closed) stops watching.
  Homes already accepted by Operations are not reopened. Never writes to Breezeway. Never notifies owners.
- One audit row `onboarding_work_order_done.apply`.

Not retroactive: Tasks sent before this is applied are not completed or watched.

## Files
`preflight.sql` (read only), `apply.sql`, `apply.undo.sql` (removes both functions and the read grant; keeps watch rows and the
two columns, nothing deleted), `practice.sql` (always rolls back), `SHA256SUMS`.

## Practice (Nov 22, live database, rolled back, as the home's Project Manager, 624 Daniel Court)
- Mark done hold removed in place for the practice only.
- Painting, Final Inspection, Landscaping: each completed 1, held none. Second call on Final Inspection: nothing changed.
- Pass 1: Painting (date Nov 17, In Progress) reopened: "The Breezeway work order passed its date, Nov 17, without being completed."
  Final Inspection (date Nov 24) stays done.
- Breezeway copy set to Deleted for Landscaping, pass 2: reopened: "The Breezeway work order was canceled in Breezeway."
- 2 history lines, 0 owner notices. Afterwards: no watch table, Painting still open, no audit rows.

## Apply
Only on `Approved: apply mark-done-breezeway` then `Approved: apply onboarding-work-order-done`.
