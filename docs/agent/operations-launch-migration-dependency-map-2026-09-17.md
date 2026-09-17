# Operations launch migration dependency map — 2026-09-17

**Decision source:** Emily's clean launch-candidate instruction and `operations-launch-recovery-2026-09-17.md`. This is a source map, not evidence of an applied migration or authenticated acceptance.

## Git boundary

`origin/main` and the recovery branch share merge base `e813389`. The relevant linear tail is:

`a4ad40b` through `c1f69b7` (Operations UI, Work Order, queue, feedback and acceptance work) → `23ad503` → `31d2823` → `7672770` (excluded cleaning/turnover/billing) → `484d15e` (canonical Work Order dispatch guard) → `cdb167e` (scope correction).

`c1f69b7` is the last committed base before the excluded migration chain. Earlier history includes Onboarding and Active Owner work shared with other branches; this recovery does not rewrite or remove that published history. The clean candidate means its **new commits and migration suffix** contain only approved Operations changes.

| Commit | Added/changed migrations | Dependency and disposition |
|---|---|---|
| `a4ad40b`–`c1f69b7` | No migrations in this Operations tail | Retain as base: Property History, Work Order lifecycle/UI, ownership, queue/oversight and source-linked feedback. `c1f69b7` adds acceptance documentation. |
| `23ad503` | `20260917020000_operations_cleaning_foundation.sql` | Exclude. Adds native cleaning schema, checklist source and turnover code/tests. Its edits to the feedback register/matrix are superseded by scope correction. |
| `31d2823` | `20260917030000_ownerrez_cleaning_ingestion.sql` | Exclude. Depends on cleaning foundation, adds native turnover ingestion and cleaner routing. OwnerRez booking/property context already exists before this commit. |
| `7672770` | `20260917040000_cleaning_billing_workflow.sql`; edits `20260917030000` | Exclude. Adds cleaning billing/workflow, adapter, synthetic sandbox route and related generated route tree. |
| `484d15e` | None | Include by cherry-pick: changes only Breezeway outbound code and two in-memory test files; its canonical Work Order link uses existing `work_orders` and `breezeway_outbound_tasks.work_order_id` columns. It has no import or schema dependency on the three excluded commits. |
| `cdb167e` | None | Bring forward as a scope-adjusted documentation change. Its new recovery record is valid; its small edits to the two older documents can be applied to their pre-cleaning versions. |

## Schema and type relationship

The candidate base already includes the canonical Ticket/Work Order and Breezeway schema and generated `breezeway_outbound_tasks.work_order_id` type. A search of the generated types and launch dispatch code found no reference to the three cleaning migration names or native cleaning tables. The excluded commits add their own SQL and pure/adapter code; they do not change `work_orders` or the Breezeway outbound table needed by `484d15e`.

An earlier Active Owner migration, `20260916140000_owner_participation_read_boundary.sql`, contains a P4-permitting owner notification projection. It predates the cleaning chain and is retained as historical migration evidence. A new forward migration after `20260917010000_initial_work_order_owner_request.sql` and before any excluded cleaning suffix can correct the current projection on the clean candidate. Do not rewrite the historical file. The existing `supabase/tests/priority_constraint.test.sql` rejects P4 for Tickets and work types, but has not been run against an isolated database in this pass.

## Validation boundary

The dependency conclusion is based on commit/file inspection and static import/type searches. It is not migration-runtime proof. Before promoting the candidate, verify migration order and generated types, run isolated tests/typecheck/build, and apply migrations only to a genuinely isolated local backend. The three excluded migrations must not be present in the candidate tree.
