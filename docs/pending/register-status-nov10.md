# Register status sweep, Nov 10 2026 (drift audit, layer 1, report only)

Every line of `docs/decision-register.md` as it reads now, after Build 11. I checked the code as it is now and read the live database. No code, setting or data was changed. Nothing was published. No OwnerRez searches were run.

**How to read this**
- DONE: built, with the file, migration or test that shows it.
- PARTLY: some of it exists; the missing part is named.
- NOT BUILT: nothing matching was found.
- DIFFERENT: built, but not the way the line says.
- NOT CHECKABLE: the answer is outside the code and database.
- Size: small = under 30 minutes, medium = under 90, large = more.
- Nov 16: **Stop** = stops work on Nov 16; **Fix** = wrong but not blocking; **Wait** = can follow.

**Totals (115 lines; Nov 9 had 113, E1 is new):** DONE 47, PARTLY 55, NOT BUILT 6, DIFFERENT 3, NOT CHECKABLE 4.
Nov 9 totals: DONE 27, PARTLY 74, NOT BUILT 8, NOT CHECKABLE 4.

## The one fact that changes everything: the published app is the Nov 6 version
- The published site carries the code from Nov 6, 23:14 UTC (the deployed commit "Gated OwnerRez lookups by role").
- Proof, all read only from the public site:
  - `/direct-bookings`, `/databases`, `/my-scorecard` and `/export-check` return "Page not found".
  - The published Home still reads "Own the outcome. Protect the stay." (the order from before Nov 9) with one fixed picture.
  - No published file contains "End my shift", "See all in Oversight" or "Today, for me".
- So everything built from Nov 7 on runs only in the preview: Direct Bookings, Databases, Builds 1 to 11 and the tagline change. The team sees none of it until Emily approves a publish.
- The database is shared, so every applied migration (up to 0324) is already live under the old Nov 6 screens. I did not test how the old screens behave against the newer database.
- Nightly export: the job last night (Nov 10, 08:00 UTC) ran the old published code. It saved the old 8 files, with no table count and no check. The full 244-table export has only run as manual tests in the preview (Nov 10, 04:16 to 04:48 UTC, check passed).
- The statuses below describe the code. "Live for the team" depends on that publish.

**Live facts read today:**
- Tickets and claims: 90 tickets, all Notion imports (81 open, 9 Needs a home), 0 archived; 36 claims.
- Accounts: 17 sign-ins. Roles: 2 admin, 3 manager, 4 tech, 3 onboarding, 6 owner.
- Schedule and records: 29 shift rows; 37 on-call rows; 0 scorecard records; 1 Direct Booking approval; 0 time-off requests; 0 ended shifts.
- Handoffs and homes: 0 carry-over items; 0 Breezeway bridge records; 1 home label on 26 homes.
- Onboarding: 11 projects, none with a Status or a Committed Handoff Date yet. Plans: 1 on Standard v3, 4 on V2, 2 on Full Plan, 4 with no plan version.
- Notion import runner: done (recent open set: 90 done, 1 failed). Older open and closed history: 0 done.
- Switches on: operations_queue_v2, onboarding_portal_v2, breezeway_outbound.
- Switches off: email_intake, breezeway_bridge, internal_work_orders, imported_tickets_page, claims_menu, owner_alerts, work_orders_page, work_map, vendor_portal, quarterly_reviews, quarterly_scheduler, survey_review_check, onboarding_external_sync, onboarding_sharepoint_docs, and all six checklist switches.
- Timed jobs inactive: resolve-mailbox-sync (every minute), breezeway-safety-sweep (every 10 minutes), quarterly scheduler.
- Timed jobs active: ticket-timed-alerts, handoff-reminders, direct-booking escalation (20 seconds), nightly backup (07:00 and 08:00 UTC), nightly-export-continue, nightly-export-missed-check, owner alerts delivery, cleaner jobs.
- No weekly scorecard job exists.
- Database functions present: set_email_intake, set_breezeway_bridge, approve_time_off, run_ticket_timed_alerts, correct_committed_handoff_date, save_onboarding_project_details. Move to queue (move_notion_to_queue) is NOT live; it is still staged in `docs/pending/build9`.
- Supervisor shift rows: Mon to Fri 8 to 5 with NO lunch stored. Coordinator lunches are stored and match the Hours paragraph.

---

## 1. House rules

