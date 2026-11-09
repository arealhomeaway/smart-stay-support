# Register status sweep, Nov 9 2026 (report only)

Every line of `docs/decision-register.md` checked against the code and the live database as they are now. Nothing was changed and nothing was published.

**How to read this**
- DONE: built, with the file, migration or test that shows it.
- PARTLY: some of it exists; the missing part is named.
- NOT BUILT: nothing matching was found.
- NOT CHECKABLE: the answer is outside the code and database (people, other systems, boards).
- Size: small = under 30 minutes, medium = under 90 minutes, large = more.
- "Live" means read from the database today. Where a README in `docs/pending` says "not applied" but the function is live, the live database wins (refund authority, handoff standard and after-handoff are live).

**Totals (113 lines):** DONE 27, PARTLY 74, NOT BUILT 8, NOT CHECKABLE 4. The shift Hours paragraph is PARTLY (one small gap).

**Live facts read today:** 43 tickets (all Notion imports), 23 claims, 17 sign-ins and 0 blocked, 29 shift rows, 37 on-call rows, 1 home label on 26 homes, 0 scorecard records, 0 Direct Booking approvals, 50 handoff requirements, 2 handoff-reminder runs in the last 3 days, 2 nightly backups in the last 2 days. Feature switches on: operations_queue_v2, onboarding_portal_v2, breezeway_outbound. Off: email_intake, breezeway_bridge, owner_alerts, claims_menu, work_orders_page, work_map, vendor_portal, quarterly_reviews, survey_review_check, all checklist switches. Mailbox sync job inactive. Notion runner state in the database still reads "stopping" (the screen shows Crashed).

---

## 1. House rules

| Line | Status | Proof | What exists / what is missing | Who notices today | Size |
|---|---|---|---|---|---|
| H1 | PARTLY | `src/lib/onboarding-template.ts:819,914,924,945,1377`; allowed by `src/lib/__tests__/screen-words.test.ts:40-48` | Screens use roles. 12 person names remain in onboarding Task instructions (purchasing and handoff contacts); the wording test explicitly allows them. | Onboarding user reads named people in Task steps. | medium |
| H2 | PARTLY | `src/lib/onboarding-template.ts:804,862,1503`; `src/lib/recovery-policy.ts:10` | Wording test exists. "sample" (6) and "threshold" (1) still in text. Plainness and tone need an editorial pass. | Onboarding user, Supervisor. | small |
| H3 | PARTLY | e.g. `src/components/HelpFeedback.tsx:112`, `src/components/AppShell.tsx:453`, `src/routes/_authenticated/tickets.$ticketId.tsx` (37) | Banned words (seat, Median, Hit, PC1, J1, proposal, Josh status): 0 on screens. Long dashes: 1,128 in screen text (many are "—" empty-value placeholders), 34 short dashes, 19 emoji or symbols. | Everyone sees long dashes, including the Help thank-you line. | large |
| H4 | PARTLY | `src/lib/tickets.ts:47-74`; `src/lib/__tests__/urgency-names.test.ts:33-38` | Right now / Today / Routine exist, but labels carry "(P1)" and short badges show P1/P2/P3 in 40 places. The test expects the codes. | Coordinator, Supervisor: P1/P2/P3 badges, filters, escalation text. | medium |
| H5 | NOT BUILT | none found | Staff tier names do not exist. Allowed for now: B1 says no tiers on screen before Dec 1. | Nobody until Dec 1. | large |
| H6 | PARTLY | `src/components/AppShell.tsx:393-448` (min-h-11); `src/components/GlobalSearch.tsx:90-94` (h-8) | Main phone buttons are 44px. Search Resolve is 32px; Home links 20px (links audit). | Phone users. | small |
| H7 | NOT CHECKABLE | | Needs the boards side by side; done per build. | | |
| H8 | DONE | `src/routes/_authenticated/integrations_.notion-import.tsx:345,360` | No screen asks anyone to edit Notion. | | |
| H9 | DONE | `drizzle/migrations/0272_ticket_archive.sql`; `src/lib/shell-nav.ts:320-341` | Archive with reason, Admin restore, delete blocked, pages behind switches. | | |
| H10 | PARTLY | `src/lib/credentials.server.ts:217-240`; `src/lib/__tests__/fix-batch-2.test.ts:171-173` | Logged Show, fails closed. "Never in reports" not proven across every export. | Nobody today; risk only. | small |
| H11 | DONE | `src/components/scorecard/QueueOpenLogger.tsx`; mounted in team-queue, oversight, supervisor-check | Sweeps record on opening; no button. (Window split is in B4.) | | |
| H12 | NOT CHECKABLE | | Process rule. | | |

## 2. Who sees what

