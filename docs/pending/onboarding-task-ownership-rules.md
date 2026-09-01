# Onboarding task ownership — proposed rules (FOR APPROVAL)

Problem: 177 of 180 tasks opened unassigned, because the ARHA plan carries a
role *name* in text and Resolve stored no owner. Assigning 177 tasks by hand
would fix one project and none of the next ones.

Fix: ownership is a **seat**, not a person. Every task is created owned by a
functional seat (`functional_roles.code`); the person is resolved from whoever
holds that seat today. A staffing change moves the work automatically.

## Rule 1 — role name maps to seat

| Plan role (template text) | Tasks | Seat |
|---|---|---|
| Project Manager | 122 | `project_manager` (Iveth Sabillon) |
| Onboarding Manager | 15 | `director_onboarding` (Kati Hand) |
| Utilities Coordinator | 7 | `project_manager` |
| Onboarding Admin | 4 | `project_manager` |
| Lead Designer | 2 | `project_manager` |

Utilities Coordinator, Onboarding Admin and Lead Designer have no seat of their
own today. They route to Project Manager until those seats exist; adding the
seat later is a one-line map change, not a re-assignment exercise.

## Rule 2 — stage fallback when no role is named

| Stage | Seat |
|---|---|
| post_contract | Director of Onboarding |
| phase1_inspection … phase5_monitor | Project Manager |
| phase6_handoff | **Director of Operations** — handoff belongs to Operations |

Final fallback: Director of Onboarding. No task can be created ownerless.

## Rule 3 — owner actions stay owner actions

Tasks flagged `requires_owner_approval` keep their homeowner decision record.
The seat owner is responsible for *chasing* the decision, not for making it.

## Rule 4 — explicit reassignment always wins

Seat ownership sets where a task starts. A named reassignment on an individual
task is never overwritten by a later template re-apply or seat change.

## Rule 5 — vacant seat

If a seat has no current holder, the task still records the seat and shows as
"Unstaffed — <seat>" rather than "Unassigned". That is a staffing gap, visible
as one line, not 122 orphaned rows.

## Implemented now (non-destructive)

- `onboarding_tasks.assigned_seat` column added.
- New projects are instantiated with seat + person populated (no unassigned rows).

## Awaiting approval before running

Backfill of existing projects, restricted to tasks where `assigned_to IS NULL`:
sets `assigned_seat` and the current seat holder. Tasks already assigned to a
named person are not touched. Demo projects included; archived tasks excluded.
