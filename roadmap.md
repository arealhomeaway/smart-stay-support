# Roadmap

## Full suite and publish readiness (Emily, Nov 26)
- [x] Diagnose and correct the six failures against approved rules; rerun affected tests without changing live data or publishing.
- [x] Complete Bun test suite passes in memory-safe batches; no live data changed.
- [ ] Publish waits for Emily's separate go-ahead after the fixes.

## One save per owner card and My history (Nov 25)
- [x] Combine answers, actual time and evidence into one canonical card save; demo plan-card save and edit verified.
- [x] Shared owner/staff history, totals and duplicate prompt verified with matching 15 rows on desktop/phone.
- [x] Owner-only duplicate removal: later copy archived, original and audit retained; demo-owner desktop/phone saves and archives verified, 11 isolated checks and 33 focused reader tests passed.
- [x] Owner menu and weekly-email history destination.
- [x] Stage, practise and apply authorized database package; 62 focused tests passed.
- [x] Use authorized existing demo homeowner: Saved 1.5 hrs + Docs link, phone edit, Added work and duplicate notice verified; Emily's staff list/totals matched.

## Shared simple staff Home (Emily, Nov 25)
- [x] Mount existing CoordinatorHome for all staff; plain leader Oversight link, no totals. Old components kept, reads/actions unchanged.
- [x] Emily checked at 1440/390: only header, Open Oversight and three sections; Home buttons 18 to 6, no 338/decision totals, no-team Take one empty. Seven tests pass. Approval reader/render path unchanged; Emily has zero pending personal approvals, so no approval action tested.

## Auto-assign by seat (Emily, approved ops-simplification)
- [x] Read live ticket source/team breakdown (205 open, 131 unowned); preserve exact undo.
- [x] Applied function as 0382; protected routing/alert fingerprint unchanged, 25 tests pass; automated demo 5139 assigned and archived.
- [x] Scheduled job 24 for Nov 26 14:00 UTC, sequential spread with audit IDs and self-removal; T15 updated. Future execution awaits scheduled time, not an unfinished implementation.

## Simple coordinator Home (Emily, Nov 25)
- [x] Coordinator-only My work, Take one and Hand off using existing reads/actions; leaders retain their Home.
- [x] Signed-in View as desktop/phone checked; Home buttons 9 to 6, 68 focused tests pass; booking panel and Prepare handoffs opened. No database, switch or publish changes.
- [ ] Actual Team A/B Take and handoff mutation verification waits for a writable coordinator session with matching work; View as is read-only and has no Team A/B identity selector.

## Quiet hold check (Emily, Nov 25)
- [x] Read all real open tickets and reproduce the existing Home calculation before/after; C and D both empty, no live data update needed.
- [x] Confirm ordinary tickets are not quieted by import_hold; skip D as instructed and preserve every existing rule.
- [x] Record the empty changed-ID list, exact no-op undo, preflight, isolated no-op practice and counts in docs/pending/quiet-hold-backlog. No switches changed or publish.

## Operations simplification (Emily, Nov 25, approved ops-simplification)
- [ ] Notion correction staged: 24 pure tests/7 focused isolated checks pass; fresh counts reported. No live moves, assignment or all-screen wiring until full package practice passes.
- [ ] Part 1 stopped as instructed: open-only markers/no restrictive policies staged; 47 real dependencies captured; practice failed on generated vendor qualification score represented as DEFAULT. No apply, schedule or live-reader changes.
- [ ] Separate old backlog from live tickets, maintenance/lawn reviews and Direct Booking requests; stop backlog counts and clocks
- [ ] ops-simplification staged but NOT ready to apply: isolated schema reconstruction failed; behavior/undo/preflight execution incomplete
- [ ] Route all new live tickets/reviews through existing schedule routing; one-time assignment tomorrow 8 AM Central
- [ ] Team Queue: Team A, Team B, Mine; subject tabs, four due filters, one combined table
- [ ] Home: compact leader line; personal live Needs you now, seven rows maximum, no bookings older than 24 hours
- [ ] Verify before/after counts, Team A mapping, full-suite comparison and signed-in preview; 69 focused tests passed, baseline 527 files attempted with timed-out batches
- [x] Keep guest-ready-type-links, database-priority-words and reported-issue-order-links on hold; none applied, no switches changed, no publish