Note: Finance today is a Supervisor account with a Finance role on top (S8 allows this for now), so Finance inherits Supervisor access in many places below.
Note: the links audit saw onboarding staff open Team Queue, Claims and Refunds by typing the address while using View as. The current code redirects them (`src/routes/_authenticated/route.tsx:46-51`). View as also drops every role on top (`src/hooks/useRole.ts:93-103`), so View as results for Directors and Finance are not the real account. A real-account check is needed before calling A6 and A10 fixed.

| Line | Status | Proof | What exists / what is missing | Who notices today | Size |
|---|---|---|---|---|---|
| A1 | PARTLY | `src/lib/portals.ts:58,88`; `src/lib/route-access.ts:83-88` | Operations pages refuse plain Onboarding. Every Supervisor account also gets the whole Onboarding workspace, not only shared work. | Supervisor sees Onboarding. | large |
| A2 | PARTLY | app_role enum: admin, manager, tech, vendor, owner, onboarding; `drizzle/migrations/0033_functional_role_pools.sql` | Six account types plus roles on top exist. Finance, Director and Utilities account types not built (week one). | Finance lead carries Supervisor access. | large |
| A3 | NOT BUILT | `src/lib/permissions.ts` has no CEO/COO scope | CEO and COO roles exist as names only; no "sees all, edits only metrics" rule. | Leadership must use Admin. | large |
| A4 | PARTLY | `src/lib/__tests__/access-matrix.test.ts:110-112` | Home works for staff. Finance is not view only; Active Owner not hidden from Finance. | Finance lead. | medium |
| A5 | PARTLY | `src/lib/shell-nav.ts:525-538`; `src/routes/_authenticated/dashboard.tsx:509-544` | Top bar correct. Home still offers Record routine work and a Team queue link to onboarding accounts. | Onboarding user sees operations buttons on Home. | small |
| A6 | PARTLY | `src/lib/route-access.ts:83-115`; `src/lib/__tests__/route-access.test.ts:10-14` | Plain Onboarding refused in code. Finance (Supervisor account) gets Team Queue. Real-account check pending. | Finance lead. | small |
| A7 | PARTLY | `src/lib/route-access.ts:66-67,110-113` | Coordinator refused by address. Finance gets Oversight (the access test expects it). | Finance lead sees Oversight. | small |
| A8 | PARTLY | `src/routes/_authenticated/work-orders.tsx:25-44` | Director of Onboarding and PM view; Finance edits instead of view; read-only parts not fully enforced. Page is behind an off switch. | Finance lead. | medium |
| A9 | PARTLY | `drizzle/migrations/0287_vendor_editors.sql`; `src/lib/shell-nav.ts:88-94,410-415` | Director of Onboarding, PM, Utilities edit; onboarding menu shows Vendors. Database tab still needs vendor admin, so onboarding roles do not see every tab read only. Finance edits instead of view. | Onboarding user misses the Database tab. | medium |
| A10 | PARTLY | `src/lib/route-access.ts:33-88`; `src/lib/__tests__/appshell-nav-claims-recovery-in-my-day.test.ts:36-43` | Ticket cards work. Finance edits instead of view. Old Claims page still opens by link (test expects it). | Finance lead. | medium |
| A11 | PARTLY | `drizzle/migrations/0262_direct_bookings.sql:88-105,248-274`; `0291`; live setting approvalWaitMinutes 2 | Page, approval by Supervisor, Director after 2 minutes on the server: live. Settings save also open to Supervisor and Director, not Admin only. | Nobody blocked. | small |
| A12 | PARTLY | `src/lib/property-intake.server.ts:28-46`; `src/routes/_authenticated/property.$propertyId.tsx:102-151` | Coordinator, Supervisor, Director, Admin edit. Onboarding-only Director, PM and Design cannot open the staff Properties list; Utilities tab is empty (by your Nov 9 answer); Finance can edit. | Onboarding user, Finance lead. | large |
| A13 | PARTLY | `src/routes/_authenticated/team.tsx:21-26`; `src/components/team/ScheduleTab.tsx` | View and edit split exists. Finance is not hidden. | Finance lead. | small |
| A14 | PARTLY | `src/lib/access.server.ts:19-49`; `src/lib/team-invites.server.ts:19-49` | Admin manages all; Operations leaders invite operations staff; coordinators have no Users tab. Director of Onboarding cannot add onboarding users. | Director of Onboarding must ask an Admin. | medium |
| A15 | DONE | `src/lib/playbook-editing.ts:5-17`; `drizzle/migrations/0289_playbooks_supervisor.sql`, `0293_ticket_checklist_editors.sql`; `src/lib/__tests__/access-matrix.test.ts:62-65` | Supervisor, Directors, Admin edit, publish, archive and upload (the Supervisor is the person holding or covering the Supervisor role); everyone else views. | | |
| A16 | PARTLY | `src/lib/permissions.ts:175-176,208-209`; `src/lib/__tests__/access-matrix.test.ts:74-76` | Director of Onboarding and Admin edit. Supervisor sees and opens Onboarding and templates (A16 says hidden; M6 says Supervisors add Onboarding view: the register disagrees with itself). Own-only for PM, Utilities, Design not fully proven. | Supervisor sees Onboarding. | medium |
| A17 | PARTLY | `src/lib/route-access.ts:40-49`; `src/components/SupervisorOnly.tsx` | Directors and Admin edit. Supervisor gets edit, not view. Coordinator and PM get no "own" access: coordinator sees "Supervisor access only". | Coordinator cannot reach post-handoff owner work. | large |
| A18 | PARTLY | `src/routes/_authenticated/finance.tsx:29-82`; `src/lib/permissions.ts:277-293` | Finance lead and Admin edit; Director of Onboarding view. Director of Operations sees edit buttons, not view only. | Director of Operations. | small |
| A19 | PARTLY | `drizzle/migrations/0269_scorecard_records.sql:241-255` | Supervisor coaching records exist. No review chain (Director reviews Supervisor, COO reviews Director) and no "my own, read only" view. | Waits for scorecards (Dec 1 for coordinators). | large |
| A20 | PARTLY | `src/routes/_authenticated/help-tickets.tsx:40,89-90`; `drizzle/migrations/0039_help_tickets.sql:26-32`; `src/lib/route-access.ts:54-57` | Database lets everyone read their own reports, but the page is leadership only, so nobody else sees theirs; Supervisor gets the tab but sees only own rows; Director of Operations can change status. Admin pages: code limits Integrations and Notion import to Admin; other Admin items open for Supervisor and Director (links audit). Owner portal own home and Director view: exist. | Every staff member who reports a problem cannot see its status. | medium |
| A21 | PARTLY | `src/lib/__tests__/access-matrix.test.ts` | A role by page test exists for 11 profiles. Missing Help, Admin pages, templates, scorecards, property edit scope; it records Supervisor-on-Onboarding and Finance-on-Schedule as expected. | Nobody directly. | medium |

