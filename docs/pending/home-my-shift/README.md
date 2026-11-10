# Home: My shift, End my shift, the 15 minute handoff alert, lunch and time off

Emily, Nov 7, confirmed Nov 9 (register T1, T2, T4, T6, S1, S4). Build 2 of 7. No publish.

## Files

| File | What it does |
| --- | --- |
| `01_home_my_shift.sql` | The schema step. Applied through the migration tool as `drizzle/migrations/0316_home_my_shift.sql`, byte for byte. |
| `01_undo_home_my_shift.sql` | Removes it all and restores `run_ticket_timed_alerts` exactly as captured live. |
| `02_time_off_start_setting.sql` | Data step: the setting `time_off_requests_start` = 2026-11-16. Applied with the data tool. |
| `02_undo_time_off_start_setting.sql` | Removes only that setting row (the built in default is still Nov 16). |
| `live-capture/public.run_ticket_timed_alerts.sql` | The every minute check as it was live on Nov 10, 2026 (md5 361fda50061293abc44eb7baf0e179f6, checked). |
| `practice_cancel.sql` | The cancelled live check (nothing kept). |
| `sha256.txt` | Checksums of the files above. |

## What changes in the database

New tables, read only through their policies (own rows, or Operations leadership); written only by the functions below:

- `shift_end_records`: one row each time someone ends a shift or hands off before lunch: who, when, kind (`end_of_shift` or `lunch`), Nothing to hand off, the tickets and the handoffs.
- `time_off_requests`: dates, optional note (400 characters), status `pending`, `approved` or `declined`, who decided, when, and the reason.

New functions (caller authenticated, `SECURITY DEFINER`, signed in users only):

- `shift_handoff_defaults(_at)`: the default receiver per team, from the routing function `coordinator_for` at the handoff time. If that is the person handing off, the Operations Supervisor.
- `end_my_shift(_kind, _at, _items, _nothing, _demo)`: one transaction. For each ticket the caller owns (open, not archived, not already waiting for Accept, not a quiet import): one `handoffs` row (type `shift_coverage`, the existing record the ticket's Accept and Decline settle), the ticket marked waiting for that person exactly as the ticket's Hand off form does (ownership is not moved), and one history line. Then one `shift_end_records` row. A role resolves to the person on shift in it; a role with nobody on shift goes to the Operations Supervisor.
- `request_time_off(_starts, _ends, _note, _demo)`: refused before the start date (setting, default Nov 16, 2026); tells the Operations Supervisor in app and by email.
- `decide_time_off(_id, _decision, _note)`: Operations leadership only; a decline needs a reason; the person is told.

Changed:

- `ticket_timed_alerts` allows two more kinds: `handoff_receiver`, `handoff_supervisor`.
- `run_ticket_timed_alerts` (the existing every minute job `ticket-timed-alerts`): parts a and b unchanged (a test compares them with the live capture). New part c: a Right now handoff still waiting 15 minutes after it was asked alerts the receiver and the Operations Supervisor, once each (the existing once only key), in app and email. The minutes can be set as `handoff_minutes` in `team_queue_timing`.

Unchanged: `handoffs` and its trigger (the receiver is still alerted at once), the ticket's Hand off, Accept and Decline, routing (`coordinator_for`, `coordinators_on_shift`, `ticket_route_at`, `auto_assign_ticket`), the schedule, cover, on call, every clock and every scheduled job.

## Applied and checked

- `0316_home_my_shift` matches `01_home_my_shift.sql` byte for byte; four new functions, two new tables; the job `ticket-timed-alerts` is still active every minute.
- `02_time_off_start_setting.sql` applied: one row.
- `practice_cancel.sql` ran and cancelled itself. Seen: the defaults came from routing; End my shift with two tickets made two waiting handoffs, two history lines and one shift record, the receiver was told at once, and the sender kept both until one was accepted; the 15 minute alert after two runs went once to the receiver and once to the Supervisor, in app with email queued; the evening role went to the person on shift; the weekday day role (nobody on shift) went to the Supervisor; someone who does not own a ticket and an empty list were refused; Nothing to hand off made one record; time off was refused before Nov 16 and, with the date moved inside the practice, reached the Supervisor; a coordinator could not decide it, a decline needed a reason, the Supervisor's approval told the person. Afterwards: no practice tickets, handoffs, alert lines, shift records, time off requests or setting rows remained.

## Undo

Roll the app code back first, then run `01_undo_home_my_shift.sql` and `02_undo_time_off_start_setting.sql`.
Handoffs made by End my shift stay; they are ordinary handoffs with Accept and Decline.
