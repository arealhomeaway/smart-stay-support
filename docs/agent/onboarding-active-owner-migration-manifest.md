# Onboarding + Active Owner migration manifest

This is the review manifest for draft PR #10 on `codex/onboarding-active-owner-build`. It is **not permission to apply migrations**. Shared/live/Lovable backend migration, production writes, deployment, merge and message delivery remain prohibited. Any application and post-apply scenarios below are for a separately approved, isolated acceptance database with synthetic data and outbound delivery disabled.

## Inventory and evidence boundary

Inventory reviewed September 16, 2026 against branch base `e813389933db830d5897eba5c7d85c603ea8f7e6`, including the target/access checkpoint following `8a84310531c50324bfd83ae45213aa44df817de7`. There are **40 added migration files** in this checkpoint, listed below in filename order, including the owner-review write boundary and atomic opportunity closure. No baseline migration is modified or deleted in that comparison. `scripts/test-onboarding-migrations.mjs` references exactly these 40 files: **zero additional branch migrations and zero omissions** at this inventory point.

The runner uses an in-memory PGlite database, cumulative minimal fixtures and transaction-local test data. It does not connect to a shared database. “Included in the runner” is coverage inventory, not a claim that every acceptance scenario passed. Consult the current build-progress checkpoint for the executed results. The current checkpoint passed all 40 isolated migration files; full unit/build/typecheck/lint results are recorded in build-progress. This is local fixture evidence, not shared-backend acceptance.

The fixtures deliberately replace some role/auth helpers and use simplified tables/policies. They do **not** establish a clean rebuild of the entire migration history, compatibility with the deployed schema, deployed default privileges/RLS, real JWT behavior, concurrent multi-connection transactions, browser acceptance, delivery containment or all direct-table bypass paths. Tests named below live under `supabase/tests/`; their fixture predecessors are specified in the runner.

All files live under `supabase/migrations/`. Apply order, if separately authorized for an isolated environment, is **01 through 40** after the complete baseline history. The dependency notes identify important direct dependencies; they are not permission to cherry-pick around the baseline or earlier files. Respect the target's verified ledger and object definitions rather than replaying already recorded migrations.

## Reported Lovable environment state — September 16

The user reports that the Lovable migration ledger has been reconciled for the **first 22 original migrations** (entries 01–22 below). This is user-reported environment state; this manifest update performed **no independent backend audit, migration application or production-data operation**. Ledger reconciliation is not, by itself, verified evidence of every deployed function, policy or acceptance behavior.

The user reports that these **five specific migrations remain intentionally unapplied**:

- Entry 23: `20260915050000_canonical_owner_enrollment.sql`
- Entry 24: `20260915060000_owner_request_taxonomy.sql`
- Entry 25: `20260915070000_safe_ticket_notifications.sql`
- Entry 26: `20260915080000_automatic_ticket_opportunities.sql`
- Entry 27: `20260915090000_atomic_owner_review_response.sql`

The reported statement does **not establish the applied/unapplied status of entries 28–40**. Those files remain unapproved for shared/live application. Do not read this as “only five migrations remain” across the whole branch, or as “none of this branch's migrations have previously been applied.” A separately authorized, read-only target inventory is still required before making any target-specific compatibility or rollout claim.

## Common preconditions and pre-flight

1. Confirm the isolated target, its migration ledger and the exact branch/app revision. Capture a disposable database snapshot and baseline row counts. Do not discover target compatibility by applying this chain to the shared backend. Stop on a conflicting object/signature or an already applied filename with different contents; do not drop existing data to make it fit.
2. Establish the full baseline schema, extensions and roles, including `auth.uid()`, `authenticated`, `anon`, `service_role`, `gen_random_uuid()`, `is_onboarding_staff`, `is_supervisor`, `is_internal_staff` and `has_role`. Verify the real helper definitions and the migration executor's ownership/DDL privileges. The invoker functions need the caller's actual table grants and RLS; the service-only functions need the authenticated server action to derive the actor from the session, never from a caller-supplied identity.
3. Verify canonical tables and fields: Properties/Owners/Tickets/Work Orders/approvals, projects/tasks/facts/financial requests/handoffs/reviews/events, and owner programs/enrollments/opportunities/time/property links/events/badges/templates/notifications. Important baseline providers include `20260903185818_c94d708a-ec86-4a06-ade2-1957fe25210f.sql` (projects/events), `20260903191717_f5032c92-9874-48f5-8076-c13b0db63b00.sql` (financial requests/fact proposals), the August 21 owner-program/multi-property/handoff migrations, and `20260903175808_873fb28c-18a0-4068-88d4-cb7b6bcef404.sql` (the existing unique program/Ticket opportunity index). These examples do not replace the complete baseline chain.
4. Inspect existing constraints, defaults, indexes, triggers, function ACLs and `pg_default_acl`. Verify that replacement functions keep the intended owners/ACLs and that new definer functions have the intended owner and fixed `public` search path. Explicit revokes are listed below; do not infer an endpoint's authorization from its name or UI visibility.
5. Disable outbound mail, SMS, notification workers and external integrations in the isolated environment before creating fixtures or exercising workflows. File 25 writes notification queue rows at runtime; file 26 installs/replaces triggers and creates missing opportunities during migration. Suppressing automatic review notifications does not prove that every existing trigger or worker is inactive.
6. Record pre-apply counts and representative immutable records: approvals/amounts, time entries/property links, program events/reports, stage captures, Tickets, opportunities and notification queue rows. Inspect old malformed/duplicate records and unresolved Owner links before the relevant constraint/index/trigger changes below. No automatic Owner identity inference or destructive repair is authorized.
7. Review the combined lock graph and all other writers. Row/advisory locks in one RPC do not protect an unrelated direct writer that does not follow the protocol. Exercise source-write rollback and retries with the full trigger graph. Coordinate the application change with file 38 because the old four-argument response RPC is removed.

## Common post-apply verification

In the approved isolated environment, verify the migration ledger/object definitions, expected constraints/indexes/triggers, function security mode/search path/owner/ACLs and table policies. Compare baseline row counts and history: only explicitly documented migration-time initialization/reconciliation is expected. Run the isolated suite, then repeat meaningful scenarios against the complete schema with actual test-role sessions.

Required roles are an admin/platform owner, PM/project lead, separate Onboarding Director, Operations readiness reviewer, Operations acceptance/supervisor role, assigned field staff, unrelated staff, two unrelated external owners, and an unauthenticated caller. Use canonical Owners with included/excluded properties, active/inactive/completed/archived programs and separate demo records. Verify direct RPC/table access as well as server endpoints. Check permitted and denied calls, atomic rollback on history failure, stale versions, identity/property transfers, simultaneous writes, and absence of staff-private content in serialized owner responses. Use synthetic failures only in the disposable environment. No post-apply instruction here authorizes delivery to a real person.

