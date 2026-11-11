# Notion history import run, Nov 10 (overnight Nov 11 UTC)

## Status: DONE. Phase A and Phase B finished Nov 11 14:56 UTC. The final report is at the end of this file.

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
| 2026-11-11 05:39:17 | 27 | ok | done 3, skipped 0, failed 0 | comments 20, files 45 | total done 81, cursor saved |  |
| 2026-11-11 05:40:14 | 28 | ok | done 3, skipped 0, failed 0 | comments 36, files 40 | total done 84, cursor saved |  |
| 2026-11-11 05:41:00 | 29 | ok | done 3, skipped 0, failed 0 | comments 32, files 34 | total done 87, cursor saved |  |
| 2026-11-11 05:41:13 | 30 | ok | done 3, skipped 0, failed 0 | comments 17, files 4 | total done 90, cursor saved |  |
| 2026-11-11 05:41:28 | 31 | ok | done 3, skipped 0, failed 0 | comments 12, files 5 | total done 93, cursor saved |  |
| 2026-11-11 05:41:53 | 32 | ok | done 3, skipped 0, failed 0 | comments 28, files 16 | total done 96, cursor saved |  |
| 2026-11-11 05:42:18 | 33 | ok | done 3, skipped 0, failed 0 | comments 16, files 18 | total done 99, cursor saved |  |
| 2026-11-11 05:42:34 | 34 | ok | done 3, skipped 0, failed 0 | comments 16, files 7 | total done 102, cursor saved |  |
| 2026-11-11 05:43:26 | 35 | ok | done 3, skipped 0, failed 0 | comments 38, files 37 | total done 105, cursor saved |  |
| 2026-11-11 05:44:11 | 36 | ok | done 3, skipped 0, failed 0 | comments 24, files 25 | total done 108, cursor saved |  |
| 2026-11-11 05:44:54 | 37 | ok | done 3, skipped 0, failed 0 | comments 17, files 22 | total done 111, cursor saved |  |
| 2026-11-11 05:45:10 | 38 | ok | done 3, skipped 0, failed 0 | comments 23, files 6 | total done 114, cursor saved |  |
| 2026-11-11 05:46:07 | 39 | ok | done 3, skipped 0, failed 0 | comments 36, files 40 | total done 117, cursor saved |  |
| 2026-11-11 05:46:25 | 40 | ok | done 3, skipped 0, failed 0 | comments 10, files 10 | total done 117, cursor saved |  |
| 2026-11-11 05:46:46 | 41 | ok | done 3, skipped 0, failed 0 | comments 20, files 12 | total done 120, cursor saved |  |
| 2026-11-11 05:47:04 | 42 | ok | done 3, skipped 0, failed 0 | comments 16, files 9 | total done 126, cursor saved |  |
| 2026-11-11 05:47:23 | 43 | ok | done 3, skipped 0, failed 0 | comments 13, files 9 | total done 129, cursor saved |  |
| 2026-11-11 05:47:47 | 44 | ok | done 3, skipped 0, failed 0 | comments 12, files 13 | total done 132, cursor saved |  |
| 2026-11-11 05:48:08 | 45 | ok | done 3, skipped 0, failed 0 | comments 17, files 13 | total done 135, cursor saved |  |
| 2026-11-11 05:49:06 | 46 | ok | done 3, skipped 0, failed 0 | comments 25, files 47 | total done 138, cursor saved |  |
| 2026-11-11 05:49:22 | 47 | ok | done 3, skipped 0, failed 0 | comments 9, files 6 | total done 141, cursor saved |  |
| 2026-11-11 05:49:43 | 48 | ok | done 3, skipped 0, failed 0 | comments 15, files 11 | total done 144, cursor saved |  |
| 2026-11-11 05:50:21 | 49 | ok | done 3, skipped 0, failed 0 | comments 37, files 24 | total done 147, cursor saved |  |
| 2026-11-11 05:50:44 | 50 | ok | done 3, skipped 0, failed 0 | comments 21, files 13 | total done 150, cursor saved |  |
| 2026-11-11 05:51:02 | 51 | ok | done 3, skipped 0, failed 0 | comments 17, files 9 | total done 150, cursor saved |  |
| 2026-11-11 05:51:50 | 52 | ok | done 3, skipped 0, failed 0 | comments 21, files 36 | total done 156, cursor saved |  |
| 2026-11-11 05:52:12 | 53 | ok | done 3, skipped 0, failed 0 | comments 12, files 12 | total done 159, cursor saved |  |
| 2026-11-11 05:52:35 | 54 | ok | done 3, skipped 0, failed 0 | comments 13, files 14 | total done 162, cursor saved |  |
| 2026-11-11 05:53:00 | 55 | ok | done 3, skipped 0, failed 0 | comments 22, files 17 | total done 165, cursor saved |  |
| 2026-11-11 05:53:42 | 56 | ok | done 3, skipped 0, failed 0 | comments 19, files 31 | total done 168, cursor saved |  |
| 2026-11-11 05:54:25 | 57 | ok | done 3, skipped 0, failed 0 | comments 18, files 32 | total done 171, cursor saved |  |
| 2026-11-11 05:54:56 | 58 | ok | done 3, skipped 0, failed 0 | comments 17, files 23 | total done 174, cursor saved |  |
| 2026-11-11 05:55:29 | 59 | ok | done 3, skipped 0, failed 0 | comments 11, files 22 | total done 180, cursor saved |  |
| 2026-11-11 05:55:42 | 60 | ok | done 3, skipped 0, failed 0 | comments 8, files 3 | total done 180, cursor saved |  |
| 2026-11-11 05:56:07 | 61 | ok | done 3, skipped 0, failed 0 | comments 15, files 16 | total done 183, cursor saved |  |
| 2026-11-11 05:57:07 | 62 | ok | done 3, skipped 0, failed 0 | comments 47, files 45 | total done 186, cursor saved |  |
| 2026-11-11 05:57:56 | 63 | ok | done 3, skipped 0, failed 0 | comments 28, files 36 | total done 189, cursor saved |  |
| 2026-11-11 05:58:33 | 64 | ok | done 3, skipped 0, failed 0 | comments 16, files 27 | total done 192, cursor saved |  |
| 2026-11-11 05:58:47 | 65 | ok | done 3, skipped 0, failed 0 | comments 9, files 5 | total done 195, cursor saved |  |
| 2026-11-11 05:59:36 | 66 | ok | done 3, skipped 0, failed 0 | comments 17, files 35 | total done 198, cursor saved |  |
| 2026-11-11 05:59:57 | 67 | ok | done 3, skipped 0, failed 0 | comments 17, files 9 | total done 201, cursor saved |  |
| 2026-11-11 06:00:07 | 68 | ok | done 3, skipped 0, failed 0 | comments 9, files 2 | total done 204, cursor saved |  |
| 2026-11-11 06:00:30 | 69 | ok | done 3, skipped 0, failed 0 | comments 10, files 8 | total done 207, cursor saved |  |
| 2026-11-11 06:00:51 | 70 | ok | done 3, skipped 0, failed 0 | comments 11, files 8 | total done 210, cursor saved |  |
| 2026-11-11 06:01:28 | 71 | ok | done 3, skipped 0, failed 0 | comments 24, files 18 | total done 210, cursor saved |  |
| 2026-11-11 06:03:04 | 72 | ok | done 3, skipped 0, failed 0 | comments 52, files 76 | total done 216, cursor saved |  |
| 2026-11-11 06:03:43 | 73 | ok | done 3, skipped 0, failed 0 | comments 17, files 25 | total done 219, cursor saved |  |
| 2026-11-11 06:04:03 | 74 | ok | done 3, skipped 0, failed 0 | comments 18, files 13 | total done 222, cursor saved |  |
| 2026-11-11 06:04:24 | 75 | ok | done 3, skipped 0, failed 0 | comments 32, files 12 | total done 225, cursor saved |  |
| 2026-11-11 06:05:04 | 76 | ok | done 3, skipped 0, failed 0 | comments 37, files 27 | total done 225, cursor saved |  |
| 2026-11-11 06:05:45 | 77 | ok | done 3, skipped 0, failed 0 | comments 31, files 27 | total done 231, cursor saved |  |
| 2026-11-11 06:06:25 | 78 | ok | done 3, skipped 0, failed 0 | comments 32, files 31 | total done 234, cursor saved |  |
| 2026-11-11 06:06:41 | 79 | ok | done 3, skipped 0, failed 0 | comments 14, files 7 | total done 237, cursor saved |  |
| 2026-11-11 06:06:56 | 80 | ok | done 3, skipped 0, failed 0 | comments 17, files 6 | total done 240, cursor saved |  |
| 2026-11-11 06:07:24 | 81 | ok | done 3, skipped 0, failed 0 | comments 15, files 18 | total done 243, cursor saved |  |
| 2026-11-11 06:07:41 | 82 | ok | done 3, skipped 0, failed 0 | comments 8, files 10 | total done 249, cursor saved |  |
| 2026-11-11 06:07:55 | 83 | ok | done 3, skipped 0, failed 0 | comments 5, files 6 | total done 249, cursor saved |  |
| 2026-11-11 06:08:18 | 84 | ok | done 3, skipped 0, failed 0 | comments 23, files 13 | total done 252, cursor saved |  |
| 2026-11-11 06:09:05 | 86 | ok | done 3, skipped 0, failed 0 | comments 22, files 19 | total done 261, cursor saved |  |
| 2026-11-11 06:09:18 | 87 | ok | done 3, skipped 0, failed 0 | comments 8, files 4 | total done 261, cursor saved |  |
| 2026-11-11 06:09:32 | 88 | ok | done 3, skipped 0, failed 0 | comments 19, files 6 | total done 264, cursor saved |  |
| 2026-11-11 06:09:49 | 89 | ok | done 3, skipped 0, failed 0 | comments 12, files 8 | total done 267, cursor saved |  |
| 2026-11-11 06:10:26 | 90 | ok | done 3, skipped 0, failed 0 | comments 25, files 23 | total done 270, cursor saved |  |
| 2026-11-11 06:10:33 | 91 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 273, cursor saved |  |
| 2026-11-11 06:10:53 | 92 | ok | done 3, skipped 0, failed 0 | comments 12, files 10 | total done 279, cursor saved |  |
| 2026-11-11 06:11:08 | 93 | ok | done 3, skipped 0, failed 0 | comments 9, files 6 | total done 279, cursor saved |  |
| 2026-11-11 06:11:37 | 94 | ok | done 3, skipped 0, failed 0 | comments 40, files 21 | total done 282, cursor saved |  |
| 2026-11-11 06:11:59 | 95 | ok | done 3, skipped 0, failed 0 | comments 34, files 14 | total done 285, cursor saved |  |
| 2026-11-11 06:12:33 | 96 | ok | done 3, skipped 0, failed 0 | comments 19, files 24 | total done 288, cursor saved |  |
| 2026-11-11 06:12:53 | 97 | ok | done 3, skipped 0, failed 0 | comments 6, files 11 | total done 291, cursor saved |  |
| 2026-11-11 06:13:15 | 98 | ok | done 3, skipped 0, failed 0 | comments 11, files 10 | total done 294, cursor saved |  |
| 2026-11-11 06:13:33 | 99 | ok | done 3, skipped 0, failed 0 | comments 23, files 9 | total done 297, cursor saved |  |
| 2026-11-11 06:13:45 | 100 | ok | done 3, skipped 0, failed 0 | comments 14, files 5 | total done 303, cursor saved |  |
| 2026-11-11 06:14:03 | 101 | ok | done 3, skipped 0, failed 0 | comments 13, files 9 | total done 303, cursor saved |  |
| 2026-11-11 06:14:32 | 102 | ok | done 3, skipped 0, failed 0 | comments 18, files 19 | total done 309, cursor saved |  |
| 2026-11-11 06:14:43 | 103 | ok | done 3, skipped 0, failed 0 | comments 13, files 4 | total done 309, cursor saved |  |
| 2026-11-11 06:15:00 | 104 | ok | done 3, skipped 0, failed 0 | comments 17, files 9 | total done 312, cursor saved |  |
| 2026-11-11 06:15:11 | 105 | ok | done 3, skipped 0, failed 0 | comments 15, files 3 | total done 318, cursor saved |  |
| 2026-11-11 06:15:23 | 106 | ok | done 3, skipped 0, failed 0 | comments 13, files 3 | total done 318, cursor saved |  |
| 2026-11-11 06:15:38 | 107 | ok | done 3, skipped 0, failed 0 | comments 12, files 5 | total done 324, cursor saved |  |
| 2026-11-11 06:15:52 | 108 | ok | done 3, skipped 0, failed 0 | comments 24, files 7 | total done 324, cursor saved |  |
| 2026-11-11 06:16:10 | 109 | ok | done 3, skipped 0, failed 0 | comments 18, files 8 | total done 327, cursor saved |  |
| 2026-11-11 06:16:27 | 110 | ok | done 3, skipped 0, failed 0 | comments 14, files 9 | total done 333, cursor saved |  |
| 2026-11-11 06:16:35 | 111 | ok | done 3, skipped 0, failed 0 | comments 10, files 1 | total done 333, cursor saved |  |
| 2026-11-11 06:16:50 | 112 | ok | done 3, skipped 0, failed 0 | comments 23, files 7 | total done 336, cursor saved |  |
| 2026-11-11 06:17:09 | 113 | ok | done 3, skipped 0, failed 0 | comments 13, files 5 | total done 339, cursor saved |  |
| 2026-11-11 06:17:20 | 114 | ok | done 3, skipped 0, failed 0 | comments 12, files 4 | total done 345, cursor saved |  |
| 2026-11-11 06:17:39 | 115 | ok | done 3, skipped 0, failed 0 | comments 15, files 10 | total done 345, cursor saved |  |
| 2026-11-11 06:17:51 | 116 | ok | done 3, skipped 0, failed 0 | comments 26, files 5 | total done 348, cursor saved |  |
| 2026-11-11 06:18:07 | 117 | ok | done 3, skipped 0, failed 0 | comments 13, files 6 | total done 354, cursor saved |  |
| 2026-11-11 06:18:21 | 118 | ok | done 3, skipped 0, failed 0 | comments 15, files 4 | total done 354, cursor saved |  |
| 2026-11-11 06:18:34 | 119 | ok | done 3, skipped 0, failed 0 | comments 12, files 3 | total done 360, cursor saved |  |
| 2026-11-11 06:18:44 | 120 | ok | done 3, skipped 0, failed 0 | comments 13, files 2 | total done 360, cursor saved |  |
| 2026-11-11 06:18:57 | 121 | ok | done 3, skipped 0, failed 0 | comments 8, files 5 | total done 363, cursor saved |  |
| 2026-11-11 06:19:29 | 122 | ok | done 3, skipped 0, failed 0 | comments 15, files 19 | total done 369, cursor saved |  |
| 2026-11-11 06:19:43 | 123 | ok | done 3, skipped 0, failed 0 | comments 19, files 5 | total done 369, cursor saved |  |
| 2026-11-11 06:19:53 | 124 | ok | done 3, skipped 0, failed 0 | comments 4, files 2 | total done 372, cursor saved |  |
| 2026-11-11 06:20:22 | 125 | ok | done 3, skipped 0, failed 0 | comments 11, files 16 | total done 378, cursor saved |  |
| 2026-11-11 06:20:31 | 126 | ok | done 3, skipped 0, failed 0 | comments 7, files 1 | total done 378, cursor saved |  |
| 2026-11-11 06:20:53 | 127 | ok | done 3, skipped 0, failed 0 | comments 15, files 11 | total done 381, cursor saved |  |
| 2026-11-11 06:21:04 | 128 | ok | done 3, skipped 0, failed 0 | comments 9, files 3 | total done 384, cursor saved |  |
| 2026-11-11 06:21:18 | 129 | ok | done 3, skipped 0, failed 0 | comments 21, files 3 | total done 390, cursor saved |  |
| 2026-11-11 06:21:35 | 130 | ok | done 3, skipped 0, failed 0 | comments 20, files 8 | total done 390, cursor saved |  |
| 2026-11-11 06:21:46 | 131 | ok | done 3, skipped 0, failed 0 | comments 8, files 3 | total done 393, cursor saved |  |
| 2026-11-11 06:22:00 | 132 | ok | done 3, skipped 0, failed 0 | comments 24, files 7 | total done 393, cursor saved |  |
| 2026-11-11 06:22:21 | 133 | ok | done 3, skipped 0, failed 0 | comments 36, files 11 | total done 396, cursor saved |  |
| 2026-11-11 06:22:32 | 134 | ok | done 3, skipped 0, failed 0 | comments 12, files 3 | total done 402, cursor saved |  |
| 2026-11-11 06:22:54 | 135 | ok | done 3, skipped 0, failed 0 | comments 24, files 11 | total done 405, cursor saved |  |
| 2026-11-11 06:23:06 | 136 | ok | done 3, skipped 0, failed 0 | comments 12, files 3 | total done 411, cursor saved |  |
| 2026-11-11 06:23:24 | 137 | ok | done 3, skipped 0, failed 0 | comments 12, files 9 | total done 411, cursor saved |  |
| 2026-11-11 06:23:31 | 138 | ok | done 3, skipped 0, failed 0 | comments 5, files 1 | total done 417, cursor saved |  |
| 2026-11-11 06:23:41 | 139 | ok | done 3, skipped 0, failed 0 | comments 6, files 2 | total done 417, cursor saved |  |
| 2026-11-11 06:23:52 | 140 | ok | done 3, skipped 0, failed 0 | comments 7, files 3 | total done 423, cursor saved |  |
| 2026-11-11 06:24:08 | 141 | ok | done 3, skipped 0, failed 0 | comments 9, files 4 | total done 423, cursor saved |  |
| 2026-11-11 06:24:38 | 142 | ok | done 3, skipped 0, failed 0 | comments 12, files 7 | total done 429, cursor saved |  |
| 2026-11-11 06:24:52 | 143 | ok | done 3, skipped 0, failed 0 | comments 7, files 5 | total done 429, cursor saved |  |
| 2026-11-11 06:25:21 UTC | watcher | | | | | The watcher's browser process ended after batch 144 (the sandbox closed its pipe; not an import error). The import had saved batch 144 (432 done, 0 failed) and its cursor. No batch failed, no ticket was half written. Resumed from the saved cursor. |
| 2026-11-11 06:29:48 UTC | older_open resumed from the saved cursor (watch line 2026-11-11 05:23:27.678975+00) | | | | | |
| 2026-11-11 05:23:56 | 1 | ok | done 3, skipped 0, failed 0 | comments 12, files 4 | total done 435, cursor saved |  |
| 2026-11-11 05:24:19 | 2 | ok | done 3, skipped 0, failed 0 | comments 43, files 13 | total done 435, cursor saved |  |
| 2026-11-11 05:28:28 | 3 | ok | done 3, skipped 0, failed 0 | comments 35, files 21 | total done 435, cursor saved |  |
| 2026-11-11 05:29:02 | 4 | ok | done 3, skipped 0, failed 0 | comments 35, files 20 | total done 435, cursor saved |  |
| 2026-11-11 05:29:25 | 5 | ok | done 3, skipped 0, failed 0 | comments 35, files 13 | total done 435, cursor saved |  |
| 2026-11-11 05:30:21 | 6 | ok | done 3, skipped 0, failed 0 | comments 38, files 40 | total done 435, cursor saved |  |
| 2026-11-11 05:30:44 | 7 | ok | done 3, skipped 0, failed 0 | comments 20, files 9 | total done 435, cursor saved |  |
| 2026-11-11 05:31:20 | 8 | ok | done 3, skipped 0, failed 0 | comments 12, files 13 | total done 435, cursor saved |  |
| 2026-11-11 05:31:50 | 9 | ok | done 3, skipped 0, failed 0 | comments 32, files 18 | total done 435, cursor saved |  |
| 2026-11-11 05:32:11 | 10 | ok | done 3, skipped 0, failed 0 | comments 20, files 10 | total done 435, cursor saved |  |
| 2026-11-11 05:32:34 | 11 | ok | done 3, skipped 0, failed 0 | comments 18, files 13 | total done 435, cursor saved |  |
| 2026-11-11 05:32:54 | 12 | ok | done 3, skipped 0, failed 0 | comments 13, files 11 | total done 435, cursor saved |  |
| 2026-11-11 05:33:10 | 13 | ok | done 3, skipped 0, failed 0 | comments 23, files 6 | total done 435, cursor saved |  |
| 2026-11-11 05:33:28 | 14 | ok | done 3, skipped 0, failed 0 | comments 24, files 9 | total done 435, cursor saved |  |
| 2026-11-11 05:33:45 | 15 | ok | done 3, skipped 0, failed 0 | comments 19, files 10 | total done 435, cursor saved |  |
| 2026-11-11 05:34:01 | 16 | ok | done 3, skipped 0, failed 0 | comments 12, files 8 | total done 435, cursor saved |  |
| 2026-11-11 05:34:16 | 17 | ok | done 3, skipped 0, failed 0 | comments 14, files 6 | total done 435, cursor saved |  |
| 2026-11-11 05:34:46 | 18 | ok | done 3, skipped 0, failed 0 | comments 23, files 19 | total done 435, cursor saved |  |
| 2026-11-11 05:35:15 | 19 | ok | done 3, skipped 0, failed 0 | comments 17, files 22 | total done 435, cursor saved |  |
| 2026-11-11 05:35:27 | 20 | ok | done 3, skipped 0, failed 0 | comments 17, files 4 | total done 435, cursor saved |  |
| 2026-11-11 05:35:48 | 21 | ok | done 3, skipped 0, failed 0 | comments 19, files 11 | total done 435, cursor saved |  |
| 2026-11-11 05:36:26 | 22 | ok | done 3, skipped 0, failed 0 | comments 26, files 23 | total done 435, cursor saved |  |
| 2026-11-11 05:36:53 | 23 | ok | done 3, skipped 0, failed 0 | comments 29, files 16 | total done 435, cursor saved |  |
| 2026-11-11 05:37:28 | 24 | ok | done 3, skipped 0, failed 0 | comments 26, files 17 | total done 435, cursor saved |  |
| 2026-11-11 05:38:00 | 25 | ok | done 3, skipped 0, failed 0 | comments 28, files 21 | total done 435, cursor saved |  |
| 2026-11-11 05:38:16 | 26 | ok | done 3, skipped 0, failed 0 | comments 16, files 7 | total done 435, cursor saved |  |
| 2026-11-11 05:39:17 | 27 | ok | done 3, skipped 0, failed 0 | comments 20, files 45 | total done 435, cursor saved |  |
| 2026-11-11 05:40:14 | 28 | ok | done 3, skipped 0, failed 0 | comments 36, files 40 | total done 435, cursor saved |  |
| 2026-11-11 05:41:00 | 29 | ok | done 3, skipped 0, failed 0 | comments 32, files 34 | total done 435, cursor saved |  |
| 2026-11-11 05:41:13 | 30 | ok | done 3, skipped 0, failed 0 | comments 17, files 4 | total done 435, cursor saved |  |
| 2026-11-11 05:41:28 | 31 | ok | done 3, skipped 0, failed 0 | comments 12, files 5 | total done 435, cursor saved |  |
| 2026-11-11 05:41:53 | 32 | ok | done 3, skipped 0, failed 0 | comments 28, files 16 | total done 435, cursor saved |  |
| 2026-11-11 05:42:18 | 33 | ok | done 3, skipped 0, failed 0 | comments 16, files 18 | total done 435, cursor saved |  |
| 2026-11-11 05:42:34 | 34 | ok | done 3, skipped 0, failed 0 | comments 16, files 7 | total done 435, cursor saved |  |
| 2026-11-11 05:43:26 | 35 | ok | done 3, skipped 0, failed 0 | comments 38, files 37 | total done 435, cursor saved |  |
| 2026-11-11 05:44:11 | 36 | ok | done 3, skipped 0, failed 0 | comments 24, files 25 | total done 435, cursor saved |  |
| 2026-11-11 05:44:54 | 37 | ok | done 3, skipped 0, failed 0 | comments 17, files 22 | total done 435, cursor saved |  |
| 2026-11-11 05:45:10 | 38 | ok | done 3, skipped 0, failed 0 | comments 23, files 6 | total done 435, cursor saved |  |
| 2026-11-11 05:46:07 | 39 | ok | done 3, skipped 0, failed 0 | comments 36, files 40 | total done 435, cursor saved |  |
| 2026-11-11 05:46:25 | 40 | ok | done 3, skipped 0, failed 0 | comments 10, files 10 | total done 435, cursor saved |  |
| 2026-11-11 05:46:46 | 41 | ok | done 3, skipped 0, failed 0 | comments 20, files 12 | total done 435, cursor saved |  |
| 2026-11-11 05:47:04 | 42 | ok | done 3, skipped 0, failed 0 | comments 16, files 9 | total done 435, cursor saved |  |
| 2026-11-11 05:47:23 | 43 | ok | done 3, skipped 0, failed 0 | comments 13, files 9 | total done 435, cursor saved |  |
| 2026-11-11 05:47:47 | 44 | ok | done 3, skipped 0, failed 0 | comments 12, files 13 | total done 435, cursor saved |  |
| 2026-11-11 05:48:08 | 45 | ok | done 3, skipped 0, failed 0 | comments 17, files 13 | total done 435, cursor saved |  |
| 2026-11-11 05:49:06 | 46 | ok | done 3, skipped 0, failed 0 | comments 25, files 47 | total done 435, cursor saved |  |
| 2026-11-11 05:49:22 | 47 | ok | done 3, skipped 0, failed 0 | comments 9, files 6 | total done 435, cursor saved |  |
| 2026-11-11 05:49:43 | 48 | ok | done 3, skipped 0, failed 0 | comments 15, files 11 | total done 435, cursor saved |  |
| 2026-11-11 05:50:21 | 49 | ok | done 3, skipped 0, failed 0 | comments 37, files 24 | total done 435, cursor saved |  |
| 2026-11-11 05:50:44 | 50 | ok | done 3, skipped 0, failed 0 | comments 21, files 13 | total done 435, cursor saved |  |
| 2026-11-11 05:51:02 | 51 | ok | done 3, skipped 0, failed 0 | comments 17, files 9 | total done 435, cursor saved |  |
| 2026-11-11 05:51:50 | 52 | ok | done 3, skipped 0, failed 0 | comments 21, files 36 | total done 435, cursor saved |  |
| 2026-11-11 05:52:12 | 53 | ok | done 3, skipped 0, failed 0 | comments 12, files 12 | total done 435, cursor saved |  |
| 2026-11-11 05:52:35 | 54 | ok | done 3, skipped 0, failed 0 | comments 13, files 14 | total done 435, cursor saved |  |
| 2026-11-11 05:53:00 | 55 | ok | done 3, skipped 0, failed 0 | comments 22, files 17 | total done 435, cursor saved |  |
| 2026-11-11 05:53:42 | 56 | ok | done 3, skipped 0, failed 0 | comments 19, files 31 | total done 435, cursor saved |  |
| 2026-11-11 05:54:25 | 57 | ok | done 3, skipped 0, failed 0 | comments 18, files 32 | total done 435, cursor saved |  |
| 2026-11-11 05:54:56 | 58 | ok | done 3, skipped 0, failed 0 | comments 17, files 23 | total done 435, cursor saved |  |
| 2026-11-11 05:55:29 | 59 | ok | done 3, skipped 0, failed 0 | comments 11, files 22 | total done 435, cursor saved |  |
| 2026-11-11 05:55:42 | 60 | ok | done 3, skipped 0, failed 0 | comments 8, files 3 | total done 435, cursor saved |  |
| 2026-11-11 05:56:07 | 61 | ok | done 3, skipped 0, failed 0 | comments 15, files 16 | total done 435, cursor saved |  |
| 2026-11-11 05:57:07 | 62 | ok | done 3, skipped 0, failed 0 | comments 47, files 45 | total done 435, cursor saved |  |
| 2026-11-11 05:57:56 | 63 | ok | done 3, skipped 0, failed 0 | comments 28, files 36 | total done 435, cursor saved |  |
| 2026-11-11 05:58:33 | 64 | ok | done 3, skipped 0, failed 0 | comments 16, files 27 | total done 435, cursor saved |  |
| 2026-11-11 05:58:47 | 65 | ok | done 3, skipped 0, failed 0 | comments 9, files 5 | total done 435, cursor saved |  |
| 2026-11-11 05:59:36 | 66 | ok | done 3, skipped 0, failed 0 | comments 17, files 35 | total done 435, cursor saved |  |
| 2026-11-11 05:59:57 | 67 | ok | done 3, skipped 0, failed 0 | comments 17, files 9 | total done 435, cursor saved |  |
| 2026-11-11 06:00:07 | 68 | ok | done 3, skipped 0, failed 0 | comments 9, files 2 | total done 435, cursor saved |  |
| 2026-11-11 06:00:30 | 69 | ok | done 3, skipped 0, failed 0 | comments 10, files 8 | total done 435, cursor saved |  |
| 2026-11-11 06:00:51 | 70 | ok | done 3, skipped 0, failed 0 | comments 11, files 8 | total done 435, cursor saved |  |
| 2026-11-11 06:01:28 | 71 | ok | done 3, skipped 0, failed 0 | comments 24, files 18 | total done 435, cursor saved |  |
| 2026-11-11 06:03:04 | 72 | ok | done 3, skipped 0, failed 0 | comments 52, files 76 | total done 435, cursor saved |  |
| 2026-11-11 06:03:43 | 73 | ok | done 3, skipped 0, failed 0 | comments 17, files 25 | total done 435, cursor saved |  |
| 2026-11-11 06:04:03 | 74 | ok | done 3, skipped 0, failed 0 | comments 18, files 13 | total done 435, cursor saved |  |
| 2026-11-11 06:04:24 | 75 | ok | done 3, skipped 0, failed 0 | comments 32, files 12 | total done 435, cursor saved |  |
| 2026-11-11 06:05:04 | 76 | ok | done 3, skipped 0, failed 0 | comments 37, files 27 | total done 435, cursor saved |  |
| 2026-11-11 06:05:45 | 77 | ok | done 3, skipped 0, failed 0 | comments 31, files 27 | total done 435, cursor saved |  |
| 2026-11-11 06:06:25 | 78 | ok | done 3, skipped 0, failed 0 | comments 32, files 31 | total done 435, cursor saved |  |
| 2026-11-11 06:06:41 | 79 | ok | done 3, skipped 0, failed 0 | comments 14, files 7 | total done 435, cursor saved |  |
| 2026-11-11 06:06:56 | 80 | ok | done 3, skipped 0, failed 0 | comments 17, files 6 | total done 435, cursor saved |  |
| 2026-11-11 06:07:24 | 81 | ok | done 3, skipped 0, failed 0 | comments 15, files 18 | total done 435, cursor saved |  |
| 2026-11-11 06:07:41 | 82 | ok | done 3, skipped 0, failed 0 | comments 8, files 10 | total done 435, cursor saved |  |
| 2026-11-11 06:07:55 | 83 | ok | done 3, skipped 0, failed 0 | comments 5, files 6 | total done 435, cursor saved |  |
| 2026-11-11 06:08:18 | 84 | ok | done 3, skipped 0, failed 0 | comments 23, files 13 | total done 435, cursor saved |  |
| 2026-11-11 06:08:34 | 85 | ok | done 3, skipped 0, failed 0 | comments 11, files 9 | total done 435, cursor saved |  |
| 2026-11-11 06:09:05 | 86 | ok | done 3, skipped 0, failed 0 | comments 22, files 19 | total done 435, cursor saved |  |
| 2026-11-11 06:09:18 | 87 | ok | done 3, skipped 0, failed 0 | comments 8, files 4 | total done 435, cursor saved |  |
| 2026-11-11 06:09:32 | 88 | ok | done 3, skipped 0, failed 0 | comments 19, files 6 | total done 435, cursor saved |  |
| 2026-11-11 06:09:49 | 89 | ok | done 3, skipped 0, failed 0 | comments 12, files 8 | total done 435, cursor saved |  |
| 2026-11-11 06:10:26 | 90 | ok | done 3, skipped 0, failed 0 | comments 25, files 23 | total done 435, cursor saved |  |
| 2026-11-11 06:10:33 | 91 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 435, cursor saved |  |
| 2026-11-11 06:10:53 | 92 | ok | done 3, skipped 0, failed 0 | comments 12, files 10 | total done 435, cursor saved |  |
| 2026-11-11 06:11:08 | 93 | ok | done 3, skipped 0, failed 0 | comments 9, files 6 | total done 435, cursor saved |  |
| 2026-11-11 06:11:37 | 94 | ok | done 3, skipped 0, failed 0 | comments 40, files 21 | total done 435, cursor saved |  |
| 2026-11-11 06:11:59 | 95 | ok | done 3, skipped 0, failed 0 | comments 34, files 14 | total done 435, cursor saved |  |
| 2026-11-11 06:12:33 | 96 | ok | done 3, skipped 0, failed 0 | comments 19, files 24 | total done 435, cursor saved |  |
| 2026-11-11 06:12:53 | 97 | ok | done 3, skipped 0, failed 0 | comments 6, files 11 | total done 435, cursor saved |  |
| 2026-11-11 06:13:15 | 98 | ok | done 3, skipped 0, failed 0 | comments 11, files 10 | total done 435, cursor saved |  |
| 2026-11-11 06:13:33 | 99 | ok | done 3, skipped 0, failed 0 | comments 23, files 9 | total done 435, cursor saved |  |
| 2026-11-11 06:13:45 | 100 | ok | done 3, skipped 0, failed 0 | comments 14, files 5 | total done 435, cursor saved |  |
| 2026-11-11 06:14:03 | 101 | ok | done 3, skipped 0, failed 0 | comments 13, files 9 | total done 435, cursor saved |  |
| 2026-11-11 06:14:32 | 102 | ok | done 3, skipped 0, failed 0 | comments 18, files 19 | total done 435, cursor saved |  |
| 2026-11-11 06:14:43 | 103 | ok | done 3, skipped 0, failed 0 | comments 13, files 4 | total done 435, cursor saved |  |
| 2026-11-11 06:15:00 | 104 | ok | done 3, skipped 0, failed 0 | comments 17, files 9 | total done 435, cursor saved |  |
| 2026-11-11 06:15:11 | 105 | ok | done 3, skipped 0, failed 0 | comments 15, files 3 | total done 435, cursor saved |  |
| 2026-11-11 06:15:23 | 106 | ok | done 3, skipped 0, failed 0 | comments 13, files 3 | total done 435, cursor saved |  |
| 2026-11-11 06:15:38 | 107 | ok | done 3, skipped 0, failed 0 | comments 12, files 5 | total done 435, cursor saved |  |
| 2026-11-11 06:15:52 | 108 | ok | done 3, skipped 0, failed 0 | comments 24, files 7 | total done 435, cursor saved |  |
| 2026-11-11 06:16:10 | 109 | ok | done 3, skipped 0, failed 0 | comments 18, files 8 | total done 435, cursor saved |  |
| 2026-11-11 06:16:27 | 110 | ok | done 3, skipped 0, failed 0 | comments 14, files 9 | total done 435, cursor saved |  |
| 2026-11-11 06:16:35 | 111 | ok | done 3, skipped 0, failed 0 | comments 10, files 1 | total done 435, cursor saved |  |
| 2026-11-11 06:16:50 | 112 | ok | done 3, skipped 0, failed 0 | comments 23, files 7 | total done 435, cursor saved |  |
| 2026-11-11 06:17:09 | 113 | ok | done 3, skipped 0, failed 0 | comments 13, files 5 | total done 435, cursor saved |  |
| 2026-11-11 06:17:20 | 114 | ok | done 3, skipped 0, failed 0 | comments 12, files 4 | total done 435, cursor saved |  |
| 2026-11-11 06:17:39 | 115 | ok | done 3, skipped 0, failed 0 | comments 15, files 10 | total done 435, cursor saved |  |
| 2026-11-11 06:17:51 | 116 | ok | done 3, skipped 0, failed 0 | comments 26, files 5 | total done 435, cursor saved |  |
| 2026-11-11 06:18:07 | 117 | ok | done 3, skipped 0, failed 0 | comments 13, files 6 | total done 435, cursor saved |  |
| 2026-11-11 06:18:21 | 118 | ok | done 3, skipped 0, failed 0 | comments 15, files 4 | total done 435, cursor saved |  |
| 2026-11-11 06:18:34 | 119 | ok | done 3, skipped 0, failed 0 | comments 12, files 3 | total done 435, cursor saved |  |
| 2026-11-11 06:18:44 | 120 | ok | done 3, skipped 0, failed 0 | comments 13, files 2 | total done 435, cursor saved |  |
| 2026-11-11 06:18:57 | 121 | ok | done 3, skipped 0, failed 0 | comments 8, files 5 | total done 435, cursor saved |  |
| 2026-11-11 06:19:29 | 122 | ok | done 3, skipped 0, failed 0 | comments 15, files 19 | total done 435, cursor saved |  |
| 2026-11-11 06:19:43 | 123 | ok | done 3, skipped 0, failed 0 | comments 19, files 5 | total done 435, cursor saved |  |
| 2026-11-11 06:19:53 | 124 | ok | done 3, skipped 0, failed 0 | comments 4, files 2 | total done 435, cursor saved |  |
| 2026-11-11 06:20:22 | 125 | ok | done 3, skipped 0, failed 0 | comments 11, files 16 | total done 435, cursor saved |  |
| 2026-11-11 06:20:31 | 126 | ok | done 3, skipped 0, failed 0 | comments 7, files 1 | total done 435, cursor saved |  |
| 2026-11-11 06:20:53 | 127 | ok | done 3, skipped 0, failed 0 | comments 15, files 11 | total done 435, cursor saved |  |
| 2026-11-11 06:21:04 | 128 | ok | done 3, skipped 0, failed 0 | comments 9, files 3 | total done 435, cursor saved |  |
| 2026-11-11 06:21:18 | 129 | ok | done 3, skipped 0, failed 0 | comments 21, files 3 | total done 435, cursor saved |  |
| 2026-11-11 06:21:35 | 130 | ok | done 3, skipped 0, failed 0 | comments 20, files 8 | total done 435, cursor saved |  |
| 2026-11-11 06:21:46 | 131 | ok | done 3, skipped 0, failed 0 | comments 8, files 3 | total done 435, cursor saved |  |
| 2026-11-11 06:22:00 | 132 | ok | done 3, skipped 0, failed 0 | comments 24, files 7 | total done 435, cursor saved |  |
| 2026-11-11 06:22:21 | 133 | ok | done 3, skipped 0, failed 0 | comments 36, files 11 | total done 435, cursor saved |  |
| 2026-11-11 06:22:32 | 134 | ok | done 3, skipped 0, failed 0 | comments 12, files 3 | total done 435, cursor saved |  |
| 2026-11-11 06:22:54 | 135 | ok | done 3, skipped 0, failed 0 | comments 24, files 11 | total done 435, cursor saved |  |
| 2026-11-11 06:23:06 | 136 | ok | done 3, skipped 0, failed 0 | comments 12, files 3 | total done 435, cursor saved |  |
| 2026-11-11 06:23:24 | 137 | ok | done 3, skipped 0, failed 0 | comments 12, files 9 | total done 435, cursor saved |  |
| 2026-11-11 06:23:31 | 138 | ok | done 3, skipped 0, failed 0 | comments 5, files 1 | total done 435, cursor saved |  |
| 2026-11-11 06:23:41 | 139 | ok | done 3, skipped 0, failed 0 | comments 6, files 2 | total done 435, cursor saved |  |
| 2026-11-11 06:23:52 | 140 | ok | done 3, skipped 0, failed 0 | comments 7, files 3 | total done 435, cursor saved |  |
| 2026-11-11 06:24:08 | 141 | ok | done 3, skipped 0, failed 0 | comments 9, files 4 | total done 435, cursor saved |  |
| 2026-11-11 06:24:38 | 142 | ok | done 3, skipped 0, failed 0 | comments 12, files 7 | total done 435, cursor saved |  |
| 2026-11-11 06:24:52 | 143 | ok | done 3, skipped 0, failed 0 | comments 7, files 5 | total done 435, cursor saved |  |
| 2026-11-11 06:25:21 | 144 | ok | done 3, skipped 0, failed 0 | comments 13, files 19 | total done 435, cursor saved |  |
| 2026-11-11 06:29:56 | 145 | ok | done 3, skipped 0, failed 0 | comments 5, files 1 | total done 435, cursor saved |  |
| 2026-11-11 06:30:04 | 146 | ok | done 3, skipped 0, failed 0 | comments 7, files 1 | total done 435, cursor saved |  |
| 2026-11-11 06:30:16 | 147 | ok | done 3, skipped 0, failed 0 | comments 20, files 3 | total done 444, cursor saved |  |
| 2026-11-11 06:30:25 | 148 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 444, cursor saved |  |
| 2026-11-11 06:30:44 | 149 | ok | done 3, skipped 0, failed 0 | comments 17, files 7 | total done 447, cursor saved |  |
| 2026-11-11 06:30:56 | 150 | ok | done 3, skipped 0, failed 0 | comments 15, files 3 | total done 453, cursor saved |  |
| 2026-11-11 06:31:05 | 151 | ok | done 3, skipped 0, failed 0 | comments 10, files 3 | total done 453, cursor saved |  |
| 2026-11-11 06:31:16 | 152 | ok | done 3, skipped 0, failed 0 | comments 10, files 2 | total done 456, cursor saved |  |
| 2026-11-11 06:31:36 | 153 | ok | done 3, skipped 0, failed 0 | comments 17, files 8 | total done 459, cursor saved |  |
| 2026-11-11 06:31:54 | 154 | ok | done 3, skipped 0, failed 0 | comments 7, files 9 | total done 465, cursor saved |  |
| 2026-11-11 06:32:06 | 155 | ok | done 3, skipped 0, failed 0 | comments 12, files 3 | total done 465, cursor saved |  |
| 2026-11-11 06:32:34 | 156 | ok | done 3, skipped 0, failed 0 | comments 15, files 16 | total done 468, cursor saved |  |
| 2026-11-11 06:33:06 | 157 | ok | done 3, skipped 0, failed 0 | comments 20, files 20 | total done 471, cursor saved |  |
| 2026-11-11 06:33:23 | 158 | ok | done 3, skipped 0, failed 0 | comments 10, files 8 | total done 474, cursor saved |  |
| 2026-11-11 06:33:52 | 159 | ok | done 3, skipped 0, failed 0 | comments 24, files 18 | total done 477, cursor saved |  |
| 2026-11-11 06:34:05 | 160 | ok | done 3, skipped 0, failed 0 | comments 16, files 6 | total done 483, cursor saved |  |
| 2026-11-11 06:34:15 | 161 | ok | done 3, skipped 0, failed 0 | comments 21, files 2 | total done 483, cursor saved |  |
| 2026-11-11 06:34:26 | 162 | ok | done 3, skipped 0, failed 0 | comments 11, files 4 | total done 489, cursor saved |  |
| 2026-11-11 06:34:38 | 163 | ok | done 3, skipped 0, failed 0 | comments 12, files 4 | total done 489, cursor saved |  |
| 2026-11-11 06:34:48 | 164 | ok | done 3, skipped 0, failed 0 | comments 7, files 3 | total done 495, cursor saved |  |
| 2026-11-11 06:35:01 | 165 | ok | done 3, skipped 0, failed 0 | comments 15, files 6 | total done 495, cursor saved |  |
| 2026-11-11 06:35:15 | 166 | ok | done 3, skipped 0, failed 0 | comments 11, files 5 | total done 501, cursor saved |  |
| 2026-11-11 06:35:24 | 167 | ok | done 3, skipped 0, failed 0 | comments 7, files 2 | total done 501, cursor saved |  |
| 2026-11-11 06:35:36 | 168 | ok | done 3, skipped 0, failed 0 | comments 6, files 3 | total done 504, cursor saved |  |
| 2026-11-11 06:36:03 | 169 | ok | done 3, skipped 0, failed 0 | comments 15, files 18 | total done 507, cursor saved |  |
| 2026-11-11 06:36:12 | 170 | ok | done 3, skipped 0, failed 0 | comments 18, files 2 | total done 510, cursor saved |  |
| 2026-11-11 06:36:34 | 171 | ok | done 3, skipped 0, failed 0 | comments 25, files 13 | total done 513, cursor saved |  |
| 2026-11-11 06:36:56 | 172 | ok | done 3, skipped 0, failed 0 | comments 9, files 10 | total done 516, cursor saved |  |
| 2026-11-11 06:37:19 | 173 | ok | done 3, skipped 0, failed 0 | comments 8, files 13 | total done 522, cursor saved |  |
| 2026-11-11 06:37:32 | 174 | ok | done 3, skipped 0, failed 0 | comments 18, files 6 | total done 522, cursor saved |  |
| 2026-11-11 06:37:43 | 175 | ok | done 3, skipped 0, failed 0 | comments 6, files 3 | total done 528, cursor saved |  |
| 2026-11-11 06:37:52 | 176 | ok | done 3, skipped 0, failed 0 | comments 6, files 2 | total done 528, cursor saved |  |
| 2026-11-11 06:38:05 | 177 | ok | done 3, skipped 0, failed 0 | comments 11, files 4 | total done 534, cursor saved |  |
| 2026-11-11 06:38:16 | 178 | ok | done 3, skipped 0, failed 0 | comments 9, files 2 | total done 534, cursor saved |  |
| 2026-11-11 06:38:27 | 179 | ok | done 3, skipped 0, failed 0 | comments 11, files 3 | total done 540, cursor saved |  |
| 2026-11-11 06:38:35 | 180 | ok | done 3, skipped 0, failed 0 | comments 16, files 1 | total done 540, cursor saved |  |
| 2026-11-11 06:38:47 | 181 | ok | done 3, skipped 0, failed 0 | comments 7, files 5 | total done 546, cursor saved |  |
| 2026-11-11 06:38:57 | 182 | ok | done 3, skipped 0, failed 0 | comments 10, files 2 | total done 546, cursor saved |  |
| 2026-11-11 06:39:15 | 183 | ok | done 3, skipped 0, failed 0 | comments 47, files 8 | total done 549, cursor saved |  |
| 2026-11-11 06:39:30 | 184 | ok | done 3, skipped 0, failed 0 | comments 36, files 8 | total done 552, cursor saved |  |
| 2026-11-11 06:39:48 | 185 | ok | done 3, skipped 0, failed 0 | comments 19, files 11 | total done 558, cursor saved |  |
| 2026-11-11 06:40:04 | 186 | ok | done 3, skipped 0, failed 0 | comments 11, files 6 | total done 558, cursor saved |  |
| 2026-11-11 06:40:18 | 187 | ok | done 3, skipped 0, failed 0 | comments 15, files 4 | total done 561, cursor saved |  |
| 2026-11-11 06:41:42 | 188 | ok | done 3, skipped 0, failed 0 | comments 28, files 49 | total done 567, cursor saved |  |
| 2026-11-11 06:41:52 | 189 | ok | done 3, skipped 0, failed 0 | comments 11, files 2 | total done 567, cursor saved |  |
| 2026-11-11 06:42:06 | 190 | ok | done 3, skipped 0, failed 0 | comments 18, files 5 | total done 570, cursor saved |  |
| 2026-11-11 06:42:21 | 191 | ok | done 3, skipped 0, failed 0 | comments 10, files 5 | total done 576, cursor saved |  |
| 2026-11-11 06:42:32 | 192 | ok | done 3, skipped 0, failed 0 | comments 11, files 2 | total done 576, cursor saved |  |
| 2026-11-11 06:42:43 | 193 | ok | done 3, skipped 0, failed 0 | comments 13, files 4 | total done 584, cursor saved |  |
| 2026-11-11 06:42:55 | 194 | ok | done 3, skipped 0, failed 0 | comments 12, files 5 | total done 584, cursor saved |  |
| 2026-11-11 06:43:01 | 195 | ok | done 2, skipped 1, failed 0 | comments 5, files 0 | total done 584, cursor saved |  |
| 2026-11-11 06:43:16 | 196 | ok | done 1, skipped 2, failed 0 | comments 5, files 5 | total done 585, cursor saved |  |
| 2026-11-11 06:43:27 | 197 | ok | done 2, skipped 1, failed 0 | comments 4, files 3 | total done 595, cursor end |  |
| 2026-11-11 06:43:33 | 198 | ok | done 2, skipped 1, failed 0 | comments 1, files 0 | total done 595, cursor end |  |
| 2026-11-11 06:43:41 | 199 | ok | done 3, skipped 0, failed 0 | comments 8, files 2 | total done 595, cursor end |  |
| 2026-11-11 06:43:46 | 200 | completed | done 3, skipped 0, failed 0 | comments 0, files 0 | total done 595, cursor end |  |
| 2026-11-11 06:43:53 UTC | older_open done | job done after 200 batches | progress {"done": 595, "bytes": 536777224, "files": 2313, "failed": 0, "skipped": 5, "comments": 3405} | | cursor none |  |