## Operations cleanup (Emily, Nov 25)
- [x] 1 Lock icons across all named ticket lists; signed-in Oversight/Supervisor/Databases verified, Home via shared renderer/tests
- [ ] 2 Preview wiring complete; waiting on Approved: apply guest-ready-type-links
- [ ] 3 Waiting on Approved: apply database-priority-words
- [ ] 4 All issues verified in shared panel; atomic linking waits on Approved: apply reported-issue-order-links
- [x] 5 Hide onboarding homes from Home and Needs you now, keep real carry-over links; tests pass
- [x] 6 Team B 140 equals five tabs 73+13+0+0+54 in signed-in preview
- [x] 7 View lock targets profile access section; target scroll verified, direct click test incomplete
- [x] Preview builds/typecheck pass; 37 focused tests and 16 isolated package checks pass; no publish or switch changes
- [ ] Complete full-suite before/after comparison: baseline timed out in a later batch; not completed this turn

## Delete property (Admin, Nov 24)
- [x] Update H9 with the approved onboarding-only exception
- [x] Preview menu/server checks and staged items 1-7 without widening is_director; full behavior awaits application
- [x] Stage property-delete with preflight, isolated practice, undo and checksums
- [x] Read-only list of the two homes passing the specified safety checks, with creation details
- [x] Focused authority/lifecycle/safety/atomic audit tests: 39 passed; existing property-page tests: 40 passed
- [ ] Item 6 exact file removal: blocked by external-storage transaction limitation; reviewed removal contract needed
- [ ] Live deletion/full-schema practice: blocked by unapproved staged action and unresolved linked-history/file handling; no apply or publication

## Proof that it saved (Admin, Nov 17)
- [x] H1-H3 homeowner Saved messages, Completed proof, Your hours
- [x] T4-T6 team Saved messages, Done by [role], Done recently
- [x] T7 home team (PM, Utilities, Task assignees) read homeowner answers (replaced by T8)
- [x] T8 every staff member reads every homeowner answer and its files, read only
- [ ] Home's Property Coordinator reading answers: waiting on how a home's coordinator is recorded (no per-home record exists)
- [x] No "Overdue" on finished homeowner items

## Shannon Linder duplicated hours (Admin, Nov 21)
- [ ] Part 1 link 32 repeats: staged docs/pending/shannon-hours-links, waiting on "Approved: apply shannon-hours-links"
- [ ] Part 2 Edit and Add more for hours: docs/pending/homeowner-reopen rechecked, waiting on "Approved: apply homeowner-reopen"
- [x] Part 3 screen: Save disabled, "Saving...", "Already saved." shown; [ ] server guard staged docs/pending/hours-double-save, waiting on approval (after homeowner-reopen)
- [x] Part 4 "Update that one instead?" question on new logs

## Onboarding notifications and escalations (Nov 22)
- [x] Owner tasks notify only the home's Project Manager (applied 0367 Nov 22)
- [x] No notice when completing a task you created (already true; practised)
- [x] Director of Onboarding notified only for: tasks they sent, escalations, PM hand-added tasks (applied 0367)
- [x] Daily 8 AM local reminder (built; starts once staged change applied and published)
- [x] Escalate button on owner cards (shows once staged change applied)
- [x] Escalations list above the task list (shows once applied)
- [x] Each escalation: email + in-app to Director of Onboarding (applied 0367; email sends to test inbox after publish)
- [x] All onboarding emails only to the test inbox until the setting is removed

## Owner weekly updates and onboarding tour (Nov 22)
- [x] Replace task-written weekly update card with three templated updates (Closing +7/+14/+21, 9 AM local, business days) — built in preview; DB applied Nov 23 (0368); Active Owners portal + email (Nov 23); real sends wait on Emily approving removal of the test inbox; publish waits on Emily
- [x] Portal for Active Owners, email for others, PM reply-to and copy, logged on owner tab (preview)
- [x] PM preview the business day before with Edit / Hold (preview)
- [x] Call or Email on owner tab fills the matching template (preview)
- [x] Owner tab prompt at 6 days since last update (preview)
- [x] Tour step 27 wording; tour on for onboarding team (preview)
- [x] No owner sends while testing; read back scheduled updates per home (preview)