## 3. Left menu and top bar

| Line | Status | Proof | What exists / what is missing | Who notices today | Size |
|---|---|---|---|---|---|
| M1 | PARTLY | `src/lib/shell-nav.ts:310-372` | Five groups in order. Insight has Analytics only (no Reports). Admin is one item, not Logic and Automations plus Admin tools. Oversight is also a menu item, not only a Home tab. | Supervisor, Director. | medium |
| M2 | PARTLY | `src/lib/shell-nav.ts:277-341`; live switches off | My Work, Work Orders, Work Map, Claims and Refunds, Quarterly Reviews hidden. Direct Bookings can still send some users to the old Leads page. | Rare. | small |
| M3 | PARTLY | `src/lib/shell-nav.ts:116-212,288-299`; `src/lib/route-access.ts:119-133` | Sub pages are top tabs. Finance sits under Analytics, not Admin tools (allowed "later"). Imported tickets is an Admin tab (register says not an Admin page). Admin lands on Executive View, no CEO-to-Analytics landing. | Admin. | small |
| M4 | PARTLY | `src/lib/shell-nav.ts:511-538`; `src/components/AppShell.tsx:398-425` | Both buttons side by side, overlay, hidden for onboarding, vendor and owner. They also disappear on Vendors and Active Owner pages for operations staff. | Coordinator on Vendors cannot record work from the top bar. | small |
| M5 | DONE | `src/lib/view-as.ts:20-23`; `src/components/ViewAsSwitcher.tsx` | Admin-only View as, no Demo button. (It offers 4 roles only and drops roles on top; see A section.) | | |
| M6 | PARTLY | `src/lib/permissions.ts:161-209` | Menus follow access. Supervisor and Director see Admin items; no Logic and Automations view for Directors; no COO or CEO menu. | Supervisor sees Admin. | medium |

## 4. Home, Team Queue, Record work, tickets and routing