| Line | Nov 9 | Now | Proof | What exists / what is missing | Who notices | Size | Nov 16 |
|---|---|---|---|---|---|---|---|
| H1 | PARTLY | PARTLY | `src/lib/onboarding-template.ts:819,914,924`; allowed by `src/lib/__tests__/screen-words.test.ts:61-67` | Screens use roles. The protected onboarding plan text still holds 12 name-bearing lines (purchasing and handoff contacts), frozen by the word test. Rewording needs approval to change the protected plan. | Onboarding user reads names in Task steps | medium | Fix |
| H2 | PARTLY | PARTLY | `screen-words.test.ts:36-45,68-70` | "sample" now 0 on screens; 1 "threshold" left in a saved policy version stamp. Tone and "never explains how it works" need an editorial read, not a word test. | Supervisor, Onboarding user | medium | Fix |
| H3 | PARTLY | PARTLY (much better) | Scanner `screen-words.test.ts:127-169`; frozen list `:61-87` | Screen text in components: 0 long dashes, 0 codes, 0 emoji (one map copyright mark). The frozen list allows 102 hits in 10 files, mostly the protected onboarding plan (10 long dash, 5 short dash, 36 spaced hyphen, 7 symbols) and internal Coach prompts. | Onboarding user sees dashes and symbols in plan steps | medium | Fix |
| H4 | PARTLY | DONE | `src/lib/tickets.ts:47-74`; `src/lib/__tests__/urgency-names.test.ts:33-38`; scanner `:29-30,51` | No P1/P2/P3 on screens; 2 hits only in an internal prompt, frozen. | | | |
| H5 | NOT BUILT | PARTLY | Waiting rule proven in T13; tiers held by B1 | Waiting never counts (built). Tier names not shown, as B1 requires until Dec 1. | Nobody until Dec 1 | large | Wait |
| H6 | PARTLY | PARTLY | `src/components/GlobalSearch.tsx:90-95` now 44px; `src/components/ui/button.tsx:23-26` default 36px, small 32px | Search fixed. Shared buttons stay under 44px unless a screen overrides them; Build 11 found small controls in shared panels (Owner Completions, task list, budget lines, file icons, note box). | Phone users | medium | Fix |
| H7 | NOT CHECKABLE | NOT CHECKABLE | | Needs the boards side by side; done per build. | | | |
| H8 | DONE | DONE | `src/routes/_authenticated/integrations_.notion-import.tsx:345,360` | No screen asks anyone to edit Notion. | | | |
| H9 | DONE | DONE | `drizzle/migrations/0272_ticket_archive.sql`; switches in `src/lib/shell-nav.ts:331-337,356` | Archive with reason, Admin restore, delete blocked, pages behind switches. | | | |
| H10 | PARTLY | PARTLY | `src/lib/credentials.server.ts:191-236`; `0298_full_backups.sql:35-42`; `src/lib/nightly-export.ts:4-8` | Logged Show, fails closed; full export strips secret columns. "Never in reports" not proven across every report and attachment. | Nobody unless a code leaks | medium | Fix |
| H11 | DONE | DONE | `src/components/scorecard/QueueOpenLogger.tsx` | Sweeps record on opening, no button. (The automatic weekly scorecard is tracked under B4.) | | | |
| H12 | NOT CHECKABLE | NOT CHECKABLE | | Process rule. | | | |

## 2. Who sees what

Proof for most of these lines: `src/lib/route-access.ts`, `src/lib/permissions.ts`, `drizzle/migrations/0317_access_fixes.sql`, `src/lib/__tests__/access-matrix.test.ts`, `access-fixes-build5.test.ts`. View as now keeps roles on top (`src/lib/view-as.ts:14-47`). Real accounts were not signed in for this audit.

