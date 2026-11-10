# Roadmap — approved build work, NO publish

## Nov 10 bonus guide corrections (docs only; replaces conflicting parts of Builds 12 to 14)
- [x] Save docs/specs/bonus-guide-values.md (A to G, exact numbers)
- [x] Register BN11 line in section 14
- [x] Report conflicts between A to G and existing code
- [x] Build 12: Homes ready for guests is one shared team score (fact keeps who; no individual score)
- [ ] Build 13: dollar amounts per level, per plan and first period override, seeded B to D, engine per A

## Nov 10 build 13: bonus engine, My bonus, verify chain, Finance view (BN5, BN6, BN11; no publish)
- [ ] 1 Bonus settings page (COO, CEO, Admin): plans, period amounts, goals, thresholds, people, priorities, history, notice
- [ ] 2 Engine in the database per bonus-guide-values.md A (share move, fewer than 3, max, system problem)
- [ ] 3 My bonus on My scorecard (own bars and dollars; reviewers and leaders see their chain)
- [ ] 4 Verify chain: period close item, email, 2 day reminder, manual entry, excused with COO approval, Verify, reopen, questions
- [ ] 5 Bonus payouts card in Databases with filters and CSV, verified only
- [ ] 6 Isolated SQL tests, cancelled real practice, word check, browser desktop and phone, BN5 and BN6
- [ ] Build 14 (queued): 5 records per active PC, Director double check of 5, coaching per PC, report through Wednesday

## Nov 10 build 12: arrival check queue and Arrival readiness database (register BN4, BN10; no publish, switch OFF)
- [x] Register section 14 Bonus tracking (BN0 to BN10)
- [x] Spec saved as docs/specs/arrival-check.md
- [x] 1 Which arrivals (owner stays in; extensions, cancellations, blocks, unverified, New House out)
- [x] 2 Created 6 AM Central once per reservation; deadline = check in minus 2 hours in home time zone; Late booking
- [x] 3 Unowned Arrival check ticket, From OwnerRez, Team B unless home rule; never before 6 AM
- [x] 4 Checklist (lock, Breezeway work orders reviewed, ready or issue + backup plan) and arrival facts
- [x] 5 Issue found opens one linked ticket owned by the finder
- [x] 6 Result On time / Late / Missed; add only scorecard fact kind arrival_check
- [x] 7 One Supervisor alert 30 minutes before the deadline, in app and email
- [x] 8 Arrival readiness database card and list with filters, totals, access
- [x] 9 Switch arrival_checks OFF, forward only start line, test records, Integrations status
- [x] 10 Tests, cancelled real database practice, browser check, BN10 final wording

## Nov 10 build 9: answers and fixes from the overnight questions (no publish)
- [ ] A4 Portal quote approved: coordinator alert in app and email "Approved. Post it in the portal."
- [ ] A5 Reply time and answered how columns written only by server actions (APPLY, cancelled practice)
- [ ] A6 Regenerate the unsent draft on the open ALE request (new one home sentence)
- [ ] A8 Fix the flaky ticket history check
- [ ] B1 Move to queue (select several) on Older open, Supervisor and Director only
- [ ] B2 Confirm Admin tab and Integrations imported tickets list both hidden
- [ ] C1 Hand off to a role goes to the person on shift; refuse when nobody is on shift
- [ ] C2 Approve time off all or nothing in one database function (APPLY)
- [ ] C3/E4 Central time on Hand off form, next step due time and My shift
- [ ] C4 Coordinators open Team and Coverage read only (Schedule tab only)
- [ ] C5 Full stop in the history line
- [ ] D1 Handoff box: 44px Accept and Decline, Handoffs, Decline, no long dashes, roles only
- [ ] D2 Read only My scorecard page for anyone with a scorecard record
- [ ] D3 No long dash in Work Order "Supervisor approved" history line
- [ ] E2 Remove older Reopen this ticket button inside Do this now
- [ ] E5 Waiting time out of Command Center Typical time to resolve
- [ ] E8 Closing form button reads Send for review
- [ ] F1 Supervisor who also holds Finance keeps Finance's view of Onboarding
- [ ] F3 Handoff tab: Director of Onboarding marks ready, Director of Operations or Admin accepts, Supervisor read only (APPLY)
- [ ] F4 Handoffs page: each home's real open handoff tasks; "Not tracked in Resolve yet"
- [ ] F5 Onboarding menu link named All properties
- [ ] F8 No dashes in Add users account type labels
- [ ] G1 STAGE ONLY names to roles in task text
- [ ] G2 STAGE ONLY database written text dashes and vendor rule P codes
- [ ] G3 First approved homeowner report sentence: long dash to comma
- [ ] H2 Fewer live rows: warn on check page and morning Admin alert with table names
- [ ] H3 Not copied stores shown on check page with reason
- [ ] I1 APPLY one switch step; switch stays off, timed check inactive
- [ ] Tests, cancelled database steps, browser check, register S4, O4, T5, T6
- WAITS ON EMILY: 4G work order channel when vendor has email; SharePoint space check

