# Roadmap — approved build work, NO publish

## Nov 5 reservation change tile (build/test only)
- [x] Add Guest reservation-change tile, booking-only category mapping and text suggestions using existing Current or past guest request catalog routing
- [x] Stage cleaning repeat-complaint 60-day template version and audited TEST 1 archive with compensating undo/checksums; nothing applied
- [x] 16 new rules/isolated publishing tests; full suite 2444 pass / 5 skip; mocked shared form desktop/mobile suggestion/choice checked without sign-in or writes
- [ ] Live template publication/archive blocked by no live-write approval; playbook editing migration rejected BEGIN/COMMIT, remains unapplied

## Nov 5 Help ticket bulk updates (build/test only)
- [x] Filtered Select all across all paginated rows, row selection, six bulk statuses/note and default-off notifications
- [x] Caller-authenticated atomic history/status action, replay receipt and grouped notification claim; SQL/undo/README/checksums staged only
- [x] 14 mocked/isolated rules tests; full suite 2428 pass / 5 skip / 0 fail; automatic type/build OK; mocked desktop/mobile save and restricted-control checks passed
- [ ] Real bulk saving blocked by unapplied SQL and prohibition on real Help ticket writes

## Nov 5 SOP upload (build/test only)
- [x] Admin/Director Upload dialog, Word/PDF reading, existing SharePoint/Coach integration, linked draft editor and side-by-side version comparison
- [x] Transactional SOP/version/draft setup, undo, README and checksums staged in docs/pending/sop-upload; no application
- [x] 15 mocked/isolated upload, AI, rollback and permission tests; full suite 2414 pass / 5 skip / 0 fail; automatic type/build OK; mocked desktop/mobile Word and PDF browser flow passed
- [ ] Real authenticated upload blocked by unapplied SQL and prohibition on real uploads

## Nov 5 playbook editing (build/test only)
- [x] Read-only checklist provenance/behavior/mapping, playbook counts and duplicate/empty inventory reported before B
- [x] Admin/both Director draft editing, version-safe active edits, atomic approval/history and archive; SQL/undo/README/checksums staged in docs/pending/playbooks-nov5 only
- [x] 11 lifecycle/server-permission tests; full suite 2399 pass / 5 skip / 0 fail; automatic type/build OK; synthetic desktop/mobile editor saves checked
- [x] Read-only before/after: all 35 live playbook row checksums unchanged; no real writes, migration application or publish
- [ ] Signed-in edit/approve/archive cannot be verified until staged SQL is applied; byte-for-byte application rejected BEGIN/COMMIT. Booking vs Other guest complaint ambiguity resolved by separately approved reservation tile.

## Nov 5 simplify Record work (build/test only)
- [x] Rename maintenance entry, show unchanged situation tiles directly, restrict work-type override to Admin/Supervisor
- [x] Carry repair selections into shared maintenance form; unchanged catalog supplies work type, seat and clocks
- [x] 26 new regression tests; full suite 2388 pass / 5 skip / 0 fail; automatic type/build OK
- [x] Unsigned synthetic browser checks: three roles, suggested tile, three repair handoffs retaining summary/home/source, mobile overflow; no publish or data writes
- [ ] Authenticated real-record creation not tested because sign-in and data writes are not approved; Internal remains deliberately unmapped and requires a Supervisor work-type choice

## Nov 1 Operations pilot dispatch (build/test only)
- [x] Read-only impact: zero recorded task sends; accepted vendor/appointment, exact Work Order reservation, Admin scope/history built
- [x] Stage database guards and exact undo in docs/pending/pilot-dispatch; no application, live writes, sign-in, sends or publish
- [x] Mocked outbound/concurrency tests, full suite 1987 pass / 5 skip, automatic type/build OK
- [ ] Signed-in Admin/real dispatch and production multi-connection acceptance blocked by no sign-in, no sends, unapplied staged guards

## Oct 30 Homeowners fix and Lee identity correction
- [x] Fix property demo lookup, roster gating and enrollment-error handling; exclude archived reviews/retired Opportunities; role render/rule tests, full suite 1842 pass / 5 skip, automatic type/build OK
- [x] Inventory Lee program history and stage exact shared-alert read undo with base64/SHA256/ACL capture
- [x] Phase A canonical Ryan login created with owner role only, no membership or email, retained receipt
- [x] Phase B completed as Emily: Ryan primary, Lindsey co-owner; both access only RL program; identical table-predicate portal row sets (0 reviews, 6 entries, 8 alerts, 10 events); 302 minutes unchanged; invites revoked; other programs/canonical owner/security set unchanged; one-time function removed; Ryan-only welcome sent by 23:00 UTC job. Receipt retained. Homeowner sign-in/rendered portal/inbox delivery not tested.

