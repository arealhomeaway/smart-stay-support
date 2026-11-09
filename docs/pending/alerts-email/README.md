# Team Queue alert emails right away (register T7, alerts batch answer 1). APPLIED Nov 8, 2026

Emily, Nov 8: the Supervisor alert (10 minutes) and the Director alert (15 minutes) on the Team
Queue are emailed right away, not on the 5-minute pass. Claim hold unchanged.

How: instead of a second run every minute (1,440 runs a day, refused for cost), the database asks
for the email the moment it writes one of these two alerts. One request per alert, carrying only
the alert id. The app sends it through the same sender and safety checks as every other staff
email (demo never emailed, staff only, personal settings). No new scheduled job.

| File | What it does |
|---|---|
| `01_team_queue_alert_email_now.sql` | Adds `private.request_team_queue_alert_email()` and the trigger `staff_notifications_team_queue_email_now` (after insert, only these two kinds, email pending, not demo). Applied byte-for-byte as migration 0306. |
| `01_undo_team_queue_alert_email_now.sql` | Removes both. |

Nothing existing was replaced: `staff_notifications` had no triggers before; the function is new.

App side (takes effect on publish):
- `src/routes/api/public/hooks/team-queue-alert-email.ts`: checks the database-held scheduler
  token, then sends exactly that one alert, only if it is one of the two kinds.
- `src/lib/staff-notify.server.ts`: the 5-minute pass leaves these two kinds alone for 10 minutes,
  then sends any still waiting (a failed instant send is never lost).

Until publish, the published 5-minute pass keeps sending these emails as it does today, and the
instant request reaches nothing. No double emails: each alert is marked sent by whichever path
sends it first.

Live check, Nov 8 (cancelled, nothing kept): three practice alerts saved (Supervisor alert,
demo Director alert, ticket note). Exactly one request was queued, for the Supervisor alert, to
the app address, with the token header.