| Line | Nov 9 | Now | Proof | What exists / what is missing | Who notices | Size | Nov 16 |
|---|---|---|---|---|---|---|---|
| A1 | PARTLY | DONE | `route-access.ts:110-128,138-145`; `permissions.ts:193-195`; `access-matrix.test.ts:31-40` | Supervisor gets only the read only Handoffs page; Finance exception kept (A16). | | | |
| A2 | PARTLY | PARTLY | `permissions.ts:17-25,257-267`; `access-seats.ts` | Six account types plus roles on top. Finance, Director, Utilities account types are week one. | Finance lead still on a Supervisor account | large | Wait |
| A3 | NOT BUILT | NOT BUILT | none found | No CEO/COO rule. | Leadership uses Admin | large | Wait |
| A4 | PARTLY | DONE | `route-access.ts:171-193`; `useRole.ts:108-127`; `permissions.ts:337-342` | Finance Home read only; Active Owner hidden. Onboarding accounts get their own Onboarding Home. | | | |
| A5 | PARTLY | DONE | `permissions.ts:233-244,328-330`; `dashboard.tsx:479,606-625` | Onboarding no longer sees routine or queue controls on Home. | | | |
| A6 | PARTLY | DONE | `permissions.ts:328-332`; `route-access.ts:82-83`; `access-matrix.test.ts:15-40` | Finance-only account refused; plain Onboarding refused. | | | |
| A7 | PARTLY | DONE | `route-access.ts:73-74`; `access-matrix.test.ts:31-40,76-78` | Coordinator and Finance-only refused by address. | | | |
| A8 | PARTLY | PARTLY | `permissions.ts:334,354`; `work-orders.tsx:35-44` | Finance read only, but sees a "Manager" link that leads to a refusal. Page is behind an off switch. | Finance lead | small | Fix |
| A9 | PARTLY | DONE | `src/lib/vendor-page-views.ts:9-24`; `permissions.ts:284-305`; `access-matrix.test.ts:186-209` | Onboarding roles see all five tabs; leadership fields read only; Finance view; Design hidden. | | | |
| A10 | PARTLY | DONE | `permissions.ts:344`; `route-access.ts:138-145,171-193` | Finance read only on claims and refunds. | | | |
| A11 | PARTLY | PARTLY | `direct-bookings.settings.tsx:26,51-83` | Supervisor and Director can still save Direct Booking settings; the line says Admin saves. | Supervisor could change rates | small | Fix |
| A12 | PARTLY | PARTLY | `route-access.ts:86-88`; `property.$propertyId.tsx:140-152,256-259`; `0317` | Onboarding roles open Properties; Finance cannot edit the profile. Utilities tab still "Nothing here yet"; some property panels use the Supervisor account check, so Finance not proven read only everywhere. | Utilities, Finance lead | large | Fix |
| A13 | PARTLY | DONE | `permissions.ts:331-333`; `team.tsx:21-25`; `access-matrix.test.ts` | Finance hidden; onboarding view. | | | |
| A14 | PARTLY | DONE | `team.tsx:32-63`; `access.server.ts:19-60`; `team-invites.server.ts:32-53`; `0317:15-26` | Director of Onboarding invites onboarding users. | | | |
| A15 | DONE | DONE | `playbook-editing.ts:5-17`; `0289`, `0293` | Unchanged. | | | |
| A16 | PARTLY | PARTLY | `route-access.ts:185-205`; `onboarding.$propertyId.tsx:521-527`; `0324:151-185` | Supervisor-only Handoffs; Supervisor+Finance read only (built). Director of Operations is not view only: the screen offers "Correct" on the Committed Handoff Date to any manager account and the database accepts any manager. Some sections still follow the wider edit rule. Own-only for PM, Utilities, Design not proven on the new pages. | Director of Operations sees a correction button | small | Fix |
| A17 | PARTLY | PARTLY | `route-access.ts:43-52`; `permissions.ts:197-201`; `SupervisorOnly.tsx` | Supervisor gets edit, not view. Coordinator and PM have no "own" entry. | Coordinator cannot reach post-handoff owner work | large | Fix |
| A18 | PARTLY | PARTLY | `permissions.ts:370-375`; `finance.tsx:48-82`; `fix-batch-2.test.ts:154-157` | Director of Operations still edits Finance; a test expects it. | Director of Operations | small | Fix |
| A19 | PARTLY | PARTLY | `src/routes/_authenticated/my-scorecard.tsx`; `route-access.ts:35-37` | Own read only My scorecard built. Review chain (Director reviews Supervisor, COO reviews Director) not built. | Director, COO | large | Wait |
| A20 | PARTLY | PARTLY | `help-tickets.tsx:73-97`; `0317:3-13`; `route-access.ts:57-62` | Staff see My reports; Admin only edits; Admin pages Admin only. Owner and vendor accounts have no My reports. | Owner, vendor | medium | Wait |
| A21 | PARTLY | PARTLY | `access-matrix.test.ts:15-63,186-234` | 12 profiles now, more pages. No CEO/COO; My scorecard, templates, Utilities property scope missing; still expects Director of Operations to edit Finance. | Nobody directly | large | Fix |

## 3. Left menu and top bar

| Line | Nov 9 | Now | Proof | What exists / what is missing | Who notices | Size | Nov 16 |
|---|---|---|---|---|---|---|---|
| M1 | PARTLY | PARTLY | `src/lib/shell-nav.ts:320-389` | Vendors out of the menu; Databases lit on Vendors (built). Missing: Home tabs My home and Oversight (Oversight is still its own item); Reports in Insight; Logic and Automations plus Admin tools (one Admin item). | Supervisor, Directors, Admin | medium | Fix |
| M2 | PARTLY | PARTLY | `shell-nav.ts:157,257-261,283-291,331-337` | Work Map, Work Orders, Claims, Quarterly behind switches. My Work, Leads, Availability off menu but not switched; Direct Bookings can still send some users to the old Leads page. | Rare | small | Fix |
| M3 | PARTLY | PARTLY | `shell-nav.ts:116-217`; `route-access.ts:152-166` | Imported tickets Admin tab is behind `imported_tickets_page` (off) but still an Admin tab; the CEO does not land on Analytics; Admin lands on Command Center. | Admin, CEO | medium | Fix |
| M4 | PARTLY | PARTLY | `shell-nav.ts:556-569`; `AppShell.tsx:405-431` | Buttons missing on Vendors and Active Owner pages. | Coordinator on Vendors | small | Fix |
| M5 | DONE | DONE | `src/lib/view-as.ts:14-47`; `view-as.test.ts` | Eight roles, roles on top kept, read only. | | | |
| M6 | PARTLY | PARTLY | `route-access.ts:106-122`; `shell-nav.ts:351-389`; `permissions.ts:360-392` | Supervisor Handoffs only (built); Admin item for Supervisor and Director opens only Help tickets. No Logic and Automations view for Directors; no COO or CEO menu. | Directors, COO, CEO | large | Fix |

