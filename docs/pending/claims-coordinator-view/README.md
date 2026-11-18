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
- Existing triggers `guard_claim_workflow`, `guard_claim_approval`, `update_claims_updated_at` are unchanged.

The filing reminder needs no database change: it runs in the existing five-minute job (code), once per claim and deadline date.

## Practice (rolled back, Nov 18)
Airbnb checkout Nov 16 -> Nov 30 (platform_default); Vrbo channel checkout Nov 20 -> Dec 4; Direct -> needs verification;
Airbnb checkout moved to Nov 18 -> Dec 2; a confirmed Direct deadline stayed Nov 25 after the source changed to Airbnb;
line items 120.10 + 45 with the 45 removed -> submitted amount 120.10, recovered untouched; delete refused;
submit without proof still blocked by the existing gate; line item after Submitted refused; platform log edit refused;
1 log row and 3 History lines. Signed-out access then corrected with REVOKE and rechecked: none.

## Files
preflight.sql (read only), apply.sql, apply.undo.sql, practice.sql (apply + checks, ends in a deliberate rollback), CHECKSUMS.sha256.
