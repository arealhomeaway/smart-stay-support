# Onboarding / Active Owner build progress

Goal: `onboarding-active-owner-build-goal.md`. Branch: `codex/onboarding-active-owner-build`.
Base: `e813389`; implementation began from `b6a4376` on September 14, 2026.

## Source and safety decisions

Read all four required plans and AGENTS.md. Existing project, scope, state, lifecycle,
template, task, approval, finance, fact proposal and owner-program modules are the
starting point. Later approved direction takes precedence over historical instructions
in imported templates. Guest readiness is the onboarding remit. No live writes,
messages, migrations, deployment, permission changes or merge have been performed.

## Verification environment

- Dependencies installed locally with bundled pnpm (no package or lockfile edits).
- Bun 1.3.10 Windows binary available through the package cache; the package wrapper
  fails to locate it, but the binary runs the existing suite successfully.
- Initial suite after the first pure-rule corrections: 568 tests passed.
- Baseline typecheck: passed.
- Baseline build: passed outside the sandbox, which blocks required child processes.
- Baseline full lint: 118,596 errors / 52 warnings; 118,544 errors are formatting
  issues. Preserve this evidence in `.codex-lint-baseline.log` (ignored local log).
- Current focused lint: passed for six changed onboarding files.
- Expanded suite: 574 tests passed. Two new test assertions needed adjustment to the
  repository's narrow Bun type shim; final typecheck will be rerun.

## Implemented so far

- Empty module selection remains empty; startup no longer silently swallows plan
  errors and retry reconciles partially created plans.
- Subtasks inherit scope exclusions, including nested children in arbitrary order.
- Appliance purchase/delivery is independent of furniture scope; existing-appliance
  and Active Owner applicability are explicit.
- Actual-closing work requires actual closing; pre-close planned-date work remains
  available. Missing prerequisites and missing correction evidence block completion.
- Server completion and handoff now use the same scope filtering as the workspace.
- Six regression cases added to the existing tests.

## Remaining work (goal is not complete)

### September 14 implementation checkpoint

The remaining-work list below predates these branch-local changes and is retained
as a scope checklist, not a description of the current implementation:

- Native stage capture now records revisions and uses gate checks; atomic fact
  review rejects stale values and unsupported property fields.
- Actual cost is stored separately from estimates, approval and invoice amounts.
  Financial decisions update the canonical approval and history atomically.
  Failed or skipped email delivery no longer marks requests sent.
- Handoff review now checks the displayed gate before advancing and commits the
  review, property transition and approved carryover together. Acceptance remains
  distinct from Supervisor Live; the Manager Hub retains pending Live reviews.
- Isolated PostgreSQL tests exercise all five new, unapplied migrations. The
  handoff test covers reviewer restrictions, stale requests, all four gates,
  approved-only carryover and rollback after a property update failure. These
  fixtures are active automated-test dependencies and must be preserved.
- Verification at this checkpoint: 582 unit tests passed, TypeScript passed,
  focused lint passed, all four isolated database test groups passed. The new
  Manager Hub summary regression is being checked separately after this count.
- No live migration, deployment, external message or deletion was performed.
  OneDrive's 268-item deletion set remains unverified and unapproved.

The Property area now exposes fact proposal capture, live versus captured values,
stale-proposal protection, reviewer notes and decision history. The server checks
that linked tasks belong to the property and are current. Fact mutations refresh
both the Property area and the onboarding workspace. Focused lint passes; the
full suite now passes 585 tests across 53 files. Browser verification is pending.

Financial approval preparation now uses a sixth unapplied migration to lock the
request and atomically create/link one canonical pending approval. Retries reuse
that approval; stale amounts, changed authority and decided approvals are rejected.
Isolated PostgreSQL tests cover rollback, reuse, stale values and unauthorized use.
Owner routing preserves recorded email delivery, reports missing contact details,
and propagates failed in-app writes. Pending task approvals now retry their actual
delivery channel. The Financial panel exposes retry and refreshes saved state even
when delivery fails. Full unit suite: 588 passing; focused lint passes.

Still to audit: simultaneous task-approval creation and uncertain email outcomes
(provider success before local delivery metadata is saved). No external messages
were sent during these tests.