## 4. Home, Team Queue, Record work, tickets and routing

| Line | Nov 9 | Now | Proof | What exists / what is missing | Who notices | Size | Nov 16 |
|---|---|---|---|---|---|---|---|
| T1 | PARTLY | PARTLY | `dashboard.tsx:166-258`; `src/lib/daily-home-photo.ts`; `SupervisorAttentionBand.tsx:88-91` | Daily home photo with caption, greeting, date, tagline, My scorecard, My shift, Recent activity collapsed (built). Missing: the My home / Oversight tabs (M1); the Needs my decision grid still sits on Home for leaders, with "Your records". | Supervisor, Directors, Admin | medium | Fix |
| T2 | PARTLY | PARTLY | `dashboard.tsx:264-420`; `src/components/home/NeedsYouNowPanel.tsx:37-108` | Side panel for ticket handoffs, escalations, approvals, Direct Bookings; See all for leaders. Onboarding handoffs, owner follow-ups and time off rows do not open the panel. | Supervisor, Director | medium | Fix |
| T3 | DONE | DONE | `dashboard.tsx:425-579`; `home-work.test.ts` | Unchanged. | | | |
| T4 | NOT BUILT | DONE | `src/components/home/MyShift.tsx`; `ShiftHandoffDialog.tsx`; `src/lib/my-shift.ts:130-384`; `0316_home_my_shift.sql`; live setting time_off_requests_start 2026-11-16 | Exact wording, End my shift walkthrough, lunch prompt, time off start date. | | | |
| T5 | PARTLY | DONE | `src/lib/ticket-next-step.ts`; `NextStepCard.tsx`; `tickets.$ticketId.tsx:987,1024-1046` | Central time next step, late wording, Continue, Send for review. | | | |
| T6 | PARTLY | PARTLY | `0316:403-534` (15-minute alert); `HandoffPanel.tsx:140-170`; `src/lib/handoff-receiver.ts`; `build9.test.ts:26-41` | Shift and team handoffs, role to person on shift, decline reason, 15-minute alert (live job ticket-timed-alerts). Department handoffs on Home open the home page instead of Accept and Decline in the side panel. | Director of Operations accepting a home | medium | Fix |
| T7 | PARTLY | DONE | `src/lib/notion-ticket-display.ts:55-95`; `tickets.$ticketId.tsx:534-536,1495,1851`; `team-queue-board.ts:31-44` | Imported ticket pages no longer show clocks or escalation (preview only until publish). | | | |
| T8 | DONE | DONE | `tickets.new.tsx`; `record-work-one-flow.test.ts` | Unchanged. | | | |
| T9 | DONE | DONE | `record-work.ts:101-137`; `TicketPriorityPanel.tsx`; `0312` | Unchanged; button reads "Escalate now". | | | |
| T10 | PARTLY | PARTLY | `record-work.ts:94-138`; live 21 active work types | No admin table of 20 problem types for Emily; no Claim Yes or No from platform names; repair comes from the type, not the text; no home details by problem type. | Coordinator: claims not flagged from "Airbnb" etc. | large | Fix |
| T11 | PARTLY | DONE | `tickets.new.tsx:548-565,667,823-835`; `0312` | "What did you do?" required and shown. | | | |
| T12 | PARTLY | DONE | `src/lib/ticket-close-reopen.ts:12-51`; `tickets.$ticketId.tsx:103-105`; `0275` | Both buttons with reasons. | | | |
| T13 | PARTLY | DONE | `ops-analytics.server.ts:164-296`; `command-center.server.ts:217-286`; `tickets.$ticketId.tsx:1531` | Waiting taken out of Analytics and Command Center times; pause wording. | | | |
| T14 | DONE | DONE | `routine-controls.ts`; `0261`; survey switch off | Unchanged. | | | |
| T15 | PARTLY | PARTLY | `0278`, `0279`, `0296:8-23`; `src/lib/automated-sources.ts:19-108`; `0319_email_intake_one_switch.sql`; `0323_breezeway_bridge.sql:146-344` | Routing, unowned From email / From OwnerRez / From Breezeway groups, Take it, Breezeway Reported Issue tickets with clocks, only Notion quiet: all built. Live: email intake off, bridge off, both timed jobs inactive, 0 bridge records. Email or OwnerRez with no mapped problem type lands in "No team yet". | Coordinator: no inbox or Breezeway work arrives | medium (switch on and test) | Stop |

## 5. Claims, refunds, repairs, vendors and money