| Line | Status | Proof | What exists / what is missing | Who notices today | Size |
|---|---|---|---|---|---|
| T1 | PARTLY | `src/routes/_authenticated/dashboard.tsx:180-215,617-620` | Greeting, date, Needs you now, My work, Routine work due today. Banner is one fixed picture, no daily home photo or caption; no My scorecard button; no My shift; Recent activity not collapsed. | Every coordinator on Home. | large (with T4) |
| T2 | PARTLY | `src/routes/_authenticated/dashboard.tsx:230-327`; `src/lib/home-work.ts:159-179` | Only the person's items, each with what and why. Rows open the page, not a side panel; no See all link to Oversight. | Supervisor. | medium |
| T3 | DONE | `src/routes/_authenticated/dashboard.tsx:339-415`; `src/lib/__tests__/home-work.test.ts` | Active, Waiting, Done recently, search, filter, List or Board, Team queue link with unclaimed count. | | |
| T4 | NOT BUILT | no "My shift", "End my shift" or "Request time off" anywhere in `src` | No hours today, no on call tonight, no Request time off, no End my shift. | Coordinator cannot end a shift or hand off from Home today. | large |
| T5 | PARTLY | `src/lib/ticket-next-action.ts:70-98` | "Next step:" exists. Screens say "Acknowledge this ticket", "Start the work", "Continue work"; "Start work: 3 days late" not found. | Coordinator. | small |
| T6 | PARTLY | `src/components/HandoffPanel.tsx:125-281`; `drizzle/migrations/0304_handoff_01_reminders.sql` | Team handoff on a ticket, Accept and Decline with reason, ownership moves on accept; onboarding handoff exists. Missing: shift handoff walk-through (needs End my shift), the 15-minute Right now unaccepted alert, and sending a role handoff to the person on shift. | Coordinator at end of shift; Supervisor gets no 15-minute alert. | large |
| T7 | PARTLY | `src/routes/_authenticated/team-queue.tsx:297,809-817`; `src/lib/__tests__/team-queue-board.test.ts`; ticket page `src/routes/_authenticated/tickets.$ticketId.tsx:1033,1249`; `src/lib/ticket-current-action.ts:127` | Queue: collapsed Imported from Notion group, No clock. The ticket page and drawer of an imported ticket show "P1 escalated", minutes since, "response clock is running" and "Acknowledge & advance". | Coordinator and Supervisor see false alarms on all 43 imported tickets. | medium |
| T8 | DONE | `src/routes/_authenticated/tickets.new.tsx:145-818`; `src/lib/__tests__/record-work-one-flow.test.ts` | One form, Create ticket, Which home, describe box with photo and speak, example, Resolve understood. | | |
| T9 | DONE | `src/lib/record-work.ts:102-115`; `src/components/TicketPriorityPanel.tsx:45-122`; `drizzle/migrations/0312_record_work_one_flow.sql:159-211` | Guest in home counts as affected; Supervisor correction with reason; red insurance box with exact text; Escalated state. Button reads "Escalate now". | | |
| T10 | PARTLY | `src/lib/record-work.ts:94-138`; work_types catalog | Problem type from text; repair from the type. Not found: an admin table of exactly 20 types for Emily to edit, Claim Yes/No from platform names, home details by problem type. | Coordinator: claim not flagged from "Airbnb" etc. | large |
| T11 | PARTLY | `drizzle/migrations/0312_record_work_one_flow.sql:18-110`; `src/routes/_authenticated/tickets.new.tsx:550-659` | Saved to the home's history, no ticket or clocks, type automatic, repeat flag. No "what you did" field; it saves "Nothing more to do". | Coordinator, home history. | small |
| T12 | PARTLY | `drizzle/migrations/0275_reopen_ticket.sql`; `src/lib/ticket-reopen.ts`; live `reopen_ticket` | Reopen with 3-500 character reason, fresh clocks, assigned to reopener, one history line, onboarding refused. Close and Reopen are not always both visible. | Coordinator. | small |
| T13 | PARTLY | `src/routes/_authenticated/tickets.$ticketId.tsx:649-675,1986-2050`; `0272_ticket_archive.sql` | Waiting needs reason and future review; Archive with reason. "Never counts against a scorecard" and Next step due time not proven end to end. | Nobody today. | medium |
| T14 | DONE | `src/lib/routine-controls.ts`; `drizzle/migrations/0261_retire_checkout_routine.sql`; switch survey_review_check off | Four controls, Survey Review hidden, Checkout and Cleaning retired, 14 days. | | |
| T15 | PARTLY | `drizzle/migrations/0278_coordinator_routing.sql`, `0279_quiet_imports_load.sql`; tests routing-by-time-sql, routing-tweaks-sql; live `ticket_route_at`, `auto_assign_ticket`, `coordinators_on_shift` | Team, load 5/3/1, quiet imports excluded, lunch, other team, on call, Supervisor: live. Email intake and Breezeway bridge are switched off, so info inbox and Breezeway tickets are not created; Breezeway code still assigns an owner instead of waiting in the queue; From email / From OwnerRez / From Breezeway groups not proven. | Coordinator: inbox and Breezeway work does not arrive in Resolve. | large |

## 5. Claims, refunds, repairs, vendors and money

