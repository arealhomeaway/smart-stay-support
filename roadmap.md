# Resolve roadmap

## Active Owner acceptance (complete)
- [x] Fresh demo owner invite redemption (Riley Alder, code QATP-7742, redeemed by a new account)
- [x] Activate Riley's demo program clock (started 2026-08-01, ends 2026-10-29)
- [x] Sign-out / sign-in persistence check
- [x] Submit -> approve, and return -> correct -> approve, no double counting
- [x] Duplicate correction prevented (returned entry shows "Corrected already", no second correction)
- [x] Hours labels: "Reported hours" (pending + approved) vs "ARHA-approved hours"


## New: downloadable Hours & Participation Report (owner self-serve)
- [x] Server-side report builder from saved participation records (owner-scoped)
- [x] In-progress "Progress report" + automatic end-of-window final report (reuse 90-day clock)
- [x] Branded PDF + CSV of time-entry detail, server-generated, no public links
- [x] Totals split: approved / awaiting review / returned-superseded, with explanations
- [x] Shared-property entries counted once, attribution explained
- [x] Outside-period entries listed separately
- [x] Demo validation: in-progress, ended program, post-correction totals, second-owner denial, PDF/CSV match portal

## Breezeway
- [x] Webhook label fix (task lookup failures, not signature failures)
- [x] Confirmed: the nine historical failures are `verify_failed` (Breezeway task
      re-fetch failing, e.g. HTTP 500), not signature/auth rejections. Historical
      log attribution beyond the code path is unverified — no authorized log
      access in this pass.
- [x] Verify_failed events now capture the task id and a transient/permanent
      classification, so a real failure is attributable instead of anonymous
- [x] Bounded, manual recovery pass for transient lookup failures (batch-limited,
      per-event retry cap, reuses the exact live scope/dedupe path) — "Retry
      failed lookups" in the admin panel. Requires the prepared-but-not-applied
      migration `20260828193000_...sql` before the retryable/retry_count/
      recovered_at columns exist.
- [x] Closed a concurrent-duplicate-delivery gap: two identical deliveries could
      both pass the "not yet processed" check and both record `processed`. A
      unique index (same migration) plus a conflict-aware insert now force the
      loser to record as `duplicate` instead.
- [x] Regression tests added (`bun test src/lib/__tests__`) for valid pilot
      events, wrong/missing secret, malformed payloads, other company/property,
      duplicate/stale, concurrent duplicate delivery, transient vs permanent
      lookup failures, bounded recovery/retry cap, and "no business writes".
- Fitzgerald-only preview processing stays unchanged

## PR review (Claude PR #1 — Breezeway webhook recovery)
- [x] Reviewed in isolated scratch copy: patch applies, 37/37 tests pass, build passes
- [ ] Blocker: 4 typecheck errors introduced (2 exactOptionalPropertyTypes, 2 missing bun:test types)
- [ ] Migration must be applied BEFORE the code ships (recordEvent writes the new retryable column)
- Not merged, migration not applied, nothing published

## PR review round 2 (head 062eb47)
- [x] Manifest + head confirmed; patch applies clean over current HEAD (only roadmap.md overlaps)
- [x] Full typecheck / production build / 46 tests run in isolated scratch copy
- [x] Migration + concurrent-duplicate constraint verified on a disposable local Postgres (not the live DB)
- [x] Resolved (head 4569800): global bun reference replaced with a scoped `declare module "bun:test"`; full typecheck clean, 46/46 tests, production build passes in the isolated copy
- Not merged, nothing published, no events replayed

## PR review round 3 (head 4569800)
- [x] Only bun.lock / package.json / src/lib/__tests__/bun-env.d.ts changed; all other PR files byte-identical to round 2
- [x] Migration `20260828193000_...sql` APPLIED to the live database (additive columns + indexes; published receiver unaffected)
- [x] Merged (57c1b27), synced, published; duplicate migration files reconciled (ledger holds only 20260828212448; PR file idempotent, nothing rerun)
- [x] Fixture-only self-test after publish: 8/8 expected outcomes, fixture rows only, no persistence errors
- Do NOT run "Retry failed lookups" as release verification — needs separate approval


## Post-publish close-out (2026-08-28)
- [x] Published site serving release 57c1b27; webhook route reachable (GET 200)
- [x] Security scan run: 3 warn-level findings, no criticals; nothing changed or dismissed
- [x] Fixture self-test (8 outcomes) recorded with is_fixture = true, separate from live counts
- [ ] No natural Fitzgerald event has processed yet (live rows: 1283 ignored_other_property,
      9 historical verify_failed, 1 invalid; zero live `processed`). Awaiting either a real
      task update on 1473933 or approval for a controlled test.

