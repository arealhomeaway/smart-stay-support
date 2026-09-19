# Operations launch recovery — working record

> **09/18/2026 current direction:** Emily superseded the isolated Supabase/backend launch gate recorded in earlier sections of this historical working record. Current acceptance uses practical, risk-based authenticated browser review of the existing Lovable/GitHub application without shared-data or provider writes. The current Operations branch contains two separate maps: **Work Map** for operational Tickets and Work Orders, and **Availability Finder** for internal direct-booking and placement inquiries. The Availability Finder uses live read-only OwnerRez reservations, a selectable 5/10/15/20-mile radius with 20 as the default and maximum, and a public-listing-link-gated Property Options PDF. It does not move reservations or guarantee availability. See the [acceptance matrix](operations-acceptance-matrix.md) for browser review limits.

## 09/18 overnight completion checkpoint

Branch `codex/ops-overnight-completion-pass` starts at `3072e821919419debcaf1f5aba9a7f5e3620045c`. The pass adds source-safe Availability Finder filters and selected-only PDF facts, one persistent Light/Dark/System theme, reusable collection controls, applicable Onboarding/Active Owner calendars, automatic priority at Ticket intake, and an audited supervisor/director priority correction. The ticket workspace continues to derive one current stage from the existing work type, steps, canonical Work Order, evidence and closure rules. Breezeway remains the vendor dispatch channel and OwnerRez remains read-only reservation context.

No migration, shared-backend record, provider record, publication, deployment, or Lovable connected branch was changed. Native cleaning, Finance, billing, Vendor Portal, inventory and P4 remain deferred or retired. The implementation and its morning acceptance guide are recorded in [operations-overnight-handoff-2026-09-18.md](operations-overnight-handoff-2026-09-18.md).

## Current Work Map and Availability Finder requirements

| Tool | Purpose and source | Current implementation | Acceptance still needed |
|---|---|---|---|
| Work Map | Operations Tickets and Work Orders; Emily's 09/18/2026 direction preserves the map pass | Existing `team-queue` Map tab is labeled Work Map; existing map pins, list, board, calendar and filters remain | Authenticated non-destructive role, navigation, dark-mode and responsive review |
| Availability Finder | Direct-booking and placement inquiry; Emily's 09/18/2026 finder and active-link requests | Staff-only dates/location search, selectable 5/10/15/20 miles, synchronized map/list, composable verified-field filters and URL state, live OwnerRez booking reads, Available / Conditional STR relocation / Unavailable, selected-property PDF and copied email summary | Authenticated non-destructive browser review of actual OwnerRez response, public listing accuracy, filter/map state, PDF download outside Resolve, and click-through of every property CTA and image |

The existing OwnerRez integration audit verifies `/bookings` reservation fields and `/properties` listing facts, but it does not verify a complete availability calendar, rate, minimum-stay or restriction endpoint for this account. Finder “Available” means no conflict was found in the fetched OwnerRez reservation set; Operations must make the final availability decision. The existing guest-context rule treats stays of 28 or more nights as mid-term. Other non-movable restrictions beyond a returned `is_block` booking cannot be inferred from absent OwnerRez fields. Search fails closed on a provider error or incomplete pagination. Only a current OwnerRez-sourced public URL on an approved ARHA listing host can enter the PDF, and export probes each selected public page before rendering. Missing, malformed or inactive links block export. The source URL and photo coverage, host redirects, and real booking-query semantics require authenticated read-only browser acceptance on the selected branch. No authenticated end-to-end acceptance is claimed by code tests alone.

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
| Authenticated acceptance | Matrix records practical, risk-based scenarios | Non-destructive review on the exact branch remains; mutating cases require a separately authorized disposable QA record |

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
| OL-05 | Scope Plan §3C; feedback OPS-004/016: OwnerRez property, booking, guest, channel and occupancy context supports Operations without a competing PMS. | `src/lib/ownerrez.server.ts`, `src/lib/ownerrez.functions.ts`, `src/lib/reservation-snapshot.server.ts`, Property Hub | Partial: synthetic contract tests now reject cross-property/cancelled bookings, expose ambiguous stays, and protect the first Ticket snapshot from concurrent overwrite. Full mapped identity, freshness, role and provider sandbox proof remain. Native turnover ingestion is excluded. |
| OL-06 | Scope Plan §3D: capture operational estimate, actual vendor cost, receipt and accounting handoff facts only. | `src/lib/work-order-cost-input.ts`, Work Order service/UI | Partial: authority, evidence and handoff acceptance needed; guest billing/deposit execution excluded. |
| OL-07 | Scope Plan §3A: P1–P3 only in intake, routing, SLAs, reports and owner-visible projection. | `src/lib/coach-schema.ts`, routing modules, final Ticket/work-type constraint migration `20260831202545`, forward owner alert correction `20260917020000` | Code and isolated PostgreSQL fixture passed: old alert priorities normalize to P3, storage rejects P4, projection exposes P1–P3. Full migration-chain and authenticated environment acceptance remain. Historical migrations remain intact. |
| OL-08 | Scope Plan §3A; feedback OPS-024–025/028: operational communications, permissions, RLS, Storage, history and isolated authenticated acceptance. | Existing server/auth/attachment code and `operations-acceptance-matrix.md` | Missing/partial: no isolated backend or captured Microsoft/provider delivery has been verified. Shared Preview remains read-only. |