| Line | Status | Proof | What exists / what is missing | Who notices today | Size |
|---|---|---|---|---|---|
| C1 | PARTLY | `src/routes/_authenticated/tickets.$ticketId.tsx:1625-1628`; `src/lib/databases-data.ts:377-391`; switch claims_menu off | Claim and Refund cards on the ticket; Databases Claims to work filter; menu items hidden. The old pages still open by link. | Nobody blocked. | small |
| C2 | DONE (live) | live `recovery_required_authority` ($500 / $1,500 / Director), `claim_required_authority`; `src/lib/claim-approval.ts:14-19`; `0302_alerts_04_claim_approval.sql` | Thresholds enforced in the database. The refund-authority README still says "not applied"; the live function says otherwise. | | |
| C3 | PARTLY | `src/lib/claims.ts:68-73`; `src/lib/notion-import/mapping.ts:167-175` | Claim review wording; imported claims go to Team B. Claim tickets on closed or historical imports are not proven always workable; owner or deadline-only visibility not proven. | Coordinator on old claims (after the closed-history run). | medium |
| C4 | DONE | `drizzle/migrations/0290_repair_policy_v3_expense_authorization.sql`, `0294_work_order_default_v3.sql`; `src/lib/__tests__/repair-policy-v3.test.ts`; live policy v3 | Ladder v3 with exactly $350 needing the owner. | | |
| C5 | PARTLY | `src/components/workorders/WorkOrderDrawer.tsx:1193-1222`; `src/components/finance/ExpenseSheet.tsx` | Invoice number on the work order; Finance expense review. Missing: Supervisor approval with the five Bill To choices, Finance "record payment", invoice must link to a ticket. | Supervisor, Finance lead (previous process continues per C10). | large |
| C6 | PARTLY | `src/lib/record-routine.ts:68-76`; `0265_record_routine.sql` | Maintenance Review routine and Breezeway link exist; the review is not created automatically for each finished work order; Supervisor check not recorded automatically. | Coordinator must start each review. | large |
| C7 | NOT CHECKABLE | `0308_delete_test_logins_detach.sql` | Test logins removed; "every picklist" needs a click-through of each list. | | |
| C8 | NOT BUILT | none found | No 3-month extension block on mid-term bookings. | Coordinator places blocks by hand in OwnerRez. | large |
| C9 | PARTLY | `src/lib/shell-nav.ts:323-325` | Old expense screens hidden. No Ramp intake, expense ticket, one-tap match, Incomplete in Ramp list or cutoffs. | Finance lead (previous process). | large |
| C10 | PARTLY | `0102_finance_foundation_expenses.sql`, `0121_statement_readiness.sql` | Finance ready check, flags, invoice fields, statement readiness. Reason is not required on every money record; no read-only Finance role yet. | Finance lead. | large |

## 6. Direct Bookings

Live settings: Nov 9 to Nov 23 approval period, 2 minutes, copies Supervisor and Director, $189 / $199, 5% for the three sources, 3-minute reply, overnight clock 09:00. Escalation job runs every 20 seconds.

| Line | Status | Proof | What exists / what is missing | Who notices today | Size |
|---|---|---|---|---|---|
| D1 | DONE | `src/lib/direct-bookings.ts:428-490`; `src/routes/_authenticated/direct-bookings.index.tsx` | Views with counts, three tiles, red strip with Review now, Referral sources, New request. | | |
| D2 | DONE | `0262_direct_bookings.sql:194-208`; `0295_direct_booking_overnight_queue.sql`; `src/lib/__tests__/direct-bookings-overnight.test.ts` | Team A on shift alerted, Start the quote owns it, overnight Right now in Team Queue, morning release. | | |
| D3 | PARTLY | `src/lib/direct-bookings.ts:10-17,317-355`; live overnightClockStart 09:00 | Clock and 9:00 AM start work. Email intake is switched off, so an emailed request is not created in about a minute; only New request creates one. | Coordinator must type in every emailed request; the 3-minute clock starts late. | medium (switch on after a check) |
| D4 | DONE | `0262` / `0263` / `0291`; live settings | Supervisor approves every quote Nov 9 to 23; Director after 2 minutes on the server; after the period, copy setting off. | | |
| D5 | DONE | `src/lib/direct-bookings.ts:521-636`; `src/lib/direct-bookings-mail.server.ts`; `0283_guarded_actions.sql` | Template, same thread, RE: subject, copies enforced on the server, never COO, fees in order, no $0 lines. | | |
| D6 | DONE | `src/lib/direct-bookings.ts:27-124`; `src/lib/direct-bookings.test.ts` | Rent math, 5% sources, Rate not set for 2 and 5 bedrooms blocks sending. | | |
| D7 | DONE | `src/lib/direct-bookings.ts:15-216`; `0283_guarded_actions.sql` | Filters, 30D FIRM order, Active Owner homes refused again at send, up to 3, 5/10/20 miles. | | |
| D8 | DONE | `src/lib/direct-bookings.ts:293-377`; `0282_request_fields.sql` | Stages, Mark as booked with optional home and date, 48-hour follow-ups. | | |
| D9 | DONE | `0262` / `0283`; `src/lib/__tests__/direct-bookings-fix-sql.test.ts` | Reason list plus note enforced in the database. | | |

## 7. Notion import, clean slate and cutover

