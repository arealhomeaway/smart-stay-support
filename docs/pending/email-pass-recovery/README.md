# Email pass recovery (applied live Nov 16, approved by the Admin)

Applied as `drizzle/migrations/0349_email_pass_recovery.sql` (same SQL as `apply.sql`), with one
audit_log row `migration_applied` / `0349_email_pass_recovery`.

What it does
- `begin_email_job_run` closes every open run older than 10 minutes as failed
  (`closed_reason` and errors: "Closed automatically: run did not finish within 10 minutes"),
  writes one audit_log row `email_job_run_closed` per run (actor "Email pass (automatic)"), then
  starts the new pass. A run younger than 10 minutes is never closed and still refuses a new pass.
- The same start step runs `private.email_pass_health_check()`: if no pass has finished itself for
  30 minutes, every Admin role holder gets one in-app notice "Emails have not gone out since
  [time] Central" (email_status none, never emailed); one per outage (`email_pass_outages`, one open
  row at most); retracted and the outage closed when a pass has finished in the last 30 minutes.
  A failed check never stops a pass.
- Runs closed by staff earlier are backfilled with their closing note in `closed_reason`.

One pass at a time: the advisory lock and the open-run check in `begin_email_job_run` (kept),
`record_email_job_part` refusing a closed run (kept), and the app runner starting no new part after
7 minutes (`RUN_BUDGET_MS`, src/lib/email-job.server.ts, needs publish).

Undo: `apply.undo.sql` restores the start step exactly as read live Nov 16, removes the health check,
retracts outage notices and keeps the new column and table (marked retired).

Practice: `src/lib/__tests__/email-pass-recovery.test.ts` (isolated copy, 12 tests).
Live checks (both rolled back): stuck 11-minute run closed and next pass started; 9-minute run left
alone; outage noticed once to 2 Admins and cleared after a finished pass.