**Verified feedback disposition:** OPS-001–019 and OPS-024–025/027–028 contain current Operations concerns subject to the scope above. The register's native cleaning, cleaner routing, inspection/readiness, guest billing and deposit rows are deferred research, regardless of older launch-blocker labels. OPS-023 bulk actions and OPS-021 calendar require team confirmation of launch necessity; they are not assumed blockers merely because code is absent. OPS-026 map/dark mode is future usability work. The exact historical 45-item source is unavailable, so incorporation is partial and cannot be claimed item by item.

## Current-scope acceptance matrix

| Case | Safe isolated checks now | Authenticated/sandbox gate |
|---|---|---|
| OA-OPS-01 P1–P3 intake, classification, SLA, escalation and queue reporting | Type/route inspection, pure priority/routing tests, final constraint migration review | Read-only PC/James/Micah browser review; a priority-correction write requires an explicitly authorized disposable QA record |
| OA-OPS-02 ownership, handoff and canonical Work Order lifecycle | Unit/service mocks and build | Real Auth/RLS, one-open constraint, evidence, rejection/correction, reopen and immutable history |
| OA-OPS-03 Breezeway dispatch and recovery | Existing mocked outbound/webhook tests, static mapping/constraint audit; provider flag remains OFF | Captured/sandbox outbound and inbound under canonical WO, duplicate races, uncertain send, admin recovery, last sync, vendor complete vs Resolve close |
| OA-OPS-04 OwnerRez context | Pure mapping/snapshot tests and code review | Synthetic property/booking/guest with missing and conflicting IDs, freshness and unrelated-property denial |
| OA-OPS-05 operational evidence and cost handoff | Pure authority/format checks | Synthetic file storage, permissions, cost history and accounting reference; no Finance execution |
| OA-OPS-06 communication | Template/permission code checks | Captured email/notification delivery to synthetic recipients only |
| OA-OPS-07 team usability | Read-only local review where possible | Emily/Kati two-screen exact-account/record path after authenticated acceptance |

**Historical environment plan, superseded:** the separate backend/database, synthetic-account and reset/reseed plan below is retained for traceability. Emily removed it as a launch requirement on 09/18/2026. Current acceptance is non-destructive on the exact Lovable branch. No shared Preview workflow writes or real provider dispatch are authorized by this record.

**Local environment checkpoint:** The repository contains a disposable PGlite PostgreSQL fixture runtime under ignored `.codex-qa.local`. The forward owner-alert migration and dedicated SQL test passed there. Supabase CLI, Docker and `psql` were not available on the command path; no local Supabase Auth/Storage/server stack, captured delivery or synthetic authenticated accounts were verified. Therefore every real-role workflow and property/Storage boundary case below remains **BLOCKED**, not passed: Emily oversight, Micah oversight, James assignment/escalation/reopen, PC intake/classification/Work Order/evidence, vendor isolation, owner isolation, and cross-property direct access. The isolated SQL fixture is migration-runtime evidence only.

