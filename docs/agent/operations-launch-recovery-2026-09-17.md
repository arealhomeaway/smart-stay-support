# Operations launch recovery — working record

**Controlling sources:** Emily's 09/17/2026 overnight instruction; `ARHA_Resolve_Operations_Scope_and_Recovery_Plan_2026-09-17.md` in Downloads. These supersede conflicting older handoff and feedback-register statements. Starting launch branch: `codex/ops-launch-pass-2` at `7672770`; clean after the seven deferred files were checkpointed on `codex/deferred-native-cleaning-review-checkpoint` at `7a7fced` and pushed. Fresh fetch showed no launch-branch divergence.

## Plan

1. Reconcile launch requirements and evidence. Mark code presence separately from isolated tests and authenticated acceptance.
2. Remove consequential P4 behavior through safe, forward-only changes; keep historical migrations intact.
3. Verify and harden the Ticket to canonical Work Order lifecycle with synthetic tests.
4. Reuse and complete Breezeway dispatch/synchronization/recovery; never call the live provider.
5. Verify OwnerRez Operations context without introducing native cleaning turnover.
6. Resolve source-supported launch feedback and update the acceptance matrix.
7. Run type, lint, isolated tests, build, migration ordering/type checks, then commit and push coherent changes.

## Launch boundary

Resolve owns Tickets, canonical Work Orders, ownership, priorities **P1–P3**, status, escalation, evidence and history. OwnerRez owns property/owner and reservation identity/context. Breezeway remains the field-execution and vendor-dispatch channel where applicable; Resolve-managed Work Orders remain supported. QuickBooks and Finance are outside this release. Native cleaning management, cleaner offers/checklists/inspection/readiness, guest billing/deposit approvals, Vendor Portal, Property Inventory, Onboarding and Active Owner work are excluded. The three cleaning migrations `20260917020000`, `20260917030000` and `20260917040000` remain unapplied and outside the launch migration set.

## Evidence lanes at start

| Area | Built evidence | Current limit |
|---|---|---|
| Ticket/Work Order lifecycle | PR #7 on `main`; PR #9 corrections carried on this branch; existing service and unit tests | No isolated authenticated full sequence |
| Queue, oversight, Property History | PR #9 and later pass-2 code | Real-role usability/counts not accepted |
| Breezeway | Outbound, webhook, mirror, recovery and admin review modules exist | Canonical Work Order mapping and provider sandbox acceptance incomplete |
| OwnerRez | Listing/guest/stay reads and Ticket reservation snapshot exist | Mapping/freshness/failure acceptance incomplete |
| P1–P3 | UI, routing and final Ticket/work-type constraints use three priorities | A later owner notification projection still permits a stored P4 value; live schema unverified |
| Team feedback | 33-row source-linked evidence register exists on this clean candidate | Historical “45 items” unverified; register has off-scope launch claims |
| Authenticated acceptance | Matrix records required scenarios | No separate backend/Auth/Storage/delivery bindings verified |

## Source and decision notes

The existing `operations-feedback-register.md` is a source locator, not an approved 45-item list. Its cleaning and billing requirements are deferred under the controlling recovery plan. Do not treat pure synthetic rules, migration text, or a compiled route as an accepted user workflow. All provider writes and shared Preview workflow writes remain prohibited.

## Corrected requirement and feedback reconciliation

Status means **code evidence only** unless an explicit isolated test result is linked. A row called partial is not accepted. The IDs below group related source-backed items for this recovery pass; they do not replace or imply recovery of the historical 45-item list.