## Beta acceptance reconciliation (Aug 28)
- Owned by Claude Code (separate branch — do NOT edit here):
  - [ ] Operations automatic assignment
  - [ ] Property/guest/owner contact population
  - [x] Handover written: assignment-rule sources + contact-source spec (.lovable/plan.md)
- Owned here (reconciliation only, no live actions):
  - [x] OwnerRez conversation/reply capability (GET+POST /v2/messages confirmed in docs)
  - [x] Breezeway dispatch/status/evidence capability (create/update task, add task photo)
  - [x] Info-mailbox communication + notification inventory
  - [x] Telegram requirement + limitation statement
  - [x] Attachment readiness (no Storage bucket, no upload code — missing)
  - [x] Active Owner guide alignment map (branded AOP package)
- Paused/unchanged: vendor portal, live sends, dispatch, external writes, automations

## Phase 1 — real file storage (Aug 29, done)
- [x] Email retry/concurrency re-verified (11 tests): claim-first + unique index, retag-only retry
- [x] Private bucket `resolve-attachments` (50 MB), documents metadata + RLS, helper moved to `private` schema
- [x] attachments.ts / attachments.server.ts / attachments.functions.ts / AttachmentsPanel; wired to ticket detail + onboarding evidence dialog
- [x] 17 unit tests + 19-check isolated end-to-end run on a temporary demo ticket (cleaned up, bucket empty)
- Still needs approval: any SharePoint *write* (new Microsoft scope) — Resolve stays the source of truth for attachments

## PR #2 review (feat/operations-assignment-contact-context)
- [ ] Isolated dry-run merge vs main; report commits/overlaps
- [ ] Reconcile typecheck discrepancy (~401 implicit-any vs clean)
- [ ] Verify auto-assignment rules vs approved SOP
- [ ] Verify guest + primary-owner contact population honesty
- [ ] Review unapplied migration + RLS; decision (merge/fix/blocked)
- [ ] Hold file-storage publish until combined Operations release

## Combined Operations release (PR #2 integration) — 2026-08-31
- [x] PR #2 patch integrated into main; attachment/owner-file/branding work preserved
- [x] Migrations re-timestamped 20260831141014 / 20260831141045 (in sequence)
- [x] Schedule-aware auto-assignment (Central, DST-safe) + exception queue
- [x] Overnight on-call roster UI (admin-managed, no default person)
- [x] General primary-owner directory from OwnerRez (read-only import)
- [ ] BLOCKER: 5 of 6 functional seats vacant — James Almario, Roms, Christine Sendico, Avy, Mike Cacatian have no Resolve profile/role
- [ ] BLOCKER: September overnight roster not yet entered
- [ ] Held: publish, mailbox polling, Breezeway automation, live intake

## Staff invitations (2026-08-31)
- [x] `tech` displays as Staff everywhere (display-only; no RLS/auth change)
- [x] Five email-bound single-use invites created (James, Romeo, Avy, Mike, Christine)
- [x] Admin "Email code" resend control in Team invite panel
- [x] Invite codes emailed from info@arealhomeaway.com (Aug 31)
- [ ] Seats stay pending until each person redeems with their exact invited email

## Property Hub / SharePoint canonical store (requested 2026-08-31) — NOT STARTED
- [ ] Phase 1: confirm OwnerRez → Resolve property identity + draft intake linking
- [ ] Phase 2: move durable file bytes from `resolve-attachments` to ARHA Resolve SharePoint Documents library
  - [ ] Report current Entra scopes, Sites.Selected grant, site/drive IDs, read vs write
  - [ ] Prepare (do NOT apply) smallest site-level write grant; approval required
  - [ ] Bucket inventory; idempotent upload + reconciliation records; proxied secure viewing
- [ ] Phase 3: Property Hub page (Overview, Details, Contacts, Onboarding, Operations, Documents & Media, Approvals, Activity) + search by name/address/owner/market/stage/external IDs
- [ ] Phase 4: read-only Notion PID inventory + full field mapping/reconciliation report; no writes, no retirement
- [ ] Phase 5: owner approval packages must carry ≥1 owner-visible file; versioned change requests
- [ ] Phase 6: Onboarding work views (My Active Projects, Needs My Attention, All Active, Awaiting Handoff, Completed)
- [ ] Phase 7: Handoff Review workspace by job title (Onboarding Dir, Ops Dir, Ops Acceptance, Live Confirmation)
- [ ] Phase 8: 5-account demo validation; report any step still needing another platform
- [ ] Hold: no tenant-wide Graph scopes, no permission change, no file moves, no Notion retirement, no publish/automation