### Phase A check (older open), Nov 11 06:47 UTC
- Run finished 06:43:53 UTC, 200 batches: 595 imported, 5 skipped (the 5 already imported tickets 1437, 1438, 1439, 1440, 1458, kept exactly as they were), 0 failed, 0 files on the failed list. 600 read = Notion's 600.
- Copied: 3,405 comments, 2,313 files (537 MB).
- Resolve now: 685 imported tickets (90 + 595), 0 duplicates, 0 imported tickets with a clock.
- Claims on the 595 new tickets: 554 claims, all Closed, damages $93,598.21, paid back $83,810.63. Notion reread for the same 595: 554, $93,598.21, $83,810.63. Exact match.
- No home: 16 held as Needs a home plus 6 with a blank Notion created date and no home, held as older by the existing blank date rule (refs 2646, 2649, 2650, 2651, 2652, 2653); 22 in all, under the 24 expected. All 22 show on the Needs a home tab.
- Protected rows unchanged: the 90 first run tickets (fingerprint same), the 2 live tickets, the 36 existing claims. The 90 got no new comments.
- Created by the run: 0 staff notifications, 0 owner notifications, 0 emails, 0 timed alerts, 0 escalations, 0 owner contact alerts, 0 owner alert log rows (no rows at all in these tables since the start line).
- Screens: Team Queue Team A 0, Team B 0, All teams 0, All unclaimed 0 (unchanged; imported group collapsed, Quiet). Money we could still lose $3,927.02 (unchanged, 36 claims). Databases tabs: All 685, Recent 94, Older open 600, Closed history 0, Needs a home 31, Claims history 590. (Tabs overlap by design: Recent counts open tickets by their original date, so 9 older open tickets with a blank Notion created date and a recent page also show on Recent; Needs a home counts any ticket with no home.)

