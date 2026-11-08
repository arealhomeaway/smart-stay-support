# Alerts and approvals

Emily's decisions of Nov 7, 2026 (punch list: Team Queue alert timing, gaps to build a to g;
register T2, T6, C2, C3, H5). Nothing is deleted. Apply in order 01 to 05 with the migration tool,
then 06 with the data tool. Each file has its own undo.

## Files

| File | Kind | What it does |
|---|---|---|
| `01_team_queue_and_waiting_alerts.sql` | migration | New column `tickets.unowned_since` (backfilled for open tickets nobody owns; quiet Notion imports stay empty) and trigger `tickets_owner_wait_clock`: a ticket created with no owner or given back starts waiting; when someone takes it the unmet response and work start clocks move forward by the wait, so waiting never counts against the taker. New table `ticket_timed_alerts` (one row per alert, unique per ticket, kind and wait or return time). New function `run_ticket_timed_alerts()` and job `ticket-timed-alerts` every minute: a Right now ticket nobody has taken alerts the Operations Supervisor at 10 minutes and the Director of Operations at 15, once each, in app and email; a waiting ticket alerts its owner at the return time, once per return time. `notify_ticket_flow_events` no longer sends Back from waiting on a status change; closure QA is byte-identical. |
| `02_note_alerts.sql` | migration | Trigger `ticket_activity_note_alerts` and `private.notify_ticket_note()`: a person's note alerts the people mentioned ("You were mentioned") and the owner and the people involved ("New note"), in app and email, nobody twice, never the author. Mentions are recorded in the existing `ticket_activity.mentions`. |
| `03_approval_links.sql` | migration | `private.ticket_link_for()` plus six functions where only the link changes: approval needed, send for approval, refund approval needed, refund decided, waiver requested, waiver decided now open `/tickets/<id>` when the item has a ticket, in the app and the email. |
| `04_claim_approval.sql` | migration | Claim approval columns on `claims`, `private.claim_required_authority()`, `request_claim_approval()`, `decide_claim_approval()` and trigger `guard_claim_approval` (approval fields change only through the two functions; a claim over $500 cannot move to Submitted or later without an approval at the right level for at least that amount). |
| `05_notification_categories.sql` | migration | Four preference columns, all default on: Notes and mentions, Team Queue (email and in app). |
| `06_team_queue_timing_setting.sql` | data | `app_settings` key `team_queue_timing`: 3, 10 and 15 minutes; Today day shift ends 17:00, night shift ends 22:00, red 120 minutes before; Routine default 24 hours. |
| `0N_undo_*.sql` | undo | One per file. Undo 01 and 03 restore the live captures exactly; the others remove only what their file added. |
| `live-capture/` | evidence | Live definitions before the change. |

## Differences from byte for byte

The first line of `01` is the review comment the migration tool needs for a scheduled job
(`lovable-cron-fallback-reviewed`). It is a comment and changes no SQL. The first comment line of
`03` was corrected from "part 4" to "part 3" before applying; also a comment only.

## Applied (Nov 8, 2026)

| File | Applied as |
|---|---|
| 01 | `drizzle/migrations/0299_alerts_01_team_queue_and_waiting_alerts.sql` |
| 02 | `drizzle/migrations/0300_alerts_02_note_alerts.sql` |
| 03 | `drizzle/migrations/0301_alerts_03_approval_links.sql` |
| 04 | `drizzle/migrations/0302_alerts_04_claim_approval.sql` |
| 05 | `drizzle/migrations/0303_alerts_05_notification_categories.sql` |
| 06 | data tool, one `app_settings` row |

Each applied file is byte-identical to the staged file (checked with diff). Live captures were
re-read just before applying and still matched.

Cancelled live check (nothing kept, counts checked afterwards: 42 tickets, 9 claims, 0 timed
alert rows, no test notes, notifications or approvals left):
- Right now at 3 minutes: no alert. At 10 minutes: the Operations Supervisor once. At 15 minutes
  (Supervisor already alerted): the Director of Operations once. A second run sent nothing.
- Today ticket unowned 5 hours: no alert.
- Waiting ticket past its return time: its owner once; a second run nothing; moving it back to
  open by hand added no second alert.
- Taken after 12 minutes with no owner: response and work start due times moved 12 minutes.
- Note by the Supervisor mentioning a coordinator: the coordinator got "You were mentioned", the
  owner got "New note", the author nothing.
- Approval alert link: `/tickets/<id>`.
- Claims: $400 needs no approval; $600 goes to the Operations Supervisor, $1,600 to the Director of
  Operations, both alerts link to the ticket; a coordinator cannot decide; the Supervisor cannot
  decide $1,600; a decision with no reason is refused; the approval fields cannot be edited directly.
- Every alert above queued an email (status pending); none was sent because nothing was kept.

## Not changed

Ticket routing, the SLA rules and clocks for owned tickets, the 5 minute notify pass, the deadline
and vendor alerts (other than the vendor no acknowledgment link, in app code), Direct Bookings
alerts and their 20 second job, handoff alerts, and every other trigger.

## Proof before applying

`src/lib/__tests__/alerts-sql.test.ts` runs every file on an isolated PostgreSQL with the live
helper captures: 3, 10 and 15 minutes with no repeats, given back tickets, demo, quiet Notion,
Today, Routine and waiting excluded, the three automated sources included, the wait clock, return
time alerts, note and mention alerts, ticket links, the claim ladder and gate, the schedule, the
setting, the preference defaults, and every undo.