| Line | Nov 9 | Now | Proof | What exists / what is missing | Who notices | Size | Nov 16 |
|---|---|---|---|---|---|---|---|
| C1 | PARTLY | PARTLY | `claims.tsx:25-55`; `shell-nav.ts:335-337` | Cards on the ticket; Databases filter; menu hidden. Old Claims page still opens by link. | Rare | small | Fix |
| C2 | DONE | DONE | `claim-approval.ts:14-26`; `recovery-policy.ts:22-24`; `0302` | Unchanged. | | | |
| C3 | PARTLY | PARTLY | `src/lib/claims.ts:66-113` | Claim review wording; Team B. "Always workable" on old imported claims and owner-or-deadline-only visibility not proven. | Team B coordinator on old claims | medium | Fix |
| C4 | DONE | DONE | `TicketWorkOrderPanel.tsx:120-128`; `BreezewayRepairLink.tsx:30-206`; `0323:374-400`; `0290` | Ladder v3; Link the Breezeway work order with status, assignee, comments, photos; creation refused while switch off. | | | |
| C5 | PARTLY | PARTLY | `BreezewayRepairLink.tsx:212-218`; `ExpenseSheet.tsx:82-119` | Invoices attach to the ticket (built). No Supervisor approval with the five Bill To choices, no Finance "record payment", no rule that every invoice links to a ticket. | Supervisor, Finance lead (previous process) | large | Wait |
| C6 | PARTLY | PARTLY | `0323:305-344`; `QueueOpenLogger.tsx` | One Maintenance Review per finished work order, Team B, 24 hours, New House skipped: built, but the bridge is off. Supervisor check records page opening, not each daily log and review. | Coordinator: no reviews created | medium | Stop (with T15) |
| C7 | NOT CHECKABLE | NOT CHECKABLE | | Needs a walk through every picklist with real accounts. | | | |
| C8 | NOT BUILT | NOT BUILT | none found | No 3-month extension block. | Coordinator blocks by hand | large | Wait |
| C9 | PARTLY | PARTLY | `shell-nav.ts`; `expenses.ts` | Old screens hidden; no Ramp intake. | Finance lead (previous process) | large | Wait |
| C10 | PARTLY | PARTLY | `0102`, `0121`; `ExpenseSheet.tsx:82-119` | Ready check, flags, invoice fields. A reason is not required on every money record ("amount or reason"). | Finance lead | large | Wait |

## 6. Direct Bookings

Live settings: approval Nov 9 to Nov 23, copies to the Supervisor and Director roles, $189 / $199, overnight start 09:00; escalation job every 20 seconds. **The published app has no Direct Bookings page** (it is the Nov 6 version), so every line here is preview only until publish.

| Line | Nov 9 | Now | Proof | What exists / what is missing | Who notices | Size | Nov 16 |
|---|---|---|---|---|---|---|---|
| D1 | DONE | DONE | `direct-bookings.ts:426-490`; `direct-bookings.index.tsx` | Unchanged. | | | |
| D2 | DONE | DIFFERENT | `0295_direct_booking_overnight_queue.sql:62-120` | During the day it alerts Team A coordinators not at lunch, then coordinators on any team not at lunch, and only then Team A at lunch. A Team A coordinator at lunch can be passed over for a Team B coordinator. Found today; the code did not change. | Team A coordinator at lunch | small | Fix (decide) |
| D3 | PARTLY | PARTLY | `src/lib/mail-categories.ts:15-47`; `direct-bookings.ts:10-17`; `mailbox.server.ts:229-510` | Only "Resolve: direct booking" opens a request; old tag retired; 09:00 setting. Intake off, so no emailed request is created in about a minute. | Coordinator types every emailed request | medium | Stop (with E1) |
| D4 | DONE | DONE | `0262`, `0263`, `0291`; live settings | Unchanged. | | | |
| D5 | DONE | DONE | `direct-bookings.ts:567-636`; `direct-bookings-mail.server.ts` | One-home opening line added; fee order. Pet fee reads "/dog" where the line says per pet. | | | |
| D6 | DONE | DONE | `direct-bookings.ts:104-124`; `direct-bookings.test.ts` | Unchanged. | | | |
| D7 | DONE | DONE | `src/components/direct-bookings/SearchMap.tsx`; `direct-bookings.ts:159-216` | OpenStreetMap in one file. | | | |
| D8 | DONE | DONE | `0315_portal_requests.sql`; `0320_build9_reply_time_guard.sql`; `direct-bookings.functions.ts:620-686` | Portal answers, no-reply guard, "Approved. Post it in the portal.", server-only reply fields. | | | |
| D9 | DONE | DONE | `0262`, `0283`; `direct-bookings-fix-sql.test.ts` | Unchanged. | | | |

## 7. Notion import, clean slate and cutover

