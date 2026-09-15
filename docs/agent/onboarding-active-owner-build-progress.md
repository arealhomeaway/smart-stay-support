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

Next overnight checkpoint (uncommitted): migration 16 and the owner logging service now save new participation entries and property links atomically. The security-invoker RPC independently validates the addressed owner, active program/start date, opportunity membership/availability, enrolled property and closing date, and inherits is_demo from the program. Isolated owner-role tests cover forced link failure rollback, default opportunity property, preserved review/evidence context, wrong property, pre-start date, another owner, closed opportunity and future opportunity. All 16 isolated migration checks, 628 unit tests, TypeScript and focused lint pass. The latest production build remains the prior correction checkpoint; a final build is still required after implementation stabilizes. New-entry history/badge side effects remain after the transaction, and concurrent lifecycle/enrollment changes and staff corrections still require review. Direct table writes remain governed by existing policies; the RPC tests do not prove those policies enforce every business rule. No access policies or shared backend were changed.

Ticket-link follow-up: migration 16 now requires an optional ticket to be visible through the caller's existing RLS and belong to a selected eligible property. A local regression test proves a visible ticket from another property is rejected; all 16 migration checks still pass. Staff correction inspection confirms a separate defect: recordTimeCorrection inserts a minimal amendment without copying property/activity/evidence context, and the current authenticated INSERT policy on owner_time_entries only allows the owning homeowner. The handler requires admin/manager but that role check does not grant insertion of another owner's time. Do not claim staff corrections work from owner-RPC tests. Repair must retain immutable originals, supervisor authorization, correct links/history, and existing external-owner isolation; no access-policy change has been made during this inspection.

Lifecycle audit found and fixed a status-action bypass: setProgramStatus previously accepted active directly from draft, skipping activation requirements, and could roll active/completed programs backward. It now permits only pre-activation transitions without a started clock, active/target-reached to paused, and paused to active with an existing start. The status update compares the previously read status and rejects stale writes before recording history. Three regression tests cover draft activation, terminal reopening, clock rollback/unstarted resume, and stale pause. Full unit suite: 631 passing, 64 files, 1499 assertions; TypeScript and focused lint pass after adjusting test matchers to the repository's supported types. UI option availability, activation concurrency, and formal closeout gates still require follow-up; this server-action fix does not prove direct-table RLS enforces the lifecycle.

Activation concurrency follow-up: activateProgram rejects any existing start date, then conditionally updates only the previously read pre-activation status with DFY still confirmed and started_on still null. A competing activation cannot overwrite the established clock or append a false success event. Added a stale-activation regression and a successful resume test proving only status changes while the start/end clock remains untouched. 633 unit tests pass (64 files, 1504 assertions); focused lint passes. Enrollment/property changes concurrent with activation are not yet covered by a shared transaction and remain an explicit audit item.

Staff correction repair (migration 17, unapplied): the existing authenticated supervisor handler still checks admin/manager and reads the original through the caller's RLS, then invokes a service-role-only transaction. The transaction rechecks that actor's existing role, serializes with owner resubmission, rejects an already-amended original, preserves the full activity/opportunity/evidence/demo context and historical property links, and inserts prior/new values, actor and reason into history atomically. Authenticated clients have no execute privilege on the staff operation; no existing table policies were changed. Local SQL tests reject non-supervisors and duplicates, verify preserved context, and force history failure to prove entry/link rollback. All 17 isolated migration checks, 633 unit tests, TypeScript and focused lint pass. Verified the production has_role wrapper delegates to the private role predicate and grants service-role execution. Authenticated acceptance with actual roles remains unproven.

Unattended boundary: staging this checkpoint without escalation failed with permission denied creating .git/index.lock. Per the user's final overnight instruction, no new approval was requested. Changes remain uncommitted in the working tree; local review/testing can continue. Commit/push of this checkpoint and the final production build may require the previously used elevated execution route and are deferred if it would prompt. No destructive workaround was attempted.

Closeout checklist consistency: the UI displayed entriesAttributed but allClear and completeProgram ignored it. Counted entries must now have an activity description in both the readiness result and the server closeout action. The check uses the shared countable-entry selector so a documented correction can replace an incomplete original without rewriting historical records. Two regression tests cover missing descriptions blocking closeout and corrected history remaining intact. Full unit suite: 635 passing across 65 files, 1508 assertions; focused lint passes. Other closeout prerequisites and concurrent changes remain under audit; this does not establish full closeout acceptance.

Requirement reconciliation now has a dedicated working status matrix in onboarding-active-owner-requirement-status.md, covering all four passes and the Active Owner plan rather than treating test counts as completion. Re-reading the approved multi-property plan exposed a missing report-before-closeout gate, now explicitly PARTIAL. Report export also falsely hard-coded attested=true. Aggregation now selects the persisted attested flag and the report uses it, exposes reviewStatus and countsTowardTotal, and retains the historical log. TypeScript passes after adding the previously omitted field to EntryRow/query; focused lint passes. Full suite remains 635 passing before the final attestation-query edit. Report-generation closeout gating and a focused report regression remain to implement.

Report-before-closeout implementation: migration 18 adds completion_report JSON to the existing program record (unapplied; no policy changes). completeProgram generates the report from the exact loaded aggregate used for its checklist and writes it with completion status/time/actor in one update, rejecting non-active, previously completed, or stale-status attempts. Report payload now centrally includes the disclaimer; the export screen no longer duplicates it. A report regression verifies stored false attestation is preserved, corrected history stays visible without counting twice, and the disclaimer is present. 636 unit tests pass (66 files, 1515 assertions); TypeScript and focused implementation lint pass. Route logic lint passes with its existing formatting rule disabled; full repository formatting remains a known baseline limitation. All 18 isolated migration checks pass, although migration 18 currently has schema-application coverage rather than a full closeout transaction test. Concurrent entry/task changes and exporting the saved completed snapshot still need follow-up before acceptance.

Saved report export follow-up: completed/legacy-complete/closed programs with a stored completion_report export that exact snapshot instead of recalculating newer participation. Existing completed programs without a snapshot retain the legacy report-generation fallback. Access failures from the caller-scoped program read stop the export. Two regressions prove no recomputation of a saved report and no fallback after denied access. 638 unit tests pass (66 files, 1518 assertions), TypeScript and focused lint pass. Full closeout concurrency and authenticated acceptance remain open; no database migration was applied outside the isolated test runner.

Multi-property opportunity boundary: logging now requires selected properties to be explicitly linked through owner_review_properties when task_type is multi_property. An empty selection is rejected. Both the server precheck and transaction treat those links as authoritative over a legacy single property_id field, while retaining ordinary single-property guards. Isolated owner-role tests reject another enrolled but unassigned home, reject unallocated multi-property time, and accept a linked home even with a conflicting legacy property_id. All 18 isolated migration checks, TypeScript and focused lint pass. Latest full unit run remains 638 passing before this follow-up; authenticated multi-property UI acceptance remains outstanding.

Onboarding alternate-action audit: archiveOnboardingTask and recordTaskException previously changed requirements without the stage checks used by ordinary edits. Both now read the existing task/property, reject archived work or a handoff in review/accepted/live, and require a reviewed/completed stage to be returned or reopened before changing requirements. A regression runs both actions against awaiting-review and complete stage captures and proves rejection before writing. 639 unit tests pass (67 files, 1522 assertions), focused lint passes. These are server-action guards; simultaneous stage changes and direct-table paths still require transaction/RLS review. No actual task was archived or changed externally.

