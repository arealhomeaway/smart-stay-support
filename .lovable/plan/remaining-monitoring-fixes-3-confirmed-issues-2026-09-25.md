# Remaining monitoring fixes (3 confirmed issues)

## 1. Add a home: no half-finished homes
- Hide the "This is an Active Owner home" checkbox unless the person may enroll homes (Supervisor, Platform Owner, Onboarding Director).
- If a later step fails after the home was created, still show the outcome screen: "Home added. Onboarding plan / Active Owner enrollment could not be started: <reason>", with a button to retry just the missing step.
- On a duplicate result, offer to start the missing onboarding plan for the existing home instead of only "Already in Resolve".
- Scope answers (furnishing, pool, HOA) stay as today for now; noted as a follow-up.

## 2. Ticket page "needs review" matches the server
- Expose the server's final-review decision (with reason) through a small read-only server call using the same facts the server uses (repair amount, homeowner involvement, emergency).
- The Close/Resolve button label, confirmation message and Final Review panel use that answer; the toast uses the actual returned status (closed vs resolved) instead of a prediction.

## 3. Bulk "Set status" follows ticket rules
- Route each ticket in a bulk status change through the same server status rule used one at a time.
- Remove "Waiting" and "Dispatched" from bulk status options (they need per-ticket details); tickets that fail a rule are reported back as skipped with the reason.

## Technical details
- AddPropertyDialog.tsx: wrap enroll steps in try/catch per step, pass partial result to OutcomePanel; gate checkbox with `can("owner_programs")`.
- New `getFinalReviewStatusFn` in ticket-lifecycle.functions.ts reusing `gatherLifecycleFacts`; tickets.$ticketId.tsx uses it and `result.status`.
- queue-bulk.functions.ts: status patches call `applyStatusChange` per ticket; queue-bulk.ts drops waiting/dispatched from bulk statuses.