## Oct 30 co-owner support (approved build/test only)
- [x] Pass 2 subset: classify 59 functions plus 10 live/storage policies; reverify all 59 hashes/ACLs; stage six shared-helper substitutions plus one policy with exact undo; 13 isolated live-definition tests and full suite 1813 pass, 5 skip, 0 fail (15-second timeout for existing large ZIP test)
- [x] Stage membership foundation, pending primary backfill draft, absence undo and isolated access tests
- [x] Inventory 59 live owner_user_id functions and one direct policy with verified base64/SHA256 and grants; preserve all current routing
- [ ] Convert all owner access policies/functions and test full schema in isolation
- [x] Pass 3A: 16 remaining direct gates staged in 04 with undo and isolated tests
- [ ] Pass 3B: app-side primary checks (findOwnerProgram, listOwnerFileRecords), respond_owner_review concurrency test, full production RLS closure; demo co-owner provisioning stays unconverted
- [ ] Build guarded co-owner account linking/add/remove, shared portal and notification reads
- [x] Full suite: 1800 pass, 5 skipped; automatic local build OK; no application access changes
- [ ] Complete replacement inventory, backfill row-scoped undo, provisioning, full production-schema policy tests and authenticated acceptance: not built in this foundation part

## Oct 30 code-review fix pass (approved, pending database only)
- [x] Attempt Emily's published practice-home test; stopped before edits because the home lacked an explicit practice label
- [x] Atomic Project Team save and exact pending undo (not applied)
- [x] One business-decision approval rule, pending enforcement and separate three-template correction (not applied)
- [x] First homeowner conversation visibility, retained enrollment receipt, original review-date eligibility
- [x] Focused and full tests (1790 pass, 5 skipped), automatic type/build checks; isolated receipt and first-message screen checks; no publish or live application
- [ ] Published practice Save reproduction: blocked by missing explicit practice-home label; template test skipped because no demo/test template exists
- [ ] Live Project Team and database completion acceptance: blocked until separately authorized pending SQL is applied

## Oct 29 address labels (approved code/test only, no live writes)
- [x] Shared code/database formatting and shared property search across global/Ticket/onboarding/lead entry points
- [x] Broad staff, homeowner, navigation and export label/read coverage; stored identity and historical snapshots preserved
- [x] Stage 17 alert/report functions plus one owner projection with exact undo and expression-only diff proofs
- [x] Rachel welcome read-only finding and zero-fallback real-home inventory
- [x] Isolated label-expression and actual summary/note/handoff/message producer tests; welcome, homeowner-reader and export output tests; full suite and automatic typecheck/build; no sign-in/publish/apply
- [ ] Signed-in screen acceptance and complete producer workflow execution: blocked by no sign-in/live writes; pending SQL not applied


## Oct 29 urgent enrollment ambiguity fix (approved)
- [x] Read-only Fern inventory, original function cause and other-attempt evidence; failed prepares leave no durable attempt records
- [x] Byte-exact undo and alias-only fix with isolated new/existing-owner and Retry tests
- [x] Apply one function replacement; definition/grants and all enrollment/output records unchanged; unrelated account timestamp changed concurrently
- [x] Scheduled 17:25 UTC email-job pass completed without errors or sends; report Retry safety without retrying Fern, signing in or publishing

## Oct 29 Step 3 cleanup Part A (approved, no publish or live record writes)
- Continue approved items 1–3 plus screen visibility and full tests; stop on a live-data check/apply failure, fix test typos; no real records or approvals touched.
- [x] Narrow handoff acceptance permission to current Director of Operations cover; exact undo, isolated role tests, apply and unchanged-record/grant checks
- [x] Mirror active-cover acceptance on the screen; retire unused wrappers, retain canonical helper coverage
- [x] Full tests (1727 pass, 5 skip) and automatic typecheck/production build; no publish
- [x] Stage old handoff function retirement with exact base64/SHA-verified undo; no remaining src or database function callers; not applied
- [x] Record evidenced Oct 16 live notification function in pending replay SQL with exact base64/SHA proof, without applying; no evidence for additional builders
- [ ] Live cover-screen acceptance: blocked by no publish, account/seat changes or real-record writes; isolated rules verified
- [x] Read-only security scan/linter report completed in prior attempt; no security fixes