Handoff lock coverage: added regression cases for both archive and exception actions while handoff is requested, while property lifecycle is active_operations, and when handoff_accepted_at is set despite an inconsistent lifecycle label. Each case rejects before any write. Full unit suite: 640 passing across 67 files, 1534 assertions; TypeScript and focused test lint pass. This strengthens evidence for the alternate-action guard only; handoff request creation still inserts the handoff and updates property lifecycle separately and remains an atomicity gap in the broader audit.

Handoff request atomicity repair (migration 19, unapplied): after the existing authenticated/caller-scoped readiness checks, a server-only RPC rechecks onboarding staff, locks the property, rejects stale lifecycle/accepted/live state or an existing open request, and saves the request plus property lifecycle together. Request demo classification is inherited from the locked property. Direct authenticated clients lack execute permission and cannot use this persistence function to bypass the readiness handler. Local SQL tests force the lifecycle update to fail and prove no partial request survives, then verify request context, lifecycle advancement and stale retry rejection. All 19 isolated migration checks, 640 unit tests (67 files, 1534 assertions), TypeScript and focused lint pass. This closes the split-write defect; concurrent task/fact/stage changes between readiness reads and persistence remain an explicit gap. Shared/live schema and external records were not changed.

Handoff transaction rejection coverage now also verifies non-staff rejection, refusal of unaccepted carryover, and duplicate rejection when an existing request survives with an inconsistent property lifecycle. All 19 isolated migration checks pass. No application code changed in this follow-up, so the latest 640-unit-test/TypeScript/focused-lint checkpoint remains applicable. These checks do not replace the remaining readiness-input concurrency audit.

Carryover freshness: the handoff persistence transaction now locks referenced carryover tasks in stable ID order and rechecks property identity, archival state, assignee, due date and reason before saving. SQL regressions reject an unassigned stale item and a cross-property item, and verify a valid carryover's IDs/acceptance survive. All 19 isolated migration checks pass. Task-set changes outside the referenced carryover set, pending facts and stage revisions remain part of the wider readiness-snapshot concurrency gap; no broad serializability claim is made.

Workspace authorization audit: getOnboardingWorkspace now passes the authenticated user ID to loadOnboardingWorkspace, which verifies the existing is_onboarding_staff capability before any workspace reads. Verified the predicate includes admin/manager/onboarding and matches ROLE_CAPABILITIES; owner/vendor/tech-only roles lack this workspace capability. No role assignments or RLS policies changed. Regression tests deny a non-onboarding caller before table access and fail closed on role lookup errors. 642 unit tests pass (68 files, 1539 assertions), TypeScript and focused lint pass. Field-only assigned-work data minimization and role-specific UI acceptance still require additional review; this entry-point guard is not a global RLS proof.

### September 15 - resumed write-access checkpoint

Preserved committed and uncommitted work on codex/onboarding-active-owner-build. Completed the pending atomic owner entry/staff correction, lifecycle, saved-report, multi-property opportunity, handoff/carryover and capability-check checkpoint. Reopening now retains evidence, shares the stage/handoff guard, and conditionally updates only the completion read by the caller; regression coverage includes stale completion rejection.

Validation: 643 unit tests / 68 files / 1550 assertions pass; TypeScript passes. All 19 additive migration files pass the isolated runner (migration 18 is schema application coverage, not a concurrent closeout test). Production client/server build passed using .codex-qa.local/build-resume.config.mjs and fresh output build-20260915-resume-verified; sandbox EPERM required an approved child-process retry. Strict focused source/test/script lint passed. Generated types and owner-program route pass logic lint with formatting rule disabled; strict generated-file lint reports 8199 formatting errors, so full strict touched-file lint is not clean. No broad generated-file reformat. git diff --check passed.

Requirements matrix now records transaction, history, role-view and full-schema owner-access gaps, plus exact isolated-account acceptance instructions. Verdict: MORE IMPLEMENTATION REQUIRED. No merge, deployment, live migration, external message or deletion. The goal is not complete and this checkpoint does not claim authenticated acceptance.


### September 15 - atomic owner activity history

Follow-up to aa0d182: moved logging/resubmission events into their existing invoker RPC transactions using additive migration 20. Existing grants and access policies are unchanged. Removed duplicate server event writes and the correction's history-only link read. Isolated owner-role tests force history failure and prove rollback of both entries and links, then verify success context, duplicate correction rejection and another-owner denial. All 20 migration files pass the isolated runner; 643 unit tests / 1550 assertions and TypeScript pass; focused lint passes. Closeout events, last-activity/badge side effects and wider concurrency/role-view gaps remain. Production build result is recorded in the next checkpoint entry.

Owner-history final build: production client/server build passed with fresh output `.codex-qa.local/build-20260915-owner-history`. No deployment performed. Validation is complete for this follow-up; authenticated acceptance remains outstanding.


### September 15 - versioned owner closeout

Added unapplied migration 21: report-input version invalidation and service-only closeout RPC. The server captures a version before loading/checking its canonical aggregate; completion locks and compares that version, then writes status, saved report and audit event atomically. Trigger-only invalidation covers program, enrollment, entries/reviews and links, property metadata and badges without granting owners program UPDATE. Existing RLS policies remain unchanged. Tests cover stale source changes, owner insert invalidation, role rejection, history-failure rollback and repeat closeout rejection. Sequential isolated tests do not claim simultaneous multi-connection acceptance.

644 unit tests / 69 files / 1557 assertions pass. TypeScript and strict focused changed-source lint pass. All 21 migration files pass the isolated runner. Found an additional concrete closeout defect: aggregate queries need complete program-scoped pagination before large-program reports are trustworthy. That work, broader eligibility/handoff/stage races and role-specific workspace behavior remain. Production build result follows when its running handle completes.

Versioned-closeout production build passed using fresh `.codex-qa.local/build-20260915-owner-closeout` output. No deployment or shared migration. Working checkpoint remains MORE IMPLEMENTATION REQUIRED.


### September 15 - complete owner aggregation

Replaced capped collection reads with counted, deterministically ordered pagination, scoped to the program including review/entry property links through existing foreign keys. The helper honors a lower server row cap and rejects missing/error pages or changed counts. Regression coverage includes 1205 entries with a late correction under a 200-row cap, preserving all links and correct combined totals. Also corrected per-property direct/shared minutes to exclude returned/superseded entries through the canonical selector. 647 unit tests / 70 files / 1615 assertions pass; TypeScript and strict focused lint pass. No migration changed; the existing 21-migration validation remains applicable. Production build result follows when the running handle finishes. Authenticated query/security and multi-connection acceptance remain outstanding.

Pagination production build passed with fresh `.codex-qa.local/build-20260915-owner-pagination` output. No deployment or live migration. The goal remains incomplete: handoff/lifecycle concurrency, role-specific workspace behavior and authenticated acceptance still require work.


### September 15 - role-aware onboarding navigation

Added a server-derived presentation mode using existing supervisor capability and PM/director assignments. Field users land on My Work, supervisor/lead hub labels match their view, and workspace queries are keyed by authenticated identity and disabled while no user is known. Existing workspace mutation invalidation remains compatible. No role grants or RLS policies changed. Wider data projection and direct project/action boundaries remain unfinished; navigation is not claimed as authorization.

