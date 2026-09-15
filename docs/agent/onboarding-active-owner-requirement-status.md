# Onboarding and Active Owner requirement audit

Working audit, not acceptance approval. Sources: the active build goal and its four referenced plans, re-read during the overnight run. The September 3 staged model supersedes the September 1 workspace tabs; the active goal requires Full Furnishing and No Furnishings. The broader beta plan supplies safety and integration constraints, not authorization to activate its external workflows.

PASS means the stated local check is proven. PARTIAL means implementation or verification remains incomplete. BLOCKED means a specific external/permission boundary prevents that item. NOT YET ACCEPTED means interactive acceptance remains outstanding. A local PASS does not imply authenticated acceptance.

| Requirement | Status | Current evidence and remaining work |
|---|---|---|
| Separate property, owner, project, portal access, enrollment | PARTIAL | Project/enrollment implementation exists; real account relationships and owner visibility need acceptance. |
| Explicit Start Onboarding with known context | NOT YET ACCEPTED | Initialization and retry logic implemented; authenticated flow unverified. |
| Branch, responsible roles, closing/possession/handoff dates, scope, references | NOT YET ACCEPTED | Project capture implemented; verify all fields and preservation in preview. |
| Full Furnishing and No Furnishings through one applicability engine | PARTIAL | Local scope/fixture tests; full project acceptance outstanding. |
| Furnishing, pool, HOA, utilities, repairs, appliances, lock, cameras, warranty, Active Owner modules | PARTIAL | Engine and ancestor applicability implemented; final module-by-module evidence mapping remains. |
| Owner contact in property, project, approval, handoff | PARTIAL | Property capture exists; all four contexts still need explicit inspection. |
| Eight work states and prerequisite/lifecycle/scope release | PARTIAL | Derived states and tests exist; all mutation paths and stage freezes need final audit. |
| Future work quiet; actionable work visible | NOT YET ACCEPTED | Synthetic WorkflowTable desktop/mobile preview checked earlier; full workspace unverified. |
| Revisioned native stage capture | PARTIAL | Local migration tests; authenticated revision/correction interactions outstanding. |
| Observations and file metadata within approved storage boundaries | PARTIAL | Capture/evidence model exists; verify permissions and file links with isolated accounts. No external file writes authorized. |
| Reviewed permanent property and asset facts | PARTIAL | Atomic stale-value and rollback tests; equipment UI needs authenticated acceptance. |
| Preserve prior values, reviewer, evidence, reason; controlled reopen | PARTIAL | Stage/fact history implemented. Task reopen now preserves evidence and rejects stale completion. Cross-table concurrent task/stage paths remain. |
| Equipment child records; restricted credentials remain secure | PARTIAL | New scoped asset table and field allowlist tested; schema review and acceptance remain. |
| Canonical owner approval and both channels | PARTIAL | Atomic request/decision and delivery reconciliation checks pass; no live sends or authenticated acceptance. |
| Approval property/task/evidence/request/response linkage | PARTIAL | Local transaction tests cover key boundaries; full lifecycle acceptance remains. |
| Meaningful notifications and deep links | PARTIAL | Delivery work exists; audit all state-change triggers and role routing. Staff email remains prohibited by beta direction. |
| Utilities, restricted credential references, costs | PARTIAL | Validation implemented; full UI and external-owner visibility need acceptance. |
| Estimate, approved, invoice, actual, variance, accounting separation | PARTIAL | Guards and migration tests exist; complete path acceptance outstanding. |
| Configurable authority thresholds and accounting mailbox | PARTIAL | Policy snapshots implemented; mailbox configuration and actual delivery verification need authorized environment. |
| PM > Director Onboarding > Director Operations > Ops acceptance > Supervisor Live | PARTIAL | Locked review migration tested; full chain and competing mutation audit incomplete. |
| Handoff blockers, carryover, finance independent of Live | PARTIAL | Derived readiness and tests exist; transaction rechecks carryover links, assignee, date and reason. Full readiness-input concurrency and end-to-end acceptance outstanding. |
| Six workspace areas and details in drawers | NOT YET ACCEPTED | Implemented; full desktop/390px verification pending. |
| Manager Hub and My Work | PARTIAL | Assignment/team selection and filtered drill-through implemented; role-specific experience unverified. |
| PM, directors, supervisor, field role homes | PARTIAL | Local selection guards; common Director hub navigation and wider workspace payload still need role-specific behavior. |
| Director attention/review/correction/risk/blocked/upcoming/handoff/workload queues | PARTIAL | Queue/drill-through work exists; inspect each named queue against current routes. |
| Origin, filters, contextual Back | PARTIAL | URL state implementation exists; complete navigation acceptance remains. |
| Two marked QA projects excluded from KPIs | PARTIAL | Synthetic fixtures cover Full/No Furnishing; authenticated isolated project seed/acceptance not performed. |
| Owner property enrollment excludes non-enrolled properties | PARTIAL | Logging boundaries tested; portal/document/ticket/review RLS audit remains. |
| Real program activation and one preserved clock | PARTIAL | Status bypass and competing activation fixed; property enrollment changes during activation remain open. |
| Opportunity > entry, property/date eligibility, demo classification | PARTIAL | Atomic logging RPC and isolated owner-role tests; direct table policy assumptions and concurrent changes remain. |
| Distinct-entry totals and correction chains | PARTIAL | Shared countable selector and tests; final report/badge/90-day window consistency review remains. |
| Owner and staff immutable corrections with evidence/property/activity links | PARTIAL | Migrations 15/17 tested; authenticated role acceptance and complete history durability remain. |
| 90-day benchmark, milestones, 100-hour threshold, alerts, badges | PARTIAL | Existing pure tests; full source-to-behavior reconciliation remains. Older approved plan specifies strictly above 100, while goal says at least 100; do not silently change threshold policy. |
| Manual time only, no tax guarantee | PARTIAL | Existing notices and manual input; inspect all owner/report copy before acceptance. |
| Combined report and disclaimer before completion | PARTIAL | Completion saves generated report in same update. Export uses stored attestation and counted/history distinction. Saved-report export tested; concurrent-change verification remains. |
| Formal completion enforces checklist | PARTIAL | Missing-description gate fixed; report prerequisite implemented; concurrent entry/task changes during closeout remain open. |
| No owner cross-access or demo leakage | PARTIAL | Focused RPC tests are insufficient for global RLS proof; complete external-owner audit remains. |
| Operations preserved | PARTIAL | Full unit suite passes; targeted Operations regression/route smoke still required after final changes. |
| Additive unapplied migrations, grants/RLS review | PARTIAL | 19 local migration files pass the isolated runner; minimal fixtures do not prove complete deployed schema. |
| Full unit suite | PASS | September 15: 643 tests, 68 files, 1550 assertions, zero failures. |
| TypeScript and focused lint | PASS | TypeScript passes. Strict touched source/test/script lint passes. Generated types and owner-program route pass logic lint with formatting rule disabled. Strict generated-file lint reports 8199 formatting errors; no broad reformat performed. |
| Final production build | PASS | September 15 production client/server build passed in fresh isolated output `.codex-qa.local/build-20260915-resume-verified`. Child-process escalation required; no deployment. |
| Clean commits/push and draft PR updated | PARTIAL | Verified checkpoint prepared for feature-branch commit/push and PR update. Final response/PR records resulting SHA and publication status. |
| Authenticated desktop and 390px acceptance | BLOCKED | Need an approved isolated schema and role/test-account access. Shared/live migrations and account creation not authorized. |
| Consolidated review request and morning report | PARTIAL | This checkpoint explicitly remains MORE IMPLEMENTATION REQUIRED. Authenticated acceptance is not yet ready. |