## Onboarding filters, search and views (Nov 22)
- [x] One Filter button opening a selection panel (My Tasks and Project Database, preview)
- [x] My Tasks search: task text, task type, assignee role, tag; same search in project task list (preview)
- [x] Task type filter (Utilities, Designer...) (preview)
- [x] Saved named views per person; Group by home saved per person (applied as 0369, Nov 23)
- [x] Kanban view for one property, picked from a dropdown (preview)
- [x] Project Database columns per person: drag/show/hide and Stager column, saved per person (applied as 0369, Nov 23)

## Onboarding Breezeway work orders (Nov 22)
- [x] Description arrives as the work order's instructions (new sends); list open ones sent the wrong way
- [x] Task done once its work order is created; shows Breezeway status (staged: onboarding-work-order-done, needs mark-done-breezeway first)
- [x] Reopen with reason when canceled or past date unfinished (staged)

## Onboarding utilities and checklist cleanup (Nov 22)
- [x] Utilities tasks no longer show "Property and equipment facts"
- [x] Utility cost box labelled "Estimated monthly cost"
- [x] Cost segregation step off the plan + 8 open copies archived (applied Nov 22, migration 0364)
- [ ] Notion Utility Property Matrix import: blocked. The Notion tables holding providers, account numbers, logins and Property IDs are not shared with the Resolve Notion connection

## Roles apply, no proof, homeowner answer review (Nov 22)
- [x] Apply onboarding-roles-attach (Designer and Onboarding Manager only; Project Manager and Utilities left for the Director)
- [x] O7/O8 changed: no proof on screens and in app saves
- [x] No-proof database part: practice re-run, applied 0365 Nov 22
- [x] Owner completions page put back as before the last build
- [x] My Tasks My homeowners: unreviewed answers with task name, answer, Reviewed button (shows once applied)
- [x] Collapsed Reviewed list with who and when; new owner answer returns it (shows once applied)
- [x] Review database change: applied 0366 Nov 22

## Approvals and Daniel Court instructions (Nov 22)
- [x] Apply mark-done-breezeway (0362)
- [x] Apply onboarding-work-order-done (0363)
- [x] Apply cost-seg-removal (0364)
- [x] Write Task text into the 5 Daniel Court work order instructions in Breezeway (docs/pending/daniel-court-instructions)

## Breezeway work order correction (Nov 22)
- [x] Instructions box fills with the Breezeway template's own instructions; editable; sent exactly as in the box
- [x] Task step guidance never written into Breezeway (work order section and vendor dispatch panel)
- [x] Sent work orders show their instructions as Breezeway has them now
- [x] 5 Daniel Court work orders put back from before.json, read back
- [x] Done on send and reopen when late or canceled unchanged
- [x] Property page review draft: all staff see full utility account numbers and logins; never owners or vendors

## Active Owner enrollment fully automatic on every path (Admin, Nov 23)
- [x] 1a Add property step 3 for everyone who can add a home
- [x] 1b Owner Type set to Active Owner on any save enrolls, any role, as the saver
- [x] 1c Start onboarding / scope change with the module enrolls fully
- [x] 1d Owner Type label and module kept in step on save
- [x] 2 5 minute safety net (existing five-minute job)
- [ ] 3a-3d Missing details never block; Needs you now items (3c waits on a decision: program cannot go live without a closing date)
- [ ] 4 Staged ao-module-sync for 3400 N Fern Ave and 624 Daniel Court (waiting on "Approved: apply ao-module-sync")
- [x] 5 Tests, practice on demo data, read-only check of the 8 live homes, AGENTS.md rule
- [ ] Staged ao-auto-enroll database change (needed for 1-3), waiting on "Approved: apply ao-auto-enroll"

- [x] property-delete-fix applied (0373); 123 test deleted.
- [ ] property-delete-fix2: staged; delete step skips work items moved by a trigger. Waiting on "Approved: apply property-delete-fix2", then delete 5253 Trace.

## Change 1 of 5 (Nov 24): Guest-ready standards, locked due dates, ticket panel, New ticket
- [x] Preview build (page, lock UI, P1-P3 words, Ticket type, panel buttons, New ticket)
- [ ] Apply ticket-due-date then guest-ready-standards (waits on Emily's approval words)
- [ ] Change 2 of 5: Team B view (waits; questions answered Nov 24)
