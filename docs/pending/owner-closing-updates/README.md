# owner-closing-updates (APPLIED Nov 23 2026, 13:38 UTC, migration 0368, on "Approved: apply owner-closing-updates")

Owner updates 1, 2 and 3 after closing replace the Friday weekly update (Admin, Nov 22).
Apply only on the exact words `Approved: apply owner-closing-updates`.

## What apply.sql does (one transaction, additive, one audit row `owner_closing_updates.apply`)
1. New record `owner_closing_updates`: one row per home per update (1, 2, 3) with its closing date, send day,
   9:00 AM home time, status, the Project Manager's edit for this send only, who held it, and what was sent.
   Sent, test sent, missed, failed and held updates are final; nothing is removed. Staff can read it.
2. New append-only history `owner_closing_update_events`.
3. Edit (`edit_owner_closing_update`) and Hold (`hold_owner_closing_update`): the home's Project Manager; the
   Director of Onboarding and Admin cover. Only before the send time. Hold skips that one update for good.
4. Setting `owner_update_test_inbox` = emily.jimenez@arealhomeaway.com. While it is set, every update and every
   test copy goes only to that inbox: no owner email, no portal post. Removing it later needs its own approval.
Nothing existing changes: no Task, card, notice, email, permission or existing weekly update row.

## Screen and job (built in preview, not published)
- Owner tab: an Owner updates card (Closing date, Update 1 to 3 with day and status), Preview with Edit, Hold and
  Send a test copy; a Needs action row the business day before each send; the 6 days prompt.
- Five-minute job (after publish): schedules each home's updates, sends the Project Manager preview at 9:00 AM home
  time the business day before, sends at 9:00 AM home time, and marks an update missed (never sent late) if it was
  not sent by 5:00 PM that day. The Friday weekly drafts and auto-send no longer run.
- Before apply, the card shows the dates as Planned and Edit and Hold are off.

## Preflight (read only, Nov 23): all 7 checks ok

## Practice (Nov 23, live database, rolled back), 3400 N Fern Avenue
- Project Manager edits update 1: saved. Project Manager of other homes edits it: refused.
- Blank message: refused. Project Manager of other homes holds update 2: refused.
- Director of Onboarding holds update 2: held. Hold again: already held. Edit a held update: refused.
- Project Manager puts the template back on update 1: saved.
- Un-hold directly, change a sent update, remove an update, remove history: all refused.
- 3 history lines (edited, held, edit_cleared); test inbox set; 0 owner notices, 0 emails, 0 staff notices.
- After undo: records, actions and setting gone; the 2 practice updates kept in the undo audit line.

## Undo
apply.undo.sql copies every update and history line into one audit line, then removes the actions, guards, both
records and the test inbox setting. The Owner tab then shows the dates as Planned with Edit and Hold off.
