# Notion history import run, Nov 10 (overnight Nov 11 UTC)

## Status: RUNNING (START THE IMPORT received Nov 11 05:13 UTC, Emily's go at about 10:50 PM Central Nov 10). See the Run log at the end; the final report is written there when the run ends.

(Earlier status, Nov 11 04:50 UTC: armed and waiting.)

Emily answered the five questions on Nov 11. The two code changes are made and tested. The import starts only when Emily sends a separate message that says START THE IMPORT (after 10 PM Central). Then: full backup first, then Phase A older open, then Phase B closed history, logged per batch below. No ticket, claim or comment was written to Resolve for this step. Notion was only read.

Saved run state (`app_settings.notion_import_runner`, read only): the last job is the first run (recent open), status done, Nov 9 17:02 UTC, 90 done, 1 failed. Older open and closed: 0 done. No job is running.

## Answers applied (Emily, Nov 11)
1. Home count: the Nov 9 dry run is the expectation: 24 older open, 133 closed, 5 recent open with no matching home, 162 in all, all as Needs a home. Register N5 updated; the 30 is stale.
2. Order: the closed history run reads newest first (by Notion created time). The dry run, the recent open run and the older open run read oldest first, as the first run did. Code: `notionSortDirection` in `src/lib/notion-import/runner.ts`, used by the one sort line in `src/lib/notion-import/notion.server.ts`.
3. The 6 tickets (1457, 1492, 1495, 1498, 1500, 1515) stay exactly as they are. The older open and closed history runs never rewrite, close, reassign or retitle any ticket already in Resolve; they only add its new Notion comments and files (imported comments have no Resolve author, so no note alert goes out). The only other imported tickets in the history lists are the 5 that passed 30 days (1437, 1438, 1439, 1440, 1458, in the older open list); they are also kept exactly as they are, with their claims unchanged. The other 79 are recent open and neither history run reads them as theirs.
4. New expectations: Notion total 2,937; older open 600 (595 new, 5 already in Resolve); closed 2,234 (2,228 new, 6 already in Resolve and kept). Register N1 updated.
5. The 14 tickets created in Notion on or after Nov 9 are not imported now. They wait for the final top up run on the cutover weekend (recent open, imported quiet like the first run). Register N12 added. List below.

## Notion reread, Nov 11 04:45 UTC (read only, 60 list reads in two passes, no rate limits)
Counted with the import's own rules (`mapNotionPage`: a claim when Will this be a claim is Yes or the status is Pending Claim Review; damages from Total Damages, paid back from Reimbursed Amount; blanks count as $0).

| Set | Tickets | Already in Resolve | Claims | Damages | Paid back | Expected | Difference |
|---|---|---|---|---|---|---|---|
| Older open, whole list | 600 | 5 | 559 | $94,230.57 | $84,192.99 | 563 / $93,598 / $83,473 | claims -0.7%, damages +0.7%, paid back +0.9% |
| Older open, new only | 595 | 0 | 554 | $93,598.21 | $83,810.63 | | the 5 kept tickets hold 5 claims, $632.36 and $382.36, which stay as they are |
| Closed | 2,234 | 6 | 81 | $29,435.24 | $25,370.40 | 81 / $29,435 / $25,370 | none (the 6 kept tickets have no claim) |
| Recent open (not run) | 103 | 79 | 43 | $3,219.66 | $2,108.77 | | |

Both sets are within 5 percent. Blank amounts: older open 107 damages and 238 paid back blank; closed 37 and 38 blank.

## The 14 new Notion tickets left for the top up run
Notion has no ticket number field, so each is listed by its Notion created date, title and page id.

