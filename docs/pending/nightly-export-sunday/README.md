# nightly-export-sunday (approved by the Admin, Nov 15 2026; applied live at the Admin's instruction, no staging)

Why: the Sunday full copy of every stored file (4.2 GB, 5,754 files on Nov 15) needed about 3.5 hours of
night, and the 2 to 5 AM window with a call every 10 minutes gave about 1 hour of working time.

Database (live now):
- `schedule.sql`: job 16 `nightly-export-continue` every 5 minutes, 07:05 to 12:55 UTC (was every 10, 07:05 to 10:55);
  job 17 `nightly-export-missed-check` at 15 past 10, 11, 12 and 13 UTC (was 10 and 11). Only the timing changed.
  Run with `cron.alter_job` because the migration tool may not touch the scheduler.
- `apply.sql` = `drizzle/migrations/0342_nightly_export_sunday.sql`: the missed check alerts at 7 AM Central on the
  weekly night (setting `nightly_export_settings.weekly_day`, Sunday) and at 5 AM on every other night. Audit action
  `nightly_export_sunday_applied`.
- Undo: `apply.undo.sql` then `schedule.undo.sql` (exact Nov 15 capture in `live-capture/`).

App code (takes effect when published):
- `src/lib/nightly-export.ts`: `exportEndHour` / `inExportWindow`: the weekly night works until 7 AM Central.
- `src/routes/api/public/hooks/nightly-backup.ts`: reads the saved weekly day for the window.
- `src/lib/nightly-export.server.ts`: per-request time limit (30 s) and retries, per-file limit (45 s or more for large
  files) with a second try, then the file is recorded as failed; each run-record write is fenced by the call's lease.

Capacity: weeknights about 2 hours of working time (36 calls), the weekly night about 3 hours 20 minutes (60 calls),
against about 1 hour before. At the measured rate of about 3.3 GB an hour, about 11 GB for the weekly full copy.

Practice run: `src/lib/__tests__/nightly-export-sql.test.ts` (database) and `nightly-export-run.test.ts` /
`nightly-export.test.ts` (app code).