Unless an entry explicitly says otherwise, it performs **no migration-time business-data backfill**, adds no table/index/check/FK, installs no trigger or RLS policy, and leaves existing table grants/RLS in force. Runtime writes, schema additions and permission changes are stated per file. Replacement definitions must still be applied in sequence; later entries supersede the earlier implementation without erasing its migration history.

## Ordered per-file manifest

### 01 — `20260914010000_atomic_onboarding_fact_review.sql`

- **Purpose/dependencies:** Add atomic `review_onboarding_fact` on the baseline fact proposals, Properties and project events, using `auth.uid()` and `is_onboarding_staff`. File 14 later extends this same function to assets.
- **Behavior/permissions:** Invoker RPC locks proposal and Property, restricts writable field names, rejects an accepted stale value, updates the canonical fact and review, and inserts prior/new project history in one transaction. Revokes function execution from PUBLIC; grants authenticated execution. Function definition only at apply time; no new table RLS or trigger.
- **Pre-flight:** Check proposal status/value fields, the allowed Property column types, events insert permission and whether existing pending proposals refer to unavailable Properties. Confirm staff policies permit both canonical update and history insertion.
- **Post-apply/evidence:** `onboarding_fact_review.test.sql`; accept/reject, deny nonstaff/disallowed fields, reject changed facts and repeat decisions, and force event failure to confirm all writes roll back. Run again after file 14.

### 02 — `20260914020000_versioned_onboarding_stage_capture.sql`

- **Purpose/dependencies:** Version stage capture in baseline project events; requires projects, Properties, tasks and pending fact proposals (same baseline as 01).
- **Behavior/permissions:** Adds a unique expression index over project/kind/JSON revision, an INSERT guard trigger, service-only invoker `record_onboarding_stage_capture`, and a `security_invoker` latest-capture view. RPC locks project/Property/stage tasks, compares scope/task snapshots and expected revision, rejects locked handoff/pending facts, then appends history. PUBLIC/authenticated RPC execution revoked; service execution granted. View SELECT granted to authenticated/service. The INSERT trigger permits only `service_role`/`postgres`; it is not an UPDATE/DELETE immutability policy for the event table.
- **Pre-flight:** All existing `stage_capture:%` event values must parse as JSON with integer revisions and have unique project/kind/revision tuples. Inspect existing event UPDATE/DELETE access, service role naming and Postgres support for invoker views. The unique index scans existing rows.
- **Post-apply/evidence:** `onboarding_stage_capture.test.sql`; deny direct ordinary-role insertion, stale revision/task/scope and locked-stage writes; verify one new revision, preserved prior value and caller-scoped view reads. Test two simultaneous saves in the full schema.

### 03 — `20260914030000_onboarding_actual_cost.sql`

- **Purpose/dependencies:** Preserve actual amount separately from invoice/estimate in baseline `financial_requests`.
- **Behavior/permissions:** Adds nullable `actual_amount numeric(12,2)` with nonnegative CHECK, `actual_recorded_at` and `actual_recorded_by`. No paid-amount inference or backfill. No function, trigger, policy or grant change.
- **Pre-flight:** Confirm these columns are absent and existing application readers tolerate nulls. The CHECK is nonnegative only; inspect the application's finite/range validation rather than assuming this column alone rejects every special numeric value.
- **Post-apply/evidence:** Confirm legacy rows remain null and estimate/invoice amounts unchanged; negative values fail, valid actual values remain independent. Loaded before `onboarding_financial_decision.test.sql`; this file has no separate dedicated SQL test file.

### 04 — `20260914040000_atomic_onboarding_financial_decision.sql`

- **Purpose/dependencies:** Atomic staff-confirmed financial decisions on financial requests, canonical approvals and project history; follows 03.
- **Behavior/permissions:** Adds invoker `decide_onboarding_financial_request`; staff check, required decision note, request lock, allowed status/amount and linked pending approval match; updates approval/request and optional project event together. PUBLIC execution revoked; authenticated granted. No new policy/trigger/backfill.
- **Pre-flight:** Inspect existing pending request/approval entity/property links, authority tiers, status values and all staff UPDATE/INSERT policies. Identify orphaned or already decided linked approvals instead of silently replacing them.
- **Post-apply/evidence:** `onboarding_financial_decision.test.sql`; success/decline, invalid amount/note, duplicate decision, mismatched approval and event-failure rollback. Verify actual/invoice fields are not replaced by approved amount.

### 05 — `20260914050000_atomic_onboarding_handoff_review.sql`

- **Purpose/dependencies:** Atomic handoff review and Property transition on baseline handoffs/reviews/Properties/tasks/projects.
- **Behavior/permissions:** Invoker `review_onboarding_handoff` locks handoff then Property; verifies expected gate/status and reviewer; writes review/history fields and advances Director, readiness, Operations acceptance, then Live confirmation. Return moves the Property to corrections; acceptance marks carryover; final gate completes project and activates operations. PUBLIC execution revoked; authenticated granted. No apply-time lifecycle changes.
- **Pre-flight:** Verify gate enum/text values, existing open handoff consistency and the real `is_supervisor`/director assignments. SQL permits supervisors across gates and the assigned Director at `kati_review`; this is not evidence that separate product-role responsibilities are fully enforced. Verify all joined table policies and task statuses.
- **Post-apply/evidence:** `onboarding_handoff_review.test.sql`; stale/wrong gate, denied reviewer, returned correction, each ordered transition and rollback when a constituent write fails. Test locked PM/Director/readiness/acceptance responsibilities with real role sessions.

### 06 — `20260914060000_prepare_onboarding_financial_approval.sql`

- **Purpose/dependencies:** Reuse one canonical financial approval across delivery retries; follows 04 and baseline approvals.
- **Behavior/permissions:** Invoker `prepare_onboarding_financial_approval` locks request, verifies expected amount/tier, reuses only a matching pending approval or creates/links a new one. Runtime approval detail includes request description/vendor text; the migration does not certify these fields as owner-safe. PUBLIC execution revoked; authenticated granted. No email sent by this RPC.
- **Pre-flight:** Inspect duplicate/orphaned links, supported `owner`/`supervisor` tiers and recipient/delivery behavior in the application. Confirm text policy for owner-visible legacy/new approvals and caller grants.
- **Post-apply/evidence:** `onboarding_approval_preparation.test.sql`; retry returns same ID, changed amount/tier/source/status fails and failed link update leaves no orphan approval. Inspect owner-safe payloads separately.

