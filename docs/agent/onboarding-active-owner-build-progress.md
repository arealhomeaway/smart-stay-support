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
