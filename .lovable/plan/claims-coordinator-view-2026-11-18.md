# Claims: Coordinator view

## Step 1 audit (read only, done)

What was checked: the code and the live database (read only). Not checked: the published app, a real Property Coordinator session.

Live data: 671 claims (635 closed, 24 potential, 12 gathering). None has a checkout date, a filing deadline or a booking source recorded.

### What a Property Coordinator sees today, in order (ClaimDrawer)
1. Header: title, stage, claim type, Recover from, outcome, Demo.
2. Next action: suggested step, deadline urgency, follow-up date, Move to button.
3. Incident: description, home, incident date, guest, confirmation, stay dates, links to ticket and home.
4. Expenses: linked expenses, invoiced totals, estimates, Link expense.
5. Evidence: checklist with Received / Missing / Not available.
6. Financials: Estimated, Actual cost, Submitted, Approved (all editable); Received (Finance only); At risk.
7. Guided progress: 7 step chips, settled or not, Finance and leadership pending lines.
8. Payer and deadlines: Booking source (free text), Contracting party, Deposit payer, deadline source, deposit release source and date, deadline verification.
9. Record submission: documents, Submitted on, reference, Amount requested.
10. Decision received: outcome, amount approved, what they said, decision documents.
11. Waiver: reason, context, request; decision controls only for the routed person.
12. Recoveries received (Finance): totals and receipts; Finance-only entry.
13. Finance treatment of the unrecovered amount (Finance; leadership decision by Director of Operations).
14. Unrecovered amount and closure: reason, Close claim, blockers.
15. Update claim: Stage, Owner, Deadline, Follow up on, External reference, Outcome.
16. History: Add note and every system event, newest first.

### Answers
- a) No. The deadline is typed in by hand (`deadline_on`), and the screen says "Resolve never guesses it." Checkout is stored separately (`stay_departure`). Nothing varies by booking source.
- b) Damage screening (DepartureReviewPanel createClaim) copies the description, damage categories, estimate, checkout and stay dates, guest, channel, confirmation, OwnerRez booking and the review's attached files. It does not copy Breezeway comments or Breezeway photos, and it sets no owner.
- c) One claim-level amount per kind (estimated, actual, submitted, approved, recovered). There are no line items.
- d) No. Notes and system events share one History list (`claim_activity`).
- e) Safe to hide from Coordinators: booking source, contracting party, deposit payer, deadline source, deposit release fields and verification, actual cost, follow-up date, expenses card, waiver, recoveries, Finance treatment, external reference editing. Not safe to hide: the submission date, reference and proof; the outcome, decision proof, approved amount and reason; the unrecovered reason at closure. The $500 / $1,500 approval gate stays as it is.
- f) Yes, a reminder already exists. The five-minute job (`sweepDeadlineAlerts`) alerts the claim owner from 3 days before, on the day and after the deadline (urgent priority), through `staff_notifications` via `notify_staff_isolated`. It skips claims with no owner. Duplicates are blocked per claim for 30 days, not per deadline date. In-app delivery means one row in `staff_notifications` per person. The Operations Supervisor is found through `seat_holder_at('ops_supervisor')`.
- g) Left menu: Databases, then Claims and refunds. The Guest Claims & Refunds menu entry (switch `claims_menu`, on) goes to /claims, where the My claims tab lists open claims assigned to the person.

## Conflicts and risks for Step 2 (need a decision)
1. The current rule says Resolve never guesses the deadline. Checkout + 14 days for Airbnb and Vrbo replaces that rule; I will record the change.
2. "7 stages": the database holds 10 stages shown as 7 guided steps. The progress bar will show the existing 7 steps; stored stages stay the same.
3. The existing reminder sends up to 3 alerts (3 days before, on the day, overdue) with urgent priority, and skips claims with no owner. The new rule is one reminder, Supervisor fallback, no urgency. Plan: replace the claim part of that sweep with the new rule. Other deadline alerts stay unchanged. The overdue alert for claims goes away unless you say keep it.
4. "No red text or countdown" means removing the current urgency chip in Next action, for every role.
5. Booking source lives in two places (`reservation_channel` filled by screening and tickets; `booking_source` typed by hand). The 14-day rule will read `booking_source`, falling back to `reservation_channel`, matching Airbnb or Vrbo.
6. Breezeway photos and comments are not copied today. Reported issues will show the screening description and categories, plus the Breezeway comments and photos read live from the linked work order. Nothing is copied or written to Breezeway.
7. Live claims have no checkout date, so open claims get no automatic deadline until checkout is filled in.

## Step 2 build plan (after approval)
1. Coordinator view in ClaimDrawer, six sections: Dates, Reported issues, Evidence, Amounts, Status, Platform log. Everything else goes in a collapsed "Manager & Finance" section, open by default for the Supervisor, Directors, Admin and Finance. Submission and decision entry stay in Status, because the gates need them.
2. Dates: deadline worked out from checkout + 14 for Airbnb and Vrbo (Central time), saved with source "platform default". Other sources show "Deadline needs verification" until a manager confirms the date. Plain "File by Nov 30".
3. Amounts: new line items (issue, amount requested); the total writes the existing submitted amount. Recovered amount and the Finance ledger are not touched.
4. Platform log: a new append-only list (date, who, what the platform said or asked, what we did), separate from History.
5. Reminder: once per claim per deadline date, 3 days before (Chicago), only before Submitted, to the owner or else the Operations Supervisor. A deadline change replaces the pending reminder. Never for demo claims to real staff or unverified deadlines. My claims highlights the claim from then until Submitted.
6. Database (staged in docs/pending/claims-coordinator-view/ with preflight, practice, undo, README, checksums; applied only on "Approved: apply claims-coordinator-view"): line-item and platform-log tables with grants and staff-only rules, a reminder receipt table, a deadline default trigger. Existing gates are unchanged.
7. Verify on demo claims: Airbnb and Vrbo get +14; owner reminder once; unassigned goes to the Supervisor; Submitted sends nothing; gates still block; homeowners and vendors see nothing. Full suite, type check, build. Element table at the end.

## Technical notes
- Files: src/components/claims/ClaimDrawer.tsx, ClaimWorkflowPanel.tsx, src/lib/claims.ts, src/lib/deadline-alerts.ts(.server), claims.my-claims.tsx.
- Reminder uses the existing five-minute job, no new schedule.