## SharePoint architecture audit (read-only, 2026-08-31) — COMPLETE
- Findings only. No permissions changed, no files touched, no Property Hub work, nothing published.
- Site: ARHA Resolve — id `arealhomeaway.sharepoint.com,973560d0-454a-41fd-804c-659e7e460f83,67ecd2c1-b4e6-40d9-9eac-00c4b241c0bc`
- Library: "Documents" (Shared Documents) — drive id `b!0GA1l0pF_UGATGWefkYPg8HS7GfmtNlAnqwAxLJBwLwYFC_w8_PAQZ-W78Pw_f6p`; root currently empty (~1.5 MB site usage)
- Two Microsoft paths exist and disagree: app-user connector (Sites.Selected, resolve.integration@) vs workspace connection "ARHA Sharepoint Folder" (Sites.Read.All / Sites.ReadWrite.All / Files.Read.All / Sites.Manage.All, NOT linked to project)
- Required target: single app-scoped identity + Sites.Selected + one site-level write grant on /sites/ARHAResolve
- Buckets: `resolve-attachments` (private, 50MB cap, 1 object), `database_export_24_08_26` (private, 1 export)
- Properties: 162 rows, 156 with OwnerRez ids, 6 demo
- Next priority: Operations/Breezeway release readiness (Property Hub deferred)

## Amended beta scope (ChatGPT prompt + Aug 31 onboarding meeting) — 2026-09-01
Applied now (UI/content only, no schema, nothing published):
- [x] "Inspection" reads as **Assessment** in user-facing labels (ticket category, vendor service
      category, owner participation activity, quarterly page copy, onboarding template titles);
      internal keys unchanged
- [x] Assessment report task is **save-only** — no ARHA review; bids only when the Realtor asks
- [x] Handoff gate steps now read by job title: **Director of Onboarding review** → **Director of
      Operations review** → Operations acceptance → Live confirmation
- [x] Carryover copy states the work belongs to Operations after handoff, assigned by the Director
      of Operations with a named owner and due date

Confirmed already correct, no change needed:
- Single 90-day owner review (no 30/60 milestones in the program clock)
- Owner goal 100+ hours, internal operating target 105 (`src/lib/owner-participation.ts`)

Accepted scope decisions (not yet built):
- [ ] NO historical migration for beta (old tickets, Asana/Notion activity, legacy docs, old
      SharePoint/OneDrive folders, historical Breezeway work, productivity backfill)
- [ ] Analytics start from clean non-demo beta activity, with a visible "analytics start date" label
- [ ] Current PID field set imported/mapped (facts, contacts, external ids, operating instructions,
      onboarding status) so nobody needs to open the Notion PID
- [ ] Eight-tab Property Hub polished to one consistent application (shared header, states, no fake data)
- [ ] Active Owner analytics completed: owner-facing + staff/exec program view, filters, CSV
- [ ] Operations ticket analytics: volume, response/resolution (median + average), assignment and
      handoff credit from the immutable activity log, team activity filters, CSV export
- [ ] Accuracy tests: demo/archived excluded, shared activity counted once, superseded/returned
      excluded, SLA timestamps, no handoff double-count, Central-time boundaries, CSV = dashboard

Critical path (historical migration removed):
- By Sep 4: current-PID import + mapping, Property Hub tabs 1–5 (Overview, Details, Contacts,
  Onboarding, Operations) polished, Active Owner staff/exec analytics + CSV, analytics start-date label
- Week of Sep 7: SharePoint-backed uploads (needs the site-level write grant), Documents & Media,
  Approvals with versioned files, Activity, Operations ticket analytics + CSV, accuracy tests,
  My Active Projects and handoff review by job title, demo validation

## APPROVED REVISED CRITICAL PATH (2026-08-31) — supersedes dates above

### Track 0 — Operations beta (Sept 2)
- [x] Archive 437 pre-launch imported tickets (441 archived 2026-08-28, reversible reason tag)
- [ ] Verify archived + demo records are excluded from every live queue AND every live analytics query (audit each query path, not just the queue)
- [ ] Visible analytics baseline banner: "Live reporting begins September 2, 2026"
- [ ] Reissue staff invites: Romeo Canales, Avy Vergara, Mike Cacatain, Christine Sendico (email-bound, resend)
- [ ] Kati Hand — create onboarding-role invite now (redemption is a Sept 4–7 gate, not Sept 2)
- [ ] Confirm Micah Sinor supervisor access (invite NJCY-9K58 still pending redemption)
- [ ] Enter September overnight on-call roster (oncall_roster is EMPTY for September — routing has no destination)
- [ ] Controlled live Breezeway test on 9211 Fitzgerald + documented result (failure = isolated integration defect, not a beta block)
- Josh Dunham redemption: NOT a Sept 2 blocker