649 unit tests / 71 files / 1623 assertions, TypeScript and focused route/source lint pass. Initial production build passed; a final build follows the small hub-title alignment. Authenticated desktop/390px navigation still needs acceptance. Modern web guidance search/accessibility retrieval used the installed CLI because npx was unavailable; required child-process escalation succeeded. No plugin upgrade or permission change was performed.

Final role-navigation build passed using fresh `.codex-qa.local/build-20260915-workspace-view-final` output. Verified all remaining generic workspace query keys are prefix invalidations, so they continue to invalidate the identity-scoped queries. No deployment, live migration or permission-policy change.


### September 15 - assigned-work server response

Restricted assigned-mode workspace responses to assigned in-scope tasks, associated homes, self profile and matching task approvals. Removed project/history/external/document/participation collections and access/Wi-Fi notes from that response. Canonical scope and release are computed before redaction; only related task structure/status/title context is serialized for My Work and its drawer. Unrelated task notes/evidence/assignments are not returned. Field project URLs return to My Work. Existing RLS policies unchanged.

650 unit tests / 72 files / 1639 assertions pass, including a real-loader response-redaction regression preserving prerequisite blocking. TypeScript and focused route/source lint pass. Production build result follows its live handle. Remaining work: direct task action authorization, project-lead scope, onboarding read completeness, broader transaction races and authenticated acceptance. This is a response projection, not proof of complete server/RLS authorization.

Assigned-workspace production build passed with fresh `.codex-qa.local/build-20260915-assigned-workspace` output. No deployment or live migration. Working checkpoint remains MORE IMPLEMENTATION REQUIRED.


### September 15 - scoped task actions

Added existing-capability/project-responsibility/assignment checks to generic task save, approval submission/recording/requirement changes, notes and reopen. Assigned workers write progress only and cannot alter requirements/links/dates/ownership/carryover. Updates compare current assignment and task updated_at; archived rows cannot be saved. Notes reject mismatched property/task links and archived tasks. New task creation and requirement changes require management access.

656 unit tests / 73 files / 1658 assertions and focused lint pass. TypeScript passed after an indexed-property syntax correction. Existing onboarding_tasks_updated trigger supports the stale-row comparison. No RLS or grant changes. Direct database API bypass proof, concurrent project-responsibility changes, remaining property/handoff actions and field UI management controls are still incomplete. Production build status follows its live handle.

Task-access production build passed with fresh `.codex-qa.local/build-20260915-task-access` output. No deployment or migration. The goal remains MORE IMPLEMENTATION REQUIRED.


### September 15 - task drawer alignment

Date editing is now shown only for the selected property's supervisor/PM/director; field users retain read-only date display and progress/evidence actions. Fixed the drawer's omitted sortOrder and preserved prior order for older generic-save callers. Removed date-change use of the supervisor exception action; the separate observation is labeled as a requested date change. Atomic date/history persistence, required reasons and manual-override state remain follow-up work.

658 unit tests / 74 files / 1670 assertions pass, with TypeScript clean and focused lint at zero errors/one existing Fast Refresh export warning. The drawer test required React runtime access outside the sandbox; the approved retry and full suite passed. Production build result follows its running handle. No migrations or access policies changed.

Drawer production build passed using fresh `.codex-qa.local/build-20260915-task-drawer` output. No deployment or shared migration. Working checkpoint remains MORE IMPLEMENTATION REQUIRED.

### September 15 follow-up: atomic date overrides

The task drawer now uses a dedicated date action with a required reason and the task version viewed by the user. Migration `20260915040000_atomic_task_date_override.sql` locks project, property and task in stage-capture order, rechecks existing supervisor/project responsibility, lifecycle and stage locks, and saves the manual scheduling flag and prior/new date history together. Generic task saves reject date changes. The authenticated actor comes from server context; the RPC is service-role-only, with no existing RLS policy changed.

659 unit tests / 74 files / 1675 assertions pass. TypeScript passes. Focused lint has zero errors and one existing TaskDrawer Fast Refresh warning; generated types pass logic lint with the existing formatting baseline excluded. All 22 isolated migrations pass, including missing reason, unrelated actor, stale version, stage/handoff locks and history-failure rollback. The production client/server build passes in `.codex-qa.local/build-20260915-date-override` with no deployment. Server tests verify actor/version forwarding, assignee denial and stale-result propagation.

The dedicated override gap from the previous checkpoint is resolved locally. General schedule recalculation/configuration, wider task/stage/handoff concurrency and project-lead workspace scope remain incomplete. Authenticated desktop/390px acceptance and full-schema security review remain outstanding. Verdict remains MORE IMPLEMENTATION REQUIRED.

### September 15 follow-up: property management action scope

Lifecycle edits, handoff requests, schedule anchors, schedule previews/applications and per-task schedule configuration now reuse the existing supervisor or non-cancelled project PM/director responsibility check. Task assignment alone is insufficient. The regression exercises all six entry points and proves denial before writes. This is a server-action guard; direct database RLS and concurrent reassignment are not newly proven or changed.

Final validation: 660 unit tests / 74 files / 1682 assertions, zero failures; TypeScript passes; focused lint for this checkpoint passes without warnings; all 22 isolated migration checks pass; production client/server build passes at `.codex-qa.local/build-20260915-property-management`. The earlier TaskDrawer Fast Refresh warning and generated-types formatting baseline remain as documented. A test-declaration incompatibility introduced by the late date-action assertions was caught and fixed by using the repository's existing assertion style. This final TypeScript run supersedes the earlier date-checkpoint claim, which preceded those assertions.

Remaining implementation is explicit: project-lead data projection and complete workspace pagination; project/scope and other action-boundary review; complete handoff readiness and stage/task/schedule transaction boundaries; program activation/enrollment concurrency; post-transaction badge/activity durability; full external-owner RLS/demo-isolation evidence. General scheduling can still race or mutate reviewed work despite the newly scoped caller guard. Requirements beyond these checks retain their PARTIAL or NOT YET ACCEPTED status. Authenticated desktop/390px testing requires an approved isolated backend and role accounts; no shared migration or account setup was performed. MORE IMPLEMENTATION REQUIRED.

### September 15 follow-up: complete workspace pagination

All fourteen collection reads used by `loadOnboardingWorkspace` now use exact-count pagination with deterministic tie-break ordering: properties, tasks, handoffs, profiles, notes, reviews, external databases/records, documents, owner approvals, projects, stage captures and both participation sources. The previous 200-approval limit is removed. Supporting-record errors now reject the load rather than silently producing an empty section. The shared query adapter reuses `readAllRows`; it does not change RLS or introduce another aggregate model.

Regression evidence covers 1205 rows per source under a 200-row backend cap, exact-count requests, deterministic ordering, all seven pages, complete returned collections and a later supporting-page failure. Assigned-work redaction is exercised under a two-row cap. Existing delivery test adapters were extended for ordered/ranged reads; delivery behavior and assertions remain intact.

662 unit tests / 75 files / 1890 assertions pass; TypeScript and focused lint pass; production client/server build passes in `.codex-qa.local/build-20260915-workspace-pages`; all 22 isolated migration checks pass. No schema or access-policy changes were made in this checkpoint.