| ID | Source and exact launch requirement | Implementation evidence | State / remaining proof |
|---|---|---|---|
| OL-01 | Scope Plan §3A; Handoff §6; feedback OPS-001–008: PC My Work and Team Queue show owned/next-action work with useful views, composable filters and preserved context. | `src/lib/my-work.ts`, `src/lib/team-queue.ts`, Ticket and Team Queue routes | Built, inadequately tested: signed-in PC/James/Micah combinations and return navigation need acceptance. |
| OL-02 | Scope Plan §3A; feedback OPS-010–015: each repair has a canonical Resolve Work Order; first meaningful action establishes owner; vendor completion is not closure; correction/reopen/history remain accountable. | `src/lib/ticket-action-start.ts`, `src/lib/ticket-lifecycle.server.ts`, `src/lib/work-orders.ts`, Ticket Work Order panel, PR #7/#9 tests | Built, inadequately tested: full authenticated sequence, concurrency and role denial remain. |
| OL-03 | Scope Plan §3A; feedback OPS-009,016–019: oversight drill-down, relationship-based Property History, scheduled Work Orders, Claims/Recovery and routines remain usable. | `src/lib/property-hub.server.ts`, Oversight/Work Orders/Claims/Routines routes | Partial: team review and property-linked coverage needed. |
| OL-04 | Scope Plan §3B; feedback OPS-010,014: selected canonical Work Orders dispatch to Breezeway with external ID, duplicate protection, visible failure, retry/reconciliation, supported status/assignee/comments/photos/cost/checklist facts and final PC verification. | `src/lib/breezeway-outbound.server.ts`, webhook/recovery/mirror modules, `BreezewayTaskPanel.tsx` | Partial: canonical link guard hardened and 108 focused plus 118 adjacent isolated tests passed in this pass. Supported cost/checklist mapping and full sandbox sequence remain unproved. |
| OL-05 | Scope Plan §3C; feedback OPS-004/016: OwnerRez property, booking, guest, channel and occupancy context supports Operations without a competing PMS. | `src/lib/ownerrez.server.ts`, `src/lib/ownerrez.functions.ts`, `src/lib/reservation-snapshot.server.ts`, Property Hub | Partial: mapped identity, freshness, missing/mismatch handling and role proof needed. Native turnover ingestion is excluded. |
| OL-06 | Scope Plan §3D: capture operational estimate, actual vendor cost, receipt and accounting handoff facts only. | `src/lib/work-order-cost-input.ts`, Work Order service/UI | Partial: authority, evidence and handoff acceptance needed; guest billing/deposit execution excluded. |
| OL-07 | Scope Plan §3A: P1–P3 only in intake, routing, SLAs, reports and owner-visible projection. | `src/lib/coach-schema.ts`, routing modules, final Ticket/work-type constraint migration `20260831202545`, forward owner alert correction `20260917020000` | Code and isolated PostgreSQL fixture passed: old alert priorities normalize to P3, storage rejects P4, projection exposes P1–P3. Full migration-chain and authenticated environment acceptance remain. Historical migrations remain intact. |
| OL-08 | Scope Plan §3A; feedback OPS-024–025/028: operational communications, permissions, RLS, Storage, history and isolated authenticated acceptance. | Existing server/auth/attachment code and `operations-acceptance-matrix.md` | Missing/partial: no isolated backend or captured Microsoft/provider delivery has been verified. Shared Preview remains read-only. |

**Verified feedback disposition:** OPS-001–019 and OPS-024–025/027–028 contain current Operations concerns subject to the scope above. The register's native cleaning, cleaner routing, inspection/readiness, guest billing and deposit rows are deferred research, regardless of older launch-blocker labels. OPS-023 bulk actions and OPS-021 calendar require team confirmation of launch necessity; they are not assumed blockers merely because code is absent. OPS-026 map/dark mode is future usability work. The exact historical 45-item source is unavailable, so incorporation is partial and cannot be claimed item by item.

## Current-scope acceptance matrix

| Case | Safe isolated checks now | Authenticated/sandbox gate |
|---|---|---|
| OA-OPS-01 P1–P3 intake, classification, SLA, escalation and queue reporting | Type/route inspection, pure priority/routing tests, final constraint migration review | Synthetic PC/James/Micah records, role writes, clocks and report parity on separate backend |
| OA-OPS-02 ownership, handoff and canonical Work Order lifecycle | Unit/service mocks and build | Real Auth/RLS, one-open constraint, evidence, rejection/correction, reopen and immutable history |
| OA-OPS-03 Breezeway dispatch and recovery | Existing mocked outbound/webhook tests, static mapping/constraint audit; provider flag remains OFF | Captured/sandbox outbound and inbound under canonical WO, duplicate races, uncertain send, admin recovery, last sync, vendor complete vs Resolve close |
| OA-OPS-04 OwnerRez context | Pure mapping/snapshot tests and code review | Synthetic property/booking/guest with missing and conflicting IDs, freshness and unrelated-property denial |
| OA-OPS-05 operational evidence and cost handoff | Pure authority/format checks | Synthetic file storage, permissions, cost history and accounting reference; no Finance execution |
| OA-OPS-06 communication | Template/permission code checks | Captured email/notification delivery to synthetic recipients only |
| OA-OPS-07 team usability | Read-only local review where possible | Emily/Kati two-screen exact-account/record path after authenticated acceptance |

