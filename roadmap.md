# Roadmap — approved build work, NO publish

## Oct 27 onboarding cleanup (approved build only)
- [x] Unified Add property window using canonical actions and retry receipts
- [x] Active Owner tab combines released reviews and staff Opportunities
- [x] Handoff layout and pending id-based duplicate-step repair with undo
- [x] Isolated tests, full suite and read-only preview checks; no live mutations or publish
- [ ] Pending review conversation SQL/RLS and homeowner integration: requires isolated test coverage and separate authorization before any shared-backend application
- [ ] Real setup and handoff acceptance: blocked by prohibition on live writes; Oct 27 32/54 batch reconciliation and full template-stage labels remain unverified

- [x] Grouped top tabs (My Work / Properties / Work Orders / Claims / Reports / Admin) via PAGE_TAB_GROUPS + GroupTabs; Record work retained (top action hidden on /tickets)
- [x] Sidebar regrouped in AppShell; Ask the Coach + Help moved into Help & Feedback dropdown
- [x] Re-labels: Onboarding Home / My Tasks; unified page titles (Onboarding, Active Owner, Vendors, Owner Participation, My Work/My Tasks)
- [x] Glossary/plain-language sweep (Platform Owner→Admin, work order→Work Order casing, handoff wording limited to ownership transfer, approvals wording)
- [x] Tests: 1535 pass / 5 skip / 0 fail; tsgo clean; build OK
- [x] Fixed pre-existing test-isolation flake (owner-progress-demo mock) by renaming to zz-owner-progress-demo.test.ts
- [ ] STOP — do not publish; await Emily's go

## Pass 1 fix-up (approved, no publish)
- [x] "an Admin" article fixes
- [x] Group tab bars on STR Cleaner Time, Vendors, Owner Participation
- [x] Invite codes text
- [x] Spending approval + Supervisor wording
- [x] Revert onboarding-template.ts to 464897d7
- [x] Builder-word fixes

## One-step Active Owner enrollment (Oct 26; files only, no live writes)
- [x] Read-only generic account email trace; hosted sender/content not verified
- [x] One enrollment window and resumable canonical action built; live execution blocked until pending SQL approved
- [x] Immediate owner hours and Admin closing migrations staged, not applied
- [x] Four-program Opportunity repair script and exact read-only inventory staged, not run
- [x] Held branded password-link welcome preparation
- [x] Synthetic unit tests and automatic typecheck/build verification (1546 pass, 5 skip)
- [ ] Isolated database and signed-in enrollment acceptance: blocked because required SQL is deliberately unapplied and shared live writes are forbidden
- [x] Tests, typecheck, build

## Oct 26 follow-up (approved, no publish)
- [x] A. One summary notification + email per Opportunity release batch (pending SQL file)
- [x] B. Held-welcome note + Send setup link on enrollment confirmation
- [x] C. Ticket #57: template step window defaults + Blocks handoff note, tests

## Release Part 1 (Oct 27, done)
- [x] Publish confirmed: live build index-DmxmHkXp.js (Pass 1, enrollment window, #57 fix)
- [x] Applied 0157, 0158, 0160, 0159 with fingerprints + undo files in docs/pending/active-owner-enrollment/undo/
- [ ] Part 2 (separate go-ahead): repair-four-real-programs.sql, 0162, 0161

## Oct 27 revised Part 2
- [ ] A. Skip prerelease welcome, then approve wording: blocked by migration tool's DDL-only restriction; no data changes
- [x] B. Permanent authenticated batch-release action, read-only confirmation and pending 0163 SQL (no publish/apply)
- [x] Full automated suite and automatic typecheck/production build; isolated PostgreSQL release coverage
- [ ] Signed-in preview/real release acceptance: blocked until 0163 is applied and code released; no real release executed

## Help Ticket #56 bulk template steps (approved, no publish)
- [x] Template-only selection and bulk edit window with leave-as-is defaults
- [x] Pending all-or-nothing database action and audit history, not applied
- [x] Isolated tests, full suite, typecheck and production build; no live template writes

## Option A: bulk edit one home's onboarding plan (approved, no publish)
- [x] Selection + bulk window on home plan (open Tasks only)
- [x] Pending all-or-nothing DB action + undo in docs/pending/home-plan-bulk-edit/ (not applied)
- [x] Isolated tests, full suite, typecheck, build
- [ ] Follow-up (not built): single-Task "return to automatic date" action

## Optional Library video, played in the owner portal (approved, no publish)
- [x] Staff Video section (upload/replace/remove, caption, progress, history)
- [x] Owner play button + in-portal player via short-lived links, live from library item
- [x] Pending DB change + undo in docs/pending/library-video/ (not applied)
- [x] Isolated tests, full suite, typecheck, build
- [ ] Real 129 MB upload and homeowner viewing: blocked until 0167 is applied and published
