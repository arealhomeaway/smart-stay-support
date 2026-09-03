# Onboarding Operating System — staged build

The 67-section brief is a multi-pass program, not one change. Below is how I propose
to land it in four sequenced passes so each one is verifiable and nothing in
Operations, Active Owner, auth or production data is put at risk. Every pass ends with
typecheck, focused tests, desktop + 390px smoke, and a report.

I will start Pass 1 as soon as this is approved, then continue straight into Pass 2, 3
and 4 without waiting for further approval — unless a pass turns up a hard stop
(auth/RLS, data loss, property identity, destructive external writes).

## Pass 1 — Separation of concerns + initialization (foundation)

The spine everything else depends on.

- Separate Property / Owner / Onboarding Project / portal access. Onboarding Project
  becomes an explicit record with its own lifecycle, scope and reviewers, instead of
  stage columns living on the property row.
- Explicit "Start onboarding" action that captures branch, PM, Director, closing /
  possession / target handoff dates, scope, modules, external references — pre-filled
  from what Resolve already knows.
- Scope/applicability engine: module flags (furnishing, pool, HOA, utilities, repairs,
  appliances, smart lock, cameras, warranty, Active Owner) drive which requirements
  exist. Full Furnishing and No Furnishings both fall out of the same rules.
- Active Owner enrollment moves to the **property/program** level, aggregating into one
  owner portal while keeping explicit per-property context. Non-enrolled properties of
  the same owner stay out.
- Owner contact surfaced on Property, Project, approval and handoff contexts.

## Pass 2 — Work release, stage capture, evidence, permanent facts

- Task states: Future / Waiting / Ready / In Progress / Awaiting Review / Correction
  Required / Complete / Not Applicable, with release driven by lifecycle + prerequisites
  + applicability. Future work stays visually quiet.
- Native stage capture replacing Fillout thinking: one canonical stage record per
  stage, edited with revision history, context already known.
- Observations (answer / measurement / condition / defect / permanent-fact candidate)
  with evidence attached; SharePoint holds files, Resolve holds metadata and review.
- Reviewer flow with current-vs-proposed value comparison; accepted facts written
  atomically to canonical Property/Asset records, prior value preserved. No silent
  overwrite, no Add-to-PID.
- Assets/equipment as child records; restricted credentials stay in the secure store.
- Corrections as first-class work with full origin → fix → evidence → verification
  history.
- Stage completion becomes gate-driven; Director-level reopen preserves the original
  approval, reviewer, date, facts and reason.

## Pass 3 — Owners, financials, handoff

- One canonical Owner Approval object with two channels: Resolve-generated email for
  standard owners (recipient, subject, sent time, linked task/property/approval,
  response evidence, staff-confirmed decision) and in-app for Active Owners.
- Notifications on meaningful state changes only, in-app + email, deep-linked.
- Utilities normalized (account / restricted credential / cost).
- Financial Request model: estimate → approval → invoice → variance → accounting
  handoff, with configurable $200 / $350 / emergency thresholds and a standardized,
  admin-configurable accounting email. Approved amount never overwritten by actual.
- Locked handoff chain (PM → Director Onboarding → Director Operations → Operations
  accept → Supervisor Live) with derived readiness that explains itself, carryover, and
  financial reconciliation tracked separately from Live.

## Pass 4 — Premium UX, role dashboards, QA projects

- Project workspace refactored to six stable areas: Overview, Work, Property,
  Financial, Handoff, History — detail in drawers/sheets, not new tabs.
- Role-specific homes for PM, Director Onboarding, Director Operations, Supervisor and
  field staff; field users see only assigned work + instructions + evidence.
- Director Hub regrouped: Needs Attention, Awaiting My Review, Corrections, At Risk,
  Blocked, Upcoming 7/14/30, Handoff Queue, Workload — all drill-through, risk
  explainable.
- Navigation contract preserved (origin queue, filters, contextual back).
- Two clearly marked non-production QA projects: QA A Full Furnishing, QA B No
  Furnishings, excluded from production KPIs.

## Technical notes

- Additive migrations only; existing onboarding tasks, handoffs, reviews, notes and
  external records are preserved and mapped forward, never replaced.
- New public tables ship with GRANTs and RLS scoped to existing roles; no auth changes.
- Legacy Notion / Fillout / Make / Breezeway / legacy inspection Supabase stay live and
  transitional; direction of ownership per record is made explicit so nothing
  double-writes.
- Existing derived logic in `onboarding-lifecycle.ts` and `onboarding-workflow.ts` is
  extended rather than rewritten.

## Open decision I need from you

Nothing blocks Pass 1. Two items I will assume unless you say otherwise:

1. Accounting handoff recipient is admin-configurable and left unset until you provide
   the mailbox.
2. Learning stays architectural only (a third participation source is supported, no
   curriculum built).
