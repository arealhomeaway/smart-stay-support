# Roadmap

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
