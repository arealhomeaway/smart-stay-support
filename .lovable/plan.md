# Finance Foundation — Property Expenses and Clarification Requests (plan only)

Nothing in this plan changes maintenance authorization rules, turns on real-home automations, sends messages, backfills historical expenses or publishes. QuickBooks stays the accounting record and OwnerRez stays the statement record. Resolve tracks facts, readiness and review only.

## Preview reconciliation (Pass 5B, already answered)
- 248 is a count of **cleans**. Each one holds a different reservation, so it is also 248 reservations.
- 294 is the number of **reservations** at linked homes that checked out between 9/2 and 10/2.
- The clean window and the checkout window are offset by a day. Two matched cleans on 9/2 (2017 W. Flintlock Way and 3405 NW 159th Ter) belong to checkouts on 9/1, which is before the checkout window.
- So 246 of the 294 checkouts in the window matched (83.7%), and 48 did not. No records were changed.

## What gets reused
- **`financial_requests`**: already holds estimate, approved, invoice, actual and settled amounts, the invoice number and an "accounting sent" marker. It becomes the one **Expense** record. Today it is onboarding-only; it gains optional links to other work.
- **`approvals` + `owner_approval_publications`**: owner authorization stays exactly as it is today, including the `maintenance-policy.ts` thresholds and pinned policy versions. An expense only refers to an existing approval.
- **`documents` + the shared attachment path**: holds invoices and receipts. Visibility stays staff-only by default. Owners only see a file if it is explicitly marked owner-shared, and finance files never are.
- **`work_items`**: handles follow-ups and clarification requests, using the existing routing to a functional role.
- **`functional_roles`**: a new "Finance" seat and pool goes here, so no names are hard-coded.
- **`audit_log`**: records every Finance decision and every change of who pays.
- **`property_activity_log`**: unchanged and history-only. An expense may point at an activity; the activity itself never gains a status or a follow-up.
- **`work_orders.invoice_reference`/`final_cost`** and **`claims` cost fields**: stay as they are. They are shown on the expense as linked facts and are not copied into it.

## Smallest schema changes
1. **`financial_requests`** (new columns only; all nullable or with a default):
   - `source` (onboarding / operations / unmatched)
   - Optional links: `ticket_id`, `work_order_id`, `claim_id`, `activity_id`
   - `reservation_link_state` (not relevant / linked / needed but unresolved), plus `ownerrez_booking_id`
   - `statement_period` (month)
   - Three separate state columns:
     - `ops_completion` (open / done)
     - `doc_readiness` (missing / partial / ready)
     - `finance_review` (not started / in review / needs clarification / reviewed / exception)
   - `cost_responsibility` (owner / ARHA / guest / vendor / insurance / undecided). This is separate from owner notification and owner authorization.
   - `ops_recommendation` + `ops_recommended_by`, and `finance_treatment_note` + `reviewed_by/at`
   - `exception_decision` + `decided_by` (leadership)
2. **`expense_links`**: a join table that lets one expense attach to several pieces of work, and lets one issue carry many expenses across statement periods. The issue is the Ticket; dispatches are its Work Orders. The expense amount lives only on the expense, never in the links.
3. **`expense_events`**: append-only history, the same pattern as the other event tables.
4. **Clarification requests** are `work_items` with `kind = 'finance_clarification'`, a source pointing at the expense, a question, a reply, and replies kept append-only. No new table.
5. **Permissions**:
   - A database helper `is_finance(uid)` reads the Finance functional-role membership.
   - Row-level rules:
     - Operations can create and edit facts and recommendations on an expense, and can read the Finance fields.
     - Finance can edit only the review, treatment, clarification and cost-responsibility fields.
     - Leadership (director or admin) can set exceptions.
     - Owners can never read expenses, drafts, notes or finance files.

## Screens (inside the existing shell, with Back and breadcrumbs)
- **Finance workspace** (a new nav item, shown only to Finance, leadership and admin), with these tabs:
  - **Review queue**: Ops done and documents ready, waiting for Finance
  - **Needs clarification**: open questions to Operations
  - **Unmatched expenses**: invoices with no linked work yet
  - **Reservation unresolved**
  - **By statement period**
- **Expense side panel**: one shared component, like the Ticket side panel. It shows:
  - The facts
  - Links to the related Ticket, Work Order, Claim or activity
  - Invoices and files
  - Three separate status chips (Ops / Documents / Finance)
  - Owner notification, owner authorization and cost responsibility as three distinct rows
  - The clarification thread and history
- **On Tickets, Work Orders, Claims and Property Activity**: an "Expenses" card that lists the linked expenses and offers "Add expense" or "Link an existing expense". These link to the same expense rather than copying it.
- **Property page**: an Expenses section showing that home's expenses.

## Responsibilities
- Operations: facts, documents and the recommended cost responsibility.
- Finance: review, accounting treatment, clarification requests, the final cost-responsibility call and the QuickBooks reference.
- Leadership: exceptions and overrides, which are audited.

## Acceptance checks (synthetic or demo data only)
- An expense linked to a Ticket, two Work Orders and a Claim appears on all of them, with the amount stored once.
- One issue with two dispatches and three invoices across two statement periods shows the correct per-period totals.
- An invoice with no source lands in Unmatched. Linking it later moves it out without creating a copy.
- A Property Activity gains no status or follow-up. Follow-ups come only from work items.
- Reservation link "needed but unresolved" blocks Finance from marking the expense reviewed. "Not relevant" does not block it.
- Finance cannot edit Ops facts, and Ops cannot set Finance treatment. Exceptions are leadership-only. Every change is audited.
- An owner session cannot read expenses, finance files or notes.
- Changing who pays does not change the owner approval or owner notification.
- Existing maintenance thresholds are unchanged (regression tests), and no messages are sent.
- The full test suite and type check pass.

## Policy decisions to confirm (not invented)
1. Who holds the Finance seat, and whether a "read-only Finance" scope exists today. I found none in the code, so the new limited working scope would be the first.
2. Which documents make an expense "ready" for each expense type (invoice only, or invoice plus photo or receipt).
3. Statement-period cutoff dates and any deadline for Finance review.
4. The list of cost-responsibility options and who can change the choice after review.
5. Whether expenses above some amount need leadership sign-off. No threshold is assumed.
6. Whether the QuickBooks reference is entered by hand (assumed) or by a future integration.
7. Whether onboarding budget expenses join this same queue now or later.
