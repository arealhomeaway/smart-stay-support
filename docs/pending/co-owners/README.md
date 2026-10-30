# Co-owner foundation, pending only

This is a coherent first part, not a completed co-owner feature. No application access gate is changed yet.

## Files
- `01_membership_foundation.sql`: membership table, unique active membership, one active primary per program, fixed-path member helper and read-only authenticated roster policy.
- `undo/01_membership_foundation.sql`: restore confirmed live absence before any real membership is created. No CASCADE.
- `02_primary_backfill.data.sql`: separate pending primary backfill. Execution must capture inserted IDs and produce a row-scoped undo before committing. This data file is not ready to apply without that receipt.
- `live-access-reference.json`: read-only snapshot of 59 live functions containing owner_user_id and one direct policy. Function definitions are base64 with SHA256 and original grants; nothing in this snapshot is replaced in this part.
- `access-change-table.md`: current replacement count zero; complete conversion remains pending.
- `manifest.json`: exact staged-file hashes/base64, confirmed new-object absence and existing anonymous-execution baseline.

## Safety
Existing portal access, email recipients, staff access, owner response rules and hour totals remain unchanged. The helper is not wired into existing policies/functions yet. No new public RPC or anonymous execution is added. Member writes are deliberately unavailable until audited add/remove and identity checks are built.

Membership is not an application role. Owner role provisioning remains in the canonical account path; staff accounts must be refused before linking. The complete feature must retain every existing lifecycle, property inclusion, synthetic-account and demo restriction when substituting membership for owner identity.

## Remaining build
Classify and convert all access checks, including those using helper calls or actor-specific hour/notification columns; preserve recipient/identity comparisons. Stage byte-exact undo for every changed function, policy, trigger and grant. Add audited account linking/add/remove with owner-only identity checks and co-owner setup welcome. Adapt portal/file/report reads, shared in-app notifications, attribution presentation and first-answer concurrency. Run all changed production policies/functions in isolation, then full tests and automatic type/build checks.

## Six-step preview checklist after the complete feature is approved
1. On a clearly marked practice home, add an owner-only co-owner login as Admin or Onboarding Director.
2. Compare primary and co-owner homes, items, files, approvals, hours and history.
3. Confirm neither account can read or change a second unlinked program.
4. Answer one approval from each login; confirm only the first answer counts and its author remains recorded.
5. Log hours from each login, confirm shared totals and names; verify one in-app notification and primary-only routine email.
6. Remove the co-owner, confirm access ends on the next request and all recorded hours/history remain; reject a staff email.