| # | Created Date | Page made | Title | Status | Notion page id |
|---|---|---|---|---|---|
| 1 | 2026-11-09 | 2026-11-09 20:30 UTC | 9213 - garage door issue | In progress | `4134658d5f4f803f8678ee2dfc2d6f90` |
| 2 | 2026-11-09 | 2026-11-10 01:31 UTC | 6629 - Guest says the master bathroom toilet keeps running. | In progress | `4144658d5f4f80c2b905c9db3acc6f17` |
| 3 | 2026-11-09 | 2026-11-10 02:16 UTC | Aircover - Brianna Victor at 2100 Liberty | In progress | `4144658d5f4f80539107e067f12028ba` |
| 4 | 2026-11-09 | 2026-11-10 02:21 UTC | 2100 - Multiple Maintenance & Housekeeping Issues Reported During Walkthrough | In progress | `4144658d5f4f800baccfe96baa0a1b7b` |
| 5 | 2026-11-09 | 2026-11-10 03:33 UTC | VRBO - Charles Fell at 10121 E Poop in the backyard | In progress | `4144658d5f4f80efa8abfd32d27830d6` |
| 6 | 2026-11-09 | 2026-11-10 03:44 UTC | 1640 Glade Meadows Dr - Alarm panel stuck on “ALARM”, codes not working | In progress | `4144658d5f4f8046a1b2d5f13fa620c8` |
| 7 | 2026-11-09 | 2026-11-10 07:34 UTC | 904 - Vacancy Cleaning Report | In progress | `4144658d5f4f809e9c14ec276a480ba5` |
| 8 | 2026-11-09 | 2026-11-10 08:28 UTC | 2014 - Front door needs battery replaced | In progress | `4144658d5f4f807581eddeca033400c3` |
| 9 | 2026-11-09 | 2026-11-10 08:42 UTC | 105 - Restock Linens & Kitchen Supplies - Missing Sponge, Washcloths, Hand Towels, Bath To | In progress | `4144658d5f4f803b8563c0ebb71b30ee` |
| 10 | 2026-11-09 | 2026-11-10 08:58 UTC | 85 Lower - Bugs Reported in the House | In progress | `4144658d5f4f80c8bf92ccf2a011a06d` |
| 11 | 2026-11-09 | 2026-11-10 09:17 UTC | 7071 - Departure Clean Report | In progress | `4144658d5f4f80a6b201c9218562ba74` |
| 12 | 2026-11-09 | 2026-11-10 10:43 UTC | FRONT DOOR LOCK - BATTERY REPORT | In progress | `4144658d5f4f8017a74cd16368556fd4` |
| 13 | 2026-11-10 | 2026-11-10 21:32 UTC | 453 - Broken fire pit trash | In progress | `4144658d5f4f80348c5fef7a4017f135` |
| 14 | 2026-11-10 | 2026-11-11 03:17 UTC | 15905 - Slower Shower Drain | In progress | `4154658d5f4f80cc97f3e70d613b9460` |

## 10 more recent open Notion tickets not in Resolve (found in the reread)
These have a Created Date before Nov 9 but their Notion pages were made Nov 5 to 9 and they were not in the set the first run imported. Like the 14, they are recent open, so neither history run brings them in; the top up run would. If the top up is more than 30 days after a ticket's Created Date (the earliest is Nov 1, so from Dec 1), it becomes older open and only an older open run would bring it in.