### Phase B batches (closed history, newest closed first)
| At (UTC) | Batch | Result | Tickets | Comments, files | Progress | Note |
|---|---|---|---|---|---|---|
| 2026-11-11 06:48:42 UTC | closed started (watch line 2026-11-11 06:48:30.562601+00) | | | | | |
| 2026-11-11 06:49:06 UTC | watcher | | | | | Watcher paused by me after batch 1 to correct its own stop limits for this phase (it counted Phase A tickets toward the Phase B limits, which would only have stopped the run early). Batch 1 finished and saved (2 done, 1 skipped, 0 failed). Limits now: new imported tickets at most 2,823 in all (595 + 2,228) and Needs a home at most 149 in all (16 + 133). Resumed from the saved cursor. |
| 2026-11-11 06:52:26 UTC | closed resumed from the saved cursor (watch line 2026-11-11 06:48:30.562601+00) | | | | | |
| 2026-11-11 06:49:06 | 1 | ok | done 2, skipped 1, failed 0 | comments 10, files 8 | total done 5, cursor saved |  |
| 2026-11-11 06:52:39 | 2 | ok | done 3, skipped 0, failed 0 | comments 10, files 2 | total done 5, cursor saved |  |
| 2026-11-11 06:52:46 | 3 | ok | done 2, skipped 1, failed 0 | comments 6, files 1 | total done 10, cursor saved |  |
| 2026-11-11 06:52:51 | 4 | ok | done 0, skipped 3, failed 0 | comments 4, files 0 | total done 10, cursor saved |  |
| 2026-11-11 06:52:57 | 5 | ok | done 3, skipped 0, failed 0 | comments 6, files 0 | total done 10, cursor saved |  |
| 2026-11-11 06:53:06 | 6 | ok | done 3, skipped 0, failed 0 | comments 10, files 1 | total done 16, cursor saved |  |
| 2026-11-11 06:53:18 | 7 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 16, cursor saved |  |
| 2026-11-11 06:53:46 | 8 | ok | done 3, skipped 0, failed 0 | comments 6, files 10 | total done 19, cursor saved |  |
| 2026-11-11 06:54:00 | 9 | ok | done 3, skipped 0, failed 0 | comments 12, files 5 | total done 22, cursor saved |  |
| 2026-11-11 06:54:28 | 10 | ok | done 3, skipped 0, failed 0 | comments 18, files 15 | total done 25, cursor saved |  |
| 2026-11-11 06:54:38 | 11 | ok | done 3, skipped 0, failed 0 | comments 9, files 2 | total done 28, cursor saved |  |
| 2026-11-11 06:54:55 | 12 | ok | done 3, skipped 0, failed 0 | comments 14, files 7 | total done 34, cursor saved |  |
| 2026-11-11 06:55:06 | 13 | ok | done 3, skipped 0, failed 0 | comments 12, files 3 | total done 34, cursor saved |  |
| 2026-11-11 06:55:13 | 14 | ok | done 2, skipped 1, failed 0 | comments 7, files 0 | total done 34, cursor saved |  |
| 2026-11-11 06:55:24 | 15 | ok | done 3, skipped 0, failed 0 | comments 7, files 2 | total done 39, cursor saved |  |
| 2026-11-11 06:55:41 | 16 | ok | done 3, skipped 0, failed 0 | comments 14, files 8 | total done 45, cursor saved |  |
| 2026-11-11 06:55:50 | 17 | ok | done 3, skipped 0, failed 0 | comments 6, files 2 | total done 45, cursor saved |  |
| 2026-11-11 06:56:03 | 18 | ok | done 3, skipped 0, failed 0 | comments 10, files 4 | total done 51, cursor saved |  |
| 2026-11-11 06:56:12 | 19 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 51, cursor saved |  |
| 2026-11-11 06:56:18 | 20 | ok | done 3, skipped 0, failed 0 | comments 9, files 0 | total done 57, cursor saved |  |
| 2026-11-11 06:56:34 | 21 | ok | done 3, skipped 0, failed 0 | comments 4, files 4 | total done 57, cursor saved |  |
| 2026-11-11 06:56:43 | 22 | ok | done 3, skipped 0, failed 0 | comments 16, files 1 | total done 63, cursor saved |  |
| 2026-11-11 06:56:50 | 23 | ok | done 3, skipped 0, failed 0 | comments 10, files 1 | total done 63, cursor saved |  |
| 2026-11-11 06:57:00 | 24 | ok | done 3, skipped 0, failed 0 | comments 16, files 3 | total done 63, cursor saved |  |
| 2026-11-11 06:57:06 | 25 | ok | done 3, skipped 0, failed 0 | comments 5, files 0 | total done 69, cursor saved |  |
| 2026-11-11 06:57:23 | 26 | ok | done 3, skipped 0, failed 0 | comments 9, files 7 | total done 75, cursor saved |  |
| 2026-11-11 06:57:34 | 27 | ok | done 3, skipped 0, failed 0 | comments 7, files 3 | total done 75, cursor saved |  |
| 2026-11-11 06:57:51 | 28 | ok | done 3, skipped 0, failed 0 | comments 17, files 3 | total done 81, cursor saved |  |
| 2026-11-11 06:57:58 | 29 | ok | done 3, skipped 0, failed 0 | comments 12, files 1 | total done 81, cursor saved |  |
| 2026-11-11 06:58:04 | 30 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 81, cursor saved |  |
| 2026-11-11 06:58:13 | 31 | ok | done 3, skipped 0, failed 0 | comments 6, files 1 | total done 87, cursor saved |  |
| 2026-11-11 06:58:27 | 32 | ok | done 3, skipped 0, failed 0 | comments 13, files 4 | total done 96, cursor saved |  |
| 2026-11-11 06:58:37 | 33 | ok | done 3, skipped 0, failed 0 | comments 13, files 3 | total done 96, cursor saved |  |
| 2026-11-11 06:58:43 | 34 | ok | done 3, skipped 0, failed 0 | comments 6, files 0 | total done 96, cursor saved |  |
| 2026-11-11 06:58:50 | 35 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 105, cursor saved |  |
| 2026-11-11 06:58:55 | 36 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 105, cursor saved |  |
| 2026-11-11 06:59:04 | 37 | ok | done 3, skipped 0, failed 0 | comments 10, files 2 | total done 105, cursor saved |  |
| 2026-11-11 06:59:22 | 38 | ok | done 3, skipped 0, failed 0 | comments 14, files 8 | total done 108, cursor saved |  |
| 2026-11-11 06:59:41 | 39 | ok | done 3, skipped 0, failed 0 | comments 20, files 10 | total done 114, cursor saved |  |
| 2026-11-11 06:59:47 | 40 | ok | done 3, skipped 0, failed 0 | comments 12, files 0 | total done 114, cursor saved |  |
| 2026-11-11 06:59:53 | 41 | ok | done 3, skipped 0, failed 0 | comments 5, files 0 | total done 123, cursor saved |  |
| 2026-11-11 06:59:59 | 42 | ok | done 3, skipped 0, failed 0 | comments 5, files 0 | total done 123, cursor saved |  |
| 2026-11-11 07:00:11 | 43 | ok | done 3, skipped 0, failed 0 | comments 20, files 2 | total done 123, cursor saved |  |
| 2026-11-11 07:00:26 | 44 | ok | done 3, skipped 0, failed 0 | comments 11, files 2 | total done 126, cursor saved |  |
| 2026-11-11 07:00:41 | 45 | ok | done 3, skipped 0, failed 0 | comments 19, files 5 | total done 135, cursor saved |  |
| 2026-11-11 07:00:48 | 46 | ok | done 3, skipped 0, failed 0 | comments 11, files 0 | total done 135, cursor saved |  |
| 2026-11-11 07:00:55 | 47 | ok | done 3, skipped 0, failed 0 | comments 9, files 0 | total done 135, cursor saved |  |
| 2026-11-11 07:01:13 | 48 | ok | done 3, skipped 0, failed 0 | comments 15, files 7 | total done 138, cursor saved |  |
| 2026-11-11 07:01:22 | 49 | ok | done 3, skipped 0, failed 0 | comments 14, files 1 | total done 144, cursor saved |  |
| 2026-11-11 07:01:31 | 50 | ok | done 3, skipped 0, failed 0 | comments 12, files 1 | total done 144, cursor saved |  |
| 2026-11-11 07:01:42 | 51 | ok | done 3, skipped 0, failed 0 | comments 16, files 3 | total done 150, cursor saved |  |
| 2026-11-11 07:01:48 | 52 | ok | done 3, skipped 0, failed 0 | comments 11, files 0 | total done 150, cursor saved |  |
| 2026-11-11 07:02:05 | 53 | ok | done 3, skipped 0, failed 0 | comments 5, files 0 | total done 159, cursor saved |  |
| 2026-11-11 07:02:11 | 54 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 159, cursor saved |  |
| 2026-11-11 07:02:20 | 55 | ok | done 3, skipped 0, failed 0 | comments 19, files 0 | total done 159, cursor saved |  |
| 2026-11-11 07:02:27 | 56 | ok | done 3, skipped 0, failed 0 | comments 6, files 0 | total done 165, cursor saved |  |
| 2026-11-11 07:02:35 | 57 | ok | done 3, skipped 0, failed 0 | comments 14, files 1 | total done 165, cursor saved |  |
| 2026-11-11 07:02:49 | 58 | ok | done 3, skipped 0, failed 0 | comments 26, files 2 | total done 171, cursor saved |  |
| 2026-11-11 07:02:56 | 59 | ok | done 3, skipped 0, failed 0 | comments 8, files 1 | total done 171, cursor saved |  |
| 2026-11-11 07:03:09 | 60 | ok | done 3, skipped 0, failed 0 | comments 12, files 3 | total done 180, cursor saved |  |
| 2026-11-11 07:03:16 | 61 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 180, cursor saved |  |
| 2026-11-11 07:03:23 | 62 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 180, cursor saved |  |
| 2026-11-11 07:03:31 | 63 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 186, cursor saved |  |
| 2026-11-11 07:03:45 | 64 | ok | done 3, skipped 0, failed 0 | comments 16, files 2 | total done 186, cursor saved |  |
| 2026-11-11 07:03:51 | 65 | ok | done 3, skipped 0, failed 0 | comments 6, files 0 | total done 195, cursor saved |  |
| 2026-11-11 07:03:59 | 66 | ok | done 3, skipped 0, failed 0 | comments 5, files 0 | total done 195, cursor saved |  |
| 2026-11-11 07:04:08 | 67 | ok | done 3, skipped 0, failed 0 | comments 13, files 0 | total done 195, cursor saved |  |
| 2026-11-11 07:04:30 | 68 | ok | done 3, skipped 0, failed 0 | comments 20, files 4 | total done 198, cursor saved |  |
| 2026-11-11 07:04:38 | 69 | ok | done 3, skipped 0, failed 0 | comments 6, files 0 | total done 204, cursor saved |  |
| 2026-11-11 07:04:44 | 70 | ok | done 3, skipped 0, failed 0 | comments 9, files 0 | total done 204, cursor saved |  |
| 2026-11-11 07:05:05 | 71 | ok | done 3, skipped 0, failed 0 | comments 22, files 9 | total done 210, cursor saved |  |
| 2026-11-11 07:05:17 | 72 | ok | done 3, skipped 0, failed 0 | comments 7, files 3 | total done 210, cursor saved |  |
| 2026-11-11 07:05:23 | 73 | ok | done 3, skipped 0, failed 0 | comments 15, files 0 | total done 219, cursor saved |  |
| 2026-11-11 07:05:30 | 74 | ok | done 3, skipped 0, failed 0 | comments 9, files 0 | total done 219, cursor saved |  |
| 2026-11-11 07:05:41 | 75 | ok | done 3, skipped 0, failed 0 | comments 14, files 3 | total done 219, cursor saved |  |
| 2026-11-11 07:05:57 | 76 | ok | done 3, skipped 0, failed 0 | comments 9, files 2 | total done 222, cursor saved |  |
| 2026-11-11 07:06:09 | 77 | ok | done 3, skipped 0, failed 0 | comments 9, files 3 | total done 228, cursor saved |  |
| 2026-11-11 07:06:17 | 78 | ok | done 3, skipped 0, failed 0 | comments 8, files 1 | total done 228, cursor saved |  |
| 2026-11-11 07:06:24 | 79 | ok | done 3, skipped 0, failed 0 | comments 14, files 0 | total done 228, cursor saved |  |
| 2026-11-11 07:06:30 | 80 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 240, cursor saved |  |
| 2026-11-11 07:06:38 | 81 | ok | done 3, skipped 0, failed 0 | comments 8, files 1 | total done 240, cursor saved |  |
| 2026-11-11 07:06:44 | 82 | ok | done 3, skipped 0, failed 0 | comments 5, files 0 | total done 240, cursor saved |  |
| 2026-11-11 07:06:53 | 83 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 246, cursor saved |  |
| 2026-11-11 07:07:04 | 84 | ok | done 3, skipped 0, failed 0 | comments 9, files 2 | total done 246, cursor saved |  |
| 2026-11-11 07:07:12 | 85 | ok | done 3, skipped 0, failed 0 | comments 6, files 1 | total done 249, cursor saved |  |
| 2026-11-11 07:07:36 | 86 | ok | done 3, skipped 0, failed 0 | comments 15, files 11 | total done 252, cursor saved |  |
| 2026-11-11 07:07:52 | 87 | ok | done 3, skipped 0, failed 0 | comments 11, files 7 | total done 258, cursor saved |  |
| 2026-11-11 07:07:58 | 88 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 258, cursor saved |  |
| 2026-11-11 07:08:20 | 89 | ok | done 3, skipped 0, failed 0 | comments 33, files 14 | total done 264, cursor saved |  |
| 2026-11-11 07:08:33 | 90 | ok | done 3, skipped 0, failed 0 | comments 10, files 4 | total done 264, cursor saved |  |
| 2026-11-11 07:08:45 | 91 | ok | done 3, skipped 0, failed 0 | comments 11, files 4 | total done 270, cursor saved |  |
| 2026-11-11 07:08:53 | 92 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 270, cursor saved |  |
| 2026-11-11 07:09:06 | 93 | ok | done 3, skipped 0, failed 0 | comments 23, files 6 | total done 276, cursor saved |  |
| 2026-11-11 07:09:14 | 94 | ok | done 3, skipped 0, failed 0 | comments 6, files 0 | total done 276, cursor saved |  |
| 2026-11-11 07:09:23 | 95 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 282, cursor saved |  |
| 2026-11-11 07:09:32 | 96 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 282, cursor saved |  |
| 2026-11-11 07:09:39 | 97 | ok | done 3, skipped 0, failed 0 | comments 15, files 0 | total done 282, cursor saved |  |
| 2026-11-11 07:09:48 | 98 | ok | done 3, skipped 0, failed 0 | comments 12, files 1 | total done 291, cursor saved |  |
| 2026-11-11 07:09:58 | 99 | ok | done 3, skipped 0, failed 0 | comments 14, files 3 | total done 291, cursor saved |  |
| 2026-11-11 07:10:05 | 100 | ok | done 3, skipped 0, failed 0 | comments 6, files 0 | total done 300, cursor saved |  |
| 2026-11-11 07:10:14 | 101 | ok | done 3, skipped 0, failed 0 | comments 10, files 1 | total done 300, cursor saved |  |
| 2026-11-11 07:10:21 | 102 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 300, cursor saved |  |
| 2026-11-11 07:10:34 | 103 | ok | done 3, skipped 0, failed 0 | comments 16, files 4 | total done 306, cursor saved |  |
| 2026-11-11 07:10:42 | 104 | ok | done 3, skipped 0, failed 0 | comments 13, files 1 | total done 306, cursor saved |  |
| 2026-11-11 07:10:51 | 105 | ok | done 3, skipped 0, failed 0 | comments 11, files 1 | total done 309, cursor saved |  |
| 2026-11-11 07:11:41 | 106 | ok | done 3, skipped 0, failed 0 | comments 31, files 34 | total done 312, cursor saved |  |
| 2026-11-11 07:11:57 | 107 | ok | done 3, skipped 0, failed 0 | comments 11, files 5 | total done 318, cursor saved |  |
| 2026-11-11 07:12:03 | 108 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 318, cursor saved |  |
| 2026-11-11 07:12:27 | 109 | ok | done 3, skipped 0, failed 0 | comments 33, files 8 | total done 321, cursor saved |  |
| 2026-11-11 07:12:35 | 110 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 327, cursor saved |  |
| 2026-11-11 07:12:45 | 111 | ok | done 3, skipped 0, failed 0 | comments 14, files 2 | total done 327, cursor saved |  |
| 2026-11-11 07:12:58 | 112 | ok | done 3, skipped 0, failed 0 | comments 10, files 5 | total done 336, cursor saved |  |
| 2026-11-11 07:13:04 | 113 | ok | done 3, skipped 0, failed 0 | comments 14, files 0 | total done 336, cursor saved |  |
| 2026-11-11 07:13:13 | 114 | ok | done 3, skipped 0, failed 0 | comments 7, files 2 | total done 336, cursor saved |  |
| 2026-11-11 07:13:20 | 115 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 342, cursor saved |  |
| 2026-11-11 07:13:31 | 116 | ok | done 3, skipped 0, failed 0 | comments 25, files 3 | total done 342, cursor saved |  |
| 2026-11-11 07:13:39 | 117 | ok | done 3, skipped 0, failed 0 | comments 11, files 1 | total done 348, cursor saved |  |
| 2026-11-11 07:13:50 | 118 | ok | done 3, skipped 0, failed 0 | comments 18, files 3 | total done 348, cursor saved |  |
| 2026-11-11 07:14:00 | 119 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 357, cursor saved |  |
| 2026-11-11 07:14:10 | 120 | ok | done 3, skipped 0, failed 0 | comments 19, files 1 | total done 357, cursor saved |  |
| 2026-11-11 07:14:19 | 121 | ok | done 3, skipped 0, failed 0 | comments 13, files 1 | total done 357, cursor saved |  |
| 2026-11-11 07:14:26 | 122 | ok | done 3, skipped 0, failed 0 | comments 6, files 0 | total done 363, cursor saved |  |
| 2026-11-11 07:14:37 | 123 | ok | done 3, skipped 0, failed 0 | comments 8, files 4 | total done 363, cursor saved |  |
| 2026-11-11 07:14:47 | 124 | ok | done 3, skipped 0, failed 0 | comments 8, files 2 | total done 369, cursor saved |  |
| 2026-11-11 07:14:58 | 125 | ok | done 3, skipped 0, failed 0 | comments 15, files 3 | total done 369, cursor saved |  |
| 2026-11-11 07:15:07 | 126 | ok | done 3, skipped 0, failed 0 | comments 11, files 1 | total done 375, cursor saved |  |
| 2026-11-11 07:15:21 | 127 | ok | done 3, skipped 0, failed 0 | comments 9, files 2 | total done 375, cursor saved |  |
| 2026-11-11 07:15:41 | 128 | ok | done 3, skipped 0, failed 0 | comments 39, files 9 | total done 378, cursor saved |  |
| 2026-11-11 07:15:52 | 129 | ok | done 3, skipped 0, failed 0 | comments 12, files 2 | total done 384, cursor saved |  |
| 2026-11-11 07:16:04 | 130 | ok | done 3, skipped 0, failed 0 | comments 11, files 4 | total done 384, cursor saved |  |
| 2026-11-11 07:16:24 | 131 | ok | done 3, skipped 0, failed 0 | comments 10, files 7 | total done 387, cursor saved |  |
| 2026-11-11 07:16:34 | 132 | ok | done 3, skipped 0, failed 0 | comments 6, files 1 | total done 396, cursor saved |  |
| 2026-11-11 07:16:40 | 133 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 396, cursor saved |  |
| 2026-11-11 07:16:47 | 134 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 396, cursor saved |  |
| 2026-11-11 07:16:53 | 135 | ok | done 3, skipped 0, failed 0 | comments 4, files 0 | total done 405, cursor saved |  |
| 2026-11-11 07:17:02 | 136 | ok | done 3, skipped 0, failed 0 | comments 12, files 1 | total done 405, cursor saved |  |
| 2026-11-11 07:17:09 | 137 | ok | done 3, skipped 0, failed 0 | comments 11, files 0 | total done 405, cursor saved |  |
| 2026-11-11 07:17:18 | 138 | ok | done 3, skipped 0, failed 0 | comments 8, files 1 | total done 414, cursor saved |  |
| 2026-11-11 07:17:23 | 139 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 414, cursor saved |  |
| 2026-11-11 07:17:34 | 140 | ok | done 3, skipped 0, failed 0 | comments 14, files 3 | total done 414, cursor saved |  |
| 2026-11-11 07:17:46 | 141 | ok | done 3, skipped 0, failed 0 | comments 13, files 3 | total done 420, cursor saved |  |
| 2026-11-11 07:17:54 | 142 | ok | done 3, skipped 0, failed 0 | comments 5, files 1 | total done 420, cursor saved |  |
| 2026-11-11 07:18:01 | 143 | ok | done 3, skipped 0, failed 0 | comments 8, files 1 | total done 426, cursor saved |  |
| 2026-11-11 07:18:13 | 144 | ok | done 3, skipped 0, failed 0 | comments 23, files 2 | total done 426, cursor saved |  |
| 2026-11-11 07:18:23 | 145 | ok | done 3, skipped 0, failed 0 | comments 12, files 2 | total done 429, cursor saved |  |
| 2026-11-11 07:18:43 | 146 | ok | done 3, skipped 0, failed 0 | comments 13, files 6 | total done 438, cursor saved |  |
| 2026-11-11 07:18:55 | 147 | ok | done 3, skipped 0, failed 0 | comments 20, files 2 | total done 438, cursor saved |  |
| 2026-11-11 07:19:01 | 148 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 438, cursor saved |  |
| 2026-11-11 07:19:09 | 149 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 441, cursor saved |  |
| 2026-11-11 07:19:23 | 150 | ok | done 3, skipped 0, failed 0 | comments 12, files 6 | total done 441, cursor saved |  |
| 2026-11-11 07:19:29 | 151 | ok | done 3, skipped 0, failed 0 | comments 18, files 0 | total done 450, cursor saved |  |
| 2026-11-11 07:19:35 | 152 | ok | done 3, skipped 0, failed 0 | comments 2, files 0 | total done 450, cursor saved |  |
| 2026-11-11 07:19:48 | 153 | ok | done 3, skipped 0, failed 0 | comments 9, files 3 | total done 456, cursor saved |  |
| 2026-11-11 07:20:03 | 154 | ok | done 3, skipped 0, failed 0 | comments 9, files 6 | total done 456, cursor saved |  |
| 2026-11-11 07:20:14 | 155 | ok | done 3, skipped 0, failed 0 | comments 13, files 1 | total done 462, cursor saved |  |
| 2026-11-11 07:20:24 | 156 | ok | done 3, skipped 0, failed 0 | comments 7, files 1 | total done 462, cursor saved |  |
| 2026-11-11 07:20:33 | 157 | ok | done 3, skipped 0, failed 0 | comments 8, files 1 | total done 468, cursor saved |  |
| 2026-11-11 07:20:41 | 158 | ok | done 3, skipped 0, failed 0 | comments 16, files 1 | total done 468, cursor saved |  |
| 2026-11-11 07:20:52 | 159 | ok | done 3, skipped 0, failed 0 | comments 8, files 3 | total done 477, cursor saved |  |
| 2026-11-11 07:20:58 | 160 | ok | done 3, skipped 0, failed 0 | comments 15, files 0 | total done 477, cursor saved |  |
| 2026-11-11 07:21:07 | 161 | ok | done 3, skipped 0, failed 0 | comments 7, files 1 | total done 477, cursor saved |  |
| 2026-11-11 07:21:21 | 162 | ok | done 3, skipped 0, failed 0 | comments 17, files 2 | total done 480, cursor saved |  |
| 2026-11-11 07:21:40 | 163 | ok | done 3, skipped 0, failed 0 | comments 9, files 7 | total done 486, cursor saved |  |
| 2026-11-11 07:21:48 | 164 | ok | done 3, skipped 0, failed 0 | comments 8, files 1 | total done 486, cursor saved |  |
| 2026-11-11 07:21:56 | 165 | ok | done 3, skipped 0, failed 0 | comments 12, files 1 | total done 495, cursor saved |  |
| 2026-11-11 07:22:04 | 166 | ok | done 3, skipped 0, failed 0 | comments 12, files 2 | total done 495, cursor saved |  |
| 2026-11-11 07:22:13 | 167 | ok | done 3, skipped 0, failed 0 | comments 8, files 1 | total done 495, cursor saved |  |
| 2026-11-11 07:22:31 | 168 | ok | done 3, skipped 0, failed 0 | comments 17, files 8 | total done 498, cursor saved |  |
| 2026-11-11 07:22:37 | 169 | ok | done 3, skipped 0, failed 0 | comments 11, files 0 | total done 498, cursor saved |  |
| 2026-11-11 07:22:43 | 170 | ok | done 3, skipped 0, failed 0 | comments 12, files 0 | total done 510, cursor saved |  |
| 2026-11-11 07:22:49 | 171 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 510, cursor saved |  |
| 2026-11-11 07:22:55 | 172 | ok | done 3, skipped 0, failed 0 | comments 11, files 0 | total done 510, cursor saved |  |
| 2026-11-11 07:23:09 | 173 | ok | done 3, skipped 0, failed 0 | comments 9, files 3 | total done 516, cursor saved |  |
| 2026-11-11 07:23:15 | 174 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 516, cursor saved |  |
| 2026-11-11 07:23:27 | 175 | ok | done 3, skipped 0, failed 0 | comments 9, files 3 | total done 522, cursor saved |  |
| 2026-11-11 07:23:36 | 176 | ok | done 3, skipped 0, failed 0 | comments 27, files 3 | total done 522, cursor saved |  |
| 2026-11-11 07:23:46 | 177 | ok | done 3, skipped 0, failed 0 | comments 18, files 1 | total done 531, cursor saved |  |
| 2026-11-11 07:23:53 | 178 | ok | done 3, skipped 0, failed 0 | comments 11, files 1 | total done 531, cursor saved |  |
| 2026-11-11 07:24:01 | 179 | ok | done 3, skipped 0, failed 0 | comments 7, files 1 | total done 531, cursor saved |  |
| 2026-11-11 07:24:18 | 180 | ok | done 3, skipped 0, failed 0 | comments 43, files 8 | total done 534, cursor saved |  |
| 2026-11-11 07:24:30 | 181 | ok | done 3, skipped 0, failed 0 | comments 10, files 3 | total done 540, cursor saved |  |
| 2026-11-11 07:24:36 | 182 | ok | done 3, skipped 0, failed 0 | comments 4, files 0 | total done 540, cursor saved |  |
| 2026-11-11 07:24:54 | 183 | ok | done 3, skipped 0, failed 0 | comments 24, files 5 | total done 546, cursor saved |  |
| 2026-11-11 07:25:01 | 184 | ok | done 3, skipped 0, failed 0 | comments 12, files 0 | total done 546, cursor saved |  |
| 2026-11-11 07:25:11 | 185 | ok | done 3, skipped 0, failed 0 | comments 11, files 2 | total done 552, cursor saved |  |
| 2026-11-11 07:25:27 | 186 | ok | done 3, skipped 0, failed 0 | comments 20, files 7 | total done 552, cursor saved |  |
| 2026-11-11 07:25:33 | 187 | ok | done 3, skipped 0, failed 0 | comments 11, files 0 | total done 561, cursor saved |  |
| 2026-11-11 07:25:38 | 188 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 561, cursor saved |  |
| 2026-11-11 07:25:51 | 189 | ok | done 3, skipped 0, failed 0 | comments 14, files 5 | total done 561, cursor saved |  |
| 2026-11-11 07:26:05 | 190 | ok | done 3, skipped 0, failed 0 | comments 46, files 6 | total done 564, cursor saved |  |
| 2026-11-11 07:26:16 | 191 | ok | done 3, skipped 0, failed 0 | comments 11, files 3 | total done 573, cursor saved |  |
| 2026-11-11 07:26:22 | 192 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 573, cursor saved |  |
| 2026-11-11 07:26:32 | 193 | ok | done 3, skipped 0, failed 0 | comments 9, files 3 | total done 573, cursor saved |  |
| 2026-11-11 07:26:38 | 194 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 579, cursor saved |  |
| 2026-11-11 07:26:52 | 195 | ok | done 3, skipped 0, failed 0 | comments 10, files 4 | total done 579, cursor saved |  |
| 2026-11-11 07:27:00 | 196 | ok | done 3, skipped 0, failed 0 | comments 19, files 1 | total done 585, cursor saved |  |
| 2026-11-11 07:27:14 | 197 | ok | done 3, skipped 0, failed 0 | comments 10, files 4 | total done 585, cursor saved |  |
| 2026-11-11 07:27:24 | 198 | ok | done 3, skipped 0, failed 0 | comments 10, files 1 | total done 594, cursor saved |  |
| 2026-11-11 07:27:30 | 199 | ok | done 3, skipped 0, failed 0 | comments 4, files 0 | total done 594, cursor saved |  |
| 2026-11-11 07:27:38 | 200 | ok | done 3, skipped 0, failed 0 | comments 4, files 1 | total done 594, cursor saved |  |
| 2026-11-11 07:27:50 | 201 | ok | done 3, skipped 0, failed 0 | comments 16, files 2 | total done 600, cursor saved |  |
| 2026-11-11 07:28:00 | 202 | ok | done 3, skipped 0, failed 0 | comments 6, files 1 | total done 600, cursor saved |  |
| 2026-11-11 07:28:06 | 203 | ok | done 3, skipped 0, failed 0 | comments 6, files 0 | total done 606, cursor saved |  |
| 2026-11-11 07:28:16 | 204 | ok | done 3, skipped 0, failed 0 | comments 16, files 2 | total done 606, cursor saved |  |
| 2026-11-11 07:28:26 | 205 | ok | done 3, skipped 0, failed 0 | comments 7, files 2 | total done 609, cursor saved |  |
| 2026-11-11 07:29:17 | 206 | ok | done 3, skipped 0, failed 0 | comments 27, files 31 | total done 615, cursor saved |  |
| 2026-11-11 07:29:27 | 207 | ok | done 3, skipped 0, failed 0 | comments 18, files 2 | total done 615, cursor saved |  |
| 2026-11-11 07:29:37 | 208 | ok | done 3, skipped 0, failed 0 | comments 16, files 3 | total done 621, cursor saved |  |
| 2026-11-11 07:29:46 | 209 | ok | done 3, skipped 0, failed 0 | comments 10, files 1 | total done 621, cursor saved |  |
| 2026-11-11 07:30:03 | 210 | ok | done 3, skipped 0, failed 0 | comments 49, files 6 | total done 627, cursor saved |  |
| 2026-11-11 07:30:10 | 211 | ok | done 3, skipped 0, failed 0 | comments 3, files 0 | total done 627, cursor saved |  |
| 2026-11-11 07:30:21 | 212 | ok | done 3, skipped 0, failed 0 | comments 12, files 2 | total done 633, cursor saved |  |
| 2026-11-11 07:30:29 | 213 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 633, cursor saved |  |
| 2026-11-11 07:30:47 | 214 | ok | done 3, skipped 0, failed 0 | comments 17, files 7 | total done 636, cursor saved |  |
| 2026-11-11 07:31:05 | 215 | ok | done 3, skipped 0, failed 0 | comments 5, files 10 | total done 642, cursor saved |  |
| 2026-11-11 07:31:13 | 216 | ok | done 3, skipped 0, failed 0 | comments 14, files 0 | total done 642, cursor saved |  |
| 2026-11-11 07:31:19 | 217 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 651, cursor saved |  |
| 2026-11-11 07:31:25 | 218 | ok | done 3, skipped 0, failed 0 | comments 6, files 0 | total done 651, cursor saved |  |
| 2026-11-11 07:31:39 | 219 | ok | done 3, skipped 0, failed 0 | comments 8, files 1 | total done 651, cursor saved |  |
| 2026-11-11 07:31:48 | 220 | ok | done 3, skipped 0, failed 0 | comments 11, files 1 | total done 657, cursor saved |  |
| 2026-11-11 07:31:55 | 221 | ok | done 3, skipped 0, failed 0 | comments 12, files 1 | total done 657, cursor saved |  |
| 2026-11-11 07:32:15 | 222 | ok | done 3, skipped 0, failed 0 | comments 34, files 10 | total done 660, cursor saved |  |
| 2026-11-11 07:32:30 | 223 | ok | done 3, skipped 0, failed 0 | comments 15, files 6 | total done 663, cursor saved |  |
| 2026-11-11 07:32:49 | 224 | ok | done 3, skipped 0, failed 0 | comments 30, files 6 | total done 669, cursor saved |  |
| 2026-11-11 07:32:55 | 225 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 669, cursor saved |  |
| 2026-11-11 07:33:47 | 226 | ok | done 3, skipped 0, failed 0 | comments 20, files 36 | total done 672, cursor saved |  |
| 2026-11-11 07:33:58 | 227 | ok | done 3, skipped 0, failed 0 | comments 7, files 2 | total done 678, cursor saved |  |
| 2026-11-11 07:34:05 | 228 | ok | done 3, skipped 0, failed 0 | comments 4, files 0 | total done 678, cursor saved |  |
| 2026-11-11 07:34:14 | 229 | ok | done 3, skipped 0, failed 0 | comments 6, files 1 | total done 687, cursor saved |  |
| 2026-11-11 07:34:20 | 230 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 687, cursor saved |  |
| 2026-11-11 07:34:26 | 231 | ok | done 3, skipped 0, failed 0 | comments 4, files 0 | total done 687, cursor saved |  |
| 2026-11-11 07:34:53 UTC | paused | | | | | Paused by me at a saved place (the session was running long). Batch 233 finished and saved; no batch was cut off. |