### 07 — `20260914070000_onboarding_authority_policy_snapshot.sql`

- **Purpose/dependencies:** Preserve the policy used when creating a financial request; follows financial request schema/files 03–06.
- **Behavior/permissions:** Adds nullable `authority_policy jsonb` with a column comment. No policy backfill: existing `authority_tier` remains recorded context for legacy null snapshots. No grants/RLS/trigger/constraint or runtime function change.
- **Pre-flight:** Confirm application policy snapshots are validated/versioned and no code treats legacy null as a newly invented threshold.
- **Post-apply/evidence:** Verify legacy snapshots remain null and new requests retain their policy/version independently of later configuration changes. Runner loads this DDL; no standalone SQL assertion file specifically verifies application snapshot creation.

### 08 — `20260914080000_prepare_onboarding_task_approval.sql`

- **Purpose/dependencies:** Serialize task approval preparation using baseline tasks and approvals, following the canonical approval path of 06.
- **Behavior/permissions:** Invoker RPC locks the property-matched task, checks staff/archive/approval requirement, denies multiple pending approvals, reuses or creates one pending approval and sets task awaiting-owner state. PUBLIC execution revoked; authenticated granted. Existing pending rows are not mass-reconciled.
- **Pre-flight:** Count pending approvals by task/property; confirm entity, role, demo and task identity consistency. A duplicate preexisting set must be resolved through a reviewed workflow, not deleted as part of migration.
- **Post-apply/evidence:** `onboarding_task_approval.test.sql`; retry identity, wrong-property/archive/nonstaff denial, duplicate-pending rejection and transaction rollback. Test competing preparation calls in the full schema.

### 09 — `20260914090000_atomic_onboarding_task_decision.sql`

- **Purpose/dependencies:** Staff records evidenced homeowner task decisions; follows 08.
- **Behavior/permissions:** Invoker RPC requires staff and note, locks task and the one pending approval, updates canonical response/evidence and task approval status atomically. PUBLIC execution revoked; authenticated granted. No schema/RLS/trigger/backfill change.
- **Pre-flight:** Verify exactly one correctly scoped pending request and compatible evidence/status columns; inspect policies and audit coverage outside this function.
- **Post-apply/evidence:** `onboarding_task_decision.test.sql`; success/decline, missing note, duplicate/no pending request, unavailable task and rollback. Confirm evidence URL preservation when no replacement is supplied.

### 10 — `20260914100000_atomic_owner_task_response.sql`

- **Purpose/dependencies:** Server-only homeowner decision for task approvals; follows 08–09. Hardened by 28 and wrapped by 32.
- **Behavior/permissions:** Invoker `record_owner_task_response` verifies addressed owner/source, locks task before approval, validates pending state and decline note, and updates both records atomically. Revokes PUBLIC/authenticated execution; grants service only. No owner task-write grant.
- **Pre-flight:** Confirm the server derives `_owner_id` from authenticated context, checks the visible recipient and never exposes the service credential. Inspect source/approval lock order in competing staff writers.
- **Post-apply/evidence:** `owner_task_response.test.sql`; permitted recipient, wrong recipient/source, stale/closed task, missing decline explanation and atomic rollback. Re-run after 28 and test the viewed-version wrapper after 32.

### 11 — `20260914110000_atomic_owner_financial_response.sql`

- **Purpose/dependencies:** Server-only owner response to financial approvals; follows 04/06/10. Hardened by 28 and wrapped by 32.
- **Behavior/permissions:** Invoker RPC locks financial request then approval, checks addressed owner/role/entity/property/pending state and exact requested amount, and writes approval, financial state and optional project history atomically. PUBLIC/authenticated execution revoked; service granted. No owner raw financial-write grant.
- **Pre-flight:** Verify recipient binding, amount constraints and source linkage; confirm service endpoint supplies authenticated identity. Review other writers for the same lock order.
- **Post-apply/evidence:** `owner_financial_response.test.sql`; approval/decline, wrong owner/role/source/amount/state, forced history failure. Re-run hardened definition after 28 and version tests after 32.

### 12 — `20260914120000_onboarding_delivery_attempts.sql`

- **Purpose/dependencies:** Store an outbound delivery claim/outcome before the email boundary; requires approvals and financial requests.
- **Behavior/permissions:** Adds nullable `onboarding_delivery_attempt jsonb` to both tables and explanatory comments. No delivery is initiated, claims generated or historical send state backfilled. No constraint/trigger/grant/RLS change.
- **Pre-flight:** Confirm delivery workers remain disabled in the isolated environment and application retry logic recognizes uncertain attempts. Inspect existing recipient/sent-at columns used by 13.
- **Post-apply/evidence:** Verify old rows remain null and both claim columns persist supported JSON states. Exercised as dependency of `onboarding_delivery_reconciliation.test.sql`; no standalone file-12 test.

### 13 — `20260914130000_reconcile_onboarding_delivery.sql`

- **Purpose/dependencies:** Preserve verified human delivery reconciliation; directly depends on 12.
- **Behavior/permissions:** Adds nonnull JSON history columns defaulting to `[]` on approvals/financial requests. Invoker RPC locks the selected allowlisted table row, verifies attempt ID/state and evidence note, appends reconciliation history and either confirms receipt or clears retryable claim. A provider-accepted attempt cannot be marked undelivered. PUBLIC execution revoked; authenticated granted. Runtime updates may advance accounting status; it sends no email. Existing rows acquire empty history, not fabricated receipts.
- **Pre-flight:** Inspect attempt JSON shapes/IDs/timestamps and supported uncertain states; verify sent-at/status types and staff policies. Preserve evidence of pending/running/provider-accepted attempts.
- **Post-apply/evidence:** `onboarding_delivery_reconciliation.test.sql`; wrong/current attempt, insufficient evidence, accepted-provider false outcome, accounting state, repeated reconciliation and atomic receipt/history behavior. Confirm outbound workers remain disabled.

### 14 — `20260914140000_reviewed_property_assets.sql`