| # | Created Date | Page made | Title | Status | Notion page id |
|---|---|---|---|---|---|
| 1 | 2026-11-01 | 2026-11-05 01:05 UTC | Aircover - Eric Muhizi at 3117 Scissortail - Stained rug | In progress | `40f4658d5f4f80c1b44ee3780e383f57` |
| 2 | 2026-11-03 | 2026-11-05 02:37 UTC | Aircover - Victor Davila at 6629 S 22nd - smoking cigarette inside the house and driveway | In progress | `40f4658d5f4f809da85fe0ab079be3e8` |
| 3 | 2026-11-02 | 2026-11-05 03:15 UTC | Aircover - Cari Thompson Maritz at 13325 E Dog poop in the backyard | In progress | `40f4658d5f4f805eafcdcb1b03e10a6e` |
| 4 | 2026-11-04 | 2026-11-06 00:11 UTC | Aircover - Odilon Rodriguez at 9120 Yassir Blvd | In progress | `4104658d5f4f80eaad1ff47caeff55ae` |
| 5 | 2026-11-06 | 2026-11-07 02:22 UTC | Aircover - Jordan Tucker at 136 Magnolia - Stained/Missing Linens • 6 bath towels missing. | In progress | `4114658d5f4f803bbfd7feed99db8aa8` |
| 6 | 2026-11-07 | 2026-11-07 23:28 UTC | Aircover - Sheritta Yarbrough at 1701 Park Lane Dr. - stained linen | In progress | `4114658d5f4f8075ac15ef2092ea892f` |
| 7 | 2026-11-07 | 2026-11-08 00:07 UTC | VRBO - Shayla Pequeno at 3200 Birmingham Dr - dog waste smell + King sheets stained | In progress | `4124658d5f4f801e81a9ecdd48207ba7` |
| 8 | 2026-11-08 | 2026-11-08 22:26 UTC | Aircover - Justin Hasling at 1908 E Urbana St - carpet needs cleaning | In progress | `4124658d5f4f8051b3d8c08c5431f240` |
| 9 | 2026-11-07 | 2026-11-09 00:02 UTC | Aircover - Lynne Delaney at 16401 Villa Valeria Way (30D FIRM) - nighstand | In progress | `4134658d5f4f80b494a2d2c833ccfad0` |
| 10 | 2026-11-08 | 2026-11-10 08:18 UTC | Aircover - Emily Patton at 11720 NW Odor Remediation | In progress | `4144658d5f4f8025abfedc983246a4a5` |

---

## Earlier record: stopped before starting (Nov 11, 04:11 to 04:40 UTC)

Checked Nov 11, 04:11 to 04:40 UTC. Nothing was written to Resolve. The Notion import page was not opened and its saved run state (`app_settings.notion_import_runner`) was not touched. The only outside call was a read of the Notion ticket list: 30 read requests, no rate limits, nothing written to Notion.

The instruction says to stop if the register and the dry run report disagree, and to stop at the first anomaly. Three stop conditions and two count changes were found before step 1.

## Stop 1. Register N5 and the dry run disagree on tickets with no home
- Register N5: "the 30 tickets with no matching home imported as Needs a home".
- Dry run Nov 9 (`docs/pending/notion-ticket-import-dry-run-nov9.md`): 162 with no matching home (133 closed, 24 older open, 5 recent open; 146 with no home in Notion, 16 linked to 21036 Owens Rd).
- The 30 comes from the earlier dry run (`docs/pending/notion-ticket-import-dry-run.md:50`). The rule is the same either way (import as Needs a home), but the expected count, which is a stop line, is not. Decision needed: which number is the expectation.

## Stop 2. "Newest closed first" is not what the current code does
- The import reads Notion sorted by created time, oldest first, for every run (`src/lib/notion-import/notion.server.ts:108`).
- Newest closed first needs a code change. The instruction also says to use exactly the same code as the first run. Decision needed: allow a one line change for the closed run only, or run oldest first.

## Stop 3. The closed history run would change 6 of the 90 tickets already imported
These 6 are open and assigned in Resolve, but were marked Done in Notion on Nov 9 and 10 after the first import. The closed run treats them as edited and would rewrite them as closed (status, title, description, priority), taking them off the coordinators' lists and moving Team Queue and Home counts:
- 1457 1016 - Guest Feedback - shower noise behind
- 1492 5217 - Lid toilet is broke
- 1495 817 - Bathtub faucet loose
- 1498 15701 - no hair dryer + touch up painting + pest control
- 1500 525 - Guest Survey - Towel bar not attached + dining chairs
- 1515 136 - mattress damage

Decision needed: leave them exactly as they are in Resolve (needs a small code change so history runs never rewrite a ticket already imported), or let Notion's Done close them.

