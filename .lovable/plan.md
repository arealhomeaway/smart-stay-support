# Resolve Current-State Audit — Onboarding & Active Owner (read-only, 9/23)

No code, data or schema was changed. Evidence comes from the current code and live database (demo rows excluded unless noted). Approving this only marks the audit as reviewed. The next step is one focused V2 simplification plan.

## 1. Executive Summary

- **The hard rule is broken today.** Handoff is blocked by homeowner approvals, both in the browser (`validateHandoff`, `src/lib/onboarding.ts:174-176`, check `approvals`) and in the database (`create_onboarding_handoff`, migration `20260916130000…:176`, repeated in `20260916090000…:202`). In the live data, 13 open tasks marked "blocks handoff" are `awaiting_owner` on 4 real homes. Three of those homes (Foxtail, Buckland, 3915) are not in an active Active Owner program.
- **Resolve is a prettier Asana.** There are 1,184 onboarding tasks for 6 projects (about 200 per home). 1,037 of the 1,138 open tasks have no assignee. Only 43 are complete. Nothing moves forward on its own: stages, gates and assignments are all done by hand.
- **Five separate status systems describe one home.** They are lifecycle, project status, task stage, stage capture and handoff gate. Live tasks carry **15 different stage values**: three generations of stages are mixed together.
- **Owner work is spread across 5 overlapping objects.** They are `owner_reviews`, `approvals`, `owner_approval_publications`, `ticket_owner_updates` and `onboarding_tasks.requires_owner_approval`. Each has its own status set.
- **Much of the workflow logic is keyed off task titles in code.** Deadlines, tracks, task kind and conditions are matched against task titles in code, not stored in templates. A director can edit templates, but renaming a step silently changes how it behaves.
- **Good news:** `create_owner_opportunity` already accepts `onboarding` or `operations` as a source. Active Owner can become the same layer across all of Resolve without a second system being built.

## 2. Current Onboarding Workflow Map

```text
Start onboarding (property-intake / OwnerRez enroll / LifecycleSwitcher)
  -> properties.lifecycle_status = onboarding  (onboarding-project.server.ts:236)
  -> onboarding_projects row + template applied (applyOnboardingTemplate)
  -> ~200 onboarding_tasks, access-date paced (onboarding-schedule.ts ASANA_OFFSETS)
  -> PM works tasks by hand (open/blocked/complete/carryover)
  -> optional stage capture review (onboarding-stage.ts: draft/awaiting_review/...)
  -> validateHandoff readiness (address, geocode, access, blocking tasks,
     OWNER APPROVALS, evidence, blockers)
  -> property_handoffs + handoff_reviews through GATE_STEPS:
     kati_review -> micah_review -> operations_acceptance -> live_confirmation -> complete
  -> lifecycle_status = active_operations
```

| Step | Who | Manual today | Automatic today |
|---|---|---|---|
| Create project/plan | Director/Supervisor | Pick the template and scope | Tasks created; due dates from the access date |
| Assign work | Director | Every task (1,037 unassigned) | Nothing (`onboarding-assignment.server.ts` only validates) |
| Complete tasks | PM | Tick each one, upload evidence | Nothing advances |
| Advance stage | PM, then Director | Submit/approve each stage | Nothing |
| Send to homeowner | PM | Publish a snapshot (`publish_owner_approval`) | Owner notification trigger (migration 0022) |
| Reconcile delivery | Staff | Click reconcile (`DeliveryReconciliationPanel`) | Nothing (no cron) |
| Handoff gates | 4 people in sequence | Each gate by hand | Notification trigger only |

Live usage: `property_handoffs` = 0 rows and `handoff_reviews` = 0 rows. The 5-step gate has never been used.

## 3. Current Active Owner Workflow Map

