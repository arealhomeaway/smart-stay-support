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
| `0N_undo_*.sql` | undo | One per file. Undo 01 and 03 restore the live captures exactly. |
| `live-capture/` | evidence | Live definitions before the change. |

## Differences from byte for byte

The first line of `01` is the review comment the migration tool needs for a scheduled job
(`lovable-cron-fallback-reviewed`). It is a comment and changes no SQL.

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