Two canonical local QA fixtures and an isolated browser renderer now exist under
`qa/onboarding` and `src/lib/onboarding-qa-fixtures.ts`. Full Furnishing and No
Furnishings derive all 180 template tasks/subtasks, apply the shared rules, and
are explicitly excluded by the reporting filter. Desktop and 390px workflow
previews were inspected; see `qa/onboarding/README.md` for evidence and limits.
Future workflow sections now default to collapsed, with active work and blockers
expanded. Full unit suite: 592 tests passing; fixture typecheck passes.

Director Hub now includes stage review/correction counts and the assigned project
Director for review ownership. Attention rows open matching Work filters or the
handoff gate, with the origin token preserved. Workspace tab/filter selection is
URL-backed; legacy timeline/calendar/files links map into the six approved areas.
Timeline/calendar are Work disclosures and documents/media live under Property.
My Work groups are mutually exclusive, future work is collapsed, and the drawer
shares the same scope, stage captures and release context as its list. Filters
retain the complete task set for dependency calculations. Regression suite: 597
tests passing; focused lint passes. Authenticated browser validation remains open.

Onboarding authority thresholds now use the existing shared policy functions with
an optional explicit configuration. Approved defaults and Operations callers are
unchanged. Administrators can record a version, thresholds and approval reference
for future onboarding requests through existing app-settings permissions. New
requests snapshot that policy using a seventh unapplied migration. Existing
requests retain their recorded tier; sending/retry no longer reclassifies them.
Invalid settings fail closed. Tests cover boundaries, defaults, persisted authority
and non-admin rejection. Full suite: 602 passing; isolated migration checks,
typecheck and focused lint pass. No live policy settings were changed.

Still required: remaining approval concurrency,
remaining role-view audit, authenticated
workspace/Active Owner desktop and 390px acceptance, final build/schema review,
working commits and draft PR. This checkpoint does not establish preview readiness.

1. Finish foundation audit, external-reference capture, enrollment/portal boundaries,
   restart recovery and owner contact visibility. Verify and commit Pass 1.
2. Native stage capture with revisions, gate completion/reopening, atomic stale-safe
   fact review, traceable corrections and evidence integration. Existing fact review
   currently writes the property and review separately and accepts arbitrary keys.
3. Audit canonical approvals and financial requests, preserve actual vs approved
   amounts, prevent delivery failures being labeled sent, verify locked handoff chain
   and reconciliation separation. Existing lifecycle setter can bypass the chain.
4. Review Manager Hub/My Work/role views, filters/back navigation and six workspace
   areas. Add safe local Full Furnishing / No Furnishings QA fixtures and verify
   desktop + 390px without using real data.
5. Run checks for each pass, record baseline vs regressions, review unapplied schema,
   commit working states, push branch and create/update a draft PR. Consolidated
   acceptance review only when all four passes are implemented.

No claim of preview readiness yet. Browser verification and draft PR remain pending.
# Financial and utility transition verification — September 14

Invoice recording now requires approved authority, an authorized proceed estimate, or a documented emergency. Existing invoices cannot be overwritten through that action; the conditional save rejects a competing status/invoice change. The panel shares this eligibility rule, including the documented emergency path. Whitespace alone no longer satisfies an emergency or variance explanation.

Utility account updates are restricted to their property and preserve omitted service dates and notes. Utility costs require a matching account/property and a nonnegative amount with a forward billing period. New financial requests validate the linked task's property. Accounting handoff requires an invoiced request, reuses a previously recorded delivery, and reports an explicit reconciliation error if email delivery succeeds but its status update cannot be saved. Concurrent email attempts and provider/local-write uncertainty remain open; these guards do not claim exactly-once delivery.

Verification: 611 unit tests pass across 57 files, including nine new transition and property-boundary cases using local fake clients. Focused lint passes. No email was sent, live data changed, migration applied, or OneDrive item deleted during this work.

The handoff screen now offers the first review to the assigned, non-cancelled project's Director, matching the server's existing authorization rule. The latest Cloudflare production build passes with the same application entry and plugins, using a separate ignored output/cache directory and disabling deployment-config generation. All seven migrations pass the isolated PostgreSQL runner. These build and database checks do not replace authenticated workspace/portal acceptance or verification of the live schema, and no deployment or live migration was performed.