This resolves silent row-cap truncation in the workspace loader. It does not provide a cross-table snapshot, project-lead response projection, complete detail/action-query pagination, or authenticated PostgREST/performance evidence. Large property-ID filters and real-environment behavior still require acceptance. Other concurrency/security/role acceptance gaps in the checklist remain open. MORE IMPLEMENTATION REQUIRED.

### September 15 follow-up: project-lead workspace response scope

Non-supervisor PM/director workspace responses now retain full records only for properties with a non-cancelled project assigned to that caller. Pipeline, project rows, stage captures, notes, documents, approvals, participation, handoffs and external records follow that property set; reviews must also reference a returned handoff and external database descriptions must match returned records. Existing supervisor portfolio behavior remains. Leads retain the existing staff directory for assignment.

A lead's own tasks outside managed projects remain available through the existing assigned-work projection: redacted property credentials, related prerequisite summaries, canonical release decisions and task-linked approvals. The project route sends these assigned-only property contexts to My Work. This avoids dropping valid assigned work or returning the other project's private workspace records. No RLS, role or grant changed.

663 unit tests / 75 files / 1908 assertions pass; TypeScript and focused lint pass; the production client/server build passes in `.codex-qa.local/build-20260915-project-scope`; all 22 isolated migration checks pass. Regression covers managed, unrelated and cancelled projects, assignments outside managed homes, preserved prerequisite blocking, linked handoff reviews and external database filtering. Authenticated rendered navigation is NOT YET ACCEPTED.

This proves the workspace response projection, not every direct endpoint or database policy. Separate detail reads such as `getPropertyProject`, mutation scope and concurrent reassignment still need review. Wider stage/task/schedule/handoff and activation/enrollment concurrency, complete owner cross-access/demo-isolation evidence and authenticated acceptance remain incomplete. MORE IMPLEMENTATION REQUIRED.

### September 15 follow-up: canonical Owner enrollment foundation

Migration `20260915050000_canonical_owner_enrollment.sql` adds the existing `property_owners` foreign key to programs, a unique active program per canonical Owner/demo partition, and trigger validation for new program/enrollment identity. A bound program cannot replace its Owner identity; existing unbound programs are not guessed or backfilled. New enrollment must match the program and Property canonical Owner. No existing RLS or portal-user mapping changed.

`createProgram` now resolves `properties.owner_record_id`, checks that canonical Owner is active, reuses programs by the Owner ID rather than email, and snapshots contact details from that record. Submitted contact fields no longer establish identity. `addProgramProperty` rejects missing/mismatched identity, and onboarding's enrollment helper goes through the same validation instead of trusting an existing link without checking it.

666 unit tests / 76 files / 1918 assertions pass; TypeScript and focused lint pass (generated types use the documented formatting-baseline exception). All 23 isolated migration files pass, including cross-owner rejection, unbound creation, duplicate active program prevention, immutable bound identity and preservation of unresolved legacy records. Production client/server build passes in `.codex-qa.local/build-20260915-canonical-owner`. Migration is unapplied to shared/live.

Locked Ticket requirement status: PARTIALLY IMPLEMENTED. This is the canonical enrollment foundation, not automatic Ticket coverage. Automatic generation, safe operational projection, eight request types/explanations, legacy reconciliation UI and updated contact controls remain. Existing property-owner changes and complete activation/enrollment concurrency need further audit. Program/link/history creation remains multiple writes; this checkpoint does not claim it is atomic. No owner user account was created, rebound or inferred from contact text. MORE IMPLEMENTATION REQUIRED.

### September 15 follow-up: Welcome Packet request taxonomy

New opportunity offers now expose exactly the eight locked request labels. Server validation accepts those codes plus the six legacy values for compatibility; historical labels remain readable. `opportunityDecisionPath` preserves the approval path for Approve only and the informational path for Information only. The latter explicitly describes actual review time without creating an approval gate. Generic category hints describe the requested response; they are not substitutes for the required Ticket-specific WHY.

Migration `20260915060000_owner_request_taxonomy.sql` extends existing review/template constraints and changes new-record defaults to review_comment without rewriting existing rows. No schema is applied to shared/live. Tests verify all eight labels, legacy support, informational/approval paths, database acceptance, invalid-code rejection, preservation of historical codes and new defaults.

668 unit tests / 77 files / 1939 assertions pass; TypeScript and focused lint pass; all 24 isolated migration checks pass; production client/server build passes in `.codex-qa.local/build-20260915-owner-taxonomy`. Existing offer UI and server modules were extended; no parallel opportunity store was introduced.

Locked Ticket requirement remains PARTIALLY IMPLEMENTED. Automatic Ticket synchronization, owner-safe context, canonical authority-driven classification and per-Ticket WHY are still pending, as are legacy identity reconciliation and authenticated acceptance. The existing manual offer path is not a substitute for automatic coverage. No hours are generated and no messages are sent by this change.

### September 15 follow-up: structured owner Ticket projection and complete feed

`loadOwnerHomeByProgram` now requests Tickets only for `includedProperties`, rather than every historical enrollment. `loadOwnerTicketProjection` pages exact-count results with deterministic ordering and batches property filters in groups of 100. The former 120-Ticket limit and archive exclusion are removed, so visible archived work remains in history. Caller RLS and the existing non-preview demo filter still apply.

The query no longer selects raw Ticket title, description or resolution notes. A fixed-field projection returns canonical IDs/reference, known category/status/priority values, dates and allowlisted owner-submission metadata; unknown textual values cannot carry arbitrary content into those fields. Titles are derived from canonical category labels and Ticket references. Until a reviewed owner-safe narrative path exists, the description explicitly says detailed owner-safe work information has not yet been published. This is an interim safety boundary, not fulfillment of the full operational-context requirement.

670 unit tests / 78 files / 1953 assertions pass; TypeScript and focused lint pass; all 24 isolated migrations pass; production client/server build passes in `.codex-qa.local/build-20260915-owner-ticket`. Tests inject private text into source fields and unknown enum values, verify exclusion, and load 1305 Tickets across 101 properties under a 200-row backend cap, retaining archived history while excluding unrelated homes and demo records. No schema or RLS changes in this checkpoint.

Locked requirement remains PARTIALLY IMPLEMENTED. Automatic opportunity materialization, reviewed work/cost/outcome context and authority-driven WHY remain pending. The canonical Operations approval path is in `work-orders.ts` (`ownerApprovalRequest`) and linked `approvals` records for `entity_type=work_order`; saved work-order authority, quotes and approval state must be used instead of the owner's submitted Ticket path or a new dollar rule. Full owner payload/RLS proof, including reviews and other detail endpoints, is still outstanding.

### September 15 follow-up: canonical Work Order authority explanations

`ownerTicketRequest` reuses `work-orders.ts` evaluateAuthority; it does not define spending thresholds. The Ticket projection now loads paged, narrowly selected Work Order authority inputs and attaches request category, label, WHY, action-needed state and policy versions. Work Orders must match both Ticket and Property. Raw scope, vendor/contact and internal notes are not selected or copied into the explanation.

The $150 example is covered as Review — No approval required through canonical evaluation. Other cases cover owner approval across multiple Work Orders, supervisor-only authorization, missing quote/authority, emergency mitigation limited to the immediate issue, prior decisions and declined work. An approved amount that is absent or below the current quote remains unconfirmed. The owner's submitted Ticket path is not used to decide spending authority. Review time remains actual manual participation.