- **Purpose/dependencies:** Add canonical equipment assets and reviewed asset fact changes; extends 01 and baseline Properties/fact proposals.
- **Behavior/permissions:** Creates `property_assets` with Property FK, required-name CHECK and unique `(id,property_id)`. Enables RLS; authenticated SELECT/INSERT/UPDATE granted with staff/property policies (supervisors may read); service gets ALL. Adds nullable proposal `asset_id` and composite asset/Property FK. Replaces fact-review RPC with allowlisted asset-field updates plus preserved prior/new history. No seed/backfill. Existing function authenticated execution retained/regranted.
- **Pre-flight:** Inspect default privileges, real staff/supervisor policies and Property visibility. Confirm no conflicting table/column/constraint exists; proposal rows begin with null asset IDs. Do not put credentials in asset metadata.
- **Post-apply/evidence:** `onboarding_asset_review.test.sql` and re-run `onboarding_fact_review.test.sql`; asset/property mismatch, stale asset fact, disallowed field, role denial, canonical update/history rollback and no owner raw-asset access. Inspect DELETE/default privileges explicitly.

### 15 — `20260914150000_atomic_owner_time_correction.sql`

- **Purpose/dependencies:** Append owner corrections while retaining the original entry and property/evidence links; requires baseline time-entry and link schema. Extended by 20; retained narrative enforced by 35.
- **Behavior/permissions:** Invoker `resubmit_owner_time_entry` uses an entry-specific transaction advisory lock, requires the owning user and a returned/unamended original, validates minutes/activity/reason, inserts amendment and copies links. PUBLIC execution revoked; authenticated granted. No historical UPDATE permission granted or data backfill.
- **Pre-flight:** Inspect existing amendment chains/duplicates, original entry RLS and insertion/link policies. Verify the correction lock is shared with staff corrections in 17.
- **Post-apply/evidence:** `owner_time_correction.test.sql`; wrong owner/state, invalid minutes/reason, repeat amendment, property/evidence/activity context and rollback. Test simultaneous owner/staff correction after 17/35.

### 16 — `20260914160000_atomic_owner_time_entry.sql`

- **Purpose/dependencies:** Create a participation entry and selected property links atomically; requires baseline active programs, opportunities, enrollment closing dates and Tickets. Extended by 20 and 35.
- **Behavior/permissions:** Invoker RPC checks owning user, active/target-reached start, date and actual minutes, opportunity availability, selected property/multi-property membership, included post-closing enrollment and selected Ticket. Inserts entry and links together. PUBLIC execution revoked; authenticated granted. No new table policy or trigger.
- **Pre-flight:** Verify program/status/start dates, property links, closing dates, opportunity/Ticket identity and caller RLS. The original implementation does not lock every lifecycle/enrollment read; later revision-specific checks are not a proof for every legacy entry path.
- **Post-apply/evidence:** `owner_time_entry.test.sql`; invalid date/minutes/program, wrong/missing multi-property selections, unrelated Ticket, permitted links and failure rollback. Re-run after 20/35 with real RLS and concurrent lifecycle changes.

### 17 — `20260914170000_atomic_staff_time_correction.sql`

- **Purpose/dependencies:** Supervisor correction with unchanged original context and durable history; follows 15/16.
- **Behavior/permissions:** Service-only invoker RPC checks actor admin/manager role, minutes/reason, same advisory lock as owner resubmission and unamended original; inserts correction, copies links and appends program event atomically. PUBLIC/authenticated revoked; service granted. No direct owner edit grant.
- **Pre-flight:** Confirm server-derived actor and actual admin/manager role semantics, entry/event/link columns and permissions. Inspect duplicate amendments and any non-RPC correction writer.
- **Post-apply/evidence:** `staff_time_correction.test.sql`; role denial, repeated correction, preserved evidence/property/activity, forced history rollback and competing owner correction. Verify file 35 also copies the original narrative revision.

### 18 — `20260914180000_owner_completion_report.sql`

- **Purpose/dependencies:** Persist the report used at program closeout in baseline `owner_programs`; versioned completion follows in 21.
- **Behavior/permissions:** Adds nullable `completion_report jsonb` and a comment. No legacy report fabrication, constraints, triggers, policies or grants.
- **Pre-flight:** Confirm column absence and application support for missing historical reports. A JSON column alone does not validate completion criteria or report contents.
- **Post-apply/evidence:** Verify historical rows remain null and stored report round-trips. Covered as schema dependency by `owner_closeout.test.sql` after 21; no standalone file-18 test.

### 19 — `20260915010000_atomic_handoff_request.sql`

- **Purpose/dependencies:** Persist a handoff request plus Property lifecycle change atomically after server readiness checks; follows handoff schema/05.
- **Behavior/permissions:** Service-only invoker RPC checks staff actor, locks Property, compares expected lifecycle, rejects another open request, validates each submitted carryover task's Property/assignee/date/reason, inserts handoff at Director gate and changes Property lifecycle. PUBLIC/authenticated revoked; service granted. No apply-time lifecycle/data rewrite.
- **Pre-flight:** Check existing open-handoff duplicates and lifecycle values, and server readiness authorization. The RPC validates submitted carryovers; it does not independently recompute the complete readiness checklist/newly created blockers inside its transaction.
- **Post-apply/evidence:** `handoff_request.test.sql`; stale lifecycle, repeat request, invalid cross-property or incomplete carryover, unauthorized actor and rollback. Full-schema concurrent new blockers/facts/scope changes remain required acceptance scenarios.

### 20 — `20260915020000_atomic_owner_activity_history.sql`

- **Purpose/dependencies:** Add durable activity/correction history to the atomic entry paths from 15/16, using baseline program events.
- **Behavior/permissions:** Replaces both `log_owner_time_entry` and `resubmit_owner_time_entry`, preserving invoker mode and existing EXECUTE grants. Runtime entry/link/event writes share one transaction and correction history includes prior/new minutes and property IDs. No schema, trigger, policy, grant or historical-event backfill.
- **Pre-flight:** Verify events INSERT policies for owners and required event kinds/columns. Preserve existing definitions/grants in the catalog comparison.
- **Post-apply/evidence:** `owner_activity_history.test.sql`; new entry and resubmission history, correct links/context and forced event-failure rollback. Verify entry totals still count correction chains correctly in application tests.

### 21 — `20260915030000_versioned_owner_closeout.sql`

- **Purpose/dependencies:** Reject closeout if any report input changed; requires 18 and all baseline owner aggregate source/link tables.
- **Behavior/permissions:** Adds nonnull `report_version uuid DEFAULT gen_random_uuid()` (**initializes existing program rows**). Installs a program BEFORE UPDATE stamp and definer invalidation triggers on enrollments, reviews, entries, badges, review/entry property links and Property updates/deletes. Trigger functions are revoked from PUBLIC/authenticated. Service-only invoker completion locks program, compares expected version/status, saves report and completion event atomically. No table RLS change; child writes may now update/lock programs indirectly.
- **Pre-flight:** Verify every source table, Property/link trigger behavior and object names; snapshot existing reports/status/counts. Inspect cascading deletes, trigger order, role permissions and all paths through the combined lock graph.
- **Post-apply/evidence:** `owner_closeout.test.sql`; all relevant source changes invalidate version, stale completion fails, successful report/status/event commit together, and history failure rolls back. Existing completion reports must not be regenerated. Test multi-connection child-write/closeout races and deadlock retry behavior against full schema.