| Line | Nov 9 | Now | Proof | What exists / what is missing | Who notices | Size | Nov 16 |
|---|---|---|---|---|---|---|---|
| N1 | PARTLY | PARTLY | live 90 Notion tickets; runner recent_open done 90, failed 1; `notion-import.functions.ts:208-219,531-542`; `notion-page-notes-date.test.ts` | Recent open set complete (90). Page notes now get the ticket date. Older open (604) and closed history (2,225) not started. Register now says 2,916. | Coordinators look up older history in Notion | large (runs) | Fix |
| N2 | DONE | DONE | `mapping.ts:189-199,389-423` | Unchanged. | | | |
| N3 | DONE | DONE | `mapping.ts:202-230` | Unchanged. | | | |
| N4 | PARTLY | DONE | `tickets.$ticketId.tsx:534-536,1026-1044`; `src/lib/supervisor-check.ts:11,60`; `0279` | No clocks on imported ticket pages; Supervisor check skips untouched imports. | | | |
| N5 | PARTLY | PARTLY | `mapping.ts:433-507`; `notion-closed-claims.test.ts` | Date fix in code; 1 failure in the recent run; closed claims with amounts not yet imported (closed run not started). | Coordinator on that ticket | small | Fix |
| N6 | PARTLY | PARTLY | `runner.ts:123-214`; route `:88-104` | Runner no longer stuck (reads done). Stop then Resume not proven again; a stop without an open browser waits about 3 minutes before showing Crashed. | Admin | small | Fix |
| N7 | DONE | DONE | `property-history.ts`; `PropertyHistoryList.tsx:29-41` | Unchanged. | | | |
| N8 | PARTLY | PARTLY | live: 1 project on Standard v3, 4 on V2, 2 on Full Plan, 4 with none; 9 templates | Old plans not moved; old templates not removed. | Onboarding user | large | Fix |
| N9 | NOT CHECKABLE | NOT CHECKABLE | | The team uses the published Nov 6 app, so "works only in Resolve" means the old screens. Notion export and view only are outside Resolve. | Everyone | | |
| N10 | PARTLY | PARTLY | `nightly-export.server.ts`; `0318_nightly_export.sql`; `export-check.tsx`; live backup_runs | Every table, file inventory, check, alerts, Export check page, fewer-rows warning: built and tested by hand (244 tables, 100,798 rows, passed). Last night's run was the old 8-file export, because the job calls the published Nov 6 app. Next-morning Admin alert still staged. | Supervisor: no real nightly check exists yet | small (publish) | Stop (publish) |

## 8. Team and coverage

| Line | Nov 9 | Now | Proof | What exists / what is missing | Who notices | Size | Nov 16 |
|---|---|---|---|---|---|---|---|
| Hours | PARTLY | PARTLY | live coverage_shifts: ops_supervisor Mon to Fri 480 to 1020, lunch empty | All other roles and lunches match. Supervisor lunch 2 to 3 not stored, so My shift cannot show it. | Supervisor | small | Fix |
| S1 | PARTLY | DONE | `0278:91-176`; `my-shift.ts:181-384`; `MyShift.tsx` | Lunch prompt asks to hand off first. | | | |
| S2 | PARTLY | PARTLY | `team-schedule.ts:144-201,418-421` | No Director approval of schedules, no COO approval. | Director of Operations | large | Wait |
| S3 | PARTLY | PARTLY | `ScheduleTab.tsx:92-105`; `team-schedule.ts:429-435` | Rows follow a setting that can add leaders back. | Coordinator | small | Fix |
| S4 | PARTLY | DONE | `team.tsx:21-52`; `TimeOffDialog.tsx`; `0321_build9_time_off_all_or_nothing.sql` | Schedule tab only for coordinators; all-or-nothing approval. | | | |
| S5 | PARTLY | PARTLY | `UsersTab.tsx`; `TeamInvitePanel.tsx` | Function there; look against the Microsoft page not compared. | | small | Wait |
| S6 | DONE | DONE | `0248_remove_users.sql`; `docs/pending/delete-test-logins`; live 17 sign-ins | The clean-slate README still says "blocked"; the later delete step is applied. | | | |
| S7 | PARTLY | PARTLY | `ScheduleTab.tsx:213-607` | On call picker not limited to ops leadership; no warning for unsaved edits. | Supervisor | small | Fix |
| S8 | PARTLY | PARTLY | `team-invites.functions.ts:28` (`.max(90)`) | Screen offers 30 days; the server still accepts up to 90. | Nobody on screen | small | Fix |

## 9. Scorecards, Analytics, Reports, Logic and Automations

| Line | Nov 9 | Now | Proof | What exists / what is missing | Who notices | Size | Nov 16 |
|---|---|---|---|---|---|---|---|
| B1 | PARTLY | PARTLY | `scorecard-capture.ts:100-112`; `0269:79-158`; live 0 records | Facts only; no Nov 9 / Dec 1 date rule or system-affected exclusion. | Nobody until scoring | medium | Wait |
| B2 | PARTLY | PARTLY | `scorecard-capture.ts:133-156`; `RatingChannelsCard.tsx` | Channels setting; no targets by period, no one score per stay. | Director | large | Wait |
| B3 | PARTLY | DIFFERENT | `src/lib/vendor-gold.ts:153-154`; `VendorMarketCoverage.tsx:79-80` | Counts Pilot and Corrective Action vendors as well as Approved and Gold. | Director | small | Fix |
| B4 | PARTLY | PARTLY | `QueueOpenLogger.tsx`; `0269:211-236,351` (sweep_number NULL); no weekly job in the live job list | Sweeps automatic but not split into first 30 / midpoint / last 30; no automatic Thursday 3 PM weekly scorecard; no Director review of record checks; packet contents, backup plan and low-star fix plan missing. | Supervisor builds the weekly scorecard by hand | large | Fix |
| B5 | NOT BUILT | NOT BUILT | | | | large | Wait |
| B6 | PARTLY | PARTLY | `my-scorecard.tsx`; `analytics.tsx` | My scorecard page added; no single page with six views. | Supervisor, Director | large | Wait |
| B7 | NOT BUILT | NOT BUILT | | | | large | Wait |
| B8 | NOT BUILT | NOT BUILT | | "My reports" in Build 5 is the person's own help tickets, not this builder. | | large | Wait |
| B9 | PARTLY | PARTLY | app_settings | No Logic and Automations page. | | large | Wait |

