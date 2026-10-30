# Co-owner foundation, pending only

This is a tested foundation plus a shared-helper conversion subset, not a completed co-owner feature. No live or application access gate is changed yet. Do not apply these files until complete audited provisioning and the remaining access conversions are approved.

## Files
- `01_membership_foundation.sql`: membership table, unique active membership, one active primary per program, fixed-path member helper and read-only authenticated roster policy.
- `undo/01_membership_foundation.sql`: restore confirmed live absence before any real membership is created. No CASCADE.
- `02_primary_backfill.data.sql`: separate pending primary backfill. Execution must capture inserted IDs and produce a row-scoped undo before committing. This data file is not ready to apply without that receipt.
- `live-access-reference.json`: read-only snapshot of 59 live functions containing owner_user_id and one direct policy. Function definitions are base64 with SHA256 and original grants; nothing in this snapshot is replaced in this part.
- `03_access_conversion.sql` and `undo/03_access_conversion.sql`: six exact shared-helper substitutions and one released-conversation policy substitution, preserving all other conditions, search paths and ACLs through CREATE OR REPLACE / ALTER POLICY.
- `pass2-live-reference.json`: twelve exact live functions (six converted plus real dependencies and primary recipient mapping) and ten matching policies, including six unrelated storage policies.
- `pass2-undo-proof.json`: original and substituted definition bytes, SHA256, exact live ACLs, policy capture bytes and classification counts. No triggers are replaced.
- `access-change-table.md`: all 59 candidate functions and ten matching policies classified, with each old check and conversion or unchanged reason. Six functions and one policy are staged for replacement; remaining gates are explicit.
- `manifest.json`: exact staged-file hashes/base64, confirmed new-object absence and existing anonymous-execution baseline.

## Safety
Existing live portal access, email recipients, staff access, owner response rules and hour totals remain unchanged. Shared helper replacements are pending only. No new public RPC or anonymous execution is added. Member writes are deliberately unavailable until audited add/remove and identity checks are built.

Membership is not an application role. Owner role provisioning remains in the canonical account path; staff accounts must be refused before linking. The complete feature must retain every existing lifecycle, property inclusion, synthetic-account and demo restriction when substituting membership for owner identity.

## Remaining build
The shared-helper subset is covered by `co-owner-live-access.test.ts`, loading the actual captured live definitions and four public policy predicates. Relation/auth fixtures are isolated; joined relations do not reproduce the entire production RLS closure. Tests cover all six gates, primary/co-owner A, unrelated B, removal, staff characterization, anonymous refusal, primary-only approval recipient mapping, unchanged anonymous function set/ACLs, restrictions and exact undo. Routine email producer execution and full production-schema dependency closure remain unverified.

Convert the remaining direct access checks, including actor-specific hour/notification columns, while preserving recipient/identity comparisons. Stage byte-exact undo for each additional change. Add audited account linking/add/remove with owner-only identity checks and co-owner setup welcome. Adapt portal/file/report reads, shared in-app notifications, attribution presentation and first-answer concurrency. Test historical credit after removal and all production dependencies before feature enablement.

## Six-step preview checklist after the complete feature is approved
1. On a clearly marked practice home, add an owner-only co-owner login as Admin or Onboarding Director.
2. Compare primary and co-owner homes, items, files, approvals, hours and history.
3. Confirm neither account can read or change a second unlinked program.
4. Answer one approval from each login; confirm only the first answer counts and its author remains recorded.
5. Log hours from each login, confirm shared totals and names; verify one in-app notification and primary-only routine email.
6. Remove the co-owner, confirm access ends on the next request and all recorded hours/history remain; reject a staff email.
## Pass 3A
- `04_access_remaining.sql` and `undo/04_access_remaining.sql`: 16 remaining direct owner gates now use `private.is_program_member`. Hours stay attributed to the logging member; entry reads include past entries of removed members; notification rows stay addressed to the primary and are shared by program; email recipients unchanged. `respond_owner_opportunity` adds a row lock and rejects a second decision once the linked approval is approved.
- `pass3a-live-reference.json`: exact live bytes (base64 + SHA256 + ACL) of the 16 targets, 3 inherited functions and 16 dependencies.
- Apply order: 01, 02 (with receipt), 03, 04. Undo order: undo/04, undo/03, undo/01.
