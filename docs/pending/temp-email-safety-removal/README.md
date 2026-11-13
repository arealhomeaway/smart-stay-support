# Remove the temporary overnight email safety

Not applied. Apply only after "Approved: apply temp-email-safety-removal".

What it removes (added Nov 12 so a stalled five-minute run could not block the 2 AM PID copy):
- the scheduled job `temp-close-stalled-email-run` (every 5 minutes, on)
- the function `private.temp_close_stalled_email_run()`

Checked Nov 13 before staging:
- The job is listed and on. The function is there; only the database owner may run it.
- Nothing else calls the function.
- It never closed a run: no audit_log row carries its label "COO (temporary rule)". The two runs closed Nov 12 were closed by staff review.
- No five-minute run is open now (every email_job_runs row has finished_at).

Files
- `00_preflight.sql` stops unless the job and function are both there and nothing else calls the function.
- `apply.sql` unschedules the job, drops the function, writes one audit_log row.
- `apply.undo.sql` puts the function back exactly as read live and schedules the job again.
- `live-capture/temp_close_stalled_email_run.sql` is the live function as read Nov 13.

Limit: the job's stored command could not be read with the tools here, so the undo schedules
`SELECT private.temp_close_stalled_email_run();` on the same schedule.

Practice run: `src/lib/__tests__/temp-email-safety-removal-sql.test.ts` on an isolated copy.