Note: the Phase A batch table lists batches 1 to 144 twice, because the watcher logged them again when it restarted. Each batch ran once (the integration log has one row per batch).

## FINAL REPORT, Nov 11 07:36 UTC: PHASE A DONE, PHASE B PAUSED PART WAY (NOT FINISHED)
- Backup: `d170df7a-2dd1-4f9e-9aaa-295bbb07a375`, folder `2026-11-11_051821Z`, verified.
- Phase A, older open: done. 595 imported, 5 kept as they were, 0 failed. Claims 554 Closed, $93,598.21 damages, $83,810.63 paid back. Exact match with Notion.
- Phase B, closed history, newest first: PAUSED, not finished. 233 batches: 693 imported, 6 skipped (the 6 tickets 1457, 1492, 1495, 1498, 1500, 1515, kept as they were), 0 failed, 0 failed files. 2,797 comments, 623 files. 1,535 of 2,228 left. The saved place is kept. Resume continues from it (Notion import page, Resume). Claims so far 24 Closed, $100.00 damages, $525.00 paid back. The full-set claim check (81, $29,435, $25,370) waits until the phase finishes.
- Resolve at the pause: 1,378 imported tickets (90 + 595 + 693), 0 duplicates, 69 with no home (Needs a home tab), 0 with a clock.
- Protected: the 90 first run tickets, the 2 live tickets and the 36 existing claims match their before fingerprints exactly. Money we could still lose was $3,927.02 after Phase A (open claims are still the 24 Potential and 12 Gathering only).
- Silence: 0 rows since the start line in staff notifications, owner notifications, email log, ticket timed alerts, escalations, owner contact alerts and owner alert log.
- Anomalies: none from the import. There were three interruptions, all from my watcher, and each was resumed from the saved place: a text parsing bug after batch 2, the watcher's browser closing after batch 144, and my correction of the Phase B stop limits after batch 1.
- Not done yet: the end-of-run checks (screens, by team counts, and the Period, Status, Owner, Open and Reopen practice). They wait until Phase B finishes.