676 unit tests / 79 files / 1977 assertions pass; TypeScript and focused lint pass; all 24 isolated migrations pass; production client/server build passes in `.codex-qa.local/build-20260915-owner-authority`. No schema, access policy or external data changed.

Locked requirement remains PARTIALLY IMPLEMENTED. These are serialized request explanations, not yet the complete owner-facing opportunity flow. Automatic opportunity synchronization, canonical approval-record reconciliation against the Work Order mirror, rendered explanations, detailed safe work/cost/outcome publishing, and canonical identity validation of existing enrollments remain pending. Full-schema RLS/owner isolation and authenticated acceptance are not proven by this classifier. Next implementation must connect these pieces without treating missing authority or legacy Owner links as authorization.

### September 15 follow-up: canonical approval receipt reconciliation

The owner Ticket projection now reconciles Work Order approval mirrors against canonical owner approvals matched by approval ID, Work Order ID, Property ID and approver role. A pending canonical decision overrides a stale approved mirror. Missing, mismatched or unsupported records leave authority unconfirmed; approved records require a decision timestamp and valid amount. Both the canonical amount and any narrower mirrored approval must cover the current quote. Non-preview approval reads exclude demo records. No raw approval title, detail, decision note or contact data is selected.

679 unit tests / 80 files / 1997 assertions pass; TypeScript and focused lint pass; all 24 isolated migration checks pass; production client/server build passes in `.codex-qa.local/build-20260915-owner-approval`. Tests cover stale decisions, identity mismatches, missing receipts and changed amounts. No schema or RLS changes were introduced.

Locked requirement remains PARTIALLY IMPLEMENTED. Automatic opportunity synchronization, rendered explanations, detailed safe work/cost/outcome publishing and canonical identity validation of existing enrollments remain pending. Separate reads are not a transactional snapshot; this metadata is not an approval mutation or authorization to perform work. Full owner payload/RLS and authenticated acceptance remain unproven. No access is needed for the remaining independent local implementation.

### September 15 follow-up: work-alert text safety

Inspection found a bypass of the structured Ticket projection: existing database notification triggers copy raw Ticket titles/descriptions/resolution notes into owner_notifications, and the hub and delivery worker previously forwarded those fields. The shared ownerNotificationText formatter now replaces Ticket/review alert text at both output paths, retaining urgency/resolution and directing owners to the portal without implying every review requires approval. It also covers historical alerts whose Ticket link has been removed. Delivery-worker contact tasks use the same text. No delivery worker was executed and no external message was sent.

681 unit tests / 81 files / 2012 assertions pass; TypeScript and focused lint pass; all 24 isolated migrations pass; production client/server build passes in `.codex-qa.local/build-20260915-owner-alert-safety`. Injected private text is excluded from linked and legacy work notifications. No schema/RLS changes or stored notification updates were made.

Locked requirement remains PARTIALLY IMPLEMENTED. This closes these application output paths, not direct-table exposure. Existing notification generators still store raw text, direct database owner access needs review, and canonical enrollment/current-property checks on notification routing remain incomplete. Automatic opportunity generation must account for existing notification triggers before adding records. Detailed owner-safe operational context, automatic synchronization and authenticated isolation remain required; generic alert text is not a substitute for the opportunity itself. No access is needed for independent local fixes.

### September 15 follow-up: canonical Ticket alert routing

Before a queued Ticket alert can reach email or a contact task, ticketAlertRecipient rechecks the program canonical Owner, portal-user binding, active/pending status, archive/demo state, current Ticket Property and included enrollment. Contact details come from property_owners, not the program's free-text snapshots. Missing sources, changed ownership, removed enrollment, inactive Owners or failed lookups skip delivery with a staff-review reason. No worker was executed and no external messages or contact tasks were created.

685 unit tests / 82 files / 2033 assertions pass; TypeScript and focused lint pass after adapting rejection assertions to the repository test declarations. All 24 isolated migration checks pass. Production client/server build passes in `.codex-qa.local/build-20260915-owner-alert-identity`. Tests cover canonical secondary-property routing, identity mismatch, removed enrollment, demo/inactive/archive states and failed reads.

Locked requirement remains PARTIALLY IMPLEMENTED. This guard handles Ticket-linked delivery; non-Ticket review delivery, stored raw notification text, owner hub/direct-table access and concurrent ownership/recipient changes still require review. Separate preflight reads do not establish an atomic delivery claim or prevent every concurrent reassignment. Automatic opportunity creation, rendered WHY and detailed safe work/cost/outcome publishing remain required. No approval/access is needed for independent local implementation; authenticated acceptance still needs an approved isolated environment and test roles.

### September 15 follow-up: safe notification generators

Migration 20260915070000_safe_ticket_notifications.sql replaces the existing Ticket and review notification generators with fixed alert text, excluding raw titles, descriptions, resolution notes, recommendations and impact. Ticket routing uses canonical Owner + included Property enrollment (including secondary homes), active/pending unarchived non-demo programs and active canonical Owners. Review alerts validate their program and, when property/Ticket-linked, the current canonical Property relationship. Existing channel preferences and trigger execute restrictions remain; this is not a new delivery channel or an RLS change.

All 25 additive migrations pass the isolated runner. New tests cover secondary-property routing, event duplicate suppression, resolution context, private text exclusion, removed enrollment, transferred ownership, demo records, review/Ticket property mismatch and trigger privilege restrictions. The fixture now includes the existing anon role so revocation is tested against the intended schema. Focused runner lint and diff whitespace checks pass. Application code is unchanged from dbd2b97, where 685 unit tests, TypeScript, focused source lint and production build passed; those unchanged checks were not repeated for this SQL-only checkpoint.

Migration remains unapplied to shared/live. No existing notification rows were rewritten, no delivery worker ran and no message was sent. Historical raw storage and direct-table access remain unresolved; the prior application output sanitizer still protects those output paths. Non-Ticket delivery concurrency and full-schema permissions need acceptance. Locked requirement remains PARTIALLY IMPLEMENTED: safe notification generation is a prerequisite, not automatic Ticket opportunity materialization or detailed owner context. The next implementation must reuse owner_reviews while preserving decisions/time history and avoiding duplicate notification fanout.

### September 15 follow-up: automatic Ticket opportunity creation

Migration 20260915080000_automatic_ticket_opportunities.sql reuses owner_reviews and the existing program/Ticket uniqueness rule. Ticket inserts/updates, enrollment inclusion and program identity/status changes ensure linked opportunities for canonical included Properties. An initial reconciliation covers existing eligible Tickets without guessing legacy Owner identities. New rows use fixed safe text, property links and an auto_ticket marker; existing rows, decisions and time links are not replaced. Closed Tickets remain review opportunities. Automatic rows suppress duplicate review-ready notifications; ordinary Ticket notifications remain governed by the prior safe generator.

The owner hub decorates generated reviews with the current canonical Ticket authority request, category and WHY, preserving review ID/status/recorded response. Missing or mismatched Ticket context leaves authority unconfirmed. Manual opportunity rows are preserved. A detailed work summary is explicitly pending publication; automatic creation does not invent a narrative or participation time.

687 unit tests / 83 files / 2042 assertions pass; TypeScript and focused source/runner lint pass. Generated types pass logic lint with the existing formatting-baseline exception. Production client/server build passes in `.codex-qa.local/build-20260915-automatic-ticket`. All 26 isolated migration files pass. Tests prove creation for pre-enrollment and new Tickets, stage-change identity/decision preservation, property-link uniqueness, demo/removal exclusion, closed-work coverage, notification suppression, restricted sync execution and atomic rollback when a link insert fails. UI projection tests cover review/approval WHY and wrong/missing property context.

