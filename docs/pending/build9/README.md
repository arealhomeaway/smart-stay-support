# Build 9 database steps (Emily, Nov 10)

Each step has its forward file here and its undo in `undo/` with the same name. Checksums of every
file are in `sha256.json` (SHA-256 of the file bytes). Applied steps went through the migration tool
byte for byte (whitespace only) after a cancelled practice on real accounts; nothing else was applied.

| File | Item | State | What it does |
|---|---|---|---|
| 01_reply_time_guard.sql | A5 | APPLIED as migration 0320 | Staff cannot write a request's reply time, who replied, how it was sent, or how it was answered. Only Resolve's server steps can: `record_direct_booking_reply` (Send reply and Mark as sent), `answer_direct_booking_in_portal` (I answered in the partner's portal), `correct_direct_booking_portal_answer` (Supervisor or Admin correction), and server code on the service connection. No screen writes these columns directly. |
| 02_time_off_all_or_nothing.sql | C2 | APPLIED as migration 0321 | `approve_time_off` saves the chosen time off and cover rows, their audit lines and the approval in one step, or nothing. |
| 03_handoff_ready_authority.sql | F3 | APPLIED as migration 0322 | On a home's handoff tab only the Director of Onboarding marks ready; the Director of Operations, the person covering that role now, or Admin accepts. |
| 04_move_to_queue.sql | B1 | STAGED, waiting for approval | Move to queue on Databases, Tickets, Older open, for the Operations Supervisor and the Director of Operations. The button stays hidden until this is applied (`MOVE_TO_QUEUE_LIVE` in `src/lib/ticket-tabs.ts`). |
| 05_shift_history_full_stop.sql | C5 | STAGED, waiting for approval | End my shift history line gets its full stop after Done so far. |
| 06_export_fewer_alert.sql | H2 | STAGED, waiting for approval | Next morning Admin alert naming tables that hold fewer rows than last night's export. The check page warning works today without it. |
| 07_task_role_wording.sql | G1 | STAGE ONLY (Emily) | Role words in the text of 63 open onboarding Tasks across 9 homes. Preview: `07_task_role_wording_preview.md`. |
| 08_database_text.sql | G2 | STAGE ONLY (Emily) | Text written by 26 database functions without long dashes, and the Emergency Only vendor message with Right now, Today, Routine. Preview: `08_database_text_preview.md`. |

## Practice runs (cancelled, nothing kept)

- `practice_01_reply_time_guard.sql`: a signed in Admin's direct change to reply time, who replied and how answered was refused; other request fields and the server steps still saved.
- `practice_02_time_off_all_or_nothing.sql`: a coordinator was refused; the Supervisor's approval saved 2 rows, 2 audit lines and 1 notice together; a bad cover or a protected role saved nothing; a second approval was refused.
- `practice_03_handoff_ready_authority.sql`: only the Director of Onboarding marked ready; the Director of Operations and Admin accepted; everyone else was refused; the home stayed as it was.
- `practice_04_move_to_queue.sql`: a coordinator and the Director of Onboarding were refused; the Supervisor and the Director of Operations moved 2 tickets; moving again changed 0; the tickets kept no owner and no clock; 2 history lines; nothing kept afterwards.

## To apply a staged step

Pass the forward file to the migration tool unchanged. To undo, pass the file in `undo/`.
For 04, also set `MOVE_TO_QUEUE_LIVE` to `true` in the same change.
