# Vendor Sourcing, Dispatch & Expense Handoff

Finance foundation counts as development-complete. These stay on the launch checklist: James and Emily testing with their own accounts, assigning KD's account, and checking access with a real vendor login.

## What staff will see (on the Work Order inside the Ticket)

1. **Find a Vendor** replaces "Choose Vendor". Staff list candidate vendors, mark Primary or Backup, and log each contact attempt: channel, time, response (no answer / declined / accepted / call back), and next follow-up date. Each vendor shows a "Breezeway" or "Telegram" badge. Contacting a vendor and the vendor accepting are recorded separately. The existing Emergency Only and eligibility rules still decide who can be picked.
2. **Scope & dispatch**: reason, expected work, estimate or quote, guest impact, and authorization status. Authorization uses the current approval engine without changes. Approved scope and amount are saved with the approval. If either changes later, the approval no longer counts and has to be requested again.
3. **Four separate facts** shown as one status line: Vendor accepted, Spending authorized, Dispatched, Completed.
4. **Push to Breezeway** is available only once the vendor has accepted and authorization is met. It reuses the existing outbound path and its protection against duplicate retries. The external task reference is saved. A failed or uncertain handoff shows a clear banner. Vendors outside Breezeway use the same internal tracking.
5. **Visits**: each visit needs one of the 8 outcomes, plus findings, work done, and evidence. If an outcome needs follow-up, staff create or link a follow-up with an assignee and due date, and only one open follow-up is allowed per visit. Repeat visits stay under the original issue, each keeping its own vendor, date, outcome, and expense.
6. **Invoice → Finance**: staff upload an invoice from the Work Order. It creates a shared Expense, or links one Finance already entered, with property, vendor, reason, visit outcome, authorization, and links filled in. Estimates are kept apart from invoices. Several invoices per Work Order are supported. Possible duplicates (same vendor, similar amount and date, or the same invoice number) are flagged for review, never merged automatically. A diagnostic invoice can go to Finance while the repair is still open. Closing the Work Order does not hide open invoice or clarification work.
7. **Purchase authorization**: purchase expenses get their own authorization status (Authorized / Not required / Missing / Uncertain), evidence, and who authorized. This is kept apart from owner notification and cost responsibility. Missing or Uncertain raises a leadership clarification before final owner allocation. No purchase spending limits are added, maintenance limits are not applied to purchases, and a guest request never counts as owner authorization.

## Safety
- No real vendor messages, no real Breezeway tasks, and nothing published. Real-home Departure Reviews and historical imports stay off.
- A Breezeway push in demo is simulated and never reaches Breezeway. If no safe live test path exists, that check is reported as pending.
- Owners and vendors still can't see expenses or internal financial files.

## Acceptance (synthetic demo cases)
The 8 scenarios from the spec, tested in the browser plus database permission checks, followed by the full test suite and typecheck.

## Open item
Vendor records have a Breezeway link today but no Telegram field. I'll add a "Uses Telegram" checkbox on the vendor record, unchecked by default. It won't be set for real vendors until you confirm.

## Technical details
- Migration 0105:
  - `work_order_vendor_candidates`: role, status, and accepted_at/by.
  - Append-only `work_order_contact_attempts`.
  - `work_order_visits`: outcome enum, findings, work_done, evidence ids, follow_up_work_item_id (unique).
  - `work_orders` gains `dispatch_reason`, `guest_impact`, `authorized_scope`/`authorized_amount` snapshots, `dispatched_at`, and `breezeway_handoff_status`.
  - `expenses` gains `work_order_visit_id`, `is_estimate`, `invoice_number`, `duplicate_flag`, `purchase_auth_status`/`evidence`/`authorized_by`.
  - `vendor_orgs` gains `uses_telegram`.
  - Grants, RLS staff-only, and DB guards: an authorization snapshot that doesn't match clears authorized; Breezeway push requires accepted + authorized; one open follow-up per visit.
- Pure rules go in `src/lib/vendor-sourcing.ts` (status line, push eligibility, duplicate detection) and `src/lib/expenses.ts` (purchase auth), with unit tests.
- UI: a new `FindVendorPanel` and `VisitOutcomePanel` inside `TicketWorkOrderPanel`. Invoice upload reuses AttachmentsPanel and NewExpenseSheet with prefill.
- Breezeway push reuses `breezeway-outbound.server.ts` with `request_key = work_order_id`. Demo records short-circuit to a simulated result.