Locked requirement remains PARTIALLY IMPLEMENTED. Detailed reviewed work/cost/outcome content, canonical approval-response integration, all eight automatic request sources, existing manual/legacy reconciliation and complete authenticated owner isolation remain open. Persisted generated rows have an informational base; the hub derives current authority at read time, so other review/detail paths require integration. Multi-connection concurrency, property transfers, direct-table bypass, unbound legacy programs and the full deployed trigger graph remain unproven. Sync failures deliberately roll back the source write; test this behavior and deadlock/retry handling against an approved isolated full schema before acceptance. No shared migration, message or production data change occurred.

### September 15 follow-up: participation response safeguards

respondToReview now verifies the current program Owner and availability, rejects closed/archived programs and unavailable reviews, and compares viewed status/updated_at before saving. Automatic Ticket opportunities accept acknowledgement only through this path; arbitrary repair approval decisions are rejected. Acknowledgement preserves the automatic opportunity's outstanding status and records a participation-response event rather than a repair approval. This avoids dismissing a separate canonical decision request.

690 unit tests / 84 files / 2057 assertions pass. TypeScript passes after correcting a test-only index-signature access; focused lint, production client/server build (`.codex-qa.local/build-20260915-owner-review-response`) and all 26 isolated migration checks pass. Denial tests cover another Owner, closed/archived programs, future/already-answered reviews, forged approval text and stale writes.

Locked requirement remains PARTIALLY IMPLEMENTED. The owner UI still submits acknowledgement, not a canonical Work Order approval. A complete per-request approval interaction is required. Automatic review-only items also need a participation-completion display distinct from outstanding operational decisions; preserving status here is an interim safety safeguard. Response/history writes remain non-atomic and program reassignment concurrency is not solved by the viewed-review comparison. Detailed safe summaries, full-schema owner access and authenticated acceptance remain open. No new migration or external action occurred.

### September 15 follow-up: atomic response and history

Migration 20260915090000_atomic_owner_review_response.sql adds an invoker-security response RPC that locks the review, verifies the caller's program and availability, compares the supplied database version, preserves automatic-request status, and commits response plus previous/new response history together. The server uses this RPC instead of separate review/event writes. Badge refresh remains on hub load, removing a post-commit error path that could falsely report a saved response as failed. Existing RLS applies; no table policy or shared schema was changed.

690 unit tests / 84 files / 2057 assertions pass; TypeScript and focused source/runner lint pass (generated types retain the documented formatting-baseline exception). Production client/server build passes in `.codex-qa.local/build-20260915-atomic-review-response`. All 27 isolated migration files pass. Owner-role SQL checks prove response/history persistence, history-failure rollback, cross-owner denial, stale version rejection and rejection of repair approval through automatic acknowledgements. The initial fixture failure was corrected to use the runner's test.actor identity and scoped history policies.

Migration remains unapplied to shared/live. Complete concurrency acceptance is still open: the server currently supplies its freshly read review version, not the version the browser originally displayed, and program reassignment is not locked across the response transaction. Canonical approval UI, separate participation-completion display, detailed safe summaries and authenticated/full-schema owner isolation remain required. Locked requirement stays PARTIALLY IMPLEMENTED. The Lovable preview branch remains at the explicitly requested 626b33a7e751a648d6f05309bd4d851f2e1c3036; only the feature branch advances.

### September 15 follow-up: browser-origin response version

The aggregate now returns review updated_at. The owner response dialog captures that version when opened and retains it across background refreshes. Submission requires expectedUpdatedAt; the server passes that original browser version to the atomic RPC instead of substituting a fresh read. Missing versions disable response opening, and error handling retains the draft in the open dialog. Existing canonical response safeguards and history transaction remain unchanged.

690 unit tests / 84 files / 2057 assertions, TypeScript, focused source/route lint, production build (`.codex-qa.local/build-20260915-owner-response-version`) and all 27 isolated migration checks pass. The regression now provides an older browser version and a newer server record, verifying the original version reaches the RPC; the SQL test already proves rejection. Modern-web form guidance was consulted. No authenticated interactive refresh/conflict test was performed.

Locked requirement remains PARTIALLY IMPLEMENTED. Browser-version protection is implemented locally; full UI/concurrent-session acceptance and program reassignment locking remain unverified. Canonical approval interaction, review-only completion display, detailed safe summaries and full-schema owner isolation remain open. Preview branch remains at 626b33a7e751a648d6f05309bd4d851f2e1c3036. No migration or external delivery was performed.

### September 15 follow-up: review-only display and explicit manual time

Generated opportunities now carry structured owner-request metadata. The owner hub separates required responses from Property work to review, labels acknowledged review-only items as reviewed, and preserves required decisions even if participation was acknowledged. Review details and recorded responses remain readable in history/preview; closed items cannot accept time or responses. Decisions still use the existing OwnerApprovalPanel, whose successful decisions now invalidate owner-home classification. The response dialog explicitly distinguishes notes from repair approval. Recent activity no longer links owners to the internal Ticket route.

The review time dialog previously prefilled 30 minutes and clamped invalid values. It now starts/resets blank and rejects empty, fractional, invalid or out-of-range durations, preserving valid owner-entered minutes exactly. Existing server attestation and eligibility checks remain.

695 unit tests / 86 files / 2074 assertions pass; TypeScript, focused source/route lint, production client/server build (`.codex-qa.local/build-20260915-owner-review-display`) and all 27 isolated migration checks pass. Tests cover review-only vs required/unknown authority, acknowledgement not dismissing an approval, manual task behavior and absence of duration coercion. Modern-web form guidance was consulted. Full authenticated desktop/mobile interaction is not yet accepted.

Locked requirement remains PARTIALLY IMPLEMENTED. Detailed safe work/cost/outcome publishing, the full approval path's safe payload and atomic Work Order synchronization, all automatic request categories, direct-table owner isolation and concurrent reassignment remain open. The existing approval panel is present; its existence is not evidence of complete canonical approval security. Removing the internal Ticket link closes this navigation path, not direct-route/database access. Both preview branches remain at their explicitly requested SHAs; only the feature branch advances.

## September 15 — homeowner approval role/demo scope

Owner approval reads now explicitly require the signed-in recipient, owner approver role and non-demo classification. Direct decisions reject other roles/demo records; the conditional generic write repeats those restrictions so a changed role or demo flag cannot pass the pre-read check. Property-label lookup errors now propagate.

Unapplied migration `20260915100000_owner_approval_role_demo_guards.sql` extends the existing task/financial response functions, preserving their grants, lock order and atomic mirrors while checking approval and source-record demo scope under their locks. No shared migration was run. Local fixtures explicitly mark synthetic records non-demo inside their rolled-back transactions to exercise the real owner path. Isolated tests reject staff-role, demo approval and demo source records without changing decisions/mirrors; earlier rollback/duplicate/amount tests still pass against the replacement functions.

Validation: 698 unit tests / 87 files / 2087 assertions; TypeScript and strict focused lint pass; all 28 isolated migration files pass; production client/server build passes in `.codex-qa.local/build-20260915-approval-scope` without deployment.