## RESUME, Nov 11 (Emily's go about 6:40 AM Central): Phase B closed history from the saved place

### Before the resume (12:40 UTC)
- Saved place: closed history run `9dce0f9d`, 233 batches, 693 done, 6 skipped, 0 failed, 0 failed files, cursor saved Nov 11 07:34:53 UTC. The import code and saved state were not changed.
- Baseline: 1,378 imported tickets (90 first run, 595 older open, 693 closed), 0 duplicates, 0 imported tickets with a clock, Needs a home counted against the limit 54 of 149 (16 older open, 38 closed), 614 claims (36 existing, 554 older open, 24 closed).
- Fingerprints taken of the 90 first run tickets (with their activity), the 2 live tickets (with their activity) and the 36 existing claims; the 6 kept tickets (1457, 1492, 1495, 1498, 1500, 1515) are in the 90 and are still open, In progress.
- Watched every 15 seconds; any one stops the run: a failed batch, any failed ticket or file, a Notion problem, a duplicate, new imported tickets above 2,823 in all, Needs a home above 149 in all, a clock on any imported ticket, any change to the fingerprints, any non-comment activity on imported tickets, any staff notification, owner notification, email, timed alert, escalation or owner contact alert tied to an imported ticket. Rows in those tables not tied to an imported ticket are recorded below as not from the import.