- **Enrollment:** `owner_program_properties` links a home to `owner_programs` (`active-owner.server.ts:16-103`).
- **Activation:** `activate_owner_program` RPC checks the version before activating. The 90-day clock and the 100-hour target (60 onboarding / 40 ongoing) are in `owner-program.ts:10-15,112-141`.
- **Owner work:** `owner_reviews` (prepared → awaiting_owner → answered → closed), fed by onboarding tasks or tickets through `create_owner_opportunity`.
- **Approvals:** a parallel path of `approvals` → `owner_approval_publications` → `respond_owner_approval`.
- **Hours:** `owner_time_entries` is linked to the program, optionally to a review (`review_id`) and a phase, and to several homes through a join table. There is also a direct `ticket_id` column.
- **Optional prompts:** `owner-participation-prompts.ts` is suggestions only and never blocks anything (correct).
- **Live data:** 1 active program (Victor, Fitzgerald), 5 owner reviews, 13 pending `approvals`, 1 time entry, 0 `ticket_owner_updates`, and **0 tasks tagged `active_owner`**.

## 4. Current Operations Work Model

Operations work lives across `tickets` (110 columns), `ticket_steps`, `ticket_visits`, `work_orders`, `work_projects`, `breezeway_outbound_tasks`, `breezeway_work_orders` (created twice: `20260901014454`, `20260901015131`), `escalations`, `playbooks`, `routine_controls` and `handoffs` (shift handoffs, unrelated to onboarding).

"Onboarding work orders" do not have their own records. They are a merged read of `work_orders` and `breezeway_outbound_tasks` (`onboarding-work-orders.server.ts:1-38`). Tickets already create owner opportunities automatically (`20260915080000_automatic_ticket_opportunities.sql`).

## 5. Onboarding to Operations Handoff Map

Readiness is checked in `validateHandoff` (browser) and again in `create_onboarding_handoff` (database). The rules are duplicated in two places. It then passes through `property_handoffs`, then `handoff_reviews` with 4 human gates. The gate role labels (the `kati_review` / `micah_review` steps) are hard-coded constants (`onboarding.ts:258-281`). Leftover work is assigned to Operations by hand at `micah_review`. None of this has run in production.

## 6. Active Owner Cross-Department Relationship

- **Already works across Resolve:** the `owner_reviews` source can be `onboarding` or `operations`, there are automatic ticket opportunities, and `owner_notifications` is shared.
- **Tied to onboarding only:** `onboarding_tasks.requires_owner_approval` / `owner_approval_status`, the dispatch UI in TaskWorkspace, and `approvals.kind='onboarding_task'`. Operations would not need a second implementation. It needs the onboarding-only approval path folded into `owner_reviews`.
- **Blocks internal work:** the handoff check (see Summary). Separately, `work-orders.ts:647-682` puts orders waiting on an owner into a `waiting_owner` queue state. That is a legitimate spending approval, not participation, but the two are not currently told apart.

## 7. Property Core / Shared Data Map

| Fact | Stored in | Source of truth |
|---|---|---|
| Closing/access/handoff dates | `properties` + `onboarding_projects` (dual-written by hand, `onboarding-milestones.server.ts:47-83`) | Unclear; this has broken 3 times |
| Owner identity/contact | `property_owners`, `property_owner_contacts`, `owner_programs.owner_name/email/phone`, `profiles` | Four places |
| Lifecycle | `properties.lifecycle_status` + `onboarding_projects.status` + `owner_program_properties.onboarding_status/launch_status` | Three places |
| Active Owner flag | `owner_program_properties.inclusion_status` + scope module `active_owner` + task tag | Three places |
| Property facts | `properties` + PID JSON (`property-hub.server.ts:13,607`) + `external_records` + `property_fact_proposals`/`property_field_provenance` | A reconciliation layer exists because the sources disagree |
| PM/team | `onboarding_projects` seats + `properties` pod | Two places |

## 8. Task / Ticket / Activity Taxonomy