## Oct 29 Operations Send to owner (Phase 1, approved code/test only)
- [x] Shared type/fill/preview/send window and one recipient helper, Ticket/property entry points and fixed approval button
- [x] Reuse canonical Opportunity, reviewed Ticket update and Work Order approval actions; Ticket sent list and existing details
- [x] Pending Operations provenance/Ticket link SQL with live-definition SHA256 undo proof; isolated rule tests
- [x] Focused/full tests and automatic typecheck/build; synthetic unsigned preview only
- [ ] Live send acceptance: blocked by no migrations, publish, sign-in or live writes

## Oct 29 quick fixes and five Help closures (approved)
- [x] Browser-only ZIP unpacking in shared uploader and homeowner hour-file selection, independent validated rows and single-file protection
- [x] Future program date display and creation Owner priority; Module helper already present and retained
- [x] Completion status already arrives through existing Breezeway refresh/webhook; safe reconciliation built with pending atomic SQL and undo
- [x] Help #27/#28/#30/#31/#42 closed through Emily's published admin screen with exact replies, history and sent emails
- [x] Focused/full tests, automatic typecheck/build, synthetic desktop/mobile upload checks; no publish or real work/file writes
- [ ] Live acceptance of code changes: blocked by no publish, no real uploads/Task/Opportunity changes; Breezeway additionally needs pending SQL approval

## Oct 28 Help tickets 58 and 59 (approved code/test only)
- [x] Shared multiple-file queue, individual validation/progress/retry, three-upload cap and ordered attachments
- [x] Active Owner in-place draft reorder, Save/Cancel, accessible movement and saved waiting order
- [x] Isolated behavior tests, full suite, automatic typecheck/build and safe mocked preview checks
- [ ] Live upload and order acceptance: blocked by prohibition on real uploads and Opportunity writes

## Oct 27 editable handoff standard and carry-over (approved build/test only)
- [x] Editable shared standard, proposed seeds, history and human-confirmed link suggestions
- [x] Live home requirements, reasoned exceptions and category readiness
- [x] No-block steps, carry-over confirmation, booking-block acknowledgment, canonical Tickets and completion linkage
- [x] Pending database/seed/undo files, isolated tests, full suite, automatic validation and safe preview checklist
- [ ] Real-role CRUD and production Ticket trigger/closure acceptance: blocked by unapplied pending changes and forbidden live writes

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
- [ ] Append Linder correction line to program internal notes as Emily (published site)

## Nov 4 Parts 6-10 (no publish)
- [x] 6 Survey review routine (trigger for new surveys only)
- [x] 7 Maintenance review queue; Breezeway approval write-back researched, not built
- [x] 8 Calendar with Breezeway source, filters, last sync
- [x] 9 Ticket sections by need with Show all details
- [x] 10 Guest impact confirmation separate from occupancy
- [ ] Signed-in visual checks (no sign-in this session)