### 22 — `20260915040000_atomic_task_date_override.sql`

- **Purpose/dependencies:** Durable versioned manual date override; requires stage captures from 02, projects and task schedule fields.
- **Behavior/permissions:** Service-only invoker RPC verifies staff and PM/director/supervisor responsibility, locks project then Property then task, checks task version/handoff/stage freeze, marks manual override and appends prior/new date/reason history. PUBLIC/authenticated execution revoked; service granted. No other schedule writer automatically becomes atomic.
- **Pre-flight:** Check task timestamp triggers, stage JSON revisions, task date/source/override columns, noncancelled project cardinality and server actor binding.
- **Post-apply/evidence:** `task_date_override.test.sql`; unrelated staff, stale task, closed/carryover task, frozen stage/handoff, same-date rejection and date/history rollback. Verify automatic scheduling preserves the explicit override.

### 23 — `20260915050000_canonical_owner_enrollment.sql`

- **Purpose/dependencies:** Bind owner programs/enrollment to the one canonical `property_owners` identity and `properties.owner_record_id` relationship.
- **Behavior/permissions:** Adds nullable Owner FK and partial unique active-program index over `(owner_record_id,is_demo)`. Two invoker BEFORE triggers require matching canonical Owner for new/bound programs and included enrollments; existing nonnull program Owner cannot be replaced. Trigger functions revoked from PUBLIC/authenticated. Existing programs remain null/unresolved; there is no email/name identity inference or backfill. No table RLS change.
- **Pre-flight:** Verify canonical Owner/Property FKs, program archive/status fields and historical included-property consistency before binding any legacy program. New index initially sees null added values, but subsequent binding must obey uniqueness. Trigger validation does not rewrite existing links.
- **Post-apply/evidence:** `canonical_owner_enrollment.test.sql`; new null/mismatched Owner denial, permitted canonical binding, second active program denial, changed Owner denial and cross-owner included enrollment rejection. Test concurrent transfer/reassignment and inspect legacy unresolved programs explicitly.

### 24 — `20260915060000_owner_request_taxonomy.sql`

- **Purpose/dependencies:** Introduce the eight Welcome Packet codes in existing owner reviews/templates while preserving historical codes.
- **Behavior/permissions:** Changes both action-type defaults to `review_comment`; drops and replaces the two named CHECK constraints with the eight current plus six legacy accepted codes. No row-code conversion, trigger, RLS or grant change. This is constraint replacement, not a blanket additive-only DDL claim.
- **Pre-flight:** Verify exact constraint names and all distinct existing codes; any value outside the listed union will fail validation. Confirm application labels cover both current and legacy values.
- **Post-apply/evidence:** `owner_request_taxonomy.test.sql`; accept all eight codes/legacy values, reject unknown code, verify defaults and unchanged historical rows. This constraint test does not prove automatic classification for all eight types.

### 25 — `20260915070000_safe_ticket_notifications.sql`

- **Purpose/dependencies:** Prevent raw Ticket/review narrative from entering new owner alert text; depends on 23 and baseline owner-notification trigger functions/tables.
- **Behavior/permissions:** Replaces fixed-search-path definer Ticket/review notification functions, requiring canonical active Owner, current Property/enrollment and non-demo scope, fixed safe titles/body and owner portal path. Runtime inserts notification queue rows with existing preferences. PUBLIC/anon/authenticated direct execution revoked. Existing triggers and historical notifications are retained; no retrospective cleanup and no delivery operation is performed by the migration.
- **Pre-flight:** Verify actual existing triggers, notification field/status types, preference behavior and queue workers disabled. Review historical unsafe rows separately; new fixed text does not sanitize them.
- **Post-apply/evidence:** `safe_ticket_notifications.test.sql`; no raw private text, correct canonical enrollment, demo/unrelated-owner exclusion, preference/urgent behavior and fixed action path. Confirm queue rows cause no outbound delivery in the isolated environment.

### 26 — `20260915080000_automatic_ticket_opportunities.sql`

- **Purpose/dependencies:** Automatic unique opportunity/property link for every enrolled-property Ticket; directly depends on 23–25 and the baseline unique partial `(program_id,ticket_id)` index and existing notification trigger.
- **Behavior/permissions:** Adds `auto_ticket boolean NOT NULL DEFAULT false`. Installs private definer sync/trigger functions on Ticket writes, enrollment changes and program identity/status/archive changes. Inserts missing opportunities/property links with fixed informational text and `ON CONFLICT` reuse; never replaces a response/history record. Replaces the review-notification trigger to exclude automatic opportunities. **Migration-time DO block scans included properties and creates missing opportunities/links** for canonically eligible programs. Trigger functions revoked from PUBLIC/anon/authenticated; no owner table grant/RLS change.
- **Pre-flight:** Verify the exact partial unique index and link uniqueness, correct canonical binding/demo/status, existing review-trigger name, eligible Ticket volume and lock/runtime budget. Snapshot opportunity IDs/responses/time links/notifications. Confirm all downstream trigger side effects and delivery containment before reconciliation.
- **Post-apply/evidence:** `automatic_ticket_opportunities.test.sql`; preexisting/new/closed Ticket coverage, status-change ID stability, existing response preservation, unique links, removal/demo exclusion, notification suppression, direct sync denial and source-write rollback on link failure. Reconcile expected eligible Ticket coverage/counts against actual results; test full-trigger deadlocks/concurrent duplicate writes. Dynamic authority/narrative is an application projection, not a persisted migration-time rewrite of every opportunity.

### 27 — `20260915090000_atomic_owner_review_response.sql`

- **Purpose/dependencies:** Atomic owner opportunity response/history with displayed version; follows 26 and owner event schema. Replaced by the new signature in 38.
- **Behavior/permissions:** Invoker four-argument RPC locks review, verifies owning active/unarchived program, expected timestamp and availability, restricts automatic Ticket responses to acknowledgement, preserves their open status and records previous/new response history. PUBLIC/anon execution revoked; authenticated/service granted. No table policy or trigger change.
- **Pre-flight:** Verify review UPDATE and program/event SELECT/INSERT grants/RLS, event kinds and update timestamp behavior. Check the application passes the originally displayed version.
- **Post-apply/evidence:** `owner_review_response.test.sql`; wrong owner/lifecycle, future/repeated/stale responses, repair-approval misuse and forced history rollback. After 38, use the five-argument endpoint and verify old endpoint absence.