Lifecycle edits now reject attempts to reset handoff review/corrections/acceptance or manually advance a stage. Routine pause/resume/offboard applies only before handoff; resume preserves the original start date. Conditional writes detect competing lifecycle/acceptance changes. The workspace shows stage progression as reviewed state rather than a manual selector. Four regression tests bring the suite to 615 passing; typecheck and focused lint pass.

An eighth unapplied migration serializes task approval preparation on the canonical task row, reuses an existing pending approval without rewriting its context, and records the task's waiting state in the same transaction. Submission no longer resets task approval state after email delivery, avoiding a late write over a newer decision. Isolated database checks cover retries, preserved context, property boundaries, and approved-task rejection. Existing table RLS remains in force through a security-invoker function. Concurrent delivery and task-decision atomicity still need review; this is not a claim of exactly-once email delivery.

A ninth unapplied migration records staff-confirmed task decisions and their canonical approval in one transaction. It locks the task in the same order as preparation, requires exactly one pending approval for that task/property, records the response and evidence, and rejects subsequent decisions. Isolated PostgreSQL tests deliberately fail the task update to prove that the approval rolls back, then verify a successful decision and rejection of a competing response. All nine migration checks, 615 unit tests, typecheck, and focused lint pass. The owner-portal decision path still needs the equivalent transactional treatment; no live decision or external message was made.

The owner-portal task response now uses a tenth unapplied migration to replace its separate approval update and elevated task mirror with one server-only transaction. The function rechecks the addressed owner, property/task link and pending state while holding locks in the same order as staff preparation/decision. Local database tests verify wrong-owner rejection, rollback on task failure, traceable changes-requested state, repeat-response rejection, and lack of authenticated-role execute permission. Existing owner-facing access remains unchanged. Generic non-task approvals also condition their update on the current recipient. Ten isolated migration checks and focused lint pass; no live schema or owner record was changed. Financial owner responses and email-delivery concurrency remain under audit.

An eleventh unapplied migration connects financial owner responses to their canonical financial request transactionally. It validates the recipient, owner approval role, property/entity links, pending request and unchanged reviewed amount before recording the response and approved amount. The endpoint continues using the authenticated read/recipient check before its server-only transaction. Tests cover wrong recipients, changed amounts, rollback on financial-write failure, successful amount recording, repeat responses and restricted execution. All eleven isolated migration checks and 615 unit tests pass. Email delivery concurrency and full authenticated acceptance remain open.

Onboarding approval/accounting email now acquires a saved conditional delivery claim before calling the mail provider. A twelfth unapplied migration adds the claim metadata to the existing canonical records. These sends opt into a single provider attempt; unrelated Operations callers retain their existing retry behavior. Skipped sends release the claim, while provider failures, exceptions and failed receipt writes retain it for verification. Tests cover competing calls, uncertain outcomes and skipped sends; prior delivery tests now assert uncertainty instead of claiming a failed response proves non-delivery. 618 unit tests, typecheck and twelve isolated migration checks pass. Required next: a staff reconciliation action and UI for claimed uncertain attempts; the current checkpoint is deliberately not acceptance-ready and does not claim exactly-once delivery. No external emails were sent.

The Financial area now lists unresolved delivery attempts. Finished uncertain attempts can be reconciled by onboarding staff with a mailbox verification note; the thirteenth unapplied migration records the attempt and reviewer history atomically before either recording delivery or releasing a verified non-delivery for retry. Provider-accepted attempts cannot be released, and active attempts cannot be reconciled. Conditional attempt IDs reject stale actions. Tests cover these boundaries and append-only reconciliation history. All thirteen isolated migration checks pass. Interrupted processes that leave a claim marked sending still require administrator investigation; no timer automatically declares them safe to resend. Browser acceptance and the final build for this delivery checkpoint remain outstanding.

Delivery checkpoint build verification now passes using the isolated Cloudflare output folder. Reconciliation tests additionally cover accounting delivery, rollback when receipt persistence fails, stale attempt selection, and non-staff denial. A null reconciliation outcome is rejected, and a missing receipt update rolls the transaction back. Browser acceptance remains outstanding.

