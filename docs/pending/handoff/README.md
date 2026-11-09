# Handoff never blocks, and handoff reminders

Emily, Nov 7, 2026 (register O4, punch list H4). Not published.

## Status

| File | What it does | Status |
| --- | --- | --- |
| 01_handoff_reminders.sql | Reminder log, reminder rule and the daily job | APPLIED as migration 0304 (byte for byte) |
| 02_flag_snapshot_table.sql | Place to keep the exact old marks for undo | APPLIED as migration 0305 (byte for byte) |
| 03_clear_handoff_flags.sql | Clears Required and Blocks handoff, publishes plan version 4 | APPLIED with the data tool (byte for byte) |
| 04_fix_handoff_acceptance.sql | One line correction so a handoff with carry over items can be accepted | APPLIED as migration 0307 (Emily, Nov 9: yes). Byte for byte; the file's first line still reads "STAGED, NOT APPLIED" because the applied text had to match the file |

The only text added to 01 that is not SQL is its first comment line (the review note the database tool needs for a scheduled job).

Undo, newest first: 04_undo (04 is applied), then 03_undo, 02_undo, 01_undo.

## 01 Reminders

- Who: the Operations Supervisor and the Director of Operations (roles, read at send time). One person holding both gets one alert.
- When: 8 AM Central, 7 days before, 2 days before and on the handoff date (the project's handoff date). The job runs at 13:00 and 14:00 UTC and acts only in the 8 AM Central hour, so it stays at 8 AM through daylight saving changes.
- How: in app and email through the existing staff alert path; email goes out on the existing 5 minute pass. The alert opens the home's Handoff tab.
- Wording: "Handoff in 7 days: <home>", "Handoff in 2 days: <home>", "Handoff today: <home>"; body "Handoff date: Monday, November 16. Anything still open carries over to Operations."
- Once each: one row per project, handoff date and reminder. A moved date is a new date, so reminders follow it; the old date's remaining reminders never fire.
- Never: after the handoff is accepted (project or home), for a cancelled or completed project, a demo home, or a project with no date.
- Preferences: kind `handoff_reminder` falls in the existing Handoffs category.
- Today no real project has a future handoff date, so no reminder would go out until a date is set.

## 03 Clearing the marks (counts checked live just before applying)

| | Before | After |
| --- | --- | --- |
| Standard plan steps marked Blocks handoff | 134 | 109 |
| Standard plan steps marked Required | 137 | 112 |
| Handoff steps (Preparing for Handoff 18, Handoff 7) with either mark | 25 | 0 |
| Home Tasks marked Blocks handoff | 1,550 | 60 (the 60 completed, unchanged) |
| Home Tasks marked Required | 1,738 | 248 |
| Standard plan versions | 1, 2, 3 | 1, 2, 3, 4 |

- 1,490 open home Tasks changed, on 9 homes; none was on a home whose handoff is in review or accepted. Archived open Tasks are included (they were marked and open).
- The mirror on the work list followed automatically (1,497 linked items, 0 still marked).
- Version 3 is permanent and unchanged. Version 4 is version 3 with only these two marks cleared on the 25 handoff steps (checked step by step). New homes start on version 4; homes already started keep their own Tasks.
- History: 10 audit lines (1 plan, 9 homes), reason "O4: a handoff never blocks".
- Every changed row's exact old values are in `onboarding_flag_snapshots` (key `handoff_never_blocks_2026_11_08`, 1,515 rows).
- It stops with no change if run twice, if the plan is not on version 3, if the live plan differs from version 3, or if any count is not exactly as reported.

Undo restores the exact old marks and publishes version 5 with version 3's content (versions cannot be deleted). Row change times stay at the time of the change.

## 04 Correction found while testing (applied Nov 9, 2026 as migration 0307)

Accepting a handoff with any carry over item fails today: `perform_handoff_step` writes the new Ticket's history line into columns that do not exist (`actor_id`, `note`; the table has `author_id`, `body`), so the whole acceptance rolls back. No handoff has ever been accepted through it. 04 replaces only that line; the rest is the live definition byte for byte (captured in `live-capture/perform_handoff_step.sql`), and grants stay as they are.

Before applying (Nov 9): the live definition still matched the capture exactly. After applying: the live
definition differs from the capture in that one line only; grants unchanged (authenticated, service_role).
The migration file matches 04 except the final line break, which the migration tool drops.

Cancelled live tests after applying (Nov 9, nothing kept):
- Home with 133 open Tasks, 24 of them in the handoff stages (Preparing for Handoff 17, Handoff 7):
  the Director of Onboarding marked it ready, then the Director of Operations accepted. 182 carry
  over items (49 requirements, 133 Tasks), each with its own Ticket (title and source match) and
  exactly one history line "Carry-over accepted from Onboarding." by the person accepting. All 24
  handoff stage Tasks and all 133 open Tasks are covered by a carry over Ticket. Project complete,
  home active. Each Ticket also has the usual automatic assignment line; on Sunday evening all 182
  went to the Operations Supervisor (the default owner role on the accept screen).
- No carry over items: a demo home already marked ready, its 49 open requirements marked Not
  applicable first, then accepted: 0 carry over items, 0 Tickets, one acceptance history line.
- Refused, nothing changed: accept before ready; mark ready by someone who is not the Director of
  Onboarding; accept by someone who is not the Director of Operations; one item missing from the
  list; safety items without the booking block confirmation. The home stayed ready, no Tickets.
  The home handoff has no Decline step.
- Afterwards: no carry over rows, no new Tickets, no handoff history, no practice decisions; both
  projects as before.

## Checks run

- Isolated tests: `src/lib/__tests__/handoff-sql.test.ts` (12) run these files byte for byte; `src/lib/__tests__/handoff-never-blocks.test.ts` (7) cover the screens.
- Cancelled live step 1 (nothing kept): ran 03 byte for byte (counts as above), then reminders on a real home: 7 days out sent 1 to both roles with email pending and the Handoff tab link; same morning again 0; next day 0; a handed off project 0; date moved to Nov 20: old 2 day date 0, new 7 day, 2 day and day of 1 each; no date 0.
- Cancelled live step 2 (nothing kept): a real home with 133 open Tasks (24 handoff Tasks, none marked) marked ready, then accept: refused today by the column error above; with 04 inside the cancelled step, accepted, 182 carry over items each with a Ticket and history line, all 24 open handoff Tasks covered, grants kept.
- After both: no reminder rows or alerts, no carry over rows or Tickets, both projects unchanged, 04 not applied (it was applied later, Nov 9).