| Authenticated acceptance case | Result | Required isolated proof |
|---|---|---|
| Emily / Platform Owner oversight and safe delivery | **BLOCKED** | Real Auth, role/RLS, oversight drill-down and captured notifications |
| Micah / Director oversight and escalation | **BLOCKED** | Director seat, role/RLS, assigned and blocked work, cross-role denial |
| James / Supervisor assignment, P1–P3 escalation, correction and reopen | **BLOCKED** | Real Auth/RLS transitions, audit actor/time and rejected unauthorized actions |
| Property Coordinator intake, ownership, Work Order, evidence and completion | **BLOCKED** | Full synthetic authenticated flow, Storage policy and supervisor-only denials |
| Vendor assigned-work and internal-field boundary | **BLOCKED** | Vendor Auth/RLS with assigned and unrelated synthetic properties |
| Owner and unrelated-property isolation | **BLOCKED** | Owner Auth/RLS, direct URL/API access and Storage downloads |
| Breezeway and OwnerRez provider sandbox | **BLOCKED** | Sandboxed credentials, captured outbound delivery and synthetic provider records |

## Work log

- Deferred checkpoint: seven files committed as `7a7fced` on a separate pushed branch. Launch branch returned to clean `7672770`.
- Fresh `git fetch` of `main`, PR #9 branch and launch branch: launch branch `0` ahead, `0` behind before new work.
- Breezeway ticket dispatch guard now refuses provider send if a canonical Work Order cannot be confirmed, including a failed create or unresolved race. In-memory mock regressions cover failed creation and a concurrent creation that must be linked. TypeScript and semantic lint passed. An official Bun runner was installed only in a disposable temp directory; 108 focused mock/pure tests across Breezeway outbound, Work Orders, Ticket lifecycle/classification and OwnerRez links passed with 0 failures. No provider call occurred.
- Adjacent isolated Bun suite passed 118/118 tests across Breezeway webhook, recovery, routing and photos, Team Queue, Property Hub, Oversight, Ticket actions, Work Order navigation and vendor completion. Production build and `git diff --check` passed. Standard focused lint is obscured by repository-wide Windows CRLF formatting diagnostics; semantic lint with that formatting rule disabled passed.
- P4 scope finding: the only consequential remaining literal was in the later owner notification projection. Historical migrations/tests/docs retain retired references. The clean candidate excludes the three cleaning migrations; its forward correction passed an isolated PGlite fixture test. Full-stack migration and authenticated acceptance remain required.
- Clean candidate `codex/ops-launch-candidate-clean` was created from pre-cleaning `c1f69b7`, with only the Breezeway guard, scope correction and dependency map brought forward. Its forward `20260917020000_owner_alert_priority_p1_p3.sql` normalizes historical owner alert priorities to P3, adds a P1–P3 check, and replaces the owner-safe projection. The correction and dedicated constraint test passed in the repository's isolated in-memory PGlite fixture runner. This is local migration-runtime evidence for that fixture, not full-stack Auth/RLS acceptance or deployment proof.
- Clean candidate validation: 182 migration filenames, zero duplicate 14-digit versions and zero cleaning migrations; 108 focused isolated tests passed, TypeScript and semantic focused lint passed, production build passed with the required native build permission, and `git diff --check` passed. Generated types retain `breezeway_outbound_tasks.work_order_id`; no native cleaning table reference was found in the generated types.
- OwnerRez Operations context pass: API responses are filtered to the requested OwnerRez listing before occupancy/guest selection, even when a response contains another property's booking. Ticket snapshot writes are conditional on an empty snapshot timestamp to preserve the first result under concurrent requests. Synthetic fetch and database mocks cover matching, cancelled, cross-property and ambiguous bookings, unmapped property and concurrent snapshot behavior: 11 OwnerRez tests passed, 0 failed across three files. TypeScript, semantic focused lint and production build passed. No OwnerRez request was sent.
- Breezeway outbound contract extension: the in-memory test now asserts the verified home ID, task title, department and priority in the outbound payload, plus explicit write permission and disabled automatic retry for the non-idempotent POST. All five Breezeway mock suites passed 98/98 tests with zero failures; they cover existing webhook, duplicate, uncertain-outcome and manual-reconciliation behavior. They do not establish live provider sandbox acceptance. TypeScript, semantic focused lint and `git diff --check` passed.
- Adjacent Operations regression suite passed 100/100 synthetic tests across seven files covering Work Orders, Ticket lifecycle, Property Hub, Team Queue, Oversight and attachment owner boundary. This is isolated code evidence; no real Auth, RLS or Storage policy acceptance was performed.
- Production Vite build passed. Static filename check found 184 migration files and no duplicate 14-digit version prefix; it identified the three deferred cleaning migrations. Generated types include `breezeway_outbound_tasks.work_order_id`; this is static consistency evidence, not a database test. A pure check confirmed the three maintenance priority maps contain only P1–P3.