### Phase B batches after the resume
| At (UTC) | Batch | Result | Tickets | Comments, files | Progress | Note |
|---|---|---|---|---|---|---|
| 2026-11-11 12:42:00 UTC | closed resumed from the saved cursor (Nov 11 resume, watch line 2026-11-11 12:41:47.385834+00) | | | | | Emily's go about 6:40 AM Central. |
| 2026-11-11 12:42:09 | 234 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 696, cursor saved |  |
| 2026-11-11 12:42:20 | 235 | ok | done 3, skipped 0, failed 0 | comments 7, files 1 | total done 699, cursor saved |  |
| 2026-11-11 12:42:36 | 236 | ok | done 3, skipped 0, failed 0 | comments 14, files 5 | total done 702, cursor saved |  |
| 2026-11-11 12:42:45 | 237 | ok | done 3, skipped 0, failed 0 | comments 18, files 2 | total done 705, cursor saved |  |
| 2026-11-11 12:42:52 | 238 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 708, cursor saved |  |
| 2026-11-11 12:43:07 | 239 | ok | done 3, skipped 0, failed 0 | comments 20, files 3 | total done 711, cursor saved |  |
| 2026-11-11 12:43:14 | 240 | ok | done 3, skipped 0, failed 0 | comments 9, files 0 | total done 714, cursor saved |  |
| 2026-11-11 12:43:20 | 241 | ok | done 3, skipped 0, failed 0 | comments 11, files 0 | total done 717, cursor saved |  |
| 2026-11-11 12:43:27 | 242 | ok | done 3, skipped 0, failed 0 | comments 3, files 0 | total done 720, cursor saved |  |
| 2026-11-11 12:43:38 | 243 | ok | done 3, skipped 0, failed 0 | comments 12, files 2 | total done 723, cursor saved |  |
| 2026-11-11 12:43:51 | 244 | ok | done 3, skipped 0, failed 0 | comments 28, files 4 | total done 726, cursor saved |  |
| 2026-11-11 12:43:59 | 245 | ok | done 3, skipped 0, failed 0 | comments 17, files 1 | total done 729, cursor saved |  |
| 2026-11-11 12:44:23 | 246 | ok | done 3, skipped 0, failed 0 | comments 12, files 7 | total done 732, cursor saved |  |
| 2026-11-11 12:44:38 | 247 | ok | done 3, skipped 0, failed 0 | comments 7, files 4 | total done 735, cursor saved |  |
| 2026-11-11 12:44:48 | 248 | ok | done 3, skipped 0, failed 0 | comments 7, files 1 | total done 738, cursor saved |  |
| 2026-11-11 12:45:00 | 249 | ok | done 3, skipped 0, failed 0 | comments 12, files 1 | total done 741, cursor saved |  |
| 2026-11-11 12:45:07 | 250 | ok | done 3, skipped 0, failed 0 | comments 5, files 0 | total done 744, cursor saved |  |
| 2026-11-11 12:45:17 | 251 | ok | done 3, skipped 0, failed 0 | comments 6, files 1 | total done 747, cursor saved |  |
| 2026-11-11 12:45:24 | 252 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 750, cursor saved |  |
| 2026-11-11 12:45:35 | 253 | ok | done 3, skipped 0, failed 0 | comments 11, files 3 | total done 753, cursor saved |  |
| 2026-11-11 12:45:48 | 254 | ok | done 3, skipped 0, failed 0 | comments 17, files 3 | total done 756, cursor saved |  |
| 2026-11-11 12:46:03 | 255 | ok | done 3, skipped 0, failed 0 | comments 22, files 4 | total done 759, cursor saved |  |
| 2026-11-11 12:46:10 | 256 | ok | done 3, skipped 0, failed 0 | comments 27, files 1 | total done 762, cursor saved |  |
| 2026-11-11 12:46:30 | 257 | ok | done 3, skipped 0, failed 0 | comments 18, files 8 | total done 765, cursor saved |  |
| 2026-11-11 12:46:45 | 258 | ok | done 3, skipped 0, failed 0 | comments 10, files 4 | total done 768, cursor saved |  |
| 2026-11-11 12:46:52 | 259 | ok | done 3, skipped 0, failed 0 | comments 18, files 0 | total done 771, cursor saved |  |
| 2026-11-11 12:47:01 | 260 | ok | done 3, skipped 0, failed 0 | comments 8, files 1 | total done 774, cursor saved |  |
| 2026-11-11 12:47:32 | 261 | ok | done 3, skipped 0, failed 0 | comments 27, files 13 | total done 777, cursor saved |  |
| 2026-11-11 12:47:45 | 262 | ok | done 3, skipped 0, failed 0 | comments 17, files 4 | total done 780, cursor saved |  |
| 2026-11-11 12:47:54 | 263 | ok | done 3, skipped 0, failed 0 | comments 9, files 2 | total done 783, cursor saved |  |
| 2026-11-11 12:48:03 | 264 | ok | done 3, skipped 0, failed 0 | comments 15, files 1 | total done 786, cursor saved |  |
| 2026-11-11 12:48:13 | 265 | ok | done 3, skipped 0, failed 0 | comments 13, files 2 | total done 789, cursor saved |  |
| 2026-11-11 12:48:27 | 266 | ok | done 3, skipped 0, failed 0 | comments 27, files 4 | total done 792, cursor saved |  |
| 2026-11-11 12:48:34 | 267 | ok | done 3, skipped 0, failed 0 | comments 13, files 0 | total done 795, cursor saved |  |
| 2026-11-11 12:48:54 | 268 | ok | done 3, skipped 0, failed 0 | comments 45, files 9 | total done 798, cursor saved |  |
| 2026-11-11 12:49:09 | 269 | ok | done 3, skipped 0, failed 0 | comments 12, files 3 | total done 801, cursor saved |  |
| 2026-11-11 12:49:18 | 270 | ok | done 3, skipped 0, failed 0 | comments 5, files 1 | total done 804, cursor saved |  |
| 2026-11-11 12:49:35 | 271 | ok | done 3, skipped 0, failed 0 | comments 26, files 8 | total done 807, cursor saved |  |
| 2026-11-11 12:49:44 | 272 | ok | done 3, skipped 0, failed 0 | comments 10, files 1 | total done 810, cursor saved |  |
| 2026-11-11 12:49:58 | 273 | ok | done 3, skipped 0, failed 0 | comments 11, files 4 | total done 813, cursor saved |  |
| 2026-11-11 12:50:07 | 274 | ok | done 3, skipped 0, failed 0 | comments 30, files 2 | total done 816, cursor saved |  |
| 2026-11-11 12:50:18 | 275 | ok | done 3, skipped 0, failed 0 | comments 23, files 3 | total done 819, cursor saved |  |
| 2026-11-11 12:50:31 | 276 | ok | done 3, skipped 0, failed 0 | comments 25, files 3 | total done 822, cursor saved |  |
| 2026-11-11 12:50:54 | 277 | ok | done 3, skipped 0, failed 0 | comments 5, files 5 | total done 825, cursor saved |  |
| 2026-11-11 12:51:10 | 278 | ok | done 3, skipped 0, failed 0 | comments 20, files 4 | total done 828, cursor saved |  |
| 2026-11-11 12:51:19 | 279 | ok | done 3, skipped 0, failed 0 | comments 12, files 1 | total done 831, cursor saved |  |
| 2026-11-11 12:51:32 | 280 | ok | done 3, skipped 0, failed 0 | comments 18, files 3 | total done 834, cursor saved |  |
| 2026-11-11 12:51:49 | 281 | ok | done 3, skipped 0, failed 0 | comments 14, files 8 | total done 837, cursor saved |  |
| 2026-11-11 12:51:59 | 282 | ok | done 3, skipped 0, failed 0 | comments 15, files 2 | total done 840, cursor saved |  |
| 2026-11-11 12:52:12 | 283 | ok | done 3, skipped 0, failed 0 | comments 14, files 4 | total done 843, cursor saved |  |
| 2026-11-11 12:52:25 | 284 | ok | done 3, skipped 0, failed 0 | comments 16, files 3 | total done 846, cursor saved |  |
| 2026-11-11 12:52:42 | 285 | ok | done 3, skipped 0, failed 0 | comments 25, files 8 | total done 849, cursor saved |  |
| 2026-11-11 12:53:21 | 286 | ok | done 3, skipped 0, failed 0 | comments 31, files 18 | total done 852, cursor saved |  |
| 2026-11-11 12:53:32 | 287 | ok | done 3, skipped 0, failed 0 | comments 9, files 2 | total done 855, cursor saved |  |
| 2026-11-11 12:53:44 | 288 | ok | done 3, skipped 0, failed 0 | comments 22, files 2 | total done 858, cursor saved |  |
| 2026-11-11 12:53:56 | 289 | ok | done 3, skipped 0, failed 0 | comments 13, files 3 | total done 861, cursor saved |  |
| 2026-11-11 12:54:06 | 290 | ok | done 3, skipped 0, failed 0 | comments 19, files 2 | total done 864, cursor saved |  |
| 2026-11-11 12:54:16 | 291 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 867, cursor saved |  |
| 2026-11-11 12:54:29 | 292 | ok | done 3, skipped 0, failed 0 | comments 27, files 2 | total done 870, cursor saved |  |
| 2026-11-11 12:54:42 | 293 | ok | done 3, skipped 0, failed 0 | comments 15, files 3 | total done 873, cursor saved |  |
| 2026-11-11 12:54:50 | 294 | ok | done 3, skipped 0, failed 0 | comments 5, files 0 | total done 876, cursor saved |  |
| 2026-11-11 12:55:08 | 295 | ok | done 3, skipped 0, failed 0 | comments 19, files 8 | total done 879, cursor saved |  |
| 2026-11-11 12:55:21 | 296 | ok | done 3, skipped 0, failed 0 | comments 17, files 3 | total done 882, cursor saved |  |
| 2026-11-11 12:55:39 | 297 | ok | done 3, skipped 0, failed 0 | comments 32, files 6 | total done 885, cursor saved |  |
| 2026-11-11 12:55:57 | 298 | ok | done 3, skipped 0, failed 0 | comments 31, files 7 | total done 888, cursor saved |  |
| 2026-11-11 12:56:10 | 299 | ok | done 3, skipped 0, failed 0 | comments 16, files 4 | total done 891, cursor saved |  |
| 2026-11-11 12:56:25 | 300 | ok | done 3, skipped 0, failed 0 | comments 22, files 6 | total done 894, cursor saved |  |
| 2026-11-11 12:56:32 | 301 | ok | done 3, skipped 0, failed 0 | comments 4, files 0 | total done 897, cursor saved |  |
| 2026-11-11 12:56:43 | 302 | ok | done 3, skipped 0, failed 0 | comments 4, files 3 | total done 900, cursor saved |  |
| 2026-11-11 12:57:00 | 303 | ok | done 3, skipped 0, failed 0 | comments 18, files 6 | total done 903, cursor saved |  |
| 2026-11-11 12:57:06 | 304 | ok | done 3, skipped 0, failed 0 | comments 3, files 0 | total done 906, cursor saved |  |
| 2026-11-11 12:57:21 | 305 | ok | done 3, skipped 0, failed 0 | comments 22, files 3 | total done 909, cursor saved |  |
| 2026-11-11 12:57:31 | 306 | ok | done 3, skipped 0, failed 0 | comments 17, files 1 | total done 912, cursor saved |  |
| 2026-11-11 12:57:39 | 307 | ok | done 3, skipped 0, failed 0 | comments 4, files 1 | total done 915, cursor saved |  |
| 2026-11-11 12:57:48 | 308 | ok | done 3, skipped 0, failed 0 | comments 23, files 2 | total done 918, cursor saved |  |
| 2026-11-11 12:57:56 | 309 | ok | done 3, skipped 0, failed 0 | comments 14, files 1 | total done 921, cursor saved |  |
| 2026-11-11 12:58:09 | 310 | ok | done 3, skipped 0, failed 0 | comments 14, files 5 | total done 924, cursor saved |  |
| 2026-11-11 12:58:20 | 311 | ok | done 3, skipped 0, failed 0 | comments 10, files 2 | total done 927, cursor saved |  |
| 2026-11-11 12:58:50 | 312 | ok | done 3, skipped 0, failed 0 | comments 29, files 13 | total done 930, cursor saved |  |
| 2026-11-11 12:59:00 | 313 | ok | done 3, skipped 0, failed 0 | comments 6, files 1 | total done 933, cursor saved |  |
| 2026-11-11 12:59:07 | 314 | ok | done 3, skipped 0, failed 0 | comments 9, files 0 | total done 936, cursor saved |  |
| 2026-11-11 12:59:19 | 315 | ok | done 3, skipped 0, failed 0 | comments 12, files 2 | total done 939, cursor saved |  |
| 2026-11-11 12:59:26 | 316 | ok | done 3, skipped 0, failed 0 | comments 9, files 0 | total done 942, cursor saved |  |
| 2026-11-11 12:59:36 | 317 | ok | done 3, skipped 0, failed 0 | comments 20, files 1 | total done 945, cursor saved |  |
| 2026-11-11 12:59:42 | 318 | ok | done 3, skipped 0, failed 0 | comments 4, files 0 | total done 948, cursor saved |  |
| 2026-11-11 12:59:48 | 319 | ok | done 3, skipped 0, failed 0 | comments 2, files 0 | total done 951, cursor saved |  |
| 2026-11-11 13:00:01 | 320 | ok | done 3, skipped 0, failed 0 | comments 15, files 4 | total done 954, cursor saved |  |
| 2026-11-11 13:00:18 | 321 | ok | done 3, skipped 0, failed 0 | comments 17, files 3 | total done 957, cursor saved |  |
| 2026-11-11 13:00:29 | 322 | ok | done 3, skipped 0, failed 0 | comments 10, files 1 | total done 960, cursor saved |  |
| 2026-11-11 13:00:36 | 323 | ok | done 3, skipped 0, failed 0 | comments 13, files 0 | total done 963, cursor saved |  |
| 2026-11-11 13:00:46 | 324 | ok | done 3, skipped 0, failed 0 | comments 15, files 2 | total done 966, cursor saved |  |
| 2026-11-11 13:00:55 | 325 | ok | done 3, skipped 0, failed 0 | comments 8, files 1 | total done 969, cursor saved |  |
| 2026-11-11 13:01:07 | 326 | ok | done 3, skipped 0, failed 0 | comments 17, files 3 | total done 972, cursor saved |  |
| 2026-11-11 13:01:23 | 327 | ok | done 3, skipped 0, failed 0 | comments 24, files 6 | total done 975, cursor saved |  |
| 2026-11-11 13:01:39 | 328 | ok | done 3, skipped 0, failed 0 | comments 15, files 5 | total done 978, cursor saved |  |
| 2026-11-11 13:01:51 | 329 | ok | done 3, skipped 0, failed 0 | comments 10, files 3 | total done 981, cursor saved |  |
| 2026-11-11 13:02:04 | 330 | ok | done 3, skipped 0, failed 0 | comments 15, files 3 | total done 984, cursor saved |  |
| 2026-11-11 13:02:15 | 331 | ok | done 3, skipped 0, failed 0 | comments 33, files 2 | total done 987, cursor saved |  |
| 2026-11-11 13:02:40 | 332 | ok | done 3, skipped 0, failed 0 | comments 23, files 5 | total done 990, cursor saved |  |
| 2026-11-11 13:02:51 | 333 | ok | done 3, skipped 0, failed 0 | comments 19, files 1 | total done 993, cursor saved |  |
| 2026-11-11 13:03:07 | 334 | ok | done 3, skipped 0, failed 0 | comments 20, files 5 | total done 996, cursor saved |  |
| 2026-11-11 13:03:36 | 335 | ok | done 3, skipped 0, failed 0 | comments 22, files 15 | total done 999, cursor saved |  |
| 2026-11-11 13:03:50 | 336 | ok | done 3, skipped 0, failed 0 | comments 11, files 5 | total done 1002, cursor saved |  |
| 2026-11-11 13:04:00 | 337 | ok | done 3, skipped 0, failed 0 | comments 21, files 2 | total done 1005, cursor saved |  |
| 2026-11-11 13:04:06 | 338 | ok | done 3, skipped 0, failed 0 | comments 14, files 0 | total done 1008, cursor saved |  |
| 2026-11-11 13:04:39 | 339 | ok | done 3, skipped 0, failed 0 | comments 15, files 17 | total done 1011, cursor saved |  |
| 2026-11-11 13:04:49 | 340 | ok | done 3, skipped 0, failed 0 | comments 14, files 2 | total done 1014, cursor saved |  |
| 2026-11-11 13:04:56 | 341 | ok | done 3, skipped 0, failed 0 | comments 25, files 0 | total done 1017, cursor saved |  |
| 2026-11-11 13:05:03 | 342 | ok | done 3, skipped 0, failed 0 | comments 13, files 0 | total done 1020, cursor saved |  |
| 2026-11-11 13:05:10 | 343 | ok | done 3, skipped 0, failed 0 | comments 9, files 0 | total done 1023, cursor saved |  |
| 2026-11-11 13:05:17 | 344 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 1026, cursor saved |  |
| 2026-11-11 13:05:38 | 345 | ok | done 3, skipped 0, failed 0 | comments 14, files 8 | total done 1029, cursor saved |  |
| 2026-11-11 13:05:46 | 346 | ok | done 3, skipped 0, failed 0 | comments 7, files 1 | total done 1032, cursor saved |  |
| 2026-11-11 13:06:02 | 347 | ok | done 3, skipped 0, failed 0 | comments 30, files 5 | total done 1035, cursor saved |  |
| 2026-11-11 13:06:16 | 348 | ok | done 3, skipped 0, failed 0 | comments 17, files 3 | total done 1038, cursor saved |  |
| 2026-11-11 13:06:48 | 349 | ok | done 3, skipped 0, failed 0 | comments 20, files 16 | total done 1041, cursor saved |  |
| 2026-11-11 13:06:54 | 350 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 1044, cursor saved |  |
| 2026-11-11 13:07:01 | 351 | ok | done 3, skipped 0, failed 0 | comments 5, files 0 | total done 1047, cursor saved |  |
| 2026-11-11 13:07:11 | 352 | ok | done 3, skipped 0, failed 0 | comments 11, files 1 | total done 1050, cursor saved |  |
| 2026-11-11 13:07:39 | 353 | ok | done 3, skipped 0, failed 0 | comments 54, files 11 | total done 1053, cursor saved |  |
| 2026-11-11 13:08:02 | 354 | ok | done 3, skipped 0, failed 0 | comments 33, files 11 | total done 1056, cursor saved |  |
| 2026-11-11 13:08:13 | 355 | ok | done 3, skipped 0, failed 0 | comments 22, files 3 | total done 1059, cursor saved |  |
| 2026-11-11 13:08:25 | 356 | ok | done 3, skipped 0, failed 0 | comments 28, files 2 | total done 1062, cursor saved |  |
| 2026-11-11 13:08:42 | 357 | ok | done 3, skipped 0, failed 0 | comments 14, files 4 | total done 1065, cursor saved |  |
| 2026-11-11 13:08:53 | 358 | ok | done 3, skipped 0, failed 0 | comments 14, files 3 | total done 1068, cursor saved |  |
| 2026-11-11 13:09:22 | 359 | ok | done 3, skipped 0, failed 0 | comments 23, files 13 | total done 1071, cursor saved |  |
| 2026-11-11 13:09:29 | 360 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 1074, cursor saved |  |
| 2026-11-11 13:09:53 | 361 | ok | done 3, skipped 0, failed 0 | comments 24, files 10 | total done 1077, cursor saved |  |
| 2026-11-11 13:10:00 | 362 | ok | done 3, skipped 0, failed 0 | comments 6, files 0 | total done 1080, cursor saved |  |
| 2026-11-11 13:10:06 | 363 | ok | done 3, skipped 0, failed 0 | comments 9, files 0 | total done 1083, cursor saved |  |
| 2026-11-11 13:10:22 | 364 | ok | done 3, skipped 0, failed 0 | comments 20, files 4 | total done 1086, cursor saved |  |
| 2026-11-11 13:10:32 | 365 | ok | done 3, skipped 0, failed 0 | comments 21, files 1 | total done 1089, cursor saved |  |
| 2026-11-11 13:10:38 | 366 | ok | done 3, skipped 0, failed 0 | comments 11, files 0 | total done 1092, cursor saved |  |
| 2026-11-11 13:10:55 | 367 | ok | done 3, skipped 0, failed 0 | comments 31, files 6 | total done 1095, cursor saved |  |
| 2026-11-11 13:11:06 | 368 | ok | done 3, skipped 0, failed 0 | comments 7, files 2 | total done 1098, cursor saved |  |
| 2026-11-11 13:11:21 | 369 | ok | done 3, skipped 0, failed 0 | comments 25, files 1 | total done 1101, cursor saved |  |
| 2026-11-11 13:11:41 | 370 | ok | done 3, skipped 0, failed 0 | comments 14, files 5 | total done 1104, cursor saved |  |
| 2026-11-11 13:11:49 | 371 | ok | done 3, skipped 0, failed 0 | comments 16, files 1 | total done 1107, cursor saved |  |
| 2026-11-11 13:12:01 | 372 | ok | done 3, skipped 0, failed 0 | comments 7, files 3 | total done 1110, cursor saved |  |
| 2026-11-11 13:12:15 | 373 | ok | done 3, skipped 0, failed 0 | comments 8, files 3 | total done 1113, cursor saved |  |
| 2026-11-11 13:12:41 | 374 | ok | done 3, skipped 0, failed 0 | comments 30, files 11 | total done 1116, cursor saved |  |
| 2026-11-11 13:12:52 | 375 | ok | done 3, skipped 0, failed 0 | comments 12, files 1 | total done 1119, cursor saved |  |
| 2026-11-11 13:13:07 | 376 | ok | done 3, skipped 0, failed 0 | comments 13, files 5 | total done 1122, cursor saved |  |
| 2026-11-11 13:13:19 | 377 | ok | done 3, skipped 0, failed 0 | comments 14, files 2 | total done 1125, cursor saved |  |
| 2026-11-11 13:13:25 | 378 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 1128, cursor saved |  |
| 2026-11-11 13:13:34 | 379 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 1131, cursor saved |  |
| 2026-11-11 13:14:09 | 380 | ok | done 3, skipped 0, failed 0 | comments 26, files 20 | total done 1134, cursor saved |  |
| 2026-11-11 13:14:28 | 381 | ok | done 3, skipped 0, failed 0 | comments 36, files 5 | total done 1137, cursor saved |  |
| 2026-11-11 13:14:41 | 382 | ok | done 3, skipped 0, failed 0 | comments 19, files 3 | total done 1140, cursor saved |  |
| 2026-11-11 13:15:03 | 383 | ok | done 3, skipped 0, failed 0 | comments 17, files 9 | total done 1143, cursor saved |  |
| 2026-11-11 13:15:16 | 384 | ok | done 3, skipped 0, failed 0 | comments 17, files 3 | total done 1146, cursor saved |  |
| 2026-11-11 13:15:22 | 385 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 1149, cursor saved |  |
| 2026-11-11 13:15:40 | 386 | ok | done 3, skipped 0, failed 0 | comments 17, files 7 | total done 1152, cursor saved |  |
| 2026-11-11 13:15:50 | 387 | ok | done 3, skipped 0, failed 0 | comments 18, files 2 | total done 1155, cursor saved |  |
| 2026-11-11 13:15:57 | 388 | ok | done 3, skipped 0, failed 0 | comments 23, files 1 | total done 1158, cursor saved |  |
| 2026-11-11 13:16:04 | 389 | ok | done 3, skipped 0, failed 0 | comments 6, files 0 | total done 1161, cursor saved |  |
| 2026-11-11 13:16:17 | 390 | ok | done 3, skipped 0, failed 0 | comments 28, files 4 | total done 1164, cursor saved |  |
| 2026-11-11 13:16:32 | 391 | ok | done 3, skipped 0, failed 0 | comments 13, files 3 | total done 1167, cursor saved |  |
| 2026-11-11 13:16:40 | 392 | ok | done 3, skipped 0, failed 0 | comments 10, files 1 | total done 1170, cursor saved |  |
| 2026-11-11 13:16:46 | 393 | ok | done 3, skipped 0, failed 0 | comments 13, files 0 | total done 1173, cursor saved |  |
| 2026-11-11 13:17:07 | 394 | ok | done 3, skipped 0, failed 0 | comments 17, files 8 | total done 1176, cursor saved |  |
| 2026-11-11 13:17:13 | 395 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 1179, cursor saved |  |
| 2026-11-11 13:17:19 | 396 | ok | done 3, skipped 0, failed 0 | comments 23, files 0 | total done 1182, cursor saved |  |
| 2026-11-11 13:17:31 | 397 | ok | done 3, skipped 0, failed 0 | comments 16, files 2 | total done 1185, cursor saved |  |
| 2026-11-11 13:17:47 | 398 | ok | done 3, skipped 0, failed 0 | comments 23, files 7 | total done 1188, cursor saved |  |
| 2026-11-11 13:17:58 | 399 | ok | done 3, skipped 0, failed 0 | comments 14, files 3 | total done 1191, cursor saved |  |
| 2026-11-11 13:18:10 | 400 | ok | done 3, skipped 0, failed 0 | comments 25, files 3 | total done 1194, cursor saved |  |
| 2026-11-11 13:18:16 | 401 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 1197, cursor saved |  |
| 2026-11-11 13:18:29 | 402 | ok | done 3, skipped 0, failed 0 | comments 17, files 3 | total done 1200, cursor saved |  |
| 2026-11-11 13:18:49 | 403 | ok | done 3, skipped 0, failed 0 | comments 37, files 6 | total done 1203, cursor saved |  |
| 2026-11-11 13:19:15 | 404 | ok | done 3, skipped 0, failed 0 | comments 33, files 15 | total done 1206, cursor saved |  |
| 2026-11-11 13:19:30 | 405 | ok | done 3, skipped 0, failed 0 | comments 56, files 6 | total done 1209, cursor saved |  |
| 2026-11-11 13:19:44 | 406 | ok | done 3, skipped 0, failed 0 | comments 18, files 2 | total done 1212, cursor saved |  |
| 2026-11-11 13:19:54 | 407 | ok | done 3, skipped 0, failed 0 | comments 21, files 3 | total done 1215, cursor saved |  |
| 2026-11-11 13:20:04 | 408 | ok | done 3, skipped 0, failed 0 | comments 15, files 2 | total done 1218, cursor saved |  |
| 2026-11-11 13:20:21 | 409 | ok | done 3, skipped 0, failed 0 | comments 17, files 4 | total done 1221, cursor saved |  |
| 2026-11-11 13:20:37 | 410 | ok | done 3, skipped 0, failed 0 | comments 22, files 5 | total done 1224, cursor saved |  |
| 2026-11-11 13:20:48 | 411 | ok | done 3, skipped 0, failed 0 | comments 19, files 3 | total done 1227, cursor saved |  |
| 2026-11-11 13:21:19 | 412 | ok | done 3, skipped 0, failed 0 | comments 16, files 16 | total done 1230, cursor saved |  |
| 2026-11-11 13:21:27 | 413 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 1233, cursor saved |  |
| 2026-11-11 13:21:39 | 414 | ok | done 3, skipped 0, failed 0 | comments 19, files 3 | total done 1236, cursor saved |  |
| 2026-11-11 13:21:53 | 415 | ok | done 3, skipped 0, failed 0 | comments 34, files 5 | total done 1239, cursor saved |  |
| 2026-11-11 13:22:05 | 416 | ok | done 3, skipped 0, failed 0 | comments 23, files 3 | total done 1242, cursor saved |  |
| 2026-11-11 13:22:23 | 417 | ok | done 3, skipped 0, failed 0 | comments 17, files 6 | total done 1245, cursor saved |  |
| 2026-11-11 13:22:38 | 418 | ok | done 3, skipped 0, failed 0 | comments 7, files 5 | total done 1248, cursor saved |  |
| 2026-11-11 13:23:18 | 419 | ok | done 3, skipped 0, failed 0 | comments 66, files 26 | total done 1251, cursor saved |  |
| 2026-11-11 13:23:25 | 420 | ok | done 3, skipped 0, failed 0 | comments 9, files 0 | total done 1254, cursor saved |  |
| 2026-11-11 13:23:31 | 421 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 1257, cursor saved |  |
| 2026-11-11 13:23:41 | 422 | ok | done 3, skipped 0, failed 0 | comments 8, files 2 | total done 1260, cursor saved |  |
| 2026-11-11 13:23:47 | 423 | ok | done 3, skipped 0, failed 0 | comments 11, files 0 | total done 1263, cursor saved |  |
| 2026-11-11 13:24:03 | 424 | ok | done 3, skipped 0, failed 0 | comments 16, files 4 | total done 1266, cursor saved |  |
| 2026-11-11 13:24:23 | 425 | ok | done 3, skipped 0, failed 0 | comments 31, files 5 | total done 1269, cursor saved |  |
| 2026-11-11 13:24:32 | 426 | ok | done 3, skipped 0, failed 0 | comments 10, files 1 | total done 1272, cursor saved |  |
| 2026-11-11 13:24:59 | 427 | ok | done 3, skipped 0, failed 0 | comments 32, files 12 | total done 1275, cursor saved |  |
| 2026-11-11 13:25:17 | 428 | ok | done 3, skipped 0, failed 0 | comments 42, files 5 | total done 1278, cursor saved |  |
| 2026-11-11 13:25:38 | 429 | ok | done 3, skipped 0, failed 0 | comments 34, files 9 | total done 1281, cursor saved |  |
| 2026-11-11 13:25:53 | 430 | ok | done 3, skipped 0, failed 0 | comments 53, files 8 | total done 1284, cursor saved |  |
| 2026-11-11 13:26:03 | 431 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 1287, cursor saved |  |
| 2026-11-11 13:26:13 | 432 | ok | done 3, skipped 0, failed 0 | comments 18, files 3 | total done 1290, cursor saved |  |
| 2026-11-11 13:26:27 | 433 | ok | done 3, skipped 0, failed 0 | comments 25, files 5 | total done 1293, cursor saved |  |
| 2026-11-11 13:26:41 | 434 | ok | done 3, skipped 0, failed 0 | comments 10, files 4 | total done 1296, cursor saved |  |
| 2026-11-11 13:26:51 | 435 | ok | done 3, skipped 0, failed 0 | comments 14, files 1 | total done 1299, cursor saved |  |
| 2026-11-11 13:26:57 | 436 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 1302, cursor saved |  |
| 2026-11-11 13:27:15 | 437 | ok | done 3, skipped 0, failed 0 | comments 21, files 6 | total done 1305, cursor saved |  |
| 2026-11-11 13:27:25 | 438 | ok | done 3, skipped 0, failed 0 | comments 16, files 1 | total done 1308, cursor saved |  |
| 2026-11-11 13:27:38 | 439 | ok | done 3, skipped 0, failed 0 | comments 26, files 2 | total done 1311, cursor saved |  |
| 2026-11-11 13:27:44 | 440 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 1314, cursor saved |  |
| 2026-11-11 13:27:52 | 441 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 1317, cursor saved |  |
| 2026-11-11 13:28:00 | 442 | ok | done 3, skipped 0, failed 0 | comments 24, files 1 | total done 1320, cursor saved |  |
| 2026-11-11 13:28:21 | 443 | ok | done 3, skipped 0, failed 0 | comments 36, files 8 | total done 1323, cursor saved |  |
| 2026-11-11 13:28:32 | 444 | ok | done 3, skipped 0, failed 0 | comments 12, files 2 | total done 1326, cursor saved |  |
| 2026-11-11 13:28:42 | 445 | ok | done 3, skipped 0, failed 0 | comments 23, files 2 | total done 1329, cursor saved |  |
| 2026-11-11 13:28:52 | 446 | ok | done 3, skipped 0, failed 0 | comments 10, files 2 | total done 1332, cursor saved |  |
| 2026-11-11 13:29:02 | 447 | ok | done 3, skipped 0, failed 0 | comments 7, files 1 | total done 1335, cursor saved |  |
| 2026-11-11 13:29:14 | 448 | ok | done 3, skipped 0, failed 0 | comments 19, files 3 | total done 1338, cursor saved |  |
| 2026-11-11 13:29:25 | 449 | ok | done 3, skipped 0, failed 0 | comments 28, files 2 | total done 1341, cursor saved |  |
| 2026-11-11 13:29:31 | 450 | ok | done 3, skipped 0, failed 0 | comments 6, files 0 | total done 1344, cursor saved |  |
| 2026-11-11 13:29:42 | 451 | ok | done 3, skipped 0, failed 0 | comments 20, files 3 | total done 1347, cursor saved |  |
| 2026-11-11 13:29:54 | 452 | ok | done 3, skipped 0, failed 0 | comments 15, files 3 | total done 1350, cursor saved |  |
| 2026-11-11 13:30:02 | 453 | ok | done 3, skipped 0, failed 0 | comments 25, files 1 | total done 1353, cursor saved |  |
| 2026-11-11 13:30:17 | 454 | ok | done 3, skipped 0, failed 0 | comments 28, files 4 | total done 1356, cursor saved |  |
| 2026-11-11 13:30:24 | 455 | ok | done 3, skipped 0, failed 0 | comments 11, files 0 | total done 1359, cursor saved |  |
| 2026-11-11 13:30:30 | 456 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 1362, cursor saved |  |
| 2026-11-11 13:30:41 | 457 | ok | done 3, skipped 0, failed 0 | comments 21, files 3 | total done 1365, cursor saved |  |
| 2026-11-11 13:30:51 | 458 | ok | done 3, skipped 0, failed 0 | comments 18, files 2 | total done 1368, cursor saved |  |
| 2026-11-11 13:31:26 | 459 | ok | done 3, skipped 0, failed 0 | comments 29, files 18 | total done 1371, cursor saved |  |
| 2026-11-11 13:31:33 | 460 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 1374, cursor saved |  |
| 2026-11-11 13:31:43 | 461 | ok | done 3, skipped 0, failed 0 | comments 24, files 1 | total done 1377, cursor saved |  |
| 2026-11-11 13:31:49 | 462 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 1380, cursor saved |  |
| 2026-11-11 13:32:07 | 463 | ok | done 3, skipped 0, failed 0 | comments 21, files 7 | total done 1383, cursor saved |  |
| 2026-11-11 13:32:21 | 464 | ok | done 3, skipped 0, failed 0 | comments 24, files 5 | total done 1386, cursor saved |  |
| 2026-11-11 13:33:05 | 465 | ok | done 3, skipped 0, failed 0 | comments 28, files 11 | total done 1389, cursor saved |  |
| 2026-11-11 13:33:33 | 466 | ok | done 3, skipped 0, failed 0 | comments 13, files 4 | total done 1392, cursor saved |  |
| 2026-11-11 13:33:41 | 467 | ok | done 3, skipped 0, failed 0 | comments 5, files 0 | total done 1395, cursor saved |  |
| 2026-11-11 13:33:51 | 468 | ok | done 3, skipped 0, failed 0 | comments 20, files 1 | total done 1398, cursor saved |  |
| 2026-11-11 13:33:58 | 469 | ok | done 3, skipped 0, failed 0 | comments 15, files 0 | total done 1401, cursor saved |  |
| 2026-11-11 13:34:15 | 470 | ok | done 3, skipped 0, failed 0 | comments 34, files 6 | total done 1404, cursor saved |  |
| 2026-11-11 13:34:26 | 471 | ok | done 3, skipped 0, failed 0 | comments 12, files 3 | total done 1407, cursor saved |  |
| 2026-11-11 13:34:53 | 472 | ok | done 3, skipped 0, failed 0 | comments 27, files 11 | total done 1410, cursor saved |  |
| 2026-11-11 13:35:13 | 473 | ok | done 3, skipped 0, failed 0 | comments 128, files 8 | total done 1413, cursor saved |  |
| 2026-11-11 13:35:29 | 474 | ok | done 3, skipped 0, failed 0 | comments 24, files 4 | total done 1416, cursor saved |  |
| 2026-11-11 13:35:35 | 475 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 1419, cursor saved |  |
| 2026-11-11 13:35:44 | 476 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 1422, cursor saved |  |
| 2026-11-11 13:35:52 | 477 | ok | done 3, skipped 0, failed 0 | comments 14, files 1 | total done 1425, cursor saved |  |
| 2026-11-11 13:35:59 | 478 | ok | done 3, skipped 0, failed 0 | comments 13, files 0 | total done 1428, cursor saved |  |
| 2026-11-11 13:36:05 | 479 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 1431, cursor saved |  |
| 2026-11-11 13:36:12 | 480 | ok | done 3, skipped 0, failed 0 | comments 20, files 0 | total done 1434, cursor saved |  |
| 2026-11-11 13:36:19 | 481 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 1437, cursor saved |  |
| 2026-11-11 13:36:28 | 482 | ok | done 3, skipped 0, failed 0 | comments 62, files 1 | total done 1440, cursor saved |  |
| 2026-11-11 13:36:40 | 483 | ok | done 3, skipped 0, failed 0 | comments 19, files 3 | total done 1443, cursor saved |  |
| 2026-11-11 13:36:53 | 484 | ok | done 3, skipped 0, failed 0 | comments 23, files 3 | total done 1446, cursor saved |  |
| 2026-11-11 13:37:03 | 485 | ok | done 3, skipped 0, failed 0 | comments 23, files 2 | total done 1449, cursor saved |  |
| 2026-11-11 13:37:26 | 486 | ok | done 3, skipped 0, failed 0 | comments 11, files 10 | total done 1452, cursor saved |  |
| 2026-11-11 13:37:42 | 487 | ok | done 3, skipped 0, failed 0 | comments 40, files 7 | total done 1455, cursor saved |  |
| 2026-11-11 13:37:51 | 488 | ok | done 3, skipped 0, failed 0 | comments 11, files 1 | total done 1458, cursor saved |  |
| 2026-11-11 13:37:57 | 489 | ok | done 3, skipped 0, failed 0 | comments 9, files 0 | total done 1461, cursor saved |  |
| 2026-11-11 13:38:23 | 490 | ok | done 3, skipped 0, failed 0 | comments 19, files 7 | total done 1464, cursor saved |  |
| 2026-11-11 13:38:36 | 491 | ok | done 3, skipped 0, failed 0 | comments 18, files 4 | total done 1467, cursor saved |  |
| 2026-11-11 13:38:45 | 492 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 1470, cursor saved |  |
| 2026-11-11 13:38:51 | 493 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 1473, cursor saved |  |
| 2026-11-11 13:39:04 | 494 | ok | done 3, skipped 0, failed 0 | comments 13, files 2 | total done 1476, cursor saved |  |
| 2026-11-11 13:39:11 | 495 | ok | done 3, skipped 0, failed 0 | comments 15, files 0 | total done 1479, cursor saved |  |
| 2026-11-11 13:39:17 | 496 | ok | done 3, skipped 0, failed 0 | comments 21, files 0 | total done 1482, cursor saved |  |
| 2026-11-11 13:39:34 | 497 | ok | done 3, skipped 0, failed 0 | comments 21, files 6 | total done 1485, cursor saved |  |
| 2026-11-11 13:39:40 | 498 | ok | done 3, skipped 0, failed 0 | comments 6, files 0 | total done 1488, cursor saved |  |
| 2026-11-11 13:40:00 | 499 | ok | done 3, skipped 0, failed 0 | comments 20, files 10 | total done 1491, cursor saved |  |
| 2026-11-11 13:40:22 | 500 | ok | done 3, skipped 0, failed 0 | comments 22, files 6 | total done 1494, cursor saved |  |
| 2026-11-11 13:40:35 | 501 | ok | done 3, skipped 0, failed 0 | comments 10, files 1 | total done 1497, cursor saved |  |
| 2026-11-11 13:40:50 | 502 | ok | done 3, skipped 0, failed 0 | comments 24, files 3 | total done 1500, cursor saved |  |
| 2026-11-11 13:40:59 | 503 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 1503, cursor saved |  |
| 2026-11-11 13:41:20 | 504 | ok | done 3, skipped 0, failed 0 | comments 16, files 8 | total done 1506, cursor saved |  |
| 2026-11-11 13:41:38 | 505 | ok | done 3, skipped 0, failed 0 | comments 23, files 5 | total done 1509, cursor saved |  |
| 2026-11-11 13:41:49 | 506 | ok | done 3, skipped 0, failed 0 | comments 25, files 2 | total done 1512, cursor saved |  |
| 2026-11-11 13:41:55 | 507 | ok | done 3, skipped 0, failed 0 | comments 11, files 0 | total done 1515, cursor saved |  |
| 2026-11-11 13:42:07 | 508 | ok | done 3, skipped 0, failed 0 | comments 18, files 2 | total done 1518, cursor saved |  |
| 2026-11-11 13:42:18 | 509 | ok | done 3, skipped 0, failed 0 | comments 18, files 2 | total done 1521, cursor saved |  |
| 2026-11-11 13:42:25 | 510 | ok | done 3, skipped 0, failed 0 | comments 12, files 0 | total done 1524, cursor saved |  |
| 2026-11-11 13:42:35 | 511 | ok | done 3, skipped 0, failed 0 | comments 7, files 1 | total done 1527, cursor saved |  |
| 2026-11-11 13:42:41 | 512 | ok | done 3, skipped 0, failed 0 | comments 5, files 0 | total done 1530, cursor saved |  |
| 2026-11-11 13:43:06 | 513 | ok | done 3, skipped 0, failed 0 | comments 21, files 12 | total done 1533, cursor saved |  |
| 2026-11-11 13:43:16 | 514 | ok | done 3, skipped 0, failed 0 | comments 22, files 2 | total done 1536, cursor saved |  |
| 2026-11-11 13:43:26 | 515 | ok | done 3, skipped 0, failed 0 | comments 10, files 1 | total done 1539, cursor saved |  |
| 2026-11-11 13:43:41 | 516 | ok | done 3, skipped 0, failed 0 | comments 38, files 6 | total done 1542, cursor saved |  |
| 2026-11-11 13:43:41 UTC | paused | | | | | Paused by me at a saved place: the session reached its time limit. Batch 516 finished and saved; no batch was cut off. |