| Line | Status | Proof | What exists / what is missing | Who notices today | Size |
|---|---|---|---|---|---|
| N1 | PARTLY | live: 43 tickets; `src/lib/notion-import/mapping.ts:456-459` | 43 of 2,916 in. Shown set: 44 left; older open 604 and closed 2,225 not started. #1478 missing 3 comments and 4 files: comments are sent with no date (no fallback). Register number 2,892 is older than the dry run's 2,916. | Coordinators working only in Resolve today cannot find 44 recent open tickets or any older or closed one. | small fix, then the runs |
| N2 | DONE (code) | `src/lib/notion-import/mapping.ts:42-48,185-199`; `notion-ticket-display.test.ts` | Three groups by Notion created date, blank counts as older. Only the shown set has run. | | |
| N3 | DONE | `src/lib/notion-import/mapping.ts:202-217`; `notion-import-mapping.test.ts` | Name match, Director of Operations and General stay Unassigned, claims to Team B, Needs a home. | | |
| N4 | PARTLY | `0279_quiet_imports_load.sql`; `notion-open-counts-my-work.test.ts` | Queue, counts and routing load are quiet. The ticket page shows clocks and escalation (see T7). | Coordinator, Supervisor. | medium (same fix as T7) |
| N5 | PARTLY | `mapping.ts:11-12,153-177,433`; `0274_notion_import_ticket_type.sql` | Priority map, Other, claims, Owens Rd unlinked, read-only comments with author, active task. Comments and files fail when a comment has no date. | Coordinator on #1478. | small |
| N6 | PARTLY | `src/lib/notion-import/runner.ts`; `src/routes/_authenticated/integrations_.notion-import.tsx` | Check, Dry run, Preview 20, three runs, Stop, Resume all exist. Runner state stuck at "stopping"; Resume after the date fix not yet proven. | Admin. | small |
| N7 | DONE | `src/lib/property-history.ts`; `src/components/work-entry/PropertyHistoryList.tsx:29-41`; `phase2-ticket-rules.test.ts:26-30` | Same category by default, toggle for full history. | | |
| N8 | PARTLY | `docs/pending/clean-slate/README.md`; live 17 sign-ins, 9 onboarding templates | Backup, tickets removed, fake users removed, Demo button removed, View as added. The 6 homes on old plans have not moved to Standard v3; old templates not removed. | Onboarding user still sees old plans on 6 homes. | large |
| N9 | NOT CHECKABLE | | Team use, Emily's click-through, Notion export and view-only are outside Resolve. | | |
| N10 | PARTLY | `src/lib/nightly-backup.ts:6-21`; `0251_schedule_nightly_backup.sql`; live 2 runs in 2 days | A nightly SharePoint export runs, but covers 8 tables, not every database. No Supervisor double-check view. (The register says "not built"; part exists.) | Supervisor has nothing to check. | large |

## 8. Team and coverage, Users, on call, schedule

| Line | Status | Proof | What exists / what is missing | Who notices today | Size |
|---|---|---|---|---|---|
| Hours | PARTLY | live coverage_shifts (29 rows) | All six roles match days and hours, and coordinator lunches match. The Supervisor's lunch (2 to 3) is not stored. | Nobody routes to the Supervisor at lunch differently. | small |
| S1 | PARTLY | `0278_coordinator_routing.sql:91-176`; `coverage-model.test.ts` | Weekend cover of both teams and lunch skip in routing. Nothing asks the person to hand off Right now work before lunch. | Supervisor. | medium |
| S2 | PARTLY | `src/lib/team-schedule.ts:418-421` | Role and holder model, role names stay. No Director approval step for schedules, no COO approval for staffing changes. | Director of Operations. | large |
| S3 | PARTLY | `src/components/team/ScheduleTab.tsx:92-100,267-674` | Click to add or remove shifts, recurring day off, leaders hidden by default. Which rows show depends on a setting (accounting, utilities, PMs not proven). | Coordinator may see extra or missing rows. | small |
| S4 | PARTLY | `src/routes/_authenticated/team.tsx:21-50`; `src/components/team/TimeOffDialog.tsx` | Coordinators read only, no Users tab; Supervisor enters time off and cover. No Request time off or My shift for coordinators (starts Nov 16). | Coordinator, from Nov 16. | large (with T4) |
| S5 | PARTLY | `src/components/team/UsersTab.tsx`; `TeamInvitePanel.tsx` | Users tab, staff only, Add a user, profile, Can be on call, test account, shifts, time off, per-person access, "Team and shift", "Not on the schedule yet". Look against the Microsoft page not compared. | | small |
| S6 | DONE | `drizzle/migrations/0248_remove_users.sql`; `docs/pending/delete-test-logins` (applied Nov 9); live 0 blocked sign-ins | Admin-only delete, "(former)" kept on history, homeowners archived, fake sign-ins deleted. | | |
| S7 | PARTLY | `src/components/team/ScheduleTab.tsx:213-607`; `0244_oncall_weekday_pattern.sql`; live pattern saved | Weekday pattern, one night, range, swap, holiday, warning when no pattern. The list of people is not limited to ops leadership; no warning for unsaved edits. | Supervisor. | small |
| S8 | PARTLY | `src/lib/team-invites.server.ts:167-185`; `TeamInvitePanel.tsx:82-87` | Single use, 30 days, own password. Server allows up to 90 days. Finance lead is a Supervisor account (allowed for now); Finance role is week one. | | small |