### 28 — `20260915100000_owner_approval_role_demo_guards.sql`

- **Purpose/dependencies:** Harden the task/financial owner response implementations from 10–11.
- **Behavior/permissions:** Replaces both service-only invoker definitions with locked owner-role/non-demo checks on source and canonical approval. Retains atomic updates/history and explicitly re-revokes PUBLIC/authenticated execution, granting service. No migration-time data cleanup, policy, trigger or constraint change.
- **Pre-flight:** Inspect current helper signatures, endpoint actor/recipient validation and existing demo/role inconsistencies. Role flags alone do not prove full canonical Owner/Property isolation on every legacy approval path.
- **Post-apply/evidence:** Re-runs `owner_task_response.test.sql`, `owner_financial_response.test.sql`, plus `owner_approval_scope.test.sql`; deny supervisor-addressed/demo records and preserve valid production-mode synthetic owner responses.

### 29 — `20260915110000_atomic_work_order_owner_request.sql`

- **Purpose/dependencies:** Create/link one canonical Work Order owner approval and private staff history atomically; requires baseline Work Order cost/version/approval fields, canonical Owner/enrollment 23 and approval/event schema.
- **Behavior/permissions:** Invoker RPC requires internal staff and reviewed owner summary, locks/version-checks Work Order, validates quote/open state, current Owner/Property/Ticket/demo alignment and included owner-program recipient, then inserts approval/link/event. Rejects existing linked/pending approvals. PUBLIC/anon revoked; authenticated/service granted. Event stores a full private Work Order snapshot; owner views must not expose it. No invite/email sent.
- **Pre-flight:** Verify unique current program semantics, recipient binding and Work Order event policies; inspect old unlinked pending approvals and existing approval IDs. Validate owner-safe human summary workflow and private event isolation.
- **Post-apply/evidence:** `work_order_owner_request.test.sql`; stale/duplicate, invalid quote, canonical mismatch, safe summary, automatic recipient, atomic event/link rollback and nonstaff denial. Review status coverage (the function selects pending/active programs) and revised linked-approval workflow separately.

### 30 — `20260915120000_atomic_owner_work_order_response.sql`

- **Purpose/dependencies:** Server-only external-owner Work Order response; depends on 29, canonical enrollment, and baseline `audit_log`.
- **Behavior/permissions:** Invoker RPC locks Work Order then approval, validates pending owner recipient/exact quote/non-demo and current active canonical Owner/included Property/program/Ticket, updates both, appends Work Order event and audit together. PUBLIC/anon/authenticated revoked; service granted. No owner Work Order grant.
- **Pre-flight:** Verify trusted server `_owner_id`, real audit columns/policies, all link/version/amount data and lock order. Inspect pending/active program selection and old recipient links after transfers.
- **Post-apply/evidence:** `owner_work_order_response.test.sql`; valid accept/decline, wrong owner/demo/amount/property/enrollment, closed/source changes, event/audit failure rollback and direct-owner execution denial. Test competing staff response via 31 and viewed-version wrapper via 32.

### 31 — `20260915130000_atomic_staff_work_order_owner_decision.sql`

- **Purpose/dependencies:** Staff transcription of an evidenced owner response; follows 29–30 and baseline approval provenance fields.
- **Behavior/permissions:** Invoker RPC checks internal staff, note/outcome, Work Order version and canonical pending owner approval/entity/property/demo/quote. Locks Work Order before approval, caps approved amount to request, records staff provenance, updates mirrors and appends private prior-state history. An information request remains canonically pending. PUBLIC/anon revoked; authenticated/service granted.
- **Pre-flight:** Verify `recorded_by`, `responded_at`, `response_channel`, quote/status fields and event RLS; compare competing request/response lock order. This staff path does not itself repeat every current Owner/enrollment check from 30.
- **Post-apply/evidence:** `staff_work_order_owner_decision.test.sql`; allowed outcomes/amounts, denied staff/role/source/demo/stale version, prior/new evidence and atomic rollback. Confirm no private history is serialized to owners and inspect concurrent owner/staff decisions.

### 32 — `20260915140000_versioned_owner_approval_response.sql`

- **Purpose/dependencies:** Carry the owner's displayed approval version through one atomic decision; depends on 28 and 30.
- **Behavior/permissions:** Service-only invoker wrapper locks Work Order/task/financial source before approval, verifies source identity and nonnull expected timestamp, then delegates to the existing hardened response in the same transaction. PUBLIC/anon/authenticated revoked; service granted. Existing service-only delegates remain; no table RLS or data rewrite.
- **Pre-flight:** Verify all delegate signatures, approval/source timestamp updates and server usage of the wrapper; ensure no externally callable alternate endpoint omits the viewed version.
- **Post-apply/evidence:** `versioned_owner_response.test.sql`; stale/missing versions and changed source fail; current versions work for all three entity types. Test a browser-held draft during staff edits and simultaneous responses.

### 33 — `20260915150000_owner_ticket_authority_projection.sql`

- **Purpose/dependencies:** Owner-safe canonical Work Order authority/approval receipt read; depends on 23 and baseline Ticket/Work Order/approval/role fields.
- **Behavior/permissions:** Adds STABLE SQL definer read with fixed search path, one-statement canonical active Owner/current Property/included enrollment/Ticket/Work Order/demo checks and matching owner-approval receipt. Normal mode requires the program's owner; explicit preview requires admin. Returns narrow authority fields with fixed emergency-presence marker, not internal narrative. PUBLIC/anon revoked; authenticated granted. No data write, raw Work Order grant or table RLS change.
- **Pre-flight:** Inspect definer ownership, helper privileges, exact enum/type returns and 1–100 property-array contract. Review preserved completed-program history and excluded archive/demo behavior.
- **Post-apply/evidence:** `owner_ticket_authority.test.sql`; unrelated owner/forged preview/removed enrollment/canonical mismatch denial, matching receipt mapping and private field exclusion. Verify ordinary owners still cannot SELECT raw Work Orders.

### 34 — `20260915160000_reviewed_ticket_owner_updates.sql`