| Object | Purpose | Owner-facing | Hours | Status model |
|---|---|---|---|---|
| `onboarding_tasks` | Internal onboarding step | Indirectly (approval flag) | No | open/blocked/complete/carryover + owner_approval_status |
| `onboarding_template_tasks` / `owner_task_templates` (32) | Blueprints | No / yes | No | — |
| Stage capture | Per-stage review | No | No | draft/awaiting_review/correction_required/complete |
| `tickets` / `ticket_steps` | Operations issue + checklist | Via review | Via review | Ticket lifecycle incl. awaiting_owner |
| `work_orders` / Breezeway tasks | Vendor execution | Owner approval | No | approval_status + bucket |
| `approvals` | Generic decision | Yes (after publication) | No | pending/approved/declined |
| `owner_approval_publications` | Frozen snapshot shown to the owner | Yes | No | Revision |
| `owner_reviews` | Owner opportunity (the "one" object) | Yes | Yes | prepared/awaiting_owner/answered/closed |
| `ticket_owner_updates` | Published ticket summary | Yes | No | Revision (0 rows) |
| `owner_time_entries` | Hours | Yes | Yes | submitted/reviewed/flagged |
| `owner_notifications` / `owner_contact_alerts` / `staff_notifications` | Alerts | Mixed | No | read_at |
| `evidence_items` / `documents` / `evidence_requirements` | Evidence | Mixed | No | upload_status |

**Overlap:** "owner decision" has 3 models (`approvals`, `owner_reviews`, the task approval flag). "Publish then show" has 2 patterns (`owner_approval_publications`, `ticket_owner_updates`). "Evidence" has 3 (task `evidence_note`, `documents`, `evidence_items`).

## 9. Active Owner Routing Logic — Current State

Owner work is created by hand only: a PM clicks "Send to homeowner" or "Send to Active Owner" on any task. There is no rule for which tasks are eligible. Tasks carry the `active_owner` tag, but 0 live tasks have it. The scope module `active_owner` hides or shows tasks by matching their titles. Tickets create opportunities automatically. The owner's opportunity is currently a copy of the internal task rather than a separate remote activity written for the owner.

## 10. Representative Active Owner Failure Examples

1. **Owner approval blocks handoff on a home that is not Active Owner.** Home: 1399 Foxtail Ln. Tasks: "Send A Real Home Away management agreement to prospective buyer…", "Send recommended repair… cost projections…", "10. Obtain owner decisions and approvals". Status: `awaiting_owner`, blocks handoff, 1 `approvals` row each, 0 owner reviews. The same pattern appears on 1464 Buckland and 3915 W 104th. These are internal sales/admin steps. They were marked as needing owner approval by the template, and now handoff cannot happen.
2. **Fitzgerald has the same 4 blocking tasks,** including "Send Mood Boards to Owner" (`awaiting_owner`). Owner participation is gating internal progress.
3. **Internal tasks exposed directly to the owner:**
   - The review "Your initial onboarding meeting" (`041bb1c7…`) comes from the internal task "1. Receive the property from Business Development or DFY" (`a6c43cda…`).
   - The review "Supply missing property facts" (`13178afa…`) comes from "2. Create and validate the property record".
   - The owner sees an internal step renamed. No separate remote activity was written for them.
4. **Duplicate or test records:**
   - The review "Supply missing property facts" appears twice (`13178afa…` awaiting, `da05c642…` closed) from two different source tasks.
   - The review "Test" / "Testing" (`d308e131…`) is closed while its source task "5. Complete the initial property assessment" is still open.
5. **Hours not linked to their work:** the only live time entry has no `review_id` and no `ticket_id`, so it cannot be traced back to the opportunity it came from.
6. **Two decision records for one ask:** each blocking task has an `approvals` row but no `owner_reviews` row. The owner sees these in one place (approvals) and opportunities in another.

## 11. Redundancy Register

