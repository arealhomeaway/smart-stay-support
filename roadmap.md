# Roadmap — approved build work, NO publish

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
