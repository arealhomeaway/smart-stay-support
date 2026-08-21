# 90-Day Owner Participation Program — multi-property upgrade

## What already exists and gets reused

- **Owner Hub** (`/owner`) — dashboard, time-log dialog with the "no prefill / I confirm" rules, review responses, alerts feed.
- **Owner programs** staff page (`/owner-programs`) — enrollment, invite codes, roadmap seeding, contact-alert queue.
- **Tables**: `owner_programs`, `owner_reviews` (owner tasks/decisions), `owner_time_entries` (immutable, attested), `owner_task_templates`, `owner_notifications`, `owner_contact_alerts`, `owner_invites`, `properties`, `tickets`.
- **Branding, auth, roles, navigation, notification engine (email + in-app), contact-alert escalation** — untouched.

## New database work

1. `owner_program_properties` — the join that makes a program multi-property: program, property, closing date, added-on date, added-by, inclusion status, onboarding status, launch status, coverage status, last owner activity.
2. `owner_time_entry_properties` — which properties one entry touched. Minutes stay only on the entry; this table never carries minutes, so a shared 90-minute meeting can never be double counted.
3. `owner_reviews` gains: `task_type` (program_wide / property_specific / multi_property), `property_id`, plus `owner_review_properties` for multi-property tasks.
4. `owner_programs` gains: activation fields (activated_by, activated_at), `operating_target_hours` (105), `onboarding_milestone_hours` (60) / `onboarding_milestone_day` (35), onboarding lead, operations lead, DFY combined confirmation, internal notes, expanded status list (draft, waiting_for_closing, ready_for_onboarding, active, target_reached, completed, paused, closed).
5. `owner_badges` — badge code, awarded date, triggering rule, supporting record ids, `needs_review` flag.
6. `owner_program_events` — audit log: creation, activation, property add/remove, closing confirmation, time entry + corrections (original value, new value, reason, editor), status changes, alerts, badges, completion.
7. `owner_alert_log` — last-sent per alert kind per program, for the 7-day de-duplication and escalation rule.
8. Attachments: a private storage bucket for task and entry files, owner-scoped by program.

All new tables get GRANTs, RLS scoped to the owning homeowner plus staff read/write.

## Migration of today's single-property programs

Every existing `owner_programs` row has one `property_id`. The migration copies each into `owner_program_properties` (inclusion = included, added-on = program start, closing date null pending staff confirmation) and keeps the legacy column in place, read-only, so nothing currently rendering breaks. Existing time entries are backfilled into `owner_time_entry_properties` against that single property. Existing reviews become `property_specific` when they carry a ticket/property, otherwise `program_wide`. Existing hours, reviews and alerts are preserved exactly.

## How duplicate hour counting is prevented

- Minutes live on exactly one row: the participation entry. Property links carry no minutes.
- Combined program total = `SUM(minutes)` over **distinct entry ids** for the program — never a sum of per-property rollups.
- Property views compute three informational buckets (direct, shared multi-property, program-wide) and are labelled as informational; they are never inputs to the program total, benchmark, status or badges.
- Badge thresholds read the same distinct-entry total.

## Benchmark, statuses, alerts, badges

- Benchmark: `60 × day/35` through day 35, then `60 + 45 × (day-35)/55`, capped at 105. Program-level only, decimal stored, whole hours displayed. Never writes hours anywhere.
- Statuses: Not Started / On Track / Slightly Behind (1–4.9) / Action Needed (5–9.9) / Significantly Behind (10+) / Target Reached (**strictly above 100**) / Program Completed. Behind alerts suppressed for days 1–7.
- Owner alerts fire only on the seven defined triggers, deduped 7 days unless severity increases, encouraging tone, no tax language. Internal property-coverage alerts are separate and speak only to open tasks and decisions.
- Badges: all hour and portfolio badges listed in the brief, with restrained animation, recorded rule + supporting records, and a review flag if a correction invalidates one. Program Complete requires staff closeout, not hours.

## Screens

- **Owner Hub**: "Your 90-Day Participation Progress" header (Day X of 90, combined hours, benchmark, variance, % of 105, days remaining, status, next milestone, hours to exceed 100, onboarding vs operations), then per-property cards showing task coverage only — no per-property hour targets. "My Achievements" section. Log-participation dialog gains activity category, multi-property selection, decision/outcome, optional attachment, and keeps the manual-entry disclaimer and confirmation checkbox.
- **Staff**: one row per program with the full column set from the brief, plus an "Owners Needing Attention" view in the specified priority order, activation checklist (all properties closed + DFY confirmed + onboarding meeting) and admin-approved late property additions that never reset the 90 days.
- **Report**: one combined closeout report with the required disclaimer, generated before completion is allowed.

## Assumptions needing ARHA approval

1. Activation requires an admin or manager; coordinators can prepare a program but not start the clock.
2. A late-added property cannot have participation dated before its closing date; existing entries are never retroactively reassigned.
3. "Substantial onboarding completion" for the Onboarding Champion badge = all required onboarding tasks answered across all included properties.
4. Removing a property archives it (inclusion = removed) and keeps its history and its share of shared entries; it stops raising coverage alerts.
5. Attachments are stored in Lovable Cloud storage, private, visible to the owner and ARHA staff only.
6. Owner-reported time stays immutable: corrections create an amending entry rather than editing the original, matching today's behaviour.

## Build order

1. Migration + RLS + backfill.
2. Program/benchmark/badge logic in shared browser-safe modules with unit-safe pure functions.
3. Server functions for program CRUD, activation, property add/remove, task types, entry logging with multi-property links, badge evaluation, alert evaluation, report generation.
4. Owner Hub UI, then staff dashboard and Owners Needing Attention, then achievements and report export.