## 9. Scorecards, Analytics, Reports, Logic and Automations

| Line | Status | Proof | What exists / what is missing | Who notices today | Size |
|---|---|---|---|---|---|
| B1 | PARTLY | `0269_scorecard_records.sql:79-158`; live 0 records | Facts only, imports and demo excluded, no tiers or money. No Nov 9 / Dec 1 start-date rule or "system affected" exclusion in the count. | Nobody until scores show. | medium |
| B2 | PARTLY | live guest_rating_channels Airbnb + Vrbo; `RatingChannelsCard.tsx` | Channel setting exists. No targets by period, no one-score-per-stay rule. | Director of Operations. | large |
| B3 | PARTLY | `src/components/vendors/VendorMarketCoverage.tsx`; live 77 vendors | Market Coverage grid with primary and backup. It also counts Pilot and Corrective Action vendors, not only Approved and Gold. | Director: coverage looks fuller than it is. | small |
| B4 | PARTLY | sweeps `QueueOpenLogger.tsx`; coaching `SupervisorRecords.tsx`; commitment live `approve_corrective_commitment` | Automatic sweeps (no button), coaching log, corrective commitment with COO approval, arrival readiness, Friday packet tick: built. Missing: sweep split into first 30 / midpoint / last 30; weekly scorecard auto built for Thursday 3 PM (no job exists); Director review of record checks; backup plan when not ready; packet contents; fix plan on 1 to 3 star reviews. | Supervisor: no weekly scorecard on Thursday Nov 12. | large |
| B5 | NOT BUILT | | No metric store, 30-day notice or Scorecard change notice. | | large |
| B6 | PARTLY | `src/routes/_authenticated/analytics.tsx`, `ops-analytics.tsx` | Analytics pages with tiles. Not one page with the six role views; "how it is calculated" not on every number. | Supervisor, Director. | large |
| B7 | NOT BUILT | | No 12-card company dashboard, CEO dashboard or six department measures. | | large |
| B8 | NOT BUILT | | No Reports page, nine reports or My reports builder. | | large |
| B9 | PARTLY | app_settings store; individual setting cards | Settings store exists. No Logic and Automations page. | | large |

## 10. Properties, Databases, Vendors, Playbooks

| Line | Status | Proof | What exists / what is missing | Who notices today | Size |
|---|---|---|---|---|---|
| P1 | PARTLY | `src/components/property/HomeProfileTab.tsx`; `docs/pending/pid-reconciliation-nov9.md` | PID sections, linked tabs, Show empty fields, collapse, Jump to. 0 of 2,084 Notion photos and files next to their items; 960 values missing, 102 different, 174 in the wrong place. | Coordinator looking for the breaker box or water shutoff photo. | large (second PID import, 70 to 100 minutes of runs) |
| P2 | DONE | `drizzle/migrations/0309_property_labels.sql`; `src/components/property/PropertyLabels.tsx` | Admin manages, others pick and remove on one home, gray chips, person and time. | | |
| P3 | PARTLY | `src/lib/databases.ts`; `src/routes/_authenticated/databases.index.tsx`, `databases.$key.tsx` | Twenty cards in four groups with lists, back links, filters. Properties, Vendors and Onboarding cards open existing pages (you approved Onboarding). Claims and refunds can be saved from the list. | Nobody blocked. | small |
| P4 | DONE | `src/lib/shell-nav.ts:84-94` | Directory, Database, Gold Standard, Market Coverage, Needs Review. | | |
| P5 | DONE | `src/lib/sop-upload.ts:7`; `src/components/playbooks/SopUpload.tsx` | Upload button with the exact hover text; SharePoint is the master. | | |
| P6 | DONE | `src/routes/_authenticated/property.$propertyId.tsx:231-238` | Inspections tab shows Nothing here yet. | | |

## 11. Onboarding and Active Owner