### Track 1 — Active Owner beta (Sept 4–7) — feature freeze, QA/analytics only
- [ ] Owner analytics: start/end dates, days remaining, 100+ goal, internal 105 target, reported vs approved vs awaiting review, pace, shared counted once, returned/superseded/out-of-period excluded
- [ ] Owner PDF + CSV (exists — re-validate against new analytics numbers)
- [ ] Staff/exec analytics: all programs, filters (active/completed, owner, property, status, pace, date range), reported vs approved, CSV export
- [ ] Validation pass: shared once, returned/superseded excluded, pending vs approved, timestamps, CSV totals == displayed totals, demo excluded

### Track 2 — Operations analytics (Sept 4–7)
- [ ] Workload: created, completed, open, overdue, unassigned, waiting, reopened, created-vs-completed trend
- [ ] Response/resolution: acknowledgement, action-start, resolution, SLA met/breached/at-risk, closure exceptions, median + average
- [ ] Assignment/handoff: by employee and role, handoffs requested/accepted/rejected/pending, time awaiting acceptance, assignment exceptions
- [ ] Filters: employee, role, work type, priority, property, market/Pod, status, date range
- [ ] Attribution derived from immutable ticket_activity (original assignment, active ownership, contributor, accepted handoff, closer) — never "who closed it"
- [ ] CSV: America/Chicago with timezone stated, demo/archived excluded, no credentials/private URLs, no unnecessary PII, totals match dashboard

### Track 3A — Onboarding beta (Sept 4–7) — NOT deferred to Sept 14
- [ ] Real property end-to-end: 150-task Full Furnishing template, milestones, evidence capture, owner evidence + explicit approvals, exceptions/blockers
- [ ] Gates: Director of Onboarding review → Director of Operations review → Operations acceptance → live confirmation
- [ ] Carryover tasks to Operations with named owner + due date
- [ ] Current property facts, contacts, external identifiers, operating instructions, onboarding status available in Resolve (no Notion needed)
- [ ] Permissions tested for Kati / Micah / Operations

### Track 3B — Full Property Hub (revised targets, 2026-08-31)
- Sept 8–9: Property Hub Functional Beta (Overview, Details, Contacts, Onboarding, Operations, Documents, Approvals, Activity)
- Sept 10–11: Internal QA
- Sept 12: Homeowner-Ready Release Candidate
- Sept 14: Production use with first real owner/property
- [ ] Eight tabs (Overview, Details, Contacts, Onboarding, Operations, Documents & Media, Approvals, Activity)
- [ ] Shared header, consistent nav/typography/spacing, real loading/empty/permission-denied/integration-error states, no raw DB values or role keys, no fake production data, consistent status terms
- Rule: SharePoint completion, historical migration, Rai, Finance and advanced analytics must NOT block the functional Property Hub beta.

### Breezeway outbound pilot (2026-08-31) — PASS
- Flag `breezeway_outbound` ON, locked to 9211 Fitzgerald Dr / Breezeway home 1473933.
- Ops ticket #511 → Breezeway work order 166028165 (synced by webhook); onboarding task → 166030275 (synced).
- Repeat request key returned the existing record; no duplicate created. Do not expand the allowlist without COO approval.


### SharePoint (parallel, non-blocking)
- FINDING: deployed onboarding + ticket evidence capture uses ONLY the private `resolve-attachments` bucket. No SharePoint write path is deployed.
- [ ] Request tenant-admin site-level WRITE grant for ARHA Resolve site only
- [ ] Keep `resolve-attachments` as beta fallback; keep storage behind the existing documents-table abstraction (storage_path/external_url) so a later SharePoint sync needs no UI rebuild
- [ ] Narrow/retire the tenant-wide Sites.ReadWrite.All connection once scoped grant works
- No historical file migration for beta

### Beta migration rule
No historical Notion/Asana/Breezeway/documents/OneDrive/participation/comments/handoffs/productivity migration. Current authoritative property information is NOT historical and must be imported.