Role-view audit: My Work previously exposed all teammate selections to every viewer. It now keeps ordinary field viewers on their own assignments, limits project leads' team selection to their non-cancelled projects, and retains supervisor team review. The assignee filter persists in URL search, and changing the filter cannot retain a drawer for a task outside that selection. Three regression tests bring the suite to 621 passing; focused lint passes. This is presentation filtering only, not an RLS/permission change. Broader authenticated role-home acceptance remains required.

Confirmed requirement gap from the staged-build plan: atomic permanent-fact review currently targets canonical property fields only. The plan explicitly requires canonical Property/Asset review and equipment child records; asset-target proposals and their UI remain to be implemented using the existing asset model. Existing property-fact tests do not prove that requirement complete.

Asset-model inspection corrected the assumption above: existing equipment data is property notes/JSON and document metadata; no canonical asset child table exists in the repository schema. A fourteenth unapplied migration now introduces property-linked equipment records with access scoped to existing staff roles, links asset proposals into the existing fact queue, and extends its review transaction with an asset field allowlist and stale-value protection. No existing table policy was altered. Isolated tests verify accepted model changes, preserved prior/reviewer data, stale rejection and cross-property foreign-key rejection; the original property review tests are rerun after the function replacement. Application capture/review UI and generated asset types remain unfinished. This schema foundation is not yet an end-to-end asset workflow.

Asset capture is now connected to the Property area's existing facts panel. Staff can add an equipment identity, select that asset when proposing details, and review its captured/current/proposed values in the canonical queue. The server validates the asset belongs to the property and is not archived, selects the appropriate field allowlist, and captures the current asset value. Generated schema types include assets and proposal links. New service tests reject wrong-property assets and restricted fields before proposal insertion. 623 unit tests, typecheck and focused implementation lint pass. The new UI still needs desktop/mobile browser verification and a production build; no live schema or records were changed.

The asset checkpoint production build now passes in an isolated output folder. All fourteen migration checks pass, including a new forced review-write failure proving the asset update rolls back. Focused lint passes across the asset and My Work changes. Authenticated desktop/mobile verification remains unproven; these automated checks do not establish full acceptance readiness.

Active Owner opportunity audit found that a property-specific review could be logged against a different enrolled home. The logging service now rejects a selected property that differs from the opportunity's property before reading enrollment links or inserting time. A regression test verifies the rejection occurs before writing. Shared/program-wide entries retain their existing multi-property behavior. The full unit suite is 624 passing. Further audit is needed for unallocated program-wide entries and corrected historical entries; this focused check does not prove all participation boundaries.

Program-wide logging now verifies the addressed owner and an activated program, and requires an entry date from its start through today even when no property is selected. Activation validates actual included-property closing dates against the requested start, rather than relying only on confirmation flags. Regression tests reject unactivated/pre-start program-wide entries and activation before closing; 626 unit tests pass. Corrected historical entries, atomic entry/link creation, and authenticated owner acceptance remain to be audited.

Correction totals audit found a real staff/owner mismatch: the staff program list excluded returned entries but still counted superseded originals. Staff and owner aggregation now share the same countable-entry selector, excluding both returned and superseded records while leaving history intact. Tests cover correction chains and returned corrections without reviving old hours. The full suite is 628 passing. Atomic correction creation/property linking remains open.

Overnight owner-correction checkpoint: migration 15 now inserts an owner correction and copies its historical property links in one transaction. It preserves opportunity/review, ticket, activity category, original date/phase, decision/output, evidence path/materials, and demo classification. Regression checks reject another owner, invalid status/minutes, duplicate resubmission, and prove rollback if linking fails. The successful path is executed as the authenticated owner under read/insert RLS with no historical UPDATE policy. This caught and fixed an initial row-lock incompatibility: correction RPC calls now serialize through a transaction advisory lock without expanding access policies. This does not yet prove safety of other direct insert paths or concurrent staff corrections; those remain open.

Current verification: 628 unit tests pass (63 files, 1491 assertions); TypeScript and focused lint pass; all 15 isolated migration checks pass; production build passes using a fresh ignored output directory, .codex-qa.local/build-20260914-owner-corrections. The first sandbox build could not spawn child processes; the authorized retry succeeded. No shared/live migrations or external data changes occurred. Next priorities remain atomic new-entry/property-link creation, staff correction consistency, lifecycle/90-day boundaries, full requirements reconciliation, and authenticated acceptance. Overnight follow-up is scheduled on this task; completion is not claimed.