## 10. Properties, Databases, Vendors, Playbooks

| Line | Nov 9 | Now | Proof | What exists / what is missing | Who notices | Size | Nov 16 |
|---|---|---|---|---|---|---|---|
| P1 | PARTLY | PARTLY | `HomeProfileTab.tsx`; `docs/pending/pid-reconciliation-nov9.md` | Layout built. Nov 9 counts (0 of 2,084 photos, 960 values missing) not rerun; no second PID import has run. | Coordinator looking for a shutoff photo | large | Fix |
| P2 | DONE | DONE | `0309_property_labels.sql`; `PropertyLabels.tsx` | Unchanged. | | | |
| P3 | PARTLY | PARTLY | `src/lib/ticket-tabs.ts:31-37`; `TicketTabs.tsx`; staged `docs/pending/build9/04_move_to_queue.sql` | Six tabs with the four filters built. Reopen is on the ticket page reached through Open, not on the list. Move to queue waits for approval, as the line says. | Supervisor | small | Fix |
| P4 | DONE | DONE | `shell-nav.ts:84-94` | Unchanged. | | | |
| P5 | DONE | DONE | `sop-upload.ts:7`; `SopUpload.tsx` | Unchanged. | | | |
| P6 | DONE | DONE | `property.$propertyId.tsx:231-238` | Unchanged. | | | |

## 11. Onboarding and Active Owner

| Line | Nov 9 | Now | Proof | What exists / what is missing | Who notices | Size | Nov 16 |
|---|---|---|---|---|---|---|---|
| O1 | PARTLY | DONE | `OnboardingBoardHome.tsx:106-116`; `onboarding.index.tsx:260-392`; `HomeBoard.tsx`; `onboarding-board.test.ts` | Photo with address-only caption, Add a home and My tasks, header, stepper, seven tabs (preview only). The greeting is extra to the first sentence but named in the Built note. | | | |
| O2 | PARTLY | PARTLY | `0254`; `onboarding-project-read-access.test.ts` | PM own homes proven. Utilities seeing only utilities work not proven on the new pages. | Utilities | medium | Fix |
| O3 | PARTLY | DIFFERENT | `onboarding-board.ts:160-175`; `0324:36-185`; `onboarding.$propertyId.tsx:522-523` | 12 Notion statuses, set-once lock and history built. Correction is open to any manager account (screen and database), not only the Operations Supervisor or Admin. Money totals not stored. | Director of Operations and Finance lead could correct the date | small | Fix |
| O4 | PARTLY | DONE | `0322_build9_handoff_ready_authority.sql`; `0324:208-280`; `TwoStepHandoff.tsx`; live job handoff-reminders | Reminders follow the Committed Handoff Date, else the estimate; authority enforced. | | | |
| O5 | PARTLY | PARTLY | `0231_ao_engine_02_rpcs.sql:86-235` | Engine still has locked opportunities and a staff unlock. | Owner sees an opportunity "Coming soon" | large | Fix |
| O6 | NOT BUILT | NOT BUILT | | Phase 2 by decision. | | large | Wait |

## 12. Defaults (K2): PARTLY

| Default | Nov 9 | Now | Note |
|---|---|---|---|
| Name match ignores capitals and spaces | DONE | DONE | `mapping.ts:211-230` |
| Lunch cover same team first | DONE | DONE | `0278` (Direct Bookings lunch differs, see D2) |
| Median becomes Typical | DONE | DONE | word test |
| Homeowner contacts: roles, shared phone, info email | PARTLY | DONE | `src/lib/arha-contacts.ts:10-46` |
| Preview 20 tickets | DONE | DONE | `runner.ts:354-369` |
| Only an Admin deletes users | DONE | DONE | `0248` |
| Supervisor shifts kept, not listed | PARTLY | PARTLY | hidden by default, a setting can show them |
| Role handoff to the person on shift | NOT CHECKABLE | DONE | `HandoffPanel.tsx:138-170`; `build9.test.ts:26-41` |
| Follow up 48 h after each | DONE | DONE | `direct-bookings.ts:363-367` |
| Ticket checklists follow the playbook rule | PARTLY | PARTLY | rule built; all six checklist switches off live |
| Onboarding cost requests keep their own rule | NOT CHECKABLE | DONE | `onboarding-finance.server.ts:254-529` |
| Overnight clock 9:00 AM setting | DONE | DONE | live 09:00 |