- **Purpose/dependencies:** Append-only staff-reviewed owner-safe Ticket narratives plus a scoped latest-revision read; depends on canonical Owner 23 and baseline Tickets/Properties/staff helpers.
- **Behavior/permissions:** Creates `ticket_owner_updates` with Ticket/Property/Owner FKs, positive revision/length CHECKs and unique Ticket/revision. Enables RLS, explicitly revokes all table privileges from PUBLIC/anon/authenticated/service, then grants staff-policy SELECT to authenticated and SELECT/INSERT to service. Service-only invoker writer locks/version-checks Ticket, current Property/Owner and prior revision, then inserts reviewed narrative. Authenticated definer reader uses canonical eligibility/admin preview like 33. No application UPDATE/DELETE grant or narrative backfill.
- **Pre-flight:** Inspect actual Ticket timestamps and canonical owner/demo fields, default privileges, function owners and staff helper. Confirm raw Ticket text is not automatically copied; staff review is a human content obligation, not an automated PII guarantee.
- **Post-apply/evidence:** `ticket_owner_updates.test.sql`; stale Ticket/revision, missing review, invalid length/Owner, immutable prior versions, owner-safe scope and denied direct writes. Verify newer narrative does not overwrite earlier rows and test simultaneous staff saves.

### 35 — `20260915170000_owner_time_reviewed_update.sql`

- **Purpose/dependencies:** Retain the exact narrative reviewed for time entry/corrections; directly depends on 34 and entry/history paths 15–17/20.
- **Behavior/permissions:** Adds nullable revision/snapshot to entries, composite Ticket/revision FK and revision-requires-Ticket CHECK. Private fixed-search-path definer BEFORE INSERT/UPDATE trigger derives allowlisted snapshot from stored revision, validates canonical Owner/program/enrollment/opportunity/Ticket/date for new linked entries, preserves correction context and rejects snapshot/context mutation. Replaces logging RPC to accept the revision in JSON while retaining invoker mode/grants. Legacy entries remain null; no invented history/backfill. No owner access to raw revision table is added.
- **Pre-flight:** Verify 34 uniqueness/FKs, entry field types, correction chain identity, trigger order and program locks caused by 21. Snapshot text must come from DB, never client text; revision-null legacy paths need their own authorization review.
- **Post-apply/evidence:** `owner_time_reviewed_update.test.sql`; retain revision 1 after revision 2, discard forged snapshot text, invalid revision/date/Owner rejection, owner/staff correction inheritance, immutable links, failure rollback and preserved history after removal. Verify saved report/export use and concurrent enrollment/lifecycle changes.

### 36 — `20260915180000_owner_ticket_actual_cost_projection.sql`

- **Purpose/dependencies:** Add canonical actual cost to safe authority reads; directly depends on 33 and baseline `work_orders.final_cost`.
- **Behavior/permissions:** Adds STABLE fixed-search-path definer wrapper returning the authority projection plus matched Work Order final cost in one statement. PUBLIC/anon revoked; authenticated granted. Read only: no table fields, constraints, triggers, policies, backfill or internal invoice/financial narrative exposure.
- **Pre-flight:** Verify dependency signature, numeric final-cost definition and definer execution rights. Review application treatment of null/zero/partial totals and overrun explanation; actual cost is not approval authority.
- **Post-apply/evidence:** `owner_ticket_actual_cost.test.sql`; correct owner/preview scope, matched receipt and actual cost, null/zero handling and private invoice exclusion. Application unit tests cover aggregation/duplicates/invalid values/overrun labels. Confirm no quote is substituted for missing actual cost.

### 37 — `20260915190000_atomic_work_order_costs.sql`

- **Purpose/dependencies:** Atomic staff cost/scope/history save with stale-edit and linked-approval guards; requires baseline Work Order quote/second quote/final cost/scope/version/approval fields and private events, with approval workflows 29–32.
- **Behavior/permissions:** Invoker RPC requires staff/reason, finite nonnegative amounts below 10 billion with at most two decimals, locks/version-checks Work Order, prevents linked owner/supervisor quote/scope edits, updates costs and inserts previous/new history together. Clears cached authority label when unapproved quote changes; actual overrun recording does not approve spending. PUBLIC/anon revoked; authenticated/service granted. No schema/policy/trigger/backfill change.
- **Pre-flight:** Inspect numeric precision, timestamp triggers, event insertion policies and other direct/supervisor cost writers. Linked quote/scope revision requires a separate workflow; this RPC intentionally does not replace an existing approval.
- **Post-apply/evidence:** `work_order_cost.test.sql`; invalid costs/nonstaff/anon, stale replay, owner/supervisor approval freeze, unapproved authority clearing, final-cost overrun without changed approval and forced event-failure rollback. Test background-refresh drafts and competing approval/cost writes in full schema.

### 38 — `20260915200000_owner_response_reviewed_update.sql`

- **Purpose/dependencies:** Preserve the exact reviewed narrative for acknowledgements/responses even without time logging; directly depends on response RPC 27, reviewed narratives 34, canonical Owner 23 and program events/version triggers.
- **Behavior/permissions:** Adds fixed-search-path definer `read_owner_review_update`, which locks program then review, validates the authenticated owning non-demo unarchived/nonclosed program and active canonical Owner, and for linked Tickets also validates current Property/enrollment/Ticket identity before returning only the requested stored narrative fields. Null means no narrative shown, never an inferred latest revision. Scope locks use `NOWAIT` with an explicit retry error on contention, avoiding a wait behind the known inverse order of report-version triggers. **Drops the four-argument response RPC from 27** and creates a fixed-search-path **definer** five-argument replacement taking revision, preserving explicit identity/lifecycle/version/availability checks and atomically saving response and snapshot event with Property/Ticket identity. Both endpoints revoke PUBLIC/anon and grant authenticated/service; `auth.uid()` checks still apply despite elevated table access. Adds invoker event trigger allowing response inserts only as the response function's owner, deriving snapshots from stored revisions and rejecting UPDATE into a response kind or UPDATE/DELETE of existing response history. Trigger execution revoked PUBLIC/anon/authenticated. No historical narrative backfill or new table RLS.
- **Pre-flight:** Coordinate application/RPC signature rollout; inspect stored dependencies on the old signature before DROP. Verify the response function owner is the intended trusted migration role, not an application role with direct event access. Audit explicit definer authorization rather than relying on table RLS. Inspect history INSERT/UPDATE/DELETE policies and other producers of `owner_decision`/`owner_participation_response` events because they now require this canonical response path. Inspect combined program/review/Property/Ticket lock graph, NOWAIT retry handling and real default table privileges. Old history is not assigned a guessed revision.
- **Post-apply/evidence:** `owner_response_reviewed_update.test.sql`; exact old revision after newer narrative, invalid revision rollback, no private raw Ticket text, unrelated/removed-owner denial, forced receipt failure and immutable history. Verify authenticated/service direct receipt inserts and ordinary-event-to-response conversion fail; caller-scoped RPC writes still succeed. Confirm old signature unavailable, updated browser passes its captured revision, reports/history display retained content, null-narrative behavior is explicit, and account switch/refetch does not substitute another response context. Exercise lock contention with separate connections and verify a retryable error without partial writes. Final WIP/restart validation and full-schema concurrency remain separate evidence requirements.