## September 15 checkpoint evidence and remaining defects

The existing implementation was preserved. Broad PARTIAL rows above remain incomplete. Passing isolated checks do not substitute for missing behavior or acceptance evidence.

- Atomic time logging and multi-property checks: migration 16 and `supabase/tests/owner_time_entry.test.sql` cover entry/link rollback, enrollment/closing/date, opportunity membership, owner/ticket mismatch and inherited demo classification. Concurrent enrollment/status changes remain unprotected.
- Atomic staff corrections: migration 17 and `supabase/tests/staff_time_correction.test.sql` cover server-only execution, supervisor checks, shared amendment lock, preserved evidence/property/activity/attestation, duplicate rejection and audit-failure rollback.
- Lifecycle: `owner-program-status-gates.test.ts` covers forbidden transitions, stale activation/status writes and preserved start clock. Enrollment changes during activation remain outside that check.
- Saved reports: migration 18 adds the saved snapshot; `owner-report-snapshot.test.ts` covers stored attestation, correction counting, saved export and denied access. Migration 18 has schema-application coverage, not a concurrent closeout transaction test.
- Atomic handoff/carryover: migration 19 and `handoff_request.test.sql` cover request/property rollback, duplicate/stale lifecycle and locked carryover property/assignee/date/reason validation. New tasks, scope, facts or stage revisions can change after readiness reads in `requestHandoff`.
- Workspace access: `onboarding-workspace-access.test.ts` proves nonstaff and failed capability lookups are rejected before staff workspace reads. This does not prove full-schema RLS or assigned-work-only data projection.
- Task correction: `onboarding-alternate-task-guards.test.ts` covers handoff/review freezes for archive, exception and reopen. Reopening retains evidence and rejects stale completion before history; cross-table stage/task races remain.
- Role views: `onboarding-work-views.ts` and `onboarding-team-view.test.ts` limit team browsing to supervisors or assigned project leads. Field users get their own My Work selection. `loadOnboardingWorkspace` still returns the wider RLS-visible payload; common navigation exposes Director hub. Server projection and role home behavior remain unfinished.
- Concurrency/history: closeout, activation/enrollment, stage/task edits and full handoff readiness do not share one transaction boundary. Owner logging/resubmission and closeout event writes remain separate and can fail after data is saved. Staff correction history is atomic.
- External-owner security: owner RPCs retain caller RLS; staff correction/handoff RPCs use service_role-only execution and actor checks. Full-schema portal/document/ticket/review cross-access and direct-table business-rule bypass tests remain unproven. No existing access policy changed.
- Interrupted email claims can remain sending. Administrator investigation/recovery is still required; elapsed time is not evidence that retry is safe.