### Pause report, Nov 11 13:44 UTC: PHASE B STILL NOT FINISHED
- Closed history: 516 batches in all, 1,542 of 2,228 imported (849 since the resume), 6 skipped (the 6 kept tickets, unchanged), 0 failed tickets, 0 failed files, no Notion problem. 686 left. Saved place kept; Resume on the Notion import page continues from it.
- Copied in this phase so far: 7,797 comments, 1,597 files.
- Closed set claims so far: 34 claims, damages $3280.74, paid back $2025.00. The full set claim check waits until the phase finishes.
- Resolve now: 2,227 imported tickets (90 + 595 + 1,542), 0 duplicates, 0 with a clock, Needs a home against the limit 94 of 149, new imported 2,137 of 2,823.
- Protected: the 90 first run tickets (and their activity), the 2 live tickets (and their activity) and the 36 existing claims match their before fingerprints exactly.
- Silence since the resume: 0 rows in staff notifications, owner notifications, email log, timed alerts, escalations, owner contact alerts and owner alert log; 0 non-comment activity on imported tickets.
- Anomalies: none.
- Not done yet (wait for the finish): the full set claim check, totals by Notion status and by tab, counts by team and owner, comments and files versus a Notion reread, the no home list, Money we could still lose, Team Queue and Home counts, and the cancelled practice.