Remaining: the owner approval panel currently forwards Work Order scope as approval detail. A reviewed owner-safe description must preserve enough context for informed decisions without exposing internal content. Canonical Owner/Property relationship revalidation, atomic Work Order approval synchronization, multi-connection concurrency, remaining onboarding requirements and authenticated role/mobile acceptance are still incomplete. This checkpoint does not establish global RLS safety. Verdict: MORE IMPLEMENTATION REQUIRED.

## September 15 — authored Work Order owner approval context

The existing Work Order approval form now requires a separate owner-facing explanation (20–4,000 characters) and stores it in the canonical approval detail, with a neutral title. It no longer automatically copies internal scope/title. Help text calls for the issue, work performed, proposed repair and reason for the decision, excluding guest personal information, private notes and credentials. The draft starts empty, stays on failure and uses the existing per-Work-Order state reset. The authority/evidence snapshot remains internal. No approval or external message was created by this implementation run.

Validation: 700 unit tests / 87 files / 2092 assertions; TypeScript passes; focused lint has zero errors and one pre-existing WorkOrderDrawer useMemo dependency warning (verified against prior HEAD); production build passes in `.codex-qa.local/build-20260915-owner-approval-copy`; all 28 isolated migrations pass. No schema changes in this checkpoint. Desktop/390px authenticated form interaction remains unverified.

This is authoring support, not proof of a complete safe projection. Legacy approvals are untouched and may still contain internal text. Review provenance and enforcement against direct writes, owner-safe opportunity narratives for review-only Tickets, canonical recipient checks, atomic Work Order approval preparation/decisions and full role/RLS/concurrency acceptance remain incomplete. The locked requirement stays PARTIAL; verdict MORE IMPLEMENTATION REQUIRED.

## September 15 — atomic Work Order owner request

Unapplied migration `20260915110000_atomic_work_order_owner_request.sql` creates an invoker transaction for the existing Work Order owner request. It checks internal staff, locks the Work Order, rejects closed/stale/duplicate requests and invalid quotes, verifies canonical Property/Owner and Ticket identity, and derives the portal recipient only from a current pending/active canonical program with explicit included enrollment. No browser-supplied recipient or contact matching remains in this path. The canonical approval, Work Order mirror and internal snapshot/history save together. Standard/non-enrolled requests retain a null portal recipient; no message is sent. Existing table RLS and grants remain in force.

The drawer calls that transaction and retains the version from the first explanation edit. Removed the obsolete capped client-side enrollment lookup. No fallback to the earlier non-atomic writes. The staff-only history retains the original Work Order snapshot and approval ID; owner-facing text remains the explicitly authored explanation.

Validation: 700 unit tests / 87 files / 2092 assertions; TypeScript; focused lint zero errors with the existing useMemo warning; generated types logic lint passed without whole-file formatting; production build passed in `.codex-qa.local/build-20260915-work-order-request`; all 29 migration files passed the isolated runner. New SQL cases cover history-failure rollback, stale/duplicate requests, staff denial, summary/quote validation, Ticket mismatch, canonical recipient, excluded enrollment and invoker/anonymous privilege checks. Minimal fixtures do not establish full deployed-schema or multi-connection safety.

Remaining: atomic owner/staff Work Order decisions, canonical identity revalidation at decision/delivery time, direct-write bypass/concurrent enrollment paths, server-enforced reviewed safe content and legacy approvals, review-only operational narratives, broader Onboarding and authenticated desktop/390px acceptance. Locked requirement remains PARTIAL. Verdict MORE IMPLEMENTATION REQUIRED. No live migration, merge, deployment, messages or deletion.

## September 15 — atomic owner-entered Work Order decisions

Unapplied migration `20260915120000_atomic_owner_work_order_response.sql` adds the service-only owner decision transaction. The existing authenticated endpoint first reads the recipient-scoped approval, then passes its authenticated user ID to the transaction. Owners receive no internal Work Order access or direct RPC execution. The transaction locks the Work Order and canonical approval; rejects changed entity/property/recipient/role/demo/status/quote; validates an active canonical Owner and current included pending/active program; and checks the Ticket relationship. Approval status, Work Order approved amount/status/note, internal history and global audit commit together. Declining grants no amount. The endpoint returns the transaction result without a separate audit write for this path.

Validation: 700 unit tests / 87 files / 2092 assertions, TypeScript, strict touched source/test/script lint and generated-types logic lint pass. Production build passed in `.codex-qa.local/build-20260915-owner-work-order-response`. All 30 isolated migrations passed. SQL coverage includes wrong recipient, demo, changed quote, excluded enrollment, inactive Owner, completed program, missing canonical identity, staff-role approval, approval/decline mirrors, duplicate rejection and forced audit failure rolling back approval/Work Order/history. Direct owner and anonymous execution are denied. The fixture is intentionally minimal, not full-schema RLS or concurrent-session proof.

Remaining: staff-transcribed Work Order decisions still use the older separate writes and require consistent lock order/atomicity; browser-origin approval version checks are not yet implemented. Owner-safe projection/review provenance and legacy text, direct-table bypass, complete concurrency/role tests, remaining Onboarding requirements and authenticated desktop/390px acceptance remain incomplete. Locked requirement PARTIAL; verdict MORE IMPLEMENTATION REQUIRED. No shared migration, deployment, merge, messages or deletion.

## September 15 — atomic staff-transcribed owner decisions

Unapplied migration `20260915130000_atomic_staff_work_order_owner_decision.sql` replaces the drawer's separate approval/Work Order/history writes. It preserves existing internal-staff access and invoker RLS, locks Work Order then approval consistently with owner responses, requires a pending canonical owner request and viewed Work Order version, and rejects changed quote/property/entity/role/demo scope. A staff-transcribed amount cannot exceed the original request; a smaller authorization remains distinct from the requested quote. Decline/information responses authorize no amount. Information requests retain canonical pending status. Response note, recorder, timestamp/channel and previous approval evidence are retained atomically with the Work Order mirror and history.

Validation: 700 unit tests / 87 files / 2092 assertions; TypeScript passes; focused source/script lint zero errors with the pre-existing WorkOrderDrawer useMemo warning; generated types pass logic lint; production build passed in `.codex-qa.local/build-20260915-staff-work-order-decision`. All 31 migration files passed the isolated runner. New SQL tests cover staff denial, missing note, stale version, invalid amount/outcome combination, wrong approver role, forced history rollback, information-only behavior, smaller approved amount, evidence/provenance and duplicate denial. No live migration or external action occurred.

Remaining: browser-origin approval/version handling, current ownership validation for staff-recorded external responses, all other direct approval writers and full concurrent/deployed-schema RLS proof, reviewed owner-safe content/legacy records, complete Onboarding workflow acceptance and authenticated desktop/390px checks. Request/owner/staff transactions now share lock order, but minimal single-connection fixtures do not establish global concurrency safety. Locked requirement remains PARTIAL; MORE IMPLEMENTATION REQUIRED.

## September 15 — account boundary for owner state and caches

The authenticated layout now observes auth identity changes, hides the previous account's workspace, clears the shared in-memory query/mutation caches, and revalidates route authorization outside the auth callback. Same-account token refreshes retain data. Query clear destroys pending queries so a late response cannot repopulate the prior account's cache; it does not undo an already-started server mutation. The workspace remounts by account ID. Owner hub and approval queries now include the authenticated route account, with explicit preview identity in the hub key; the approval editor remounts by account and hub drafts by account/program/mode. No reliance on the separately cached current-user-id hook for these keys.