## Track 0 status (2026-08-31)
- Command Center now excludes visits, vendor ratings and handoffs tied to demo/archived tickets (matches the ticket set).
- Reporting baseline note (`src/lib/reporting.ts`) shown on Command Center, Analytics and Oversight.
- Invite emails re-sent: Romeo, Avy, Mike, Christine, Micah. Kati Hand production onboarding code KATI-H7M4 created (needs her email to lock/send).
- Breezeway: live non-fixture pilot event processed 2026-08-29; receiver proven in production.
- OPEN: September overnight on-call roster is empty — needs Emily's staffing decision.

## Sept 4–7 progress (2026-08-31)
- Leadership access: Kati Hand invite KATI-H7M4 locked to kati@arealhomeaway.com and emailed; Josh Dunham (ZH5G-L3BQ, admin) and James Miller (JMIL-2P6X, manager) emailed. Micah Sinor already provisioned (manager + director_ops seat).
- Priority 1 DONE — Active Owner staff/exec analytics: `/owner-analytics` (supervisor+), `src/lib/owner-analytics.server.ts` + `.functions.ts`. Reported vs approved vs pending hours, 100h goal / 105h operating target, benchmark variance, hours-per-week needed, staleness, CSV export. Demo-lens aware; excludes demo + archived by default.
- Priority 2 DONE — Operations performance: `/ops-analytics` (supervisor+), `src/lib/ops-analytics.server.ts` + `.functions.ts`. Volume by priority/status/source, response + resolution medians and averages (overall and per priority), response/action SLA compliance, open-past-due count, and contributor credit from the immutable `ticket_activity` log (touched, resolved, first responses, actions started, handoffs in/out, open owned, overdue). CSV export. No scoring or ranking of staff.
- NEXT: Priority 3 (authoritative PID/property field import mapping) and Priority 4 (Onboarding beta QA).

## Canonical product requirements (recorded 2026-08-31)

### Vocabulary (user-facing, fixed)
- Operations: **Ticket**. Never "Matter", never a generic "Request".
- Onboarding: **Project → Task → Subtask**.
- Vendor execution: **Work Order** (Breezeway may show "Breezeway work order"
  while it remains the transitional execution path; the platform term stays
  Work Order so it survives Breezeway retirement).
- Active Owner: **Action**, **Approval**, **Participation entry** — never
  renamed to Ticket.
- Legacy database/table/key names may stay, but must not surface in the UI.

### Priorities
- Three Operations priorities only: **P1 Critical, P2 High, P3 Standard**.
- P4 is retired: no UI, filter, SLA, assignment, analytics, fixture or server
  path may produce or present it.

### Onboarding must replace BOTH Notion and Asana
- The Onboarding team runs a live onboarding project entirely in Resolve, with
  no duplicate active workflow in Notion or Asana.
- Resolve is the active system for: projects, tasks, subtasks, dependencies,
  ownership, due dates, milestones, blockers/exceptions, evidence, owner
  approvals, internal reviews, handoff, carryover work.
- No historical Asana or Notion migration for beta; history stays archived in
  the original systems until retirement.
- Current authoritative property information moves into Resolve; SOPs and
  reference documents live in SharePoint and surface through Resolve.

### System retirement targets (long term, not beta scope)
- Notion — retire as the daily operational system.
- Asana — retire as the onboarding/project workflow system.
- Fillout — retire as forms become native Resolve workflows.
- Breezeway — transitional integration; retire once Resolve replaces the
  required operational execution capability.
- Principle: Resolve simplifies the stack rather than adding a layer.

### Assistants (do not merge or rename)
- **Rai / Ask Resolve** — future company-wide, permission-aware grounded
  knowledge and action assistant.
- **Operations Coach** — the specialized Operations execution/coaching feature.

## Breezeway integration status (approved 2026-08-31 by COO)
- Breezeway inbound: validated
- Breezeway outbound Operations: validated
- Breezeway outbound Onboarding: validated
- Duplicate / idempotency protection: validated
- Webhook reconciliation: validated
- Resolve source-of-truth boundary: validated
- Controlled pilot (9211 Fitzgerald Dr / home 1473933): PASS
- Outbound writes are NOT portfolio-wide. The server-side allowlist stays the
  gate: the `breezeway_outbound` flag may be ON, but a property must be
  explicitly listed to be writable. Never convert this to "every mapped
  property is writable".

### Limited outbound beta (3–5 approved properties) — awaiting COO approval of the list
Monitoring set (system health only — NEVER employee-performance metrics):
successful create rate, duplicate prevention, needs_review occurrences, failed
sends, webhook confirmation rate, create→confirmation latency, admin recovery
usage, Operations vs Onboarding source, Breezeway/Resolve state mismatches.