Next implementation actions: establish a consistent transaction/version boundary for closeout and its inputs; reject competing handoff readiness and stage/task changes; finish field-only workspace projection and role navigation without weakening RLS; make remaining history writes durable. Revalidate affected paths before acceptance preparation.

## Access, policy and exact acceptance sequence

No human access is required for the remaining branch-local implementation. Do not apply migrations to the shared Lovable backend to obtain test evidence.

Before authenticated acceptance, provide an approved isolated backend with the reviewed schema and test sign-ins for Onboarding staff/project manager, Onboarding Director, Operations acceptance/supervisor, platform admin and two unrelated Active Owners. Prefer existing test accounts; shared/production account creation remains unauthorized. Resolve the policy conflict between at least 100 hours in the active goal and strictly more than 100 in the earlier plan before changing the current strict threshold.

After the listed defects are fixed:
1. Start both marked Full Furnishing and No Furnishings QA projects; verify owner/property/project/enrollment separation, dates, module applicability and KPI exclusion.
2. At desktop and 390px, test all six workspace areas, each role home, assigned work, queue filters and contextual Back. Attempt unauthorized direct routes and server actions with a second owner and field role.
3. Exercise prerequisite release, stage capture, review, correction and reopen. Verify permanent facts/assets change only after review and prior evidence remains readable.
4. Attempt handoff with blockers, invalid carryover, pending reviews and competing edits. Confirm Director Onboarding, Director Operations, Operations acceptance, then Supervisor Live; financial reconciliation stays independent of Live readiness.
5. Activate a real test owner program once; log eligible single/multi-property activity; reject ineligible dates/homes/opportunities; correct as owner and staff. Verify combined totals/history/evidence, 90-day behavior and demo isolation.
6. Complete only after all gates pass. Export saved closeout report after later data changes and verify it is unchanged. Exercise competing closeout and entry/task writes.
7. Record role, viewport, expected/actual result and evidence for each checklist row. No external sends, live migrations, merge or deployment.

No merge, deployment, live migration, external message, permission-policy change or OneDrive deletion is authorized. Keep all unresolved 268 deletion items pending exact-list verification.
