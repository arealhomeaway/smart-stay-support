# Notion history import run, Nov 10 (overnight Nov 11 UTC)

## Status: STOPPED BEFORE STARTING. Nothing imported. No backup taken.

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