## Nov 9 build 6 of 7: the full nightly export (register N10, no publish)
- [x] 1 Every public table, one file each (large ones in parts), manifest with rows and sha256, dated SharePoint folder, no secrets
- [x] 2 Stored file inventory every night; new or changed files copied nightly, full copy weekly; real size reported
- [x] 3 Verify each run (manifest re read, files, live counts), Passed or Failed with reason; keep 30 daily and 12 weekly (setting)
- [x] 4 Failure and missed night (5 AM Central) alert to Admin and Director of Operations, in app and email
- [ ] 5 Read only Export check page: built (Admin tools, Oversight link for Supervisor and Director of Operations). OPEN: Director of Onboarding has no Oversight, reaches it by address only; waits on Emily
- [x] 6 Tests, one real run in a test folder (then deleted), cancelled database step, forced failure alert, Back up everything still works, register N10

## Nov 9 build 3 of 7: the rest of Home (no publish, no database change)
- [x] 1 Needs you now rows open a side panel with what, why and the action
- [x] 2 See all to Oversight for Supervisor, Directors, COO, Admin; not coordinators
- [x] 3 Recent activity collapsed with heading and count
- [x] 4 My scorecard button only with a scorecard record, never a dead button
- [x] 5 Tests, cancelled database check, browser check, register T1 and T2

## Nov 9 build 2 of 7: Home My shift, End my shift and the handoff alert (no publish)
- [x] 1 My shift card: today's hours and lunch, on call tonight, Request time off, End my shift, No shift today
- [x] 2 End my shift walk: each open ticket, default next on shift, done so far, next step, due, or Nothing to hand off; one handoff each, one history line each, one shift record
- [x] 3 Right now handoff unaccepted 15 minutes: receiver and Operations Supervisor once, in app and email; role with nobody on shift goes to the Supervisor
- [x] 4 Lunch prompt on Home: hand off Right now or time sensitive work first, never blocks
- [x] 5 Request time off from Nov 16 (setting), to the Operations Supervisor in Needs you now, approve with cover or decline, status on My shift
- [x] 6 Tests and a cancelled real database step
- [x] 7 Register T4 words

## Nov 9 build 1 of 7: Databases Tickets tabs and the old imported tickets lists (no publish)
- [x] 1 Tabs with counts: All, Recent, Older open, Closed history, Needs a home, Claims history
- [x] 2 Same filters on every tab: search (home, title, ref, Notion number), Period, Problem type, Status, Owner, totals, newest first, Open
- [x] 3 Roles unchanged; onboarding keeps view
- [x] 4 Old Admin imported tickets lists behind a switch (staged flag row), nothing else links to them
- [x] 5 Tests, browser check, register P3 line

## Nov 9 portal requests in Direct Bookings (staged and applied, no publish)
- [x] 1 Partner portal link from HTML href and text, allowlist only, Open in partner portal button
- [x] 2 No reply sender guard: warning, send buttons off, server refuses
- [x] 3 I answered in the partner's portal: note, Copy the reply, clock stops, Quote sent, 48 h follow up, one history line, approval period, method column, Supervisor or Admin correction
- [x] 4 Tests and a cancelled real database step
- [x] 5 Register D8 line

## Nov 9 email intake safety batch (switch stays OFF, sweep stays disabled, no real mail)
- [x] 1 Switch is real on every path (push, sweep, Run intake now, Preview, Refresh notifications)
- [x] 2 Turning on moves the start line (forward only), who and when recorded
- [x] 3 Start line guard on push, sweep, Run intake now, Preview
- [x] 4 Sweep every minute, private scheduler secret, renew under 12 h, 50 per page with paging (staged, job stays off)
- [x] 5 [RESOLVE TEST] from ARHA = test record (demo marking, Test chip, Test alert prefix), Clear test records, own address never creates a request
- [x] 6 Honest status panel; Sep 1 processing claim marked skipped
- [x] 7 Owner response retag retry; no retag without a live record
- [x] 8 Tests with fake messages; cancelled real database step
- [x] 9 Register section