## Also found (would fail the count checks)
- Notion has grown since the dry run: 2,937 tickets now (N1 and the dry run say 2,916).
  - Closed: 2,234 now (expected 2,225). Done 2,232, Completed Same Day 2.
  - Older open: 600 now (expected 604).
  - Open, past 30 days: 103 now.
  - Status: In progress 310, Pending Claim Review with Josh 393.
- 14 tickets were created in Notion on or after Nov 9 and are not in Resolve. They are recent open, so neither the older open run nor the closed history run would bring them in. Notion is still being used for new tickets.
- 5 of the 90 imported tickets have now passed 30 days: 1437, 1438, 1439, 1440, 1458. They are unchanged in Notion, so the older open run would skip them. It would still copy any new Notion comments and files onto them.
- 21 more of the 90 were edited in Notion since the first import. They are still recent open, so neither run touches them.

## What would be imported if approved as is
- Phase A, older open: 600 in the Notion list, of which 595 are new and 5 are already in Resolve.
- Phase B, closed history: 2,234 in the Notion list, of which 2,228 are new and 6 are the tickets in Stop 3.
- Claim expectations (563 / $93,598 / $83,473 and 81 / $29,435 / $25,370) were not rechecked against Notion. They need the claim pages read.

## Batch log
No batches run.

| Batch | Phase | Done | Skipped | Failed | Comments | Files | Cursor | Anomalies |
|---|---|---|---|---|---|---|---|---|
| none | | | | | | | | Stopped before step 1 |


---

## Run log (START THE IMPORT, Nov 11 UTC)

### Before the run
- Readiness: the five-question task finished; importer changes in place (closed history newest first, history runs never rewrite an already imported ticket); saved run state idle (last job: first run, done). Preview signed in as the Admin.
- Fresh full backup: id `d170df7a-2dd1-4f9e-9aaa-295bbb07a375`, folder `2026-11-11_051821Z`, 266 tables, 102,068 rows, finished 05:19:39 UTC, Verify passed 05:21:33 UTC (every table matches).
- Baseline 05:16 UTC: 90 imported tickets (81 open, 9 Needs a home), 2 live tickets, 36 claims (24 Potential $100.00, 12 Gathering $3,827.02 damages and $991.13 paid back), 259 imported comments, 119 ticket files, 0 duplicates, 0 imported tickets with a clock, 0 ticket timed alerts, 0 escalations. Team Queue: Team A 0, Team B 0, All teams 0, All unclaimed 0. Databases tabs: All 90, Recent 85, Older open 5, Closed history 0, Needs a home 9, Claims history 36. Money we could still lose $3,927.02.
- Watched on every poll (every 15 seconds): duplicates, clocks on imported tickets, Needs a home above the expectation (24 older open, 133 closed), new tickets above the expectation (595, 2,228), any non-comment activity on new imported tickets, any new staff notification, owner notification or email tied to a ticket, any timed alert, escalation or owner contact alert, and fingerprints of the 90 already imported tickets, the 2 live tickets and the 36 existing claims. Any one stops the run.