## Nov 8 Home and Team Queue (build only)
- [x] Home merges My Work: Needs you now, My work (Active/Waiting/Done recently, search, priority, List/Board, Team queue count), Routine work due today, Recent activity
- [x] Team Queue: matching panel removed; quiet "Imported from Notion" group (Team A, Team B, Unassigned)
- [x] Notion badges, import block, Reopen/Take; quiet imports out of counts, Oversight and rates
- [ ] Apply docs/pending/home-merge/01_notion_reopen.sql (waits on Emily's approval)
- [ ] Menu removal of My Work (separate prompt)

## Nov 8 Record routine work panel (build only)
- [x] Panel with Which check?, own team first, empty states, start by hand
- [x] Guest touch bases, Work order review, Guest reviews live; Survey reviews behind an off switch
- [x] Checkout and Cleaning review retired from the panel and Routine Work lists (data kept)
- [x] Save records who, when, home and answers; found issue opens a linked ticket (after SQL)
- [ ] Apply docs/pending/record-routine/01, 02, 03 (waits on Emily's approval)

## Nov 8 Left menu cleanup (build only)
- [x] New groups: My day, Team, Homes and owners, Insight, Admin
- [x] My Work, Work Orders (switch), Work Map (switch), Program Oversight, Homeowners, old booking pages off the menu; pages kept
- [x] Vendors in My day; Reports renamed Analytics
- [ ] Apply docs/pending/menu-cleanup/01_menu_switches.sql (waits on Emily's approval)

## Notion import runner (Nov 8)
- [x] Admin page: Check the connection, Dry run, Sample of 20, three Run buttons, Stop, Resume, live status, failed files retry
- [x] Rules, runner state, tests; staged guard SQL in docs/pending/notion-runner/ (not applied)
- [ ] Signed-in run of the page not tried: sign-in not approved; no import run (by instruction)

## Scorecard capture and archive instead of delete (Nov 8)
- [x] Permanent record table, role-checked record functions, server time, Notion flag, countable view (staged in docs/pending/scorecard-capture/, not applied)
- [x] Ready for arrival (home page), coaching and finance packet (Supervisor's Home), commitments with COO approval (guest issue tickets)
- [x] Queue sweeps logged automatically on page open (no button, per decisions); weekly numbers not built (Supervisor never types numbers)
- [x] Receipt time lock, server time on history, next action and Waiting log; routine check lock with corrections
- [x] Archive replaces delete; Admin restore and archived list on Admin tools; rating channels setting
- [ ] Apply staged SQL: waits on Emily's approval
- [ ] COO role needs a person assigned in Team & coverage before approvals can be given

## Nov 8 Routing tweaks
- [x] Overnight Direct Booking alerts add the person on call; quiet Notion imports never count towards load; Home shows unstarted requests to everyone eligible now
- [x] Mark as booked asks which home when several were offered; home and move-in date optional
- [ ] Week two: lunch times editing on Team & Coverage, and a lunch for a newly added shift (left for week one by decision)

## Nov 8 Fix batch 2 apply
- [x] Vendors page (corrected Nov 8): Director of Onboarding, Project Managers and Utilities see every tab and record; status, Gold Standard, compliance, screening, documents, logins and imports read only for them
- [x] Fix batch 2 applied (0284 to 0288) and checked in a cancelled database step
- [ ] Next audit (report only, no changes): Ticket checklists and the Admin pages, what each decides for a coordinator
- [x] Direct Bookings fix parts 3 to 5: waiting on Emily's choice of the Director alert schedule

## Nov 8 playbooks: Supervisor edits, everyone else views
- [x] Supervisor (holder or cover) saves, approves, archives and uploads SOPs; viewers see no edit controls; applied as migration 0289 with cancelled live check
- [x] Decide: approval history labels Supervisor actions as general staff; Ticket checklists still editable by every Supervisor account type, including Finance

## Nov 8 Answers, finish Direct Bookings (no publish)
- [x] A. Apply Direct Bookings parts 3 (review line only), 4, 5; verify; cancelled live test
- [x] C. Vendors: Documents upload and program owner field shown read only to onboarding roles; test
- [x] D1. New playbook history lines record Operations Supervisor role
- [x] D2. Ticket checklists edit rule = playbook rule (DB + screen + tests)
- [x] E2. v3 as database default for new Work Orders (staged + applied + test)
- [x] F. Register edits H1, A15, K2
- [x] Overnight Direct Booking requests: alert nobody, wait in Team Queue as Right now for Team A, morning alert, clock from morning (applied as 0295)
- [x] Overnight Direct Booking reply clock starts at the saved setting, default 9:00 AM
- [x] Fix batch 4: automated sources unowned with Take it, four weekday triage windows off, overnight alert and Home wording, overnight clock setting on the settings page, overnight count on Home (applied as 0296, 0297 and one data change)
- [x] Back up everything (Admin tools): full JSON backup to the private backups bucket, record table, Verify; first run 2026-11-08_214435Z
- [x] View as in the Admin menu; Demo button removed from the top bar
- [x] Clean slate practice run (Nov 8): fresh backup verified, 01 + 01c + 02 run and cancelled, nothing kept
- [ ] Clean slate real run (register N8): waits for Emily's go (needs a backup checked within 2 hours of the run)
- [x] Team Queue Supervisor/Director alert emails sent the moment they are written (migration 0306); live on publish
- [x] Both Demo controls removed; Today late windows and alert lines already match T7/T13
- [ ] Breezeway Reported Issues as unowned Team B items: blocked, the synced Breezeway data has no report type, reporter or parent task to tell them apart
- [ ] Week one: nightly schedule for Back up everything
- [ ] Report only so far: 6 homes on old plans to Standard v3; unused old templates
- [x] Team Queue matches the approved board (Pick up work groups, Take it, Accept/Decline, quiet Notion group, Everyone's work filters)
- [ ] Team Queue: decisions open on All unclaimed meaning, Give it back for Notion takes, Departure Reviews block placement (waiting on Emily)