| Line | Status | Proof | What exists / what is missing | Who notices today | Size |
|---|---|---|---|---|---|
| O1 | PARTLY | `src/routes/_authenticated/onboarding.index.tsx:244-289`; `onboarding.$propertyId.tsx:457-498` | Photo header and the home tabs exist. Banner shows a greeting and date, not the address only; buttons read My work and Add property, not My tasks and Add a home. | Onboarding user. | small |
| O2 | PARTLY | `0254_standard_template_v3.sql`; `onboarding-project-read-access.test.ts`, `-write-access.test.ts` | Standard v3 and PM own-homes access. Utilities-only view not proven on every screen. | Utilities. | medium |
| O3 | PARTLY | `src/lib/onboarding.ts:67-86` | Board is a later build (your answer). Stages are 8 plus older ones, not Notion's 12; Committed Handoff Date is not locked once set. | Project Manager, Director of Onboarding. | large |
| O4 | PARTLY | `src/components/onboarding/TwoStepHandoff.tsx`; live `read_handoff_standard`, 50 requirements; job handoff-reminders active, 2 runs | Never blocks, carry over items, Director of Onboarding marks ready, Director of Operations or Admin accepts, reminders 7 / 2 / 0 days at 8 AM Central: live. Reminders use the target date, which can still change (see O3). 0 carry over items exist yet. | Supervisor and Director reminders move if the date moves. | small (after O3) |
| O5 | PARTLY | `src/lib/owner-hours-eligibility.ts`; `ActiveOwnerPanel.tsx`; `0231_ao_engine_02_rpcs.sql` | Hours before closing, Homeowners inside Active Owner, owner sees own home. Opportunity engine still has locked states, so "open at enrollment, no staff gate" is not proven; staff notice on completion not proven end to end. | Owner may see an opportunity still locked. | large |
| O6 | NOT BUILT (later by decision) | | Phase 2. | | |

## 12. Defaults (K2)

K2 overall: PARTLY.

| Default | Status | Proof | Note |
|---|---|---|---|
| Name match ignores capitals and spaces | DONE | `mapping.ts:202-215` | Extra spaces are collapsed. |
| Lunch cover same team first | DONE | `0278_coordinator_routing.sql:91-176` | |
| Median becomes Typical | DONE | `screen-words.test.ts:133-142` | |
| Homeowner contacts: roles, shared phone, info email | PARTLY | `src/lib/arha-contacts.ts:11` | Info email set; the shared phone on the owner contact list not confirmed. |
| Button reads Preview 20 tickets | DONE | `runner.ts:354-356` | |
| Only an Admin deletes users | DONE | `0248_remove_users.sql` | |
| Supervisor shifts kept as data, not listed | PARTLY | `ScheduleTab.tsx:92-100` | Hidden by default; a setting can show them. |
| Role handoff to the person on shift | NOT CHECKABLE | | Recipient chain not traced to the end (see T6). |
| Direct Booking follow-up 48 h after each | DONE | `direct-bookings.ts:363-366` | |
| Ticket checklists follow the playbook rule | PARTLY | `src/lib/ticket-checklists.ts` | Edit rule done; every checklist switch is off, so checklists do not show on tickets. |
| Onboarding cost requests keep their own rule | NOT CHECKABLE | | Not traced. |
| Overnight clock start setting, 9:00 AM | DONE | live overnightClockStart 09:00 | |

---

## Lists

### (a) Stops someone doing their job today
1. T7, N4: every imported ticket's page shows a running clock and "P1 escalated". Medium.
2. N1, N5, N6: 44 of the 87 recent open tickets are not in Resolve (plus older open and closed history), and #1478 has no comments or files. Small fix (comment date), then resume the run.
3. T4, T6: no My shift and no End my shift, so a coordinator cannot hand off at the end of a shift in Resolve, and no 15-minute alert for an unaccepted Right now handoff. Large.
4. T15, D3: email intake and the Breezeway bridge are switched off, so info inbox tickets, emailed Direct Booking requests and Breezeway tasks do not arrive in Resolve; Direct Booking requests must be typed in with New request. Medium to check and switch on.
5. Carried over from the links audit, not rechecked here: the preview loading blank, and the phone menu staying open over the page.

### (b) Wrong but does not stop work
- Wording and phone: H1, H2, H3, H4, H6, T5, O1.
- Finance over-access: A4, A6, A7, A8, A9, A10, A12, A13, A18.
- Other access: A1, A5, A14, A16 (with M6), A17, A20, A21, M6.
- Menu: M1, M2, M3, M4.
- Home and tickets: T1, T2, T10, T11, T12, T13.
- Money and claims: C1, C3, C5, C6.
- Import and clean slate: N8, N10.
- Team: Hours (Supervisor lunch), S1, S2, S3, S5, S7, S8.
- Scorecards: B3, B4 (weekly scorecard first due Thursday Nov 12).
- Homes and onboarding: P1 (photos), P3, O2, O3, O4, O5.
- Defaults: K2 (contacts phone, Supervisor rows setting, checklists switched off).

### (c) Can wait
- Waiting by decision or date: A2, A3 (week one), H5 and B1 (Dec 1), S4 (Nov 16), C9 and C10 (previous finance process continues), O6 (Phase 2), P6.
- Later builds: A19, B2, B5, B6, B7, B8, B9, C8, H10 (report check).

## Things to decide
1. A16 and M6 disagree: should the Operations Supervisor see Onboarding (read only) or not at all?
2. N10: is the current 8-table nightly export acceptable for now, or must it cover every table before the team relies on it?
3. N1: the register says 2,892 tickets; the dry run read 2,916. Update the register to 2,916?
4. Hours: store the Supervisor's 2 to 3 lunch, or leave it out because routing never sends tickets to the Supervisor first?
