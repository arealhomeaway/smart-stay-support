# Task uploads go straight into a folder: staged database change (NOT applied)

Approved build: Admin, Nov 15 (fix batch item 2). Apply only after "Approved: apply task-upload-folder", in one transaction:

```
BEGIN;
\i 00_preflight.sql
\i apply.sql
COMMIT;
```

Undo (one transaction): `BEGIN; \i apply.undo.sql COMMIT;`

## What it changes
- `public.begin_attachment_upload` (the first step of every upload). Today it keeps a folder only for files on a home itself; a file uploaded from a Task is always saved with no folder, so it shows in Other.
- After this change a Task upload (`onboarding_task`) keeps the folder picked before saving, when it is one of the home folder categories (Design and its groups, Agreements, PMA, Estimates and invoices, Photos, Inspections). Other, unknown or empty stays empty, exactly as today.
- Nothing else changes: same permission checks, same home uploads, same other records, same retry rule.
- Writes one audit_log row (`task_upload_folder_applied`).

## Until it is applied
- The Task drawer already sends the picked folder and no longer files it in a second step, so a Task upload lands in Other. Do not publish the Task drawer change before this is applied.

## Who can pick the folder
- Anyone who may already attach files to that Task. The old second step (`move_home_file`) allowed only the home's team, a Director or an Admin.

## Checks
- `00_preflight.sql` stops unless the live function is exactly the Nov 15 capture (md5 `1ca86db5ae5256afeb618e336161bda2`).
- Isolated practice run: `bun test src/lib/__tests__/task-upload-folder-sql.test.ts` (PGlite, 6 tests: before, apply, never Other, others unchanged, retry, exact undo).
- `checksums.sha256` covers every file here.
