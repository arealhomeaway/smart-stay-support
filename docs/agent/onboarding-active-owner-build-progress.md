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

Still required: remaining approval concurrency and
policy configuration audits, role queues and filtered navigation, authenticated
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