| Item | Location | Overlaps | Source of truth | Candidate |
|---|---|---|---|---|
| `CurrentWork`, `WorkstreamBoard`, `StageProgressPanel` | `src/components/onboarding/` | PropertyWorkQueue | PropertyWorkQueue | Retire (0 imports) |
| Legacy stages `phase1..6`, `post_contract`, `LEGACY_STAGE_LABELS` | `onboarding.ts:67-104`; still on live tasks | Stages 1–8 | Stages 1–8 | Migrate, then retire |
| Stage capture workflow | `onboarding-stage.ts` | Task completion | Tasks | Consolidate |
| 5-step handoff gate | `GATE_STEPS`, `handoff_reviews` (0 rows) | Hub handoff review | — | Simplify to 1 acceptance |
| `approvals` (kind `onboarding_task`) + `requires_owner_approval` | Tasks and approvals | `owner_reviews` | `owner_reviews` | Consolidate |
| `ticket_owner_updates` (0 rows) | Tickets | `owner_approval_publications` | — | Consolidate |
| Dual date columns | `properties` / `onboarding_projects` | Each other | `properties` | Consolidate |
| Owner contact tables (4) | See §7 | Each other | `property_owners` | Consolidate |
| `breezeway_work_orders` created twice | Migrations | — | — | Verify |
| `remotion/`, `qa/onboarding/`, `src/qa/` | Project root | — | — | Retire from the app |
| `WorkflowTable` inside the queue and in My Work | Components | Queue rows | Queue | Keep one |
| `ASANA_OFFSETS` title regex | `onboarding-schedule.ts:23-72` | Template due-offset field | Template | Retire in favor of template |
| `owner_task_templates` (32) | Separate table | `onboarding_template_tasks` | — | Consolidate |

## 12. Manual Work / Automation Opportunities

| When | Today (class) | Resolve should |
|---|---|---|
| Project created | Director assigns about 200 tasks (E) | Assign by role in the template to the project's PM/Utility Manager/Director |
| Task completed | Nothing (E, G) | Unlock and notify whoever owns the next step; update stage progress |
| All steps in a stage done | Human submits/approves (E) | Close the stage automatically; ask for review only where the template says so |
| Access date changes | Now auto re-paced (done) | Keep |
| Active Owner home reaches an eligible step | PM remembers to send (E, F) | Create an owner opportunity from the template's opportunity definition, non-blocking |
| Owner ignores an opportunity | Handoff blocked (violation) | Let it expire; never block |
| Readiness met | Human requests handoff, then 4 gates (E) | Auto-request; one Operations acceptance |
| Handoff accepted | Leftover work reassigned by hand (E) | Move leftover steps to the Operations pod automatically |
| Date edited | Two tables written (C) | One field on the property |
| Delivery reconcile | Manual click (G) | Run on a schedule or on event |

## 13. UX & Training Friction

- About 200 steps per home, and most show to everyone. There are not enough conditions to hide the ones that don't apply.
- Three stage vocabularies appear side by side. Stage capture and the gates add another layer to learn.
- "Blocked" is mixed in with normal progress. Owner approvals show up as internal blockers.
- Assignment is left to the individual: with no assignee, My Work is empty for most PMs.
- Sending to the homeowner has several paths (Send to homeowner, Send to Active Owner, approvals, publication), and staff need to know which one to use.
- Template application exposes technical options ("New" vs "New and existing") to regular staff.

## 14. Hard-Coded Workflow Register

| Element | Status |
|---|---|
| Stages and stage order | Hard-coded (`ONBOARDING_STAGES`) |
| Step order, instructions, stage per step, role, approval/evidence flags | Configurable (template) |
| Relative due dates | Mostly hard-coded title regex (`ASANA_OFFSETS`) plus proportional spread |
| Conditions (pool, HOA, smart lock, furnishing, Active Owner) | Hard-coded title regex (`onboarding-scope.ts:104-260`) |
| Track/workstream | Hard-coded keywords (`onboarding-workstreams.ts:183`) |
| Task kind (vendor/upload/dispatch) | Hard-coded keywords (`onboarding-task-kind.ts:21`) |
| Active Owner eligibility | Tag exists but is unused; scope regex |
| Handoff gates and readiness rules | Hard-coded (`GATE_STEPS`, `validateHandoff`) |
| Assignment, notifications, stage advancement | Not modelled |
| Reusable modules | Scope module list is hard-coded |

## 15. Template / Versioning Architecture

There are 6 templates and 309 template steps. Edits change the live template in place. There is no published or version snapshot per project. Re-applying in `new_and_existing` mode rewrites live incomplete tasks (`onboarding-template.server.ts:222-321`). Completed, manual and approved work is protected. The current setup does not allow "Version A stays on A". A project does not record which template version it was built from.