### Breezeway retirement objective (architecture rule)
Breezeway is a TRANSITIONAL execution platform. ARHA intends to retire it once
Resolve safely replaces the Breezeway operational functionality ARHA still
requires. Do not deepen Breezeway dependency unnecessarily. Test every proposed
Breezeway work item with: does this migrate operational execution INTO Resolve,
or does it make Resolve MORE dependent on Breezeway? Only the former is
prioritized.
Long-term target chain: OwnerRez reservation/event → Resolve creates and
schedules the work → Resolve assigns staff/vendors → Resolve runs
checklists/work orders → Resolve captures evidence and exceptions → Resolve
tracks completion and analytics, with Breezeway removed from the chain.

### Development focus (no further Breezeway expansion unless a beta defect appears)
1. Sept 4–7 Onboarding + Active Owner readiness
2. Current authoritative property/PID architecture
3. Sept 8–9 Property Hub functional beta
4. SharePoint scoped-write integration
5. Sept 12 homeowner-ready release candidate
Rai / Ask Resolve stays architected for later — out of current beta build scope.

## Breezeway limited beta (approved 2026-08-31)
Allowlist extended to five verified homes only — enforced server-side in
`src/lib/breezeway-outbound.ts` (`OUTBOUND_ALLOWED_HOME_IDS`) and mirrored by the
webhook retention scope (`PILOT_HOME_IDS`). Each mapping was verified against the
Breezeway record's OwnerRez `reference_property_id`, not by name/address similarity.

| Property | Breezeway home | OwnerRez | Resolve state |
|---|---|---|---|
| 9211 Fitzgerald Dr., Indianapolis IN | 1473933 | 492500 | active, not demo, not archived |
| 2901 E. 75th St., Tulsa OK | 1295301 | 480826 | active, not demo, not archived |
| 2701 Berkshire Way, Oklahoma City OK | 368125 | 380978 | active, not demo, not archived |
| 721 Dusty Trail, Yukon OK | 322641 | 376992 | active, not demo, not archived |
| 7351 Red Rock Rd, Indianapolis IN | 1293536 | 480764 | active, not demo, not archived |

Notes:
- Near-miss guarded: Breezeway home 676169 (15701 E 75th Pl N, Owasso) is NOT the
  Tulsa 75th St home and is not allowlisted; regression test covers the refusal.
- 7351 Red Rock Rd currently has **no** onboarding project/tasks. Onboarding-side
  validation there is deferred until legitimate onboarding work exists — no
  artificial onboarding work will be created to test the integration.
- The two pilot work orders (166028165, 166030275) stay as labelled test records
  and are to be closed manually in Breezeway by an authorized ARHA user. No
  status-transition capability will be built for them.
- Monitoring (system health only, never employee performance): outbound creations,
  duplicate prevention, needs_review, definite failures, webhook confirmation,
  create-to-confirm timing, admin recovery usage, Operations vs Onboarding source,
  Resolve/Breezeway state mismatches.
- No further Breezeway scope expansion unless a defect is found.

## Breezeway feature freeze (approved 2026-08-31)
No new Breezeway functionality and no allowlist expansion without COO approval.
Collect integration-health data only (outbound success/failure, duplicate
prevention, needs_review, webhook confirmation, admin recovery, state
mismatches). System-health data only — never employee performance.

### Inbound webhook scope clarification
- Endpoint receives EVERY task event for the whole Breezeway company on the one
  subscription (Breezeway offers no per-property subscription).
- Every delivery is counted and persisted as a classification row in
  `breezeway_webhook_events` (outcome + reason only).
- Task DETAIL (task id, home id, timestamps) is retained only for the five
  approved homes; everything else is stored as `ignored_other_property` with no
  payload.
- Inbound has never created tickets, assigned work, messaged, or changed
  property stage. Nothing operational was disabled by the five-home scope.
- Outbound-created work orders on the five homes reconcile normally via
  `noteOutboundAcknowledgement` -> status `synced`.

## Sept 8–14 schedule (approved)
- Sept 8–9  Property Hub functional beta (8 tabs)
- Sept 10–11 Internal QA with production-equivalent roles
- Sept 12  Homeowner-ready release candidate
- Sept 14  First real-owner production use

## Sept 7–12 critical path (in progress)
- [x] Property Hub functional beta shell — all 8 tabs at /property/$propertyId
- [x] Onboarding ownership: seat model (`onboarding_tasks.assigned_seat`), new projects open owned
- [ ] Backfill unassigned tasks on existing projects — AWAITING APPROVAL of ownership rules
- [x] Fillout removed: mid-project review + handoff now native Resolve
- [ ] Notion/Asana/Smartsheet reference links still inside ~30 task instruction bodies (content decision needed)
- [x] PID field map v2 review table — docs/pending/property-hub-field-map-v2-review.md (awaiting approval)
- [x] Active Owner polish: returned-entry copy, report footer "Figures as of"
- [ ] SharePoint site-level write grant — outstanding with tenant admin
- [ ] September on-call roster — business input, not a development blocker

