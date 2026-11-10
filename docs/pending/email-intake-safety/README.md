# Email intake safety batch (Emily, Nov 9)

Readiness items 1 to 7 from docs/pending/email-intake-readiness-nov9.md. The email_intake switch stays OFF and the
timed sweep job stays inactive until Emily says go.

## Files
- 01-schema.sql: applied as drizzle/migrations/0314_email_intake_safety.sql (byte identical, Nov 9).
  - guard trigger `feature_flags_email_intake_guard`: the switch cannot be flipped directly.
  - `set_email_intake(boolean)` (Admin only): on moves the start line to that moment (forward only, whole seconds,
    rounded up); off leaves it; each change is an integration_events row `email_intake_switch` with who and when.
  - `email_intake_sweep_job()` (staff): whether the timed sweep job is active and its schedule, for the inbox panel.
  - trigger `staff_notifications_email_test_prefix`: alerts about an email test record start with "Test: ".
  - `clear_email_intake_test_records()` (Admin only): archives every test Ticket through archive_ticket with the
    reason "Email intake test"; sets every test request to Not booked, reason Other, note "Email intake test", with a
    history line; one integration_events row `test_records_cleared` with who, when and counts.
  - scheduler: job `resolve-mailbox-sync` now every minute (was every 10 minutes), sends the private scheduler token
    (was the public project key), and its command only calls out while the switch is on. Still inactive. The old job
    is saved in private.email_intake_safety_undo for undo.
- 02-data.sql: applied through the database query tool. The Sep 1 23:49 claim left "processing" is now "skipped"
  so it can never create work (1 row).
- undo.sql: part A puts that row back; part B restores the old job exactly from the saved copy and drops what
  01 added. The start line and switch history are records and stay. Roll back the app code with it (the sweep route
  no longer accepts the project key the old job sends).
- sha256.json: checksums of the files above.

## Checked
- src/lib/__tests__/email-intake-safety-sql.test.ts runs 01, 02 and undo against an isolated copy (12 checks).
- A cancelled real database step (nothing kept): a test Ticket and a test request, their alert, Clear test records
  and a direct switch change. Afterwards 0 test rows, switch off, job inactive, start line unchanged.

## To switch on (only when Emily says go)
1. Publish (the live site must have this code).
2. Turn on Email intake in Workflow controls (Admin). This moves the start line to that moment.
3. Turn the timed check on: `SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'resolve-mailbox-sync'), active := true);`
4. Press Refresh notifications on the Integrations inbox panel, then run the test plan.
