# Full nightly export to SharePoint (register N10). APPLIED Nov 10, 2026

Emily, Nov 9: the nightly export must cover everything before the team relies on Resolve.

| File | What it does | Undo |
|---|---|---|
| `01_nightly_export.sql` | New fields on `backup_runs` (kind, weekly, phase, saved progress, counts, check result); `backup_file_copies` (last copy of each stored file); `backup_export_alerts` (one alert per night); `backup_list_files` (server only); `can_view_export_check` and the two read rules for the check page; `nightly_export_alert` (server only); `private.nightly_export_missed_check`; two new scheduled jobs. | `01_undo_nightly_export.sql` |
| `02_export_settings.sql` | Setting `nightly_export_settings`: keep 30 nightly and 12 weekly folders, full file copy on Sunday nights. Data only. | `02_undo_export_settings.sql` |
| `practice_cancel.sql` | The practice run: step 01 plus checks, cancelled at the end. | none needed |

Applied: `01` byte for byte as migration 0318 after its practice run was cancelled with nothing
kept; `02` as a data step. Checksums in `sha256.txt`.

## Scheduled jobs, before and after

| Job | Before | After |
|---|---|---|
| `nightly-backup-0700utc` (8) | `0 7 * * *`, calls `/api/public/hooks/nightly-backup` | unchanged |
| `nightly-backup-0800utc` (9) | `0 8 * * *`, same | unchanged |
| `nightly-export-continue` (16) | none | `5-55/10 7-10 * * *`, same address and private backup token |
| `nightly-export-missed-check` (17) | none | `15 10,11 * * *`, database only, acts in the 5 AM Central hour |

Until publish, the published app still runs the 8 spreadsheet backup at 2 AM; the extra calls
find that night already done and do nothing, and the 5 AM check counts that backup as a run, so
nobody is alerted about work that is not published yet.

## How a night runs (after publish)

Each call between 2 and 5 AM Central works for about 3 minutes and saves where it got to, so no
single call has to finish everything:
1. Every table in the public schema, from `backup_list_tables` (the Back up everything list): one
   JSON file each in `<date>/tables/`, tables over 5,000 rows in numbered parts. Secret columns are
   left out by `backup_secret_column`; the login system's tables are not in the public schema.
2. The 8 spreadsheets the nightly backup always wrote, unchanged, at the top of the folder.
3. `files-inventory.csv`: every stored file (store, folder, name, size, etag, type, owner record,
   whether it was copied). New or changed files are copied to `<date>/files/<store>/<path>`;
   Sunday copies every file. The `backups` store (Back up everything output) and the two old
   database dump stores are listed but not copied, with the reason.
4. `manifest.json`: every table, its rows, its rows at the start and end of the run, its
   fingerprint (sha256) and size, the other files and the stored file totals.
5. Check: the manifest is read back and must match byte for byte; every table that existed at the
   start must be in it; every file it lists must be in SharePoint with the same size; each table
   must hold at least the smaller of its counts at the start and end of the run; no stored file may
   have failed to copy. Live counts are then compared: more rows live is allowed (added after the
   table was saved, shown as grew); fewer is shown but does not fail. Passed or Failed is saved
   with the reasons.
6. On Passed, folders beyond the newest 30 nightly and newest 12 weekly are removed (only dated
   folders recorded in `backup_runs`). On Failed, or after 3 failed calls in a row, every Admin
   and the Director of Operations get an in-app alert, emailed by the existing 5 minute pass. The
   5 AM check alerts when no export passed.

## Practice run (cancelled), Nov 10, 2026

Jobs: the two existing nightly jobs unchanged, the two new jobs active. Readers: Admin,
Operations Supervisor, Director of Operations, Director of Onboarding yes; Finance lead,
Coordinator, Project Manager no. Run history seen: Supervisor 6 rows, Coordinator 0, Finance 0.
Stored files listed: 2,159 (2,014,891,074 bytes). 5 AM check: Nov 9 (backup ran) no alert; a night
with no run 3 alerts; outside 5 AM nothing. Forced failure alert: 3 people (2 Admins and the
Director of Operations), title "Nightly export failed", email pending, link to the check page;
a second alert the same night: 0. All rolled back: no jobs, columns, tables or alerts kept.

## Real test run

See `real-run.md`.
