# Real test run, Nov 10, 2026 (UTC)

Run from the sandbox with the same server step the nightly job calls (`runNightlyExportStep`,
kind test, full weekly copy forced), into `TEST export 2026-11-10_043042Z` in the existing
SharePoint backup location. Never the real daily folder; test runs never alert, never remove
folders and never mark files as copied.

| | Result |
|---|---|
| Tables | 244 (every public table at the start of the run) |
| Rows | 100,798 |
| Stored files listed | 2,159 |
| Stored files copied | 498 (1,626,882,178 bytes, about 1.6 GB), 0 failed |
| Not copied, listed with reason | 1,661 files in `backups` (Back up everything output) and the two old database dump stores |
| Check | Passed. 2 tables grew while it ran (email_job_runs 5,854 saved / 5,857 live; integration_events 13,341 / 13,342) |
| Time | 17 min 35 s in 5 calls (tables about 4 min, files about 13 min) |
| Test folder | deleted afterwards; SharePoint then held only the dated folders 2026-11-04 to 2026-11-09 |

Earlier attempts the same night, both deleted:
1. `TEST export 2026-11-10_041648Z`: tables passed (244, 100,780 rows, 4 min 31 s) but only 1
   stored file was queued, because the file list stopped at 1,000 rows. Fixed: the list is read
   1,000 at a time; a test now covers 1,206 files.
2. `TEST export 2026-11-10_042310Z`: stopped on purpose after one SharePoint "busy" (503) answer
   failed a file. Fixed: busy answers are tried again up to 4 times; tests cover it. The run is
   recorded as failed with that reason.

SharePoint size limit: the connection does not report one (drive quota is empty). A weekly full
copy is about 1.6 GB today; 12 weekly folders is about 20 GB, plus 30 nightly folders of table
files and changed files. Deleted folders go to the SharePoint recycle bin first.

Back up everything, run once after the export with the same server steps as its Admin buttons:
244 tables, 100,803 rows, 61 s, Verify passed (1 table grew: email_job_runs).

Forced failure alert: run inside the cancelled practice step (3 in-app alerts, email pending,
second alert the same night 0, rolled back) and in the stand-in tests. No email was sent.