## 13. Email intake

| Line | Nov 9 | Now | Proof | What exists / what is missing | Who notices | Size | Nov 16 |
|---|---|---|---|---|---|---|---|
| E1 | (new) | PARTLY | `0314_email_intake_safety.sql`; `0319_email_intake_one_switch.sql` (applied; live `set_email_intake`); `src/lib/email-intake.ts:27-131`; `team-queue.tsx:119-121,290-291` | Real switch, start line, one switch with the timed check, test chip for leaders, hidden from coordinators, uncounted: built. Live: off, timed check inactive, test plan not run, no go from Emily. The follow-ups README still says "staged only" though 0319 is applied. | Coordinator: no inbox mail arrives | medium (test plan) | Stop |

---

## Changed since Nov 9 (26 status changes, plus 6 lines with progress)
- Became DONE (21): H4, A1, A4, A5, A6, A7, A9, A10, A13, A14, T4, T5, T7, T11, T12, T13, N4, S1, S4, O1, O4.
- NOT BUILT to PARTLY (1): H5.
- Became DIFFERENT (3): D2 (was DONE), B3 (was PARTLY), O3 (was PARTLY).
- New line (1): E1, PARTLY.
- Same status, real progress (6): H3, H6, T15, C4, C5, N10.
- K2 defaults that improved: homeowner contacts, role handoff, onboarding cost requests.

## Got worse (3)
1. **O3 / A16:** Build 11 added a Committed Handoff Date correction that any manager account can use. The line names only the Operations Supervisor or Admin. This is new drift from this week's code.
2. **D2:** daytime Direct Booking alerts can skip a Team A coordinator at lunch. This rule was already in the code on Nov 9 and was not caught; the code did not change.
3. **B3:** reclassified from PARTLY to DIFFERENT. The code did not change.

Not a status change, but worse in practice: the team's published app is the Nov 6 version, and last night's nightly export still ran the old 8-file copy.

## Three lists

**Stops work on Nov 16**
1. Publish (Emily's go). Without it, none of the following reach the team: Direct Bookings (D1 to D9, inside its Nov 9 to Nov 23 approval period), Databases (P3), My shift, End my shift and time off (T4, S4, starting Nov 16), the ticket page fixes (T5, T7, T11 to T13, N4), the access fixes (A lines), the onboarding pages (O1, O3) and the full nightly export (N10).
2. E1, D3, T15: email intake is off and its timed check is inactive. It needs the test plan, Emily's go, and the publish first.
3. T15, C6: the Breezeway bridge is off and its 10-minute sweep is inactive. The sweep must be switched on by hand (Build 10 question 1 still open).

**Wrong but not blocking**
H1, H2, H3, H6, H10, A8, A11, A12, A16, A17, A18, A21, M1, M2, M3, M4, M6, T1, T2, T6, T10, C1, C3, D2, N1, N5, N6, N8, Hours, S3, S7, S8, B3, B4, P1, P3, O2, O3, O5, K2.

**Can wait**
H5, A2, A3, A19, A20, C5, C8, C9, C10, S2, S5, B1, B2, B5, B6, B7, B8, B9, O6.

## Punch list decisions not found in the register
The punch list is not a file in the project. These come from the punch list items quoted in build requests (Nov 7 to Nov 10):
1. Team Queue alert timing:
   - Right now: red at 3 minutes, Supervisor alerted at 10, Director of Operations at 15.
   - Today: red 2 hours before 5 PM and again 2 hours before 10 PM.
   - Routine: red past its standard (work order review 24 hours).
   - Quiet imports never alert.
2. The back from waiting alert fires at the return time, once per return time.
3. New note alert and the @mention picker.
4. Approval alerts open the exact ticket, in the app and in the email.
5. The Claim card Supervisor Approve or Decline with a required reason (C2 has only the amounts).
6. Notification preferences: three categories, email and in app on by default.
7. PID photos are stored in Resolve and a second PID import follows (P1 does not say where or how).
8. Onboarding Files "saved to the home folder in SharePoint". Not in the register, and built differently: the files are stored in Resolve.
9. Budget & Invoices money fields (Total Furnishing Invoice, Total Repair Estimate, Change on Furnishing Invoice, Final Repair Cost). Only O3's Built note mentions them.
10. Databases "must work Monday", and the publish plan: Wednesday night after 10 PM, with the onboarding lead told first.

## Could not check
- How the published Nov 6 screens behave against the newer database (for example the reply-time guard, the Committed Handoff Date lock, time off and archive rules). No test was run.
- Real email and Breezeway arrivals: both are off.
- Real-account access: View as only, no sign-in as each role.
- PID completeness and Notion counts: not rerun (no Notion calls).
- H7 boards, H12 process history, C7 every picklist, N9 team practice.