## Nov 9 answers on the fix batch and the map (code only, no database change)
- [x] 1 Other place search failures: own line, never the calendar message
- [x] 2 Databases lit in the left menu on the Vendors page
- [x] 3 Property page header: neutral block when the home has no photo
- [x] 6 Map failure line: "The homes are still listed."
- [x] 7 Routing check on a fixed clock (Mon Nov 9, 10:00 AM Central), no rule or assertion changed

## Nov 9 fix batch from Emily's click through (code only, no database change)
- [x] 1 Properties cards to the board (photo, chips over photo, lines in order, 3 across, neutral block)
- [x] 2 Property page photo header
- [x] 3 Direct Bookings home cards show the photo
- [x] 4 Where field label, placeholder, help line; place not found and busy messages
- [x] 5 One home reply sentence; referral source warning (reply step and approver)
- [x] 6 Vendors out of every left menu; onboarding group renamed Work Orders
- [x] 7 Home banner: a real home photo that changes daily, caption, stock fallback
- [x] 8 Tests and real browser check; 9 register M1 and D5

## Nov 9 delete the 18 fake test sign-ins (Emily, Nov 8; register S6)
- [x] Read only: every row pointing at each of the 18 listed (954 links; live-capture/references-before-2026-11-09.txt)
- [x] Staged docs/pending/delete-test-logins/ (01 database step, 02 sign-in removal, practice block)
- [x] Fresh backup 2026-11-09_023728Z (235 tables, 98,781 rows), Verify passed
- [x] Practice in a cancelled step, then real run (0308), sign-in removal 35 to 17, read-only checks, register S6 line, README/checksums, suite/type/build

## Nov 9 Properties list and property page (boards; register P1, P2, M2, A12) — TONIGHT, next after the sign-in step
- [x] Part 1 Properties list: title/tagline, Add a home (Onboarding + Admin), Admin bulk label panel, filters, cards with chips; remove Work Map tab/button, PORTFOLIO, Refresh, practice toggle, OwnerRez dropdown, Live label
- [x] Part 2 property page: header (one Back, title, line, chips, view toggle, More menu), banners, labels section (staged label table + rules, 30D FIRM import), 12 tabs per role, Home Profile (search, jump to, show empty, 10 sections, every PID label, logged code Show, edit with person/time)
- [x] Other tabs from real records (Nothing here yet when empty); tests; cancelled real DB check; staged SQL 0309-0311 in docs/pending/property-page/; suite/type/build; judgement-placed labels listed
- [x] Emily answered (Nov 9): Onboarding page Add property closed to others; Inspections/House Items/Utilities stay Nothing here yet until their import
- [ ] Emily: check the real Properties list and property page screens by eye (elements unsure listed in the Nov 9 reply)

## Nov 9 Record work as one flow (board; register T8-T11) — after the property page
- [x] Search every reader of the stored Ops/Maintenance label; report
- [x] One form (no chooser), Resolve understood card, Change the problem, insurance warning + Escalate now
- [x] Create ticket via existing creation/routing with automatic label; One touch to home history with repeat counts/flag (settings 3 and 90), property page flag, weekly repeat list
- [x] After-save cards; wording; tests; staged DB in docs/pending/record-work/ (applied as 0312); cancelled real DB check; suite/type/build before and after
- [ ] Emily: register T8 still names the older Create Maintenance Ticket button; Not sure maps to the Ops label; vacant-home fridge is Today by the real rule

## Nov 9 Databases hub (board; register M1, P3, C1, T13, A9, A10) — after Record work
- [x] Board source received; built to it
- [x] Menu item after Vendors, hide Guest Claims & Refunds behind a menu switch; hub with search and four groups; lists; claims in-list editing; Tickets and Claims lists; tests; staged step applied as 0313; cancelled DB check; suite/type/build
- [ ] Emily: the Onboarding Board with five views (Gallery, Active Projects, By Status, Gantt, Work Load) does not exist; the card opens the Onboarding home until it is built