### Phase B batches after the second resume
| At (UTC) | Batch | Result | Tickets | Comments, files | Progress | Note |
|---|---|---|---|---|---|---|
| 2026-11-11 13:53:05 UTC | closed resumed from the saved cursor (second resume, same go, watch line 2026-11-11 13:52:53.815041+00) | | | | | |
| 2026-11-11 13:53:15 | 517 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 1545, cursor saved |  |
| 2026-11-11 13:53:23 | 518 | ok | done 3, skipped 0, failed 0 | comments 16, files 1 | total done 1548, cursor saved |  |
| 2026-11-11 13:53:42 | 519 | ok | done 3, skipped 0, failed 0 | comments 31, files 5 | total done 1551, cursor saved |  |
| 2026-11-11 13:54:04 | 520 | ok | done 3, skipped 0, failed 0 | comments 66, files 12 | total done 1554, cursor saved |  |
| 2026-11-11 13:55:10 | 521 | ok | done 3, skipped 0, failed 0 | comments 117, files 25 | total done 1557, cursor saved |  |
| 2026-11-11 13:55:44 | 522 | ok | done 3, skipped 0, failed 0 | comments 17, files 16 | total done 1560, cursor saved |  |
| 2026-11-11 13:55:54 | 523 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 1563, cursor saved |  |
| 2026-11-11 13:56:06 | 524 | ok | done 3, skipped 0, failed 0 | comments 17, files 2 | total done 1566, cursor saved |  |
| 2026-11-11 13:56:13 | 525 | ok | done 3, skipped 0, failed 0 | comments 13, files 0 | total done 1569, cursor saved |  |
| 2026-11-11 13:56:21 | 526 | ok | done 3, skipped 0, failed 0 | comments 19, files 1 | total done 1572, cursor saved |  |
| 2026-11-11 13:56:27 | 527 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 1575, cursor saved |  |
| 2026-11-11 13:56:48 | 528 | ok | done 3, skipped 0, failed 0 | comments 44, files 11 | total done 1578, cursor saved |  |
| 2026-11-11 13:57:06 | 529 | ok | done 3, skipped 0, failed 0 | comments 19, files 6 | total done 1581, cursor saved |  |
| 2026-11-11 13:57:19 | 530 | ok | done 3, skipped 0, failed 0 | comments 14, files 4 | total done 1584, cursor saved |  |
| 2026-11-11 13:57:36 | 531 | ok | done 3, skipped 0, failed 0 | comments 28, files 7 | total done 1587, cursor saved |  |
| 2026-11-11 13:57:46 | 532 | ok | done 3, skipped 0, failed 0 | comments 30, files 2 | total done 1590, cursor saved |  |
| 2026-11-11 13:57:52 | 533 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 1593, cursor saved |  |
| 2026-11-11 13:58:08 | 534 | ok | done 3, skipped 0, failed 0 | comments 12, files 4 | total done 1596, cursor saved |  |
| 2026-11-11 13:58:17 | 535 | ok | done 3, skipped 0, failed 0 | comments 18, files 2 | total done 1599, cursor saved |  |
| 2026-11-11 13:58:24 | 536 | ok | done 3, skipped 0, failed 0 | comments 11, files 0 | total done 1602, cursor saved |  |
| 2026-11-11 13:58:39 | 537 | ok | done 3, skipped 0, failed 0 | comments 30, files 5 | total done 1605, cursor saved |  |
| 2026-11-11 13:58:48 | 538 | ok | done 3, skipped 0, failed 0 | comments 15, files 1 | total done 1608, cursor saved |  |
| 2026-11-11 13:58:58 | 539 | ok | done 3, skipped 0, failed 0 | comments 20, files 3 | total done 1611, cursor saved |  |
| 2026-11-11 13:59:10 | 540 | ok | done 3, skipped 0, failed 0 | comments 35, files 3 | total done 1614, cursor saved |  |
| 2026-11-11 13:59:24 | 541 | ok | done 3, skipped 0, failed 0 | comments 18, files 4 | total done 1617, cursor saved |  |
| 2026-11-11 13:59:38 | 542 | ok | done 3, skipped 0, failed 0 | comments 25, files 3 | total done 1620, cursor saved |  |
| 2026-11-11 13:59:49 | 543 | ok | done 3, skipped 0, failed 0 | comments 31, files 2 | total done 1623, cursor saved |  |
| 2026-11-11 13:59:58 | 544 | ok | done 3, skipped 0, failed 0 | comments 14, files 1 | total done 1626, cursor saved |  |
| 2026-11-11 14:00:07 | 545 | ok | done 3, skipped 0, failed 0 | comments 7, files 1 | total done 1629, cursor saved |  |
| 2026-11-11 14:00:20 | 546 | ok | done 3, skipped 0, failed 0 | comments 15, files 2 | total done 1632, cursor saved |  |
| 2026-11-11 14:00:27 | 547 | ok | done 3, skipped 0, failed 0 | comments 15, files 0 | total done 1635, cursor saved |  |
| 2026-11-11 14:00:50 | 548 | ok | done 3, skipped 0, failed 0 | comments 25, files 8 | total done 1638, cursor saved |  |
| 2026-11-11 14:01:28 | 549 | ok | done 3, skipped 0, failed 0 | comments 34, files 5 | total done 1641, cursor saved |  |
| 2026-11-11 14:01:36 | 550 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 1644, cursor saved |  |
| 2026-11-11 14:01:53 | 551 | ok | done 3, skipped 0, failed 0 | comments 12, files 5 | total done 1647, cursor saved |  |
| 2026-11-11 14:02:23 | 552 | ok | done 3, skipped 0, failed 0 | comments 40, files 13 | total done 1650, cursor saved |  |
| 2026-11-11 14:02:36 | 553 | ok | done 3, skipped 0, failed 0 | comments 10, files 4 | total done 1653, cursor saved |  |
| 2026-11-11 14:02:46 | 554 | ok | done 3, skipped 0, failed 0 | comments 9, files 3 | total done 1656, cursor saved |  |
| 2026-11-11 14:02:59 | 555 | ok | done 3, skipped 0, failed 0 | comments 54, files 5 | total done 1659, cursor saved |  |
| 2026-11-11 14:03:04 | 556 | ok | done 3, skipped 0, failed 0 | comments 6, files 0 | total done 1662, cursor saved |  |
| 2026-11-11 14:03:23 | 557 | ok | done 3, skipped 0, failed 0 | comments 5, files 3 | total done 1665, cursor saved |  |
| 2026-11-11 14:03:40 | 558 | ok | done 3, skipped 0, failed 0 | comments 23, files 4 | total done 1668, cursor saved |  |
| 2026-11-11 14:03:51 | 559 | ok | done 3, skipped 0, failed 0 | comments 95, files 4 | total done 1671, cursor saved |  |
| 2026-11-11 14:04:04 | 560 | ok | done 3, skipped 0, failed 0 | comments 37, files 4 | total done 1674, cursor saved |  |
| 2026-11-11 14:04:16 | 561 | ok | done 3, skipped 0, failed 0 | comments 6, files 2 | total done 1677, cursor saved |  |
| 2026-11-11 14:05:02 | 562 | ok | done 3, skipped 0, failed 0 | comments 70, files 32 | total done 1680, cursor saved |  |
| 2026-11-11 14:05:44 | 563 | ok | done 3, skipped 0, failed 0 | comments 64, files 22 | total done 1683, cursor saved |  |
| 2026-11-11 14:05:51 | 564 | ok | done 3, skipped 0, failed 0 | comments 3, files 0 | total done 1686, cursor saved |  |
| 2026-11-11 14:05:59 | 565 | ok | done 3, skipped 0, failed 0 | comments 6, files 1 | total done 1689, cursor saved |  |
| 2026-11-11 14:06:18 | 566 | ok | done 3, skipped 0, failed 0 | comments 21, files 8 | total done 1692, cursor saved |  |
| 2026-11-11 14:06:29 | 567 | ok | done 3, skipped 0, failed 0 | comments 24, files 1 | total done 1695, cursor saved |  |
| 2026-11-11 14:06:48 | 568 | ok | done 3, skipped 0, failed 0 | comments 36, files 7 | total done 1698, cursor saved |  |
| 2026-11-11 14:06:59 | 569 | ok | done 3, skipped 0, failed 0 | comments 33, files 4 | total done 1701, cursor saved |  |
| 2026-11-11 14:07:05 | 570 | ok | done 3, skipped 0, failed 0 | comments 18, files 0 | total done 1704, cursor saved |  |
| 2026-11-11 14:07:14 | 571 | ok | done 3, skipped 0, failed 0 | comments 8, files 1 | total done 1707, cursor saved |  |
| 2026-11-11 14:07:23 | 572 | ok | done 3, skipped 0, failed 0 | comments 12, files 1 | total done 1710, cursor saved |  |
| 2026-11-11 14:08:12 | 573 | ok | done 3, skipped 0, failed 0 | comments 40, files 25 | total done 1713, cursor saved |  |
| 2026-11-11 14:08:24 | 574 | ok | done 3, skipped 0, failed 0 | comments 6, files 2 | total done 1716, cursor saved |  |
| 2026-11-11 14:08:33 | 575 | ok | done 3, skipped 0, failed 0 | comments 20, files 1 | total done 1719, cursor saved |  |
| 2026-11-11 14:08:42 | 576 | ok | done 3, skipped 0, failed 0 | comments 14, files 1 | total done 1722, cursor saved |  |
| 2026-11-11 14:08:48 | 577 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 1725, cursor saved |  |
| 2026-11-11 14:09:02 | 578 | ok | done 3, skipped 0, failed 0 | comments 46, files 4 | total done 1728, cursor saved |  |
| 2026-11-11 14:09:31 | 579 | ok | done 3, skipped 0, failed 0 | comments 97, files 17 | total done 1731, cursor saved |  |
| 2026-11-11 14:09:44 | 580 | ok | done 3, skipped 0, failed 0 | comments 21, files 4 | total done 1734, cursor saved |  |
| 2026-11-11 14:10:01 | 581 | ok | done 3, skipped 0, failed 0 | comments 31, files 6 | total done 1737, cursor saved |  |
| 2026-11-11 14:10:13 | 582 | ok | done 3, skipped 0, failed 0 | comments 7, files 2 | total done 1740, cursor saved |  |
| 2026-11-11 14:10:21 | 583 | ok | done 3, skipped 0, failed 0 | comments 11, files 0 | total done 1743, cursor saved |  |
| 2026-11-11 14:10:34 | 584 | ok | done 3, skipped 0, failed 0 | comments 21, files 4 | total done 1746, cursor saved |  |
| 2026-11-11 14:10:59 | 585 | ok | done 3, skipped 0, failed 0 | comments 36, files 9 | total done 1749, cursor saved |  |
| 2026-11-11 14:11:06 | 586 | ok | done 3, skipped 0, failed 0 | comments 9, files 0 | total done 1752, cursor saved |  |
| 2026-11-11 14:11:43 | 587 | ok | done 3, skipped 0, failed 0 | comments 91, files 16 | total done 1755, cursor saved |  |
| 2026-11-11 14:12:00 | 588 | ok | done 3, skipped 0, failed 0 | comments 10, files 1 | total done 1758, cursor saved |  |
| 2026-11-11 14:12:18 | 589 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 1761, cursor saved |  |
| 2026-11-11 14:12:49 | 590 | ok | done 3, skipped 0, failed 0 | comments 19, files 4 | total done 1764, cursor saved |  |
| 2026-11-11 14:12:57 | 591 | ok | done 3, skipped 0, failed 0 | comments 17, files 0 | total done 1767, cursor saved |  |
| 2026-11-11 14:13:04 | 592 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 1770, cursor saved |  |
| 2026-11-11 14:13:18 | 593 | ok | done 3, skipped 0, failed 0 | comments 7, files 4 | total done 1773, cursor saved |  |
| 2026-11-11 14:13:33 | 594 | ok | done 3, skipped 0, failed 0 | comments 27, files 5 | total done 1776, cursor saved |  |
| 2026-11-11 14:13:39 | 595 | ok | done 3, skipped 0, failed 0 | comments 5, files 0 | total done 1779, cursor saved |  |
| 2026-11-11 14:13:46 | 596 | ok | done 3, skipped 0, failed 0 | comments 19, files 0 | total done 1782, cursor saved |  |
| 2026-11-11 14:14:15 | 597 | ok | done 3, skipped 0, failed 0 | comments 21, files 7 | total done 1785, cursor saved |  |
| 2026-11-11 14:14:24 | 598 | ok | done 3, skipped 0, failed 0 | comments 5, files 1 | total done 1788, cursor saved |  |
| 2026-11-11 14:14:54 | 599 | ok | done 3, skipped 0, failed 0 | comments 60, files 16 | total done 1791, cursor saved |  |
| 2026-11-11 14:15:07 | 600 | ok | done 3, skipped 0, failed 0 | comments 30, files 5 | total done 1794, cursor saved |  |
| 2026-11-11 14:15:14 | 601 | ok | done 3, skipped 0, failed 0 | comments 13, files 0 | total done 1797, cursor saved |  |
| 2026-11-11 14:15:32 | 602 | ok | done 3, skipped 0, failed 0 | comments 35, files 7 | total done 1800, cursor saved |  |
| 2026-11-11 14:15:53 | 603 | ok | done 3, skipped 0, failed 0 | comments 31, files 5 | total done 1803, cursor saved |  |
| 2026-11-11 14:15:59 | 604 | ok | done 3, skipped 0, failed 0 | comments 26, files 0 | total done 1806, cursor saved |  |
| 2026-11-11 14:16:14 | 605 | ok | done 3, skipped 0, failed 0 | comments 12, files 4 | total done 1809, cursor saved |  |
| 2026-11-11 14:16:37 | 606 | ok | done 3, skipped 0, failed 0 | comments 47, files 11 | total done 1812, cursor saved |  |
| 2026-11-11 14:16:43 | 607 | ok | done 3, skipped 0, failed 0 | comments 14, files 0 | total done 1815, cursor saved |  |
| 2026-11-11 14:16:50 | 608 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 1818, cursor saved |  |
| 2026-11-11 14:17:04 | 609 | ok | done 3, skipped 0, failed 0 | comments 17, files 3 | total done 1821, cursor saved |  |
| 2026-11-11 14:17:11 | 610 | ok | done 3, skipped 0, failed 0 | comments 14, files 0 | total done 1824, cursor saved |  |
| 2026-11-11 14:17:25 | 611 | ok | done 3, skipped 0, failed 0 | comments 21, files 3 | total done 1827, cursor saved |  |
| 2026-11-11 14:17:40 | 612 | ok | done 3, skipped 0, failed 0 | comments 45, files 6 | total done 1830, cursor saved |  |
| 2026-11-11 14:17:48 | 613 | ok | done 3, skipped 0, failed 0 | comments 9, files 1 | total done 1833, cursor saved |  |
| 2026-11-11 14:17:55 | 614 | ok | done 3, skipped 0, failed 0 | comments 22, files 0 | total done 1836, cursor saved |  |
| 2026-11-11 14:18:15 | 615 | ok | done 3, skipped 0, failed 0 | comments 13, files 5 | total done 1839, cursor saved |  |
| 2026-11-11 14:19:07 | 616 | ok | done 3, skipped 0, failed 0 | comments 26, files 35 | total done 1842, cursor saved |  |
| 2026-11-11 14:19:23 | 617 | ok | done 3, skipped 0, failed 0 | comments 19, files 4 | total done 1845, cursor saved |  |
| 2026-11-11 14:19:30 | 618 | ok | done 3, skipped 0, failed 0 | comments 21, files 0 | total done 1848, cursor saved |  |
| 2026-11-11 14:19:40 | 619 | ok | done 3, skipped 0, failed 0 | comments 22, files 2 | total done 1851, cursor saved |  |
| 2026-11-11 14:20:37 | 620 | ok | done 3, skipped 0, failed 0 | comments 73, files 29 | total done 1854, cursor saved |  |
| 2026-11-11 14:20:44 | 621 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 1857, cursor saved |  |
| 2026-11-11 14:20:57 | 622 | ok | done 3, skipped 0, failed 0 | comments 9, files 3 | total done 1860, cursor saved |  |
| 2026-11-11 14:21:19 | 623 | ok | done 3, skipped 0, failed 0 | comments 63, files 6 | total done 1863, cursor saved |  |
| 2026-11-11 14:21:33 | 624 | ok | done 3, skipped 0, failed 0 | comments 17, files 3 | total done 1866, cursor saved |  |
| 2026-11-11 14:21:44 | 625 | ok | done 3, skipped 0, failed 0 | comments 30, files 3 | total done 1869, cursor saved |  |
| 2026-11-11 14:22:02 | 626 | ok | done 3, skipped 0, failed 0 | comments 93, files 7 | total done 1872, cursor saved |  |
| 2026-11-11 14:22:54 | 627 | ok | done 3, skipped 0, failed 0 | comments 108, files 25 | total done 1875, cursor saved |  |
| 2026-11-11 14:23:02 | 628 | ok | done 3, skipped 0, failed 0 | comments 13, files 1 | total done 1878, cursor saved |  |
| 2026-11-11 14:23:13 | 629 | ok | done 3, skipped 0, failed 0 | comments 10, files 1 | total done 1881, cursor saved |  |
| 2026-11-11 14:23:27 | 630 | ok | done 3, skipped 0, failed 0 | comments 8, files 2 | total done 1884, cursor saved |  |
| 2026-11-11 14:23:41 | 631 | ok | done 3, skipped 0, failed 0 | comments 20, files 7 | total done 1887, cursor saved |  |
| 2026-11-11 14:23:59 | 632 | ok | done 3, skipped 0, failed 0 | comments 41, files 7 | total done 1890, cursor saved |  |
| 2026-11-11 14:24:09 | 633 | ok | done 3, skipped 0, failed 0 | comments 8, files 1 | total done 1893, cursor saved |  |
| 2026-11-11 14:24:45 | 634 | ok | done 3, skipped 0, failed 0 | comments 85, files 12 | total done 1896, cursor saved |  |
| 2026-11-11 14:25:03 | 635 | ok | done 3, skipped 0, failed 0 | comments 44, files 7 | total done 1899, cursor saved |  |
| 2026-11-11 14:25:12 | 636 | ok | done 3, skipped 0, failed 0 | comments 14, files 1 | total done 1902, cursor saved |  |
| 2026-11-11 14:25:24 | 637 | ok | done 3, skipped 0, failed 0 | comments 36, files 3 | total done 1905, cursor saved |  |
| 2026-11-11 14:25:36 | 638 | ok | done 3, skipped 0, failed 0 | comments 5, files 2 | total done 1908, cursor saved |  |
| 2026-11-11 14:25:57 | 639 | ok | done 3, skipped 0, failed 0 | comments 48, files 9 | total done 1911, cursor saved |  |
| 2026-11-11 14:26:13 | 640 | ok | done 3, skipped 0, failed 0 | comments 29, files 6 | total done 1914, cursor saved |  |
| 2026-11-11 14:26:24 | 641 | ok | done 3, skipped 0, failed 0 | comments 12, files 3 | total done 1917, cursor saved |  |
| 2026-11-11 14:26:31 | 642 | ok | done 3, skipped 0, failed 0 | comments 10, files 1 | total done 1920, cursor saved |  |
| 2026-11-11 14:26:46 | 643 | ok | done 3, skipped 0, failed 0 | comments 29, files 6 | total done 1923, cursor saved |  |
| 2026-11-11 14:26:52 | 644 | ok | done 3, skipped 0, failed 0 | comments 11, files 0 | total done 1926, cursor saved |  |
| 2026-11-11 14:27:28 | 645 | ok | done 3, skipped 0, failed 0 | comments 27, files 22 | total done 1929, cursor saved |  |
| 2026-11-11 14:27:41 | 646 | ok | done 3, skipped 0, failed 0 | comments 19, files 3 | total done 1932, cursor saved |  |
| 2026-11-11 14:28:12 | 647 | ok | done 3, skipped 0, failed 0 | comments 40, files 8 | total done 1935, cursor saved |  |
| 2026-11-11 14:28:23 | 648 | ok | done 3, skipped 0, failed 0 | comments 27, files 2 | total done 1938, cursor saved |  |
| 2026-11-11 14:28:35 | 649 | ok | done 3, skipped 0, failed 0 | comments 29, files 3 | total done 1941, cursor saved |  |
| 2026-11-11 14:29:27 | 650 | ok | done 3, skipped 0, failed 0 | comments 37, files 38 | total done 1944, cursor saved |  |
| 2026-11-11 14:29:40 | 651 | ok | done 3, skipped 0, failed 0 | comments 19, files 2 | total done 1947, cursor saved |  |
| 2026-11-11 14:29:57 | 652 | ok | done 3, skipped 0, failed 0 | comments 44, files 9 | total done 1950, cursor saved |  |
| 2026-11-11 14:30:06 | 653 | ok | done 3, skipped 0, failed 0 | comments 25, files 1 | total done 1953, cursor saved |  |
| 2026-11-11 14:30:16 | 654 | ok | done 3, skipped 0, failed 0 | comments 8, files 0 | total done 1956, cursor saved |  |
| 2026-11-11 14:30:40 | 655 | ok | done 3, skipped 0, failed 0 | comments 33, files 9 | total done 1959, cursor saved |  |
| 2026-11-11 14:30:49 | 656 | ok | done 3, skipped 0, failed 0 | comments 33, files 2 | total done 1962, cursor saved |  |
| 2026-11-11 14:31:05 | 657 | ok | done 3, skipped 0, failed 0 | comments 12, files 5 | total done 1965, cursor saved |  |
| 2026-11-11 14:31:32 | 658 | ok | done 3, skipped 0, failed 0 | comments 18, files 12 | total done 1968, cursor saved |  |
| 2026-11-11 14:31:54 | 659 | ok | done 3, skipped 0, failed 0 | comments 28, files 8 | total done 1971, cursor saved |  |
| 2026-11-11 14:32:14 | 660 | ok | done 3, skipped 0, failed 0 | comments 29, files 9 | total done 1974, cursor saved |  |
| 2026-11-11 14:32:24 | 661 | ok | done 3, skipped 0, failed 0 | comments 15, files 1 | total done 1977, cursor saved |  |
| 2026-11-11 14:32:44 | 662 | ok | done 3, skipped 0, failed 0 | comments 69, files 9 | total done 1980, cursor saved |  |
| 2026-11-11 14:32:56 | 663 | ok | done 3, skipped 0, failed 0 | comments 24, files 3 | total done 1983, cursor saved |  |
| 2026-11-11 14:33:08 | 664 | ok | done 3, skipped 0, failed 0 | comments 25, files 4 | total done 1986, cursor saved |  |
| 2026-11-11 14:33:22 | 665 | ok | done 3, skipped 0, failed 0 | comments 16, files 2 | total done 1989, cursor saved |  |
| 2026-11-11 14:33:31 | 666 | ok | done 3, skipped 0, failed 0 | comments 11, files 2 | total done 1992, cursor saved |  |
| 2026-11-11 14:33:49 | 667 | ok | done 3, skipped 0, failed 0 | comments 55, files 9 | total done 1995, cursor saved |  |
| 2026-11-11 14:34:04 | 668 | ok | done 3, skipped 0, failed 0 | comments 53, files 7 | total done 1998, cursor saved |  |
| 2026-11-11 14:34:50 | 669 | ok | done 3, skipped 0, failed 0 | comments 95, files 28 | total done 2001, cursor saved |  |
| 2026-11-11 14:35:02 | 670 | ok | done 3, skipped 0, failed 0 | comments 8, files 2 | total done 2004, cursor saved |  |
| 2026-11-11 14:35:23 | 671 | ok | done 3, skipped 0, failed 0 | comments 21, files 9 | total done 2007, cursor saved |  |
| 2026-11-11 14:35:42 | 672 | ok | done 3, skipped 0, failed 0 | comments 20, files 7 | total done 2010, cursor saved |  |
| 2026-11-11 14:36:13 | 673 | ok | done 3, skipped 0, failed 0 | comments 35, files 10 | total done 2013, cursor saved |  |
| 2026-11-11 14:36:23 | 674 | ok | done 3, skipped 0, failed 0 | comments 6, files 3 | total done 2016, cursor saved |  |
| 2026-11-11 14:36:36 | 675 | ok | done 3, skipped 0, failed 0 | comments 14, files 4 | total done 2019, cursor saved |  |
| 2026-11-11 14:36:49 | 676 | ok | done 3, skipped 0, failed 0 | comments 15, files 3 | total done 2022, cursor saved |  |
| 2026-11-11 14:36:57 | 677 | ok | done 3, skipped 0, failed 0 | comments 11, files 1 | total done 2025, cursor saved |  |
| 2026-11-11 14:37:04 | 678 | ok | done 3, skipped 0, failed 0 | comments 15, files 0 | total done 2028, cursor saved |  |
| 2026-11-11 14:37:19 | 679 | ok | done 3, skipped 0, failed 0 | comments 23, files 5 | total done 2031, cursor saved |  |
| 2026-11-11 14:37:25 | 680 | ok | done 3, skipped 0, failed 0 | comments 16, files 0 | total done 2034, cursor saved |  |
| 2026-11-11 14:37:47 | 681 | ok | done 3, skipped 0, failed 0 | comments 56, files 12 | total done 2037, cursor saved |  |
| 2026-11-11 14:38:14 | 682 | ok | done 3, skipped 0, failed 0 | comments 66, files 14 | total done 2040, cursor saved |  |
| 2026-11-11 14:38:22 | 683 | ok | done 3, skipped 0, failed 0 | comments 18, files 1 | total done 2043, cursor saved |  |
| 2026-11-11 14:38:37 | 684 | ok | done 3, skipped 0, failed 0 | comments 19, files 5 | total done 2046, cursor saved |  |
| 2026-11-11 14:38:47 | 685 | ok | done 3, skipped 0, failed 0 | comments 11, files 2 | total done 2049, cursor saved |  |
| 2026-11-11 14:39:09 | 686 | ok | done 3, skipped 0, failed 0 | comments 24, files 11 | total done 2052, cursor saved |  |
| 2026-11-11 14:39:24 | 687 | ok | done 3, skipped 0, failed 0 | comments 30, files 4 | total done 2055, cursor saved |  |
| 2026-11-11 14:39:44 | 688 | ok | done 3, skipped 0, failed 0 | comments 27, files 11 | total done 2058, cursor saved |  |
| 2026-11-11 14:39:50 | 689 | ok | done 3, skipped 0, failed 0 | comments 9, files 0 | total done 2061, cursor saved |  |
| 2026-11-11 14:40:02 | 690 | ok | done 3, skipped 0, failed 0 | comments 32, files 3 | total done 2064, cursor saved |  |
| 2026-11-11 14:40:08 | 691 | ok | done 3, skipped 0, failed 0 | comments 5, files 0 | total done 2067, cursor saved |  |
| 2026-11-11 14:40:18 | 692 | ok | done 3, skipped 0, failed 0 | comments 12, files 2 | total done 2070, cursor saved |  |
| 2026-11-11 14:40:37 | 693 | ok | done 3, skipped 0, failed 0 | comments 69, files 6 | total done 2073, cursor saved |  |
| 2026-11-11 14:41:46 | 694 | ok | done 3, skipped 0, failed 0 | comments 75, files 43 | total done 2076, cursor saved |  |
| 2026-11-11 14:41:56 | 695 | ok | done 3, skipped 0, failed 0 | comments 22, files 3 | total done 2079, cursor saved |  |
| 2026-11-11 14:42:03 | 696 | ok | done 3, skipped 0, failed 0 | comments 19, files 0 | total done 2082, cursor saved |  |
| 2026-11-11 14:42:30 | 697 | ok | done 3, skipped 0, failed 0 | comments 37, files 8 | total done 2085, cursor saved |  |
| 2026-11-11 14:42:41 | 698 | ok | done 3, skipped 0, failed 0 | comments 21, files 3 | total done 2088, cursor saved |  |
| 2026-11-11 14:43:03 | 699 | ok | done 3, skipped 0, failed 0 | comments 42, files 14 | total done 2091, cursor saved |  |
| 2026-11-11 14:43:12 | 700 | ok | done 3, skipped 0, failed 0 | comments 7, files 1 | total done 2094, cursor saved |  |
| 2026-11-11 14:43:19 | 701 | ok | done 3, skipped 0, failed 0 | comments 11, files 0 | total done 2097, cursor saved |  |
| 2026-11-11 14:43:26 | 702 | ok | done 3, skipped 0, failed 0 | comments 22, files 0 | total done 2100, cursor saved |  |
| 2026-11-11 14:44:26 | 703 | ok | done 3, skipped 0, failed 0 | comments 93, files 26 | total done 2103, cursor saved |  |
| 2026-11-11 14:45:18 | 704 | ok | done 3, skipped 0, failed 0 | comments 57, files 25 | total done 2106, cursor saved |  |
| 2026-11-11 14:45:45 | 705 | ok | done 3, skipped 0, failed 0 | comments 83, files 15 | total done 2109, cursor saved |  |
| 2026-11-11 14:45:53 | 706 | ok | done 3, skipped 0, failed 0 | comments 14, files 1 | total done 2112, cursor saved |  |
| 2026-11-11 14:46:35 | 707 | ok | done 3, skipped 0, failed 0 | comments 67, files 22 | total done 2115, cursor saved |  |
| 2026-11-11 14:46:46 | 708 | ok | done 3, skipped 0, failed 0 | comments 11, files 2 | total done 2118, cursor saved |  |
| 2026-11-11 14:46:54 | 709 | ok | done 3, skipped 0, failed 0 | comments 7, files 2 | total done 2121, cursor saved |  |
| 2026-11-11 14:47:21 | 710 | ok | done 3, skipped 0, failed 0 | comments 29, files 15 | total done 2124, cursor saved |  |
| 2026-11-11 14:47:29 | 711 | ok | done 3, skipped 0, failed 0 | comments 10, files 0 | total done 2127, cursor saved |  |
| 2026-11-11 14:47:35 | 712 | ok | done 3, skipped 0, failed 0 | comments 5, files 0 | total done 2130, cursor saved |  |
| 2026-11-11 14:47:47 | 713 | ok | done 3, skipped 0, failed 0 | comments 6, files 2 | total done 2133, cursor saved |  |
| 2026-11-11 14:47:59 | 714 | ok | done 3, skipped 0, failed 0 | comments 22, files 2 | total done 2136, cursor saved |  |
| 2026-11-11 14:48:11 | 715 | ok | done 3, skipped 0, failed 0 | comments 23, files 4 | total done 2139, cursor saved |  |
| 2026-11-11 14:48:19 | 716 | ok | done 3, skipped 0, failed 0 | comments 14, files 0 | total done 2142, cursor saved |  |
| 2026-11-11 14:48:40 | 717 | ok | done 3, skipped 0, failed 0 | comments 33, files 10 | total done 2145, cursor saved |  |
| 2026-11-11 14:48:59 | 718 | ok | done 3, skipped 0, failed 0 | comments 10, files 7 | total done 2148, cursor saved |  |
| 2026-11-11 14:49:08 | 719 | ok | done 3, skipped 0, failed 0 | comments 17, files 2 | total done 2151, cursor saved |  |
| 2026-11-11 14:49:29 | 720 | ok | done 3, skipped 0, failed 0 | comments 48, files 9 | total done 2154, cursor saved |  |
| 2026-11-11 14:49:40 | 721 | ok | done 3, skipped 0, failed 0 | comments 71, files 2 | total done 2157, cursor saved |  |
| 2026-11-11 14:50:59 | 722 | ok | done 3, skipped 0, failed 0 | comments 115, files 43 | total done 2160, cursor saved |  |
| 2026-11-11 14:51:10 | 723 | ok | done 3, skipped 0, failed 0 | comments 6, files 1 | total done 2163, cursor saved |  |
| 2026-11-11 14:51:18 | 724 | ok | done 3, skipped 0, failed 0 | comments 3, files 0 | total done 2166, cursor saved |  |
| 2026-11-11 14:51:45 | 725 | ok | done 3, skipped 0, failed 0 | comments 19, files 13 | total done 2169, cursor saved |  |
| 2026-11-11 14:51:57 | 726 | ok | done 3, skipped 0, failed 0 | comments 7, files 2 | total done 2172, cursor saved |  |
| 2026-11-11 14:52:11 | 727 | ok | done 3, skipped 0, failed 0 | comments 12, files 4 | total done 2175, cursor saved |  |
| 2026-11-11 14:52:49 | 728 | ok | done 3, skipped 0, failed 0 | comments 54, files 20 | total done 2178, cursor saved |  |
| 2026-11-11 14:53:16 | 729 | ok | done 3, skipped 0, failed 0 | comments 72, files 15 | total done 2181, cursor saved |  |
| 2026-11-11 14:53:25 | 730 | ok | done 3, skipped 0, failed 0 | comments 22, files 1 | total done 2184, cursor saved |  |
| 2026-11-11 14:53:37 | 731 | ok | done 3, skipped 0, failed 0 | comments 18, files 3 | total done 2187, cursor saved |  |
| 2026-11-11 14:53:47 | 732 | ok | done 3, skipped 0, failed 0 | comments 30, files 2 | total done 2190, cursor saved |  |
| 2026-11-11 14:54:37 | 733 | ok | done 3, skipped 0, failed 0 | comments 132, files 34 | total done 2193, cursor saved |  |
| 2026-11-11 14:54:46 | 734 | ok | done 3, skipped 0, failed 0 | comments 16, files 1 | total done 2196, cursor saved |  |
| 2026-11-11 14:54:53 | 735 | ok | done 3, skipped 0, failed 0 | comments 9, files 0 | total done 2199, cursor saved |  |
| 2026-11-11 14:55:04 | 736 | ok | done 3, skipped 0, failed 0 | comments 22, files 2 | total done 2202, cursor saved |  |
| 2026-11-11 14:55:17 | 737 | ok | done 3, skipped 0, failed 0 | comments 18, files 1 | total done 2205, cursor saved |  |
| 2026-11-11 14:55:23 | 738 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 2208, cursor saved |  |
| 2026-11-11 14:55:39 | 739 | ok | done 3, skipped 0, failed 0 | comments 51, files 5 | total done 2211, cursor saved |  |
| 2026-11-11 14:55:45 | 740 | ok | done 3, skipped 0, failed 0 | comments 7, files 0 | total done 2214, cursor saved |  |
| 2026-11-11 14:55:54 | 741 | ok | done 3, skipped 0, failed 0 | comments 30, files 1 | total done 2217, cursor saved |  |
| 2026-11-11 14:56:08 | 742 | ok | done 3, skipped 0, failed 0 | comments 21, files 1 | total done 2220, cursor saved |  |
| 2026-11-11 14:56:19 | 743 | ok | done 3, skipped 0, failed 0 | comments 29, files 2 | total done 2223, cursor saved |  |
| 2026-11-11 14:56:26 | 744 | ok | done 3, skipped 0, failed 0 | comments 12, files 0 | total done 2226, cursor saved |  |
| 2026-11-11 14:56:34 | 745 | ok | done 2, skipped 0, failed 0 | comments 2, files 2 | total done 2228, cursor saved |  last batch, run done |