Validation: 703 unit tests / 88 files / 2103 assertions; TypeScript passes after replacing two unsupported test matchers; strict touched-file lint passes; production build passes in `.codex-qa.local/build-20260915-owner-account-boundary`; all 31 isolated migrations pass. Real QueryClient tests prove cached role/home removal, same-account refresh preservation, deferred route reload, cleanup and late-query isolation after sign-out. No migration change in this checkpoint.

Remaining: authenticated multi-account/cross-tab/browser rendering acceptance, in-flight mutation callbacks and full external-owner RLS/direct-write review, reviewed safe content and legacy approvals, stale approval form/version work and remaining Onboarding requirements. This local cache boundary is not full authorization proof. Locked requirement remains PARTIAL; MORE IMPLEMENTATION REQUIRED.

## September 15 — missed auth event on account remount

Review found that the account boundary could miss sign-out/sign-in events while the authenticated layout was unmounted. The helper now retains the cache owner in a WeakMap keyed by QueryClient and clears mismatched caches on subscription setup as well as live identity changes. The layout waits for the initial auth notification before mounting private consumers. Same-account remounts and token refreshes preserve their caches. Tests reproduce an unmounted layout followed by a different-account mount with cached prior roles/home data.

Validation: 705 unit tests / 88 files / 2107 assertions; TypeScript and strict touched-file lint pass; production build passes in `.codex-qa.local/build-20260915-account-remount`; all 31 isolated migrations pass. No schema change. Remaining authenticated browser/cross-tab acceptance, provider-local preview state and in-flight mutation review, owner-safe content, stale approvals, direct RLS/API boundaries and remaining Onboarding requirements are not covered by this regression test. Locked requirement remains PARTIAL; MORE IMPLEMENTATION REQUIRED.

## September 15 — account-scoped preview selections

Owner-program, role, demo-lens and preview-seat selections now bind to the authenticated account in session storage. The account boundary clears those four settings when identity changes or signs out, including layout remounts; unbound legacy selections are cleared rather than assigned to an assumed account. Existing preview change events synchronize mounted hooks/providers. Same-account reloads keep an intentional preview. Unrelated preferences remain intact. No program, demo record or production data was changed.

Validation: 708 unit tests / 89 files / 2121 assertions; TypeScript and strict focused lint pass; production build passes in `.codex-qa.local/build-20260915-preview-account`; all 31 isolated migrations pass. Tests cover cross-account removal, same-account retention, legacy/unbound state and sign-out. No schema change. Authenticated browser/provider rendering and cross-tab acceptance remain unverified; storage values remain a UI preference, never an authorization grant. In-flight mutation review, stale approval versions, complete owner-safe content/RLS and broader Onboarding requirements remain incomplete. Locked requirement PARTIAL; MORE IMPLEMENTATION REQUIRED.

## September 15 — direct Onboarding project reads

The authenticated project list/detail endpoints now call actor-scoped loaders. Both verify Onboarding/supervisor capability and fail closed on capability lookup errors. Lists filter non-supervisors to their PM/director assignments before pagination; supervisors retain portfolio access. Property project/history reads use the same responsibility guard as property management, denying assigned-only/unrelated staff before full project/history loads. Existing raw loaders remain available for internal workflows that already apply their own response projection. No RLS, navigation or shared schema change.

Validation: 712 unit tests / 90 files / 2135 assertions; TypeScript and strict focused lint pass; production build passed in `.codex-qa.local/build-20260915-project-read-access`; all 31 isolated migrations pass. Four regression tests cover non-staff/errors, denied details/history, lead/director list scope, supervisor portfolio and permitted property history. Remaining direct endpoints/writers, database API bypass, concurrent reassignment and authenticated role/desktop/390px acceptance are unproven. Active Owner safe-content/stale-approval gaps and the full requirement checklist remain incomplete. MORE IMPLEMENTATION REQUIRED.

## September 15 — Onboarding project mutation responsibility

Project updates and Start Onboarding retries against an existing project now require its PM/director or a supervisor after capability verification. The incoming patch cannot self-assign an unrelated caller before this check. Updates compare the read project ID, property, updated_at and status; a competing change rejects the write and no success history is written. The existing project updated_at trigger supplies version changes. New-project creation policy is unchanged.

Validation: 716 unit tests / 91 files / 2148 assertions; TypeScript and strict focused lint pass; production build passed in `.codex-qa.local/build-20260915-project-write-access`; all 31 isolated migrations pass. Tests cover unrelated edits/self-assignment, unauthorized existing-project repair, stale write rejection and PM/director/supervisor success with history. No schema change. Project update/history/enrollment side effects are not yet a single transaction; lifecycle/stage freeze and concurrent Start Onboarding checks remain incomplete. Full owner-safe content, stale approvals, database authorization and authenticated acceptance remain open. MORE IMPLEMENTATION REQUIRED.

## September 15 — viewed approval version through owner decisions

The owner approval payload now includes updated_at and the decision endpoint requires the browser's expectedUpdatedAt. The panel captures it when a note starts, retains notes on refresh/failure and disables submission when a revised request arrives until the owner reviews it. Clicks without a draft use the displayed row version. Failed decisions reload the request without erasing the note. Generic conditional approval writes now include updated_at.

Unapplied migration `20260915140000_versioned_owner_approval_response.sql` checks the browser version after locking the same source row then approval used by existing Work Order/task/financial response functions. It delegates within the same transaction, preserving their role, amount, identity, history and audit guards rather than duplicating them. The new entry point is service-only; existing service-only functions remain internal implementation paths. No owner grants or shared migration.

Validation: 716 unit tests / 91 files / 2148 assertions; TypeScript, strict touched-file lint and generated-types logic lint pass; production build passed in `.codex-qa.local/build-20260915-versioned-owner-approval`; all 32 isolated migrations pass. New SQL tests reject stale/missing versions and accept current responses for all three entity types; generic-write regression verifies the version predicate. Authenticated two-session form behavior, staff draft-version handling, all direct writers/RLS, complete owner-safe content and remaining Onboarding requirements remain incomplete. Locked requirement PARTIAL; MORE IMPLEMENTATION REQUIRED.

### September 15: owner program transport allowlist

The owner home endpoint previously serialized the aggregate program's internalNotes field. It now uses an explicit owner program projection, excluding staff notes and future unlisted fields from both normal and preview owner payloads. The staff aggregate remains intact. A serialized-payload regression verifies exclusion without modifying the source record.

Validation: 717 unit tests across 92 files (2150 assertions), TypeScript, focused lint, production build in .codex-qa.local/build-20260915-owner-program-projection, and all 32 isolated migration files pass. No migration was added or applied to shared/live.

The locked Ticket requirement remains PARTIALLY IMPLEMENTED. The owner feed still reads authority metadata with the caller client, while Work Order RLS is internal-only; a properly authorized narrow server projection is still needed. Full canonical enrollment authorization, safe detailed work/cost/outcome, other aggregate payload fields, direct-table isolation, and authenticated acceptance remain open. This patch proves program-note exclusion only, not complete owner payload security. Acceptance must inspect the serialized owner-home response, including a program with private staff notes, in an approved isolated environment. No human access is needed for further local work.
