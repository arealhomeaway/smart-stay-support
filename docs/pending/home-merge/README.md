# Home and Team Queue: reopen tickets imported from Notion

APPLIED Nov 8, 2026 with Emily's written approval. See the note at the end.

## Order

1. `01_notion_reopen.sql` adds:
   - `public.reopen_notion_ticket(_ticket_id, _reason, _response_due_at, _action_due_at)`:
     caller-authenticated (Admin, Supervisor or Property Coordinator roles), reason
     required (3 to 500 characters), clock times must start from now. Makes the ticket
     live (`external_status = 'reopened_in_resolve'`, status `open`), assigns it to the
     caller, clears old acknowledgement, action and waiting marks, sets
     `last_reopened_at = now()` and writes one history line:
     "Reopened from Notion history" (closed or older open) or
     "Taken from the Notion import" (open, past 30 days).
   - `public.keep_reopened_notion_ticket()` and trigger `tickets_keep_reopened_notion`:
     while a Notion import rerun is running (`resolve.import_quiet = on`), a ticket
     already reopened in Resolve keeps its Resolve values.

No new columns or tables. It uses existing `external_source`, `external_status`,
`import_hold`, `last_reopened_at` and `ticket_activity`.

The migration tool runs the file in one transaction, so it has no BEGIN/COMMIT lines.

## Undo

`01_undo_notion_reopen.sql` drops the trigger and both functions. Tickets already
reopened keep their Resolve values and their history lines.

## What works before this is applied

Everything on screen: the merged Home, the Team Queue cleanup, the quiet
"Imported from Notion" group, badges and the import block. The Reopen and
"Take this ticket" buttons show a plain "still being set up" message until the
function exists.

## Tests

`src/lib/__tests__/notion-reopen-sql.test.ts` runs this file and its undo in an
isolated PostgreSQL (PGlite). Checksums are in `sha256.txt`.

## Applied

- Nov 8, 2026: APPLIED byte-for-byte as migration 0264 (`01_notion_reopen.sql`). Undo if ever needed: `01_undo_notion_reopen.sql`.
