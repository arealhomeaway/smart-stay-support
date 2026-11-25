# Notion correction, Nov 25

## Status
Staged, not applied. The last complete ops-simplification practice failed rebuilding a generated vendor qualification score. This correction did not bypass that failure or apply the full package. No switch or schedule changes, no live row writes and no publication. The three earlier packages remain on hold.

## Fresh live reads
- `reported_at` stores source creation; `created_at` stores the retained Resolve import time. `external_synced_at` stores the source's last edit, so it is not the import age anchor.
- Real Notion tickets, including every non-archived row (there are zero archived or demo Notion tickets):
  - Closed/resolved history: **2,236**.
  - Open, created within 30 days before import: **91**.
    - With current/mapped owner: **56**.
    - Without owner: **35**.
    - Already started in Resolve: **3**; the other **88** remain quiet under the corrected rule.
  - Open, older at import: **586** qualifying for Old backlog. These are not newly marked; the package has not applied.
- No `ops_assignment_batch` or `ops_backlog_at` exists in the live database. Therefore **0** recent imports needed removal from a marker created by this package. Existing import holds and current screen presentation have not been rewritten.

## Current Home calculation, not post-apply results
Used the same `SupervisorAttentionBand` selections/limits (500 tickets, 200 escalations, 200 approvals), `withoutQuietNotion`, and `supervisorAttention` in supervisor mode, without changing them. This was a source/database calculation, not a fresh signed-in screenshot. Current Home calculation continues to exclude quiet imports from its working-ticket count; quiet recent imports still need the requested team-tab presentation.

| Measure | Fresh before read | After application |
|---|---:|---|
| Open working tickets in current Home reader | 196 | Not applied |
| Unassigned | 125 | Not applied |
| Overdue / high risk | 194 | Not applied |
| Open escalations in Home | 0 | Not applied |
| Home need-your-decision total | 338 | Not applied |

These are reader-limited Home counts, not portfolio totals, and cannot be compared as a completed before/after migration. The decision total sums Home's categories and can count one ticket in several categories, exactly as the existing Home does.

## Tested
- Regression run: 96 tests passed across five existing test files, zero failures. Latest preview build/typecheck signal: build OK.
- 24 pure simplification rules passed, including closed/resolved history, frozen-at-import recency, the exact 30-day boundary and all-Notion exclusion from 8 AM assignment.
- 7 correction-only isolated checks passed using the actual staged function/statement text: boundary, preserved owner/status/dates/row content, closed records unmarked, all-Notion assignment capture, mapped assignee preservation, quiet notices suppressed, quiet escalation rejected.
- These focused checks do not validate the complete package, full dependency schema, every count reader, edit-to-live transitions, full scheduling, authenticated preview, or undo. The full practice must pass before application.

## Changes
- `src/lib/ops-simplification.ts`: blanket Notion backlog projection replaced with source/import date comparison; quiet and assignment eligibility projections added. This module is still used only by dormant new screens.
- `src/lib/__tests__/ops-simplification.test.ts`: superseded blanket test replaced; concrete corrected-rule tests added.
- `docs/pending/ops-simplification/apply.sql`: recent imports excluded from marker backfill; targeted marker-only restoration; Notion assignment preservation; capture and executor skip all Notion; quiet linked notification/escalation/email guards staged.
- `docs/pending/ops-simplification/practice.mjs`: fixtures/expected backlog IDs updated to the corrected Notion rule. Full practice not rerun past its previously failed schema-copy step.
- `docs/decision-register.md`: T7 records Emily's correction, with implementation explicitly staged, not applied. Unrelated routing and switch records untouched.
- Package README, verification and roadmap: status/results updated. Correction-only practice and result files added; no application screen mounted or modified.

## Remaining
1. Correct and pass the full isolated schema/practice, including all routing and undo checks.
2. Finish caller-scoped live/history reads and From Notion presentation in current/new screens.
3. Finish the requested take-or-edit transition through canonical actions and ensure every count/clock/notification reader follows it.
4. Apply the approved package only after complete validation; then create/verify the bounded Nov 26 14:00 UTC assignment and read actual after counts. No new approval is needed.
