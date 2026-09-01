# Onboarding Portal — Asana Familiarity, Resolve Automation

Read-only plan. No code changed yet.

## A. Current onboarding UI architecture

One route, `/onboarding`, renders everything in a single 1,060-line page with three tabs: **Pipeline**, **Handoff gate**, **Source records**. Pipeline is a left property list plus a stacked column of Cards for the selected property: lifecycle controls, participation mismatch confirmation, readiness checklist, homeowner decisions, and a flat "Onboarding tasks" list of every task for the home ordered by `sort_order` (no sections). Task editing happens in a modal `TaskDialog`, with separate dialogs for evidence, exception, approval submit, handoff request and return. There is no per-property page, no My Work view, and no portfolio manager table.

## B. What already exists and gets reused (no rebuild)

Data (`onboarding_tasks`, 36 columns) already carries nearly everything the new UI needs: `stage`, `sort_order`, `assigned_to`, `assigned_seat`, `due_on`, `due_on_source`, `due_on_overridden`, `schedule_anchor`, `schedule_offset_days`, `depends_on[]`, `parent_task_id`, `blocker`, `blocks_handoff`, `evidence_required`, `evidence_note`, `requires_owner_approval`, `owner_approval_status`, `carryover_of`, `carryover_reason`, `exception_reason`, `linked_ticket_id`, `status`, `archived_at`.

Logic to reuse as-is:
- `src/lib/onboarding.ts` — `ONBOARDING_STAGES` (the six real ARHA phases + post-contract), `dependencyBlocked()`, `isOverdue()`, `validateHandoff()`, `GATE_STEPS`/`nextGateStep()`.
- `src/lib/onboarding-template.ts` — the canonical Full Furnishing template (stage, role, detail, anchor/offset, evidence, owner-approval-when-Active-Owner, Breezeway template id, subtasks). This is the section source of truth; no section names get hard-coded.
- `src/lib/onboarding-schedule.server.ts` — anchors, preview/apply recalculation, `setTaskSchedule`.
- `src/lib/onboarding.server.ts` / `.functions.ts` — all 18 server functions, including approval, exception, archive, handoff review.
- `src/lib/onboarding-ownership.ts` — seat mapping for assignee display.
- `src/lib/evidence.ts` + evidence server/functions, `HandoffGatePanel`, `OperationsContextPanel`, `ExternalRecordsPanel`, `OnboardingNotes`, `TemplatePanel`.
- Design system from the UI rebuild: `Chip`, `StageRail`, `SegmentedControl`, `SectionBand`, semantic tokens in `src/lib/semantic.ts`.

## C. Proposed screen hierarchy

```text
/onboarding                     Manager Hub (portfolio table) + Handoff gate + Source records tabs
/onboarding/my-work             My Work across all assigned properties
/onboarding/$propertyId         Property workspace
    Overview | Workflow (default) | Timeline | Calendar | Files | Activity
```
The existing `/onboarding` pipeline UI is not deleted; its property-detail body moves into the property route, and the list becomes the Manager Hub table.

## D. Workflow table

Columns: **Task · Assignee · Due Date · Status**. Nothing else in the row except small inline markers beside the task name: Auto, Auto-date, Dependency, Owner, Evidence, BW, Blocked, Overdue. Sections come from `stage` grouped in `ONBOARDING_STAGES` order, each with `done/total`, a state of complete / active / blocked / not ready, collapsed by default when complete, active section expanded. Incomplete tasks are never hidden. Row click opens the drawer; status and assignee are editable inline.

Derived status shown (mapped from stored `status` + computed state, no schema change):
Not Ready (dependency-blocked) · Ready · In Progress · Blocked (+ reason) · Needs Review (owner approval pending / evidence awaiting) · Complete.
Blocker reasons are system-derived where possible: waiting on owner, waiting on dependency, missing evidence, waiting on closing anchor; the free-text `blocker` field supplies vendor/other reasons.

## E. Task drawer

Header (task, property, section, status), then: assignee/seat, due date with its explanation, description, subtasks (`parent_task_id`), dependencies with live state, evidence requirements + files, owner approval status, Breezeway linkage/action, activity, notes, completion criteria — and a plain-language **Why this task exists** block generated from real fields: template anchor/offset ("Due date = Actual Closing + 4 business days"), `depends_on` titles, `ownerApprovalWhenActiveOwner`, `evidenceRequired`, `breezewayTemplateId`, and downstream tasks that list this one in `depends_on`. Completion is refused while an evidence requirement is unsatisfied. Manual due-date edits prompt for an override reason (stored in the existing `exception_reason` path).

## F. My Work

Tasks assigned to the signed-in user across pipeline properties, grouped Today / Overdue / Upcoming / Blocked / Needs Review, sortable by due date, property, section, status. Row shows Property · Task · Due · Status and opens the same drawer.

## G. Manager Hub

Table: Property · Current Stage · Progress · Next Milestone · Blocker · Project Manager · Target Handoff, with quick filters for behind schedule, overdue owner decisions, vendor delays, missing evidence, handoff blockers, ready for review, no recent activity, and workload by PM. Row opens the property Workflow view.

## H. Automation already available

Anchor-driven due dates with preview/apply and completed-task protection; dependency release via `depends_on`; evidence requirements and gating; Active-Owner-conditional approvals with mismatch confirmation; Breezeway template ids on template tasks plus the existing work-order/photo integration; the four-step handoff gate with carryover; audit logging on task save, approvals and handoff.

## I. Gaps that would need backend work (not in this pass)

1. **Section ordering metadata** — sections are inferred from `stage`; fine today, but a template-driven section label table would be cleaner later. Not required.
2. **Automatic status transition Not Ready → Ready** — currently derived at read time in the UI. Persisting it would need a trigger. Recommend keeping it derived.
3. **Structured blocker reason code** — today `blocker` is free text. A small enum column would make reasons reportable. Deferred; UI derives reasons meanwhile.
4. **Breezeway task creation from an onboarding task** — the work-order integration exists but is wired to tickets, not onboarding tasks. Needs a thin server function later.
5. **Milestone set beyond the three anchors** (Design Complete, Staging Complete, Target/Actual Go Live, Handoff Date) — only planned closing, actual closing, actual access exist today. Timeline will show what exists and mark the rest as not yet tracked.

Each of these is additive; none touches production rows.

## J. Risks

Low. This pass is presentation plus read-time derivation over existing server functions. No changes to OwnerRez, Breezeway, SharePoint, Active Owner, evidence, handoff, RLS or permissions. The main risk is route churn — mitigated by keeping `/onboarding` working and adding child routes.

## K. Build order

C1 Property route shell + tabs → C2 sectioned Workflow table → D drawer → G Manager Hub → E My Work → Overview/Timeline/Calendar/Files tabs → automation-explanation verification pass.

## L. Scope

UI-only: roughly 90% of this request — all of sections 1–7, 9, 10, 13–19, 21 display behavior. Backend: the five items in I, small and deferrable, to be raised individually before any schema change.