## 16. Conditional Logic Findings

Conditions exist only as scope modules plus title regex. They are not stored on template steps. There are no conditions for market or property type. The furnishing and Active Owner conditions depend on wording, so renaming a step breaks them. Staff void or archive tasks that don't apply by hand.

## 17. Reusable Module Opportunities

These steps recur in every template and could become modules: Utilities & access, Smart lock/cameras, HOA documents, Furnishing/staging/purchasing, Photography & listing, Readiness & final clean, Owner agreement/intake, and Active Owner opportunities. The 5 Asana imports repeat the same sections as the ARHA plan.

## 18. Suspected Obsolete / Dead Functionality

- `CurrentWork`, `WorkstreamBoard`, `StageProgressPanel` (0 imports).
- Legacy stage values.
- Handoff gate and `handoff_reviews` (never used).
- `ticket_owner_updates` (0 rows).
- Duplicate `breezeway_work_orders` DDL.
- `remotion/` and the QA preview folders.
- PID and Notion references in copy (`property-details.ts`, `document-completion.ts:78`, `onboarding-template.ts:1302…`).
- `record_onboarding_task_stage` no longer exists.

## 19. Data Cleanup / Migration Risks

- The 1,184 live tasks carry mixed stage values and have no template version reference.
- 13 pending `approvals` plus 18 owner-approval task flags would need to become non-blocking opportunities or plain internal steps.
- Owner reviews that duplicate internal tasks, and the "Test" review.
- The unlinked time entry.
- Picking the one date source means checking for mismatches between the property and project copies first.
- Victor's program: 3915 must be re-added after closing.

## 20. Questions Requiring Business Clarification

1. Should homeowner **spending approvals** (repairs, purchases) still gate work? They are contract authority, not participation.
2. How many handoff sign-offs are really needed: one Operations acceptance, or Director plus Operations?
3. Should steps be assigned by role automatically (PM, Utility Manager, Design, Director)?
4. Which steps create an Active Owner opportunity, and does the director write the owner-facing wording per step?
5. Should stages close automatically when their steps are done, or should any stage require a director review?
6. Is the ARHA Full Furnishing plan the only master, or should the Asana imports become modules/variants?
7. Does staff approve owner hours, or do they count as soon as they're logged?

## 21. The 10 Highest-Impact Simplification Opportunities

1. Remove owner approval and participation from the handoff checks in both the browser and the database. This enforces the hard rule.
2. Use one owner work object (`owner_reviews`) for onboarding and Operations. Fold `approvals` kind `onboarding_task`, the task approval flag and `ticket_owner_updates` into it.
3. Assign steps automatically by role from the template.
4. Advance automatically: finishing a step unlocks the next and notifies whoever owns it, and stages close themselves.
5. Store due offsets, conditions, track, kind and Active Owner opportunity wording on template steps. Retire the title-matching code.
6. Version templates: each project records the version it was built from, and changes reach live projects only through an explicit update.
7. Use one stage vocabulary: move legacy stage values to Stages 1–8 and retire stage capture as a separate workflow.
8. Replace the 5-step gate with one handoff: readiness is automatic, then one Operations acceptance, then leftover steps are reassigned automatically.
9. Keep one copy of each property fact: dates, owner contact and lifecycle live on the property, and every department reads them there.
10. Use conditions to cut roughly 200 steps down to what applies, and have My Work show only "needs me / blocked / late / decision / review."

## Technical Notes

- **Live counts (non-demo):** 6 projects; 1,184 tasks (1,181 active, 43 done, 1,037 unassigned open); 15 distinct live stage values; 0 `active_owner`-tagged tasks; 6 templates / 309 steps; 32 owner task templates; 1 active program; 5 reviews; 13 pending approvals; 1 time entry; 0 `ticket_owner_updates`; 0 `property_handoffs`; 0 `handoff_reviews`.
- **Not traced:** a full unused-component import graph, and whether every notification trigger fires twice for the same event.