### Batches
| At (UTC) | Batch | Result | Tickets | Comments, files | Progress | Note |
|---|---|---|---|---|---|---|
| 2026-11-11 05:23:42 UTC | older_open started (start line 2026-11-11 05:23:27.678975+00) | | | | | |
| 2026-11-11 05:24:20 UTC | watcher | | | | | The watcher script (not the import) crashed on its own text parsing after batch 2; closing its browser ended the page's batch loop. The import saved its place after batch 2 (6 tickets done, 0 failed). Nothing was lost or doubled. Watcher fixed; the run is resumed from the saved cursor once the import marks the run as interrupted (3 minutes). |
| 2026-11-11 05:27:54 UTC | older_open resumed from the saved cursor (watch line 2026-11-11 05:23:27.678975+00) | | | | | |
| 2026-11-11 05:23:56 | 1 | ok | done 3, skipped 0, failed 0 | comments 12, files 4 | total done 6, cursor saved |  |
| 2026-11-11 05:24:19 | 2 | ok | done 3, skipped 0, failed 0 | comments 43, files 13 | total done 6, cursor saved |  |
| 2026-11-11 05:28:28 | 3 | ok | done 3, skipped 0, failed 0 | comments 35, files 21 | total done 9, cursor saved |  |
| 2026-11-11 05:29:02 | 4 | ok | done 3, skipped 0, failed 0 | comments 35, files 20 | total done 12, cursor saved |  |
| 2026-11-11 05:29:25 | 5 | ok | done 3, skipped 0, failed 0 | comments 35, files 13 | total done 15, cursor saved |  |
| 2026-11-11 05:30:21 | 6 | ok | done 3, skipped 0, failed 0 | comments 38, files 40 | total done 18, cursor saved |  |
| 2026-11-11 05:30:44 | 7 | ok | done 3, skipped 0, failed 0 | comments 20, files 9 | total done 21, cursor saved |  |
| 2026-11-11 05:31:20 | 8 | ok | done 3, skipped 0, failed 0 | comments 12, files 13 | total done 24, cursor saved |  |
| 2026-11-11 05:31:50 | 9 | ok | done 3, skipped 0, failed 0 | comments 32, files 18 | total done 27, cursor saved |  |
| 2026-11-11 05:32:11 | 10 | ok | done 3, skipped 0, failed 0 | comments 20, files 10 | total done 30, cursor saved |  |
| 2026-11-11 05:32:34 | 11 | ok | done 3, skipped 0, failed 0 | comments 18, files 13 | total done 33, cursor saved |  |
| 2026-11-11 05:32:54 | 12 | ok | done 3, skipped 0, failed 0 | comments 13, files 11 | total done 39, cursor saved |  |
| 2026-11-11 05:33:10 | 13 | ok | done 3, skipped 0, failed 0 | comments 23, files 6 | total done 39, cursor saved |  |
| 2026-11-11 05:33:28 | 14 | ok | done 3, skipped 0, failed 0 | comments 24, files 9 | total done 42, cursor saved |  |
| 2026-11-11 05:33:45 | 15 | ok | done 3, skipped 0, failed 0 | comments 19, files 10 | total done 45, cursor saved |  |
| 2026-11-11 05:34:01 | 16 | ok | done 3, skipped 0, failed 0 | comments 12, files 8 | total done 48, cursor saved |  |
| 2026-11-11 05:34:16 | 17 | ok | done 3, skipped 0, failed 0 | comments 14, files 6 | total done 48, cursor saved |  |
| 2026-11-11 05:34:46 | 18 | ok | done 3, skipped 0, failed 0 | comments 23, files 19 | total done 54, cursor saved |  |
| 2026-11-11 05:35:15 | 19 | ok | done 3, skipped 0, failed 0 | comments 17, files 22 | total done 57, cursor saved |  |
| 2026-11-11 05:35:27 | 20 | ok | done 3, skipped 0, failed 0 | comments 17, files 4 | total done 60, cursor saved |  |
| 2026-11-11 05:35:48 | 21 | ok | done 3, skipped 0, failed 0 | comments 19, files 11 | total done 63, cursor saved |  |
| 2026-11-11 05:36:26 | 22 | ok | done 3, skipped 0, failed 0 | comments 26, files 23 | total done 66, cursor saved |  |
| 2026-11-11 05:36:53 | 23 | ok | done 3, skipped 0, failed 0 | comments 29, files 16 | total done 69, cursor saved |  |
| 2026-11-11 05:37:28 | 24 | ok | done 3, skipped 0, failed 0 | comments 26, files 17 | total done 72, cursor saved |  |
| 2026-11-11 05:38:00 | 25 | ok | done 3, skipped 0, failed 0 | comments 28, files 21 | total done 75, cursor saved |  |
| 2026-11-11 05:38:16 | 26 | ok | done 3, skipped 0, failed 0 | comments 16, files 7 | total done 78, cursor saved |  |