## Nov 9 clean slate real run (Emily's go, Nov 8 6:55 PM Central)
- [x] Fresh backup 2026-11-09_005832Z (235 tables, 99,445 rows), Verify passed; 42 live tickets matched the Nov 8 list
- [x] Ran 01, 01c, 02 for real; counts exactly as practice; all triggers and delete blocks on; 01b never run
- [x] Read-only role page checks (Admin plus four View as roles); full suite 3179 pass / 5 skip / 0 fail on rerun; type check clean
- [x] 02b not run, replaced by blocking (Emily, Nov 9): 02c blocked the last 4; all 18 blocked, none deleted
- [x] 03 closed the two demo follow-ups on the removed QA Kati account and deleted their 2 alerts; staff alerts 443

## Nov 9 Notion import: older open, then closed history (Emily's go, 11:30 AM Central)
- [x] Read-only checks before writing: counts, storage, claim amounts per group from Notion fields
- [ ] Stopped before any write: imported claims on older open and closed tickets would add about $123,000 to Money we could still lose (N2, N4); waits for Emily's choice
- [ ] Waits for Emily: newest closed first needs a one-line read-order change; Supervisor check lists imports as New in the last 24 hours

## Nov 9 Notion import, read only steps (register N6)
- [x] Check the connection, full dry run and a chosen 20-ticket preview, run read only outside the app (the in-app buttons save run status, so not pressed)
- [ ] Emily reviews the preview of 20, then the three runs wait for her go

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
- [x] Clean slate 01c now lists all 16 expenses; practice run 2 (Nov 9) with fresh verified backup, cancelled, nothing kept
- [x] Handoff acceptance fix applied (migration 0307); cancelled tests with carry over, without carry over, and refusals passed
- [ ] Clean slate real run (register N8): waits for Emily's go (needs a backup checked within 2 hours of the run)
- [x] Team Queue Supervisor/Director alert emails sent the moment they are written (migration 0306); live on publish
- [x] Both Demo controls removed; Today late windows and alert lines already match T7/T13
- [ ] Breezeway Reported Issues as unowned Team B items: blocked, the synced Breezeway data has no report type, reporter or parent task to tell them apart
- [ ] Week one: nightly schedule for Back up everything
- [ ] Report only so far: 6 homes on old plans to Standard v3; unused old templates
- [x] Team Queue matches the approved board (Pick up work groups, Take it, Accept/Decline, quiet Notion group, Everyone's work filters)
- [ ] Team Queue: decisions open on All unclaimed meaning, Give it back for Notion takes, Departure Reviews block placement (waiting on Emily)

## Nov 9 Notion dry run, time limited, read only (register N6) — LAST, after Databases
- [x] Connection yes; 2,916 read in 1 min 43 s, nothing written; 20 preview; report docs/pending/notion-ticket-import-dry-run-nov9.md
- [x] Emily answered (Nov 9): Director's tickets stay Unassigned; 5 no-home queue tickets stay Unassigned with Needs a home; Qym matches
- [x] Two-home rule (address in title, else first linked) in the runner; row 18 rechecked read only; other 5 not identifiable without a full read

## Nov 9 Notion import first real run: recent open (Emily's yes, ~5:50 AM Central; register N1-N7)
- [x] Fresh full backup 2026-11-09_121747Z (240 tables, 99,187 rows), Verify passed
- [x] Read-only before counts (all 0; documents 314)
- [x] Run recent_open STOPPED at first anomaly: 43 of 87 imported; ticket #1478 failed on its page notes (no date), its 3 comments and 4 files not copied
- [x] Verify of the 43 (read only): Team B 42, Unassigned 1, 26 assigned, 23 claims, 176/83 match Notion except #1478, rerun plan 43 unchanged / 44 create, no clocks/alerts/notifications
- [x] Page-notes date fix (Emily's yes, Nov 9 ~9:10 AM); backup 2026-11-09_165531Z verified; Crashed reset to Stopped; resumed: 90 recent open in Resolve (4 created in Notion today); #1478 comments and files copied
- [x] Preview blank: not reproducible on Nov 9 (preview and production build both load, signed out and Admin, desktop and phone); no code change
- [x] Quiet rule on the ticket drawer and page: "Imported from Notion. No clock.", no minutes, clock, escalation or Acknowledge until taken
- [ ] Older open (604) and closed history (2,225) runs: wait for Emily's go

## Nov 9 answers and small fixes (property page, Record work, Databases, Notion)
- [x] Add a home: server check on both create actions; Onboarding page Add property only for Onboarding roles and Admin
- [x] Pending codes line in Entry & Access Details (waiting count, Mark current, Archive), code managers only, values stay behind logged Show
- [x] Register T8 copy reads Create ticket
- [x] Tests; suite before/after, type check, build
## Nov 9 Direct Bookings real map (code only, no publish)
- [x] OpenStreetMap map in one provider file: search point, 5/10/20 rings with labels, numbered pins with labels, straight line note
- [x] Overlapping pins spread apart; map and cards connected; picked pins differ; attribution; failure message; phone scroll safe
- [x] Tests, browser check desktop and phone, register D7 line
## Nov 10 Build 4 of 7: Ticket page items (code only, no publish, no database change)
- [x] Do this now next step line with due time and late wording; Change next step recorded with who and when; Continue; old words replaced (T5, T13)
- [x] One touch What did you do? (required), shown in the repeat line detail (T11)
- [x] Close ticket and Reopen ticket always both in the header, one disabled with a reason; onboarding sees neither (T12)
- [x] Waiting card paused sentence; Analytics resolve times take Waiting out (T13)
- [x] Board comparison report; tests; browser desktop and phone; register T5, T11, T12, T13
## Nov 10 Build 5 of 7: Access fixes and the Supervisor handoff only view (no publish)
- [x] Supervisor: no Onboarding workspace; read only Handoffs page under Homes and owners (A1, A16)
- [x] Finance on a Supervisor type account: view only pages, hidden pages, Finance and Direct Bookings unchanged (A4 to A13, A18)
- [x] Onboarding roles: Properties list, every Vendors tab read only, Director of Onboarding adds Onboarding staff, no routine work or Team Queue link (A5, A9, A12, A14)
- [x] Admin group: Supervisor and Director see only Help Tickets; Admin pages Admin only by address and data (A20, M6)
- [x] My reports for every staff member from the help button and account page; Admin manages; thank you line fixed (A20)
- [x] View as: every role with its role on top, read only, refuses pages the role cannot open (M5)
- [x] Staged database step applied after cancelled practice; access table and tests; browser check; register A1, A16, M6
## Nov 10 Build 8 of 8: Email intake follow ups (no publish, intake stays off)
- [x] (a) Test records with their Test chip for Admin, Operations Supervisor and the Directors in separate uncounted lists; hidden from coordinators (E1)
- [x] (c) Run intake now hidden
- [x] (e) One switch: staged database step (not applied, waits for Emily's okay); switch row and status panel show both
- [x] Tests, cancelled database practice, browser check desktop and phone, register E1
## Nov 10 Build 9: answers and fixes from the overnight questions (no publish)
- [x] A portal: approved alert in app and by email; reply time written only by server steps (applied 0320); ALE draft regenerated; flaky history check fixed
- [x] B Older open Move to queue, Supervisor and Director of Operations (database step staged, button hidden until applied); Admin tab and Integrations list hidden
- [x] C Hand off form resolves a role to the person on shift; time off approval all or nothing (applied 0321); Central time; coordinator schedule only; full stop (staged)
- [x] D Handoff box words and 44px; My scorecard page; Supervisor approved history line
- [x] E Old Reopen inside Do this now removed; Command Center resolve time without Waiting; Send for review
- [x] F Supervisor with Finance keeps Finance's Onboarding view; ready/accept authority (applied 0322); Handoffs page from each home's Tasks; All properties; Add users labels
- [x] G Task role words and database text staged only; report sentence 4 commas
- [x] H Export check link rule, fewer rows warning, Not copied list; next morning Admin alert staged
- [x] I One switch applied (0319), switch off, timed check inactive
- [ ] Waiting on Emily: apply 04 Move to queue, 05 full stop, 06 fewer rows alert; G1/G2 when approved; 4G vendor channel; SharePoint space check
## Nov 10 Build 10: the Breezeway bridge (no publish, bridge stays off)
- [x] 1 Inspect real task fields (read only GET, about 30 tasks)
- [x] 2 Real bridge switch with forward only start line, status on Integrations
- [x] 3 Store tags, real finished time, creator and reported issue marker on the mirror
- [x] 4 Reported issue creates one ordinary ticket, Team B, From Breezeway
- [x] 5 Finished maintenance creates one Maintenance Review, due 24 hours, link, skips
- [x] 6 internal_work_orders switch off; Link the Breezeway work order on the Repair card
- [x] 7 Cleanup: pilot fallback, 10 minute safety sweep, Retry all, failures on Integrations, second escalation, webhook note
- [x] 8 Tests, cancelled database practice, browser check, register T15, C4 to C6
