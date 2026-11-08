# Notion import runner: pending database change

APPLIED Nov 8, 2026 with Emily's written approval. See the note at the end.
Staged Nov 8, 2026. Apply only with Emily's written approval, byte for byte,
after checking `sha256.txt`.

The runner works without this file: it already skips tickets that were reopened or taken,
always sends a created date, and only an Admin session can call the import functions.
This file moves those protections into the database so they hold even if the app changes.

## Order

1. `01_import_guard.sql`
   - `public.import_notion_ticket(jsonb)`: same body as live, plus
     - a ticket with `external_status = 'reopened_in_resolve'` returns action `kept`; the
       ticket and its linked claim are not touched;
     - a missing `reported_at` (Notion created date) is refused instead of becoming now.
   - Execute on the three import functions is removed from `service_role`; only signed-in
     sessions can call them, and each function still refuses anyone who is not an Admin.

No new tables or columns.

## Undo

`01_undo_import_guard.sql` restores the live function body exactly (as read Nov 8, 2026)
and gives `service_role` execute back.

## Test

`src/lib/__tests__/notion-runner-sql.test.ts` loads the live import functions, the live
reopen protection and this file into an isolated PostgreSQL and checks both guards, the
duplicate rule and the undo. Nothing touches the real database.