## Operations beta go-live (Sept 1, approved)
- [x] After-hours coverage window configured: 22:00–08:00 America/Chicago,
      stored in `coverage_config` (business configuration, not code constants);
      `auto_assign_ticket()` reads it and stays DST-safe.
- [x] After-hours routing: rostered on-call person owns escalation inside the
      window; normal seat routing resumes at 08:00. Priority is never forced to
      P1 by the time of day.
- [x] Overnight handoff view enabled — `OvernightHandoffPanel` on /oversight.
      Reads the Ticket record itself; no duplicate written overnight report.
- [x] Operations functional-seat assignments (configurable, name-independent):
      ops_supervisor=James Almario, ge_day=Romeo Canales, ge_evening=Mike
      Cacatain, po_day=Avy Vergara, po_evening=Christine Sendico. Seats without
      a redeemed account are held as pending and surfaced as an access blocker.
- [ ] Avy Vergara, Mike Cacatain, Christine Sendico invitations outstanding —
      evening + property-ops routing is pending until redeemed.
- Telegram unchanged and in scope (communication/alerts); Resolve owns tickets.

## Breezeway portfolio expansion (2026-09-01)
- [x] Write scope moved from a hardcoded five-home allowlist to the persisted
      `breezeway_mapping_state = 'verified'` gate (156 active properties verified
      deterministically via OwnerRez reference ids).
- [x] Webhook retention widened to the same verified set; fixture self-tests keep
      the offline pilot set.
- [x] Work Order mirror: `breezeway_work_orders` + `breezeway_work_order_comments`,
      current work only (no historical import), staff-read RLS, server-write only.
- [x] Resolve UI: Property Hub > Operations shows Breezeway work orders with
      status/stage, assignees, schedule, photo count, comment thread, reply, and
      close / reopen / approve — all badged "Breezeway".
- [x] Resolve stays source of truth: a Breezeway change never rewrites a Ticket;
      escalation to a Ticket is a deliberate link, never automatic.
- [ ] Blocked: replies need `BREEZEWAY_COMMENT_PEOPLE_ID` (the Breezeway person
      Resolve posts as). Reads and lifecycle work without it.
- [ ] Gap: Breezeway Chats/Messaging is not in the public Inventory API —
      task comments are the only supported message surface today.
- [ ] Photos: counts are mirrored; binary photo display needs the per-task photo
      endpoint (next pass).

## Breezeway portfolio operation + Evidence Quality Gate (2026-09-01)

### Portfolio state (production)
- `breezeway_outbound`: **ON**.
- 156 properties `verified` (Breezeway home ID + OwnerRez identity, 1:1). 6 properties
  not verified (demo/inactive) and blocked from every Breezeway write.
- Write gate is the database mapping state, not a hardcoded list. Staff can
  create/update/close/reopen/approve on all 156; anything else is refused server-side.
- Mirror populated: 852 current work orders across 120 homes, refreshed by webhook per
  task and by the scheduled sweep `/api/public/hooks/breezeway-mirror`.

### Comments (two-way)
- Breezeway people directory mirrored: 134 people; **5 map to Resolve staff by email**
  (James Almario, Romeo Canales, Kati Hand, Emily Jimenez, Micah Sinor).
- Identity order: staff's own Breezeway person → shared "ARHA Resolve" integration
  identity with the staff name written into the body. Never a colleague's account.
- **Open item:** no "ARHA Resolve" person exists in Breezeway yet, and
  `BREEZEWAY_COMMENT_PEOPLE_ID` is unset — so replies from staff outside the five above
  cannot be posted. Create that Breezeway user and set the ID.
- Every outbound comment records author, Breezeway identity used, identity mode,
  timestamp, IDs and delivery state (sending/delivered/failed). Inbound mirroring
  de-duplicates on the Breezeway comment ID, so a reply never doubles in Resolve.

### Photos
- Per-task read mirrors Breezeway photos into Resolve and shows them in the Hub.
- **Uploads to Breezeway are not supported by their API.** Evidence captured in Resolve
  stays in Resolve; incoming Breezeway photos can be run through the gate.

### Evidence Quality Gate
- One reusable gate for Work Orders, Tickets, Onboarding tasks, Assessments and
  property records. Standard: can a reasonable reviewer clearly verify the work?
