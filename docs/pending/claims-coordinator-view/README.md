# claims-coordinator-view (staged, not applied)

Approved plan Nov 18 (Claims: Coordinator view). Apply only on `Approved: apply claims-coordinator-view`.

## What it adds
- `claims_default_filing_deadline` trigger: Airbnb or Vrbo (booking source, else reservation channel) with a checkout date
  sets the filing deadline to checkout + 14 days, source `platform_default`. A typed or confirmed deadline is never replaced.
  Other sources leave the deadline empty, shown as "Deadline needs verification" until a manager enters and confirms it.
- `claim_line_items`: issue + amount requested. Before Submitted the total writes `claims.submitted_amount` and a History line.
  Fixed once submitted. Remove instead of delete. Recovered amount and the Finance ledger are never touched.
- `claim_platform_log`: dated entries (date, who, what the platform said or asked, what we did). Append only, separate from History.
- Access: internal staff only (same rule as claims), demo-only for synthetic accounts, nothing for homeowners, vendors or signed-out visitors.
- `claims_retract_filing_alerts` (Nov 23 addition): when a claim's deadline date changes, its filing reminder and
  overdue alerts for the old date are cancelled (hidden from the inbox, kept as history).
- Existing triggers `guard_claim_workflow`, `guard_claim_approval`, `update_claims_updated_at` are unchanged.

The filing reminder and the Nov 23 overdue alert run in the existing five-minute job (code), once per claim and deadline date:
the reminder from 3 days before through the day before, the overdue alert on the day after only (Chicago), never on the deadline day.

## Practice (rolled back, Nov 18)
Airbnb checkout Nov 16 -> Nov 30 (platform_default); Vrbo channel checkout Nov 20 -> Dec 4; Direct -> needs verification;
Airbnb checkout moved to Nov 18 -> Dec 2; a confirmed Direct deadline stayed Nov 25 after the source changed to Airbnb;
line items 120.10 + 45 with the 45 removed -> submitted amount 120.10, recovered untouched; delete refused;
submit without proof still blocked by the existing gate; line item after Submitted refused; platform log edit refused;
1 log row and 3 History lines. Signed-out access then corrected with REVOKE and rechecked: none.

## Practice rerun (Nov 23, with the addition, rolled back)
Same results as Nov 18, plus: demo overdue alert to the real Operations Supervisor refused; an edit that keeps the date
cancelled 0 alerts; checkout moved (deadline Dec 2 -> Dec 3) cancelled both old-date alerts with reason "The filing deadline
changed." while another claim's alert stayed; a typed new date cancelled the previous date's reminder; 0 emails.

## Files
preflight.sql (read only), apply.sql, apply.undo.sql, practice.sql (apply + checks, ends in a deliberate rollback), CHECKSUMS.sha256.
