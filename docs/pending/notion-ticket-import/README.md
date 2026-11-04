# Notion ticket import: pending database change

Not applied. Apply `01_notion_ticket_import.sql` byte-for-byte with the usual checks; undo is `01_undo_notion_ticket_import.sql`.

Adds: `tickets.import_hold` (Backlog review / Needs a home), `ticket_activity.external_author_name` and `external_id` (unique per ticket),
import-quiet `WHEN` clauses on 12 ticket triggers (only active inside the import functions' own transaction), and three
Admin-only functions: `import_notion_ticket`, `import_notion_ticket_comments`, `import_notion_ticket_file`.
The tickets `(external_source, external_id)` unique rule already exists live (`tickets_external_unique`); the file asserts it.

Isolated test: `src/lib/__tests__/notion-import-sql.test.ts`.