**Environment release gate:** separate backend/database, Auth users, Storage, secrets and queues; synthetic PC, James, Micah, Emily, vendor and owner accounts; synthetic properties/reservations/Tickets/Work Orders/files; external delivery disabled or captured; reset/reseed; unmistakable staging label. No shared Preview workflow writes or real provider dispatch.

**Local environment checkpoint:** The repository contains a disposable PGlite PostgreSQL fixture runtime under ignored `.codex-qa.local`. The forward owner-alert migration and dedicated SQL test passed there. Supabase CLI, Docker and `psql` were not available on the command path; no local Supabase Auth/Storage/server stack, captured delivery or synthetic authenticated accounts were verified. Therefore every real-role workflow and property/Storage boundary case below remains **BLOCKED**, not passed: Emily oversight, Micah oversight, James assignment/escalation/reopen, PC intake/classification/Work Order/evidence, vendor isolation, owner isolation, and cross-property direct access. The isolated SQL fixture is migration-runtime evidence only.

## Work log

- Deferred checkpoint: seven files committed as `7a7fced` on a separate pushed branch. Launch branch returned to clean `7672770`.
- Fresh `git fetch` of `main`, PR #9 branch and launch branch: launch branch `0` ahead, `0` behind before new work.
- Breezeway ticket dispatch guard now refuses provider send if a canonical Work Order cannot be confirmed, including a failed create or unresolved race. In-memory mock regressions cover failed creation and a concurrent creation that must be linked. TypeScript and semantic lint passed. An official Bun runner was installed only in a disposable temp directory; 108 focused mock/pure tests across Breezeway outbound, Work Orders, Ticket lifecycle/classification and OwnerRez links passed with 0 failures. No provider call occurred.
- Adjacent isolated Bun suite passed 118/118 tests across Breezeway webhook, recovery, routing and photos, Team Queue, Property Hub, Oversight, Ticket actions, Work Order navigation and vendor completion. Production build and `git diff --check` passed. Standard focused lint is obscured by repository-wide Windows CRLF formatting diagnostics; semantic lint with that formatting rule disabled passed.
- P4 scope finding: the only consequential remaining literal was in the later owner notification projection. Historical migrations/tests/docs retain retired references. The clean candidate excludes the three cleaning migrations; its forward correction passed an isolated PGlite fixture test. Full-stack migration and authenticated acceptance remain required.
- Clean candidate `codex/ops-launch-candidate-clean` was created from pre-cleaning `c1f69b7`, with only the Breezeway guard, scope correction and dependency map brought forward. Its forward `20260917020000_owner_alert_priority_p1_p3.sql` normalizes historical owner alert priorities to P3, adds a P1–P3 check, and replaces the owner-safe projection. The correction and dedicated constraint test passed in the repository's isolated in-memory PGlite fixture runner. This is local migration-runtime evidence for that fixture, not full-stack Auth/RLS acceptance or deployment proof.
- Clean candidate validation: 182 migration filenames, zero duplicate 14-digit versions and zero cleaning migrations; 108 focused isolated tests passed, TypeScript and semantic focused lint passed, production build passed with the required native build permission, and `git diff --check` passed. Generated types retain `breezeway_outbound_tasks.work_order_id`; no native cleaning table reference was found in the generated types.
- Production Vite build passed. Static filename check found 184 migration files and no duplicate 14-digit version prefix; it identified the three deferred cleaning migrations. Generated types include `breezeway_outbound_tasks.work_order_id`; this is static consistency evidence, not a database test. A pure check confirmed the three maintenance priority maps contain only P1–P3.