### 39 — `20260916010000_owner_review_write_boundary.sql`

- **Purpose/dependencies:** Close direct owner UPDATE access to operational opportunity fields and responses that could bypass the atomic receipt. Directly depends on the five-argument definer response RPC from 38 and the baseline `owner_reviews` RLS policy named `Owners answer their own reviews`. The migration first checks the exact response function exists and is `SECURITY DEFINER`; a missing signature or invoker implementation prevents the policy removal.
- **Behavior/permissions:** Drops only the named owner UPDATE policy from `owner_reviews`. This is an explicit **RLS access-policy change**, not additive-only DDL. It does not revoke table privileges, drop owner SELECT or staff-management policies, replace functions, create triggers/constraints or rewrite/delete business records. Owners must use the caller-validated atomic response RPC; staff keep management access under the remaining baseline policies. INSERT/DELETE denial depends on those existing policies and role definitions, which this file does not replace. Other permissive UPDATE/ALL policies must not accidentally restore ordinary-owner writes.
- **Pre-flight:** Verify 38's exact definer signature, trusted owner, EXECUTE ACL and explicit caller checks; confirm the named policy exists and inspect all current `owner_reviews` policies, table grants and real `is_staff` membership logic. Check that the app uses the five-argument response action and no legitimate owner flow still depends on direct review UPDATE. The runner's `owner_review_write_boundary_schema.sql` renames earlier minimal fixture policies to the baseline names and supplies simplified staff helper/grants/policies; that fixture is local test setup, not deployable migration or proof of the target's policies.
- **Post-apply/evidence:** `owner_review_write_boundary.test.sql` verifies owners retain opportunity SELECT; direct UPDATE of response/status/title/automatic-Ticket/property/Ticket fields affects no rows; direct DELETE affects no rows; direct INSERT is denied. It verifies the atomic acknowledgement still writes response plus receipt, time logging and returned-entry correction still work, and staff can update a review. Repeat these checks with actual owner/staff JWTs against the full isolated schema, inspect all remaining policies and verify immutable receipts cannot be bypassed through alternate endpoints. No migration-time row or history count changes are expected; runtime RPC writes remain governed by 38.

### 40 — `20260916020000_atomic_owner_opportunity_closure.sql`

- **Purpose/dependencies:** Atomically withdraw a manual participation opportunity and retain its linked history. Follows 38–39 and the baseline review/program/event schema, including `updated_at`, `closed_at`, `responded_at`, archive/demo fields, staff helper and program report-version triggers from 21.
- **Behavior/permissions:** Adds fixed-search-path SECURITY DEFINER `close_owner_opportunity(uuid,timestamptz,text)`. Requires authenticated internal staff and a 3–500 character reason. Locks program then review with NOWAIT, verifies the browser's expected version, lifecycle and demo alignment, rejects answered/responded/already-closed records, and rejects every Ticket-linked opportunity (including legacy nonautomatic rows) plus automatic flags. Updates status/close timestamp/version and inserts canonical program/Property/review/actor/reason/prior/new history together. Contention returns a retry error. PUBLIC/anonymous execution revoked; authenticated/service granted with `auth.uid()` and staff checks still mandatory. No apply-time data writing, backfill, table/policy/trigger/constraint change or removal of previous records. Time/evidence/property links are retained.
- **Pre-flight:** Verify the trusted function owner, real `is_internal_staff` definition, baseline column types, other direct staff writers, event/report-version triggers and combined lock order. Deploy the application requiring the displayed timestamp with the RPC in an approved isolated environment; a freshly re-read timestamp must not substitute for the browser's view. Confirm Ticket opportunities remain reviewable rather than manually withdrawn. This function does not close raw-table access or redesign program lifecycle/role assignments.
- **Post-apply/evidence:** `owner_opportunity_closure.test.sql`; reject owners/anonymous privilege, missing or stale version, invalid reason, completed/archived program, demo mismatch, automatic and legacy Ticket rows, and existing owner responses. Force event insertion failure to verify status/timestamp rollback; verify single closure receipt and preserved time/property links. Unit tests cover authorization and displayed-version forwarding; dialog capture retains the original context and reason through refetch/error until explicit review. Test simultaneous response/closure/closeout with actual role sessions and full schema; local fixtures and injected errors are not multi-connection proof.
## Known migration/acceptance discrepancies to keep visible

- **Inventory coverage is complete, acceptance is not.** All 40 branch/worktree SQL files are in the runner. Standalone assertions are not present for the pure-column files 03, 07, 12 and 18; they are loaded as dependencies of later tests. The runner also re-runs several earlier tests after replacement functions. A count of 40 is not 40 independent end-to-end migrations accepted on the actual schema. Reported ledger reconciliation for 01–22 and intentional deferral of 23–27 do not establish the backend status of 28–40.
- **The chain includes data writing and non-additive operations.** File 26 reconciles missing opportunities/links at apply time; 21 initializes UUID versions; 13/26 introduce defaults visible on existing rows. File 24 replaces constraints, 26 replaces a notification trigger, 38 removes an RPC signature, and 39 drops an owner UPDATE RLS policy. Many other files replace function definitions. Calling the whole set “additive only” would be inaccurate.
- **Legacy data is deliberately unresolved where evidence is absent.** Canonical Owner links are not inferred from free text; past narratives, paid amounts, policy snapshots and closeout reports are not fabricated. Pre-flight must enumerate unresolved cases and acceptance must verify their explicit UI behavior.
- **Permissions and automatic side effects need the complete schema.** Service-only endpoint checks, narrow definer reads, existing invoker table RLS, immutable history triggers, report invalidation and opportunity/notification triggers must be tested together. No raw-owner-table or cross-owner security claim follows from minimal fixtures alone.
- **Known product/concurrency work is not satisfied by this manifest.** Revised linked approvals, legacy supervisor writers, direct-table bypass, complete lifecycle/handoff readiness rechecks, all eight automatic request classifications, PM/Director/readiness/acceptance responsibilities, and authenticated desktop/390px acceptance remain subject to the requirements checklist. Do not apply this chain as a workaround for missing acceptance evidence.

For a final review, re-run the base-to-HEAD migration inventory plus any uncommitted migration additions and compare it with the runner and this manifest, attach the actual validation results to PR #10, and retain the explicit no-shared/live-migration boundary. This document records what must be reviewed; it does not declare the goal complete or authorize a rollout.