- Stage A technical (blur, resolution, dark, overexposed, glare, obstruction,
  framing/distance) and Stage B requirement-specific (labels, dimensions,
  before/after state), evaluated by vision model, 17 named reason codes with a fix
  sentence each. Generic rejection is impossible by construction (test-enforced).
- Statuses: Awaiting evidence · Checking photo · Evidence verified · Photo not accepted ·
  Needs better photo · Accepted with exception.
- Supervisor override records reason, person, timestamp and audit event, and keeps the
  original verdict.
- Analytics are system-level only (first-attempt pass, rejection reasons, attempts to
  pass, subject coverage). No staff scoring, by design.

### Breezeway Chats / Messaging
REQUIRES BREEZEWAY MESSAGING API ACCESS. No workaround built. Task comments remain the
only supported conversation surface.

### Remaining reasons to open Breezeway
1. Guest/team messaging (Chats) — no API.
2. Creating or editing the Breezeway people directory, groups and property setup.
3. Cleaner scheduling/dispatch boards and recurring cleaning templates.
4. Adding photos to a Breezeway task from Breezeway's own app (their API is read-only
   for photos).
5. Breezeway-native reporting/billing exports.
Everything else — read, create, update, close, reopen, approve, comment, read photos —
is now doable from Resolve.

### Pre-publish regression (2026-09-01) — PASS except the shared comment identity
- 156 verified / 6 unmapped; write guard refuses on mapping state, flag state and
  missing property before any Breezeway call.
- Hub Operations tab verified live as a staff user: retrieval, comments, photos
  (77 on one work order), Close/Reopen/Approve controls, evidence gate per work order.
- Breezeway tables are staff-only SELECT; no anon/owner/vendor grants. Every server fn
  re-checks `is_staff`; supervisor-only actions re-check role.
- Ticket state independent: no path creates or mutates a Ticket from a work order or
  comment (mirror + optional activity note only).
- BLOCKED: "ARHA Resolve" person does not exist in Breezeway yet. Unmapped staff replies
  refuse cleanly ("Resolve has no Breezeway identity to post under…") — no impersonation,
  nothing posted. Once the person exists, a people sync auto-detects it by name; the
  BREEZEWAY_COMMENT_PEOPLE_ID secret is only a manual override.
- Publish held per COO instruction until the fallback comment test passes.

## Operations usability + Property Hub refinement release (in progress)
- [x] 1. Ticket detail — Close Ticket moved to end of workflow (no duplicate close actions)
- [x] 2. Launch-state gating for Quarterly Reviews + Vendor Portal (architecture kept, nav hidden)
- [x] 3a. Breezeway Work Order: template selector (GET /companies/templates), assignee selector (validated Breezeway person ids), corrected department enum, Resolve-evidence labelling
- [ ] 3b. Breezeway task photo upload (POST /task/{id}/photos is supported by the API — multipart client not built yet)
- [ ] 4. Notion PID import into Property Hub (read-only source audit first, match on ownerrez_property_id)
- [ ] 5. Property primary photos (PID/OwnerRez sources, graceful fallback)
- [ ] 6. Owner records + property relationships (dedupe owners, report cross-source conflicts)
- [ ] 7. Documents & Media category redesign + quick links
- [ ] 8. Property Hub retrieval/IA improvements across the eight tabs
- [ ] 9. Full regression + publish + release report

## Frontline ticket experience simplification (audit approved 2026-09-02)
- [x] Read-only audit of ticket intake + open-ticket page (this pass)
- [x] Implement approved frontline simplification: priority ceilings, deterministic classifier, simplified intake, derived Next Action hero, guest/stay consolidation, panel vocabulary
- [ ] Silent Operations training video (paused by request until simplification ships)

## Phase 1 items (Sept 21)
- [x] Dedicated Work Order calendar (month + timeline, conflict visibility, links back)
- [x] Complete notification coverage (SLA breach warnings, missed vendor dispatch, claim deadline reminders)
- [x] Queue bulk actions (batch reassignment, status updates, priority tagging, permission checks)
- [x] Reliable pet & amenity matching from verified OwnerRez fields; unconfirmed facts hidden from filtered searches; interrupted MTR stays offered with an STR re-book second step
- [x] Operational taxonomy & field guidance (one shared category list across tickets, work orders, claims and vendors; trades roll up to categories; one-line guidance per field)
[x] Breezeway sync depth & document completion (unplaced updates + drift review, differences held for a person, vendor paperwork completeness, legacy document retirement)
