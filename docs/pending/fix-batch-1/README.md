# Fix batch 1 (staged, NOT applied)

Approved by Emily (Nov 8, 2026). Nothing in this folder has been run against the live
database. Apply only with explicit approval, in the order below, and check `sha256.txt` first.

| Order | File | How to apply | Undo |
| --- | --- | --- | --- |
| 1 | `01_notion_import_ticket_type.sql` | migration tool, byte for byte | `01_undo_notion_import_ticket_type.sql` (restores the applied 0273 function) |
| 2 | `02_reopen_ticket.sql` | migration tool, byte for byte | `02_undo_reopen_ticket.sql` (drops the new function) |
| 3 | `03_claims_team_b.sql` | data tool (one row data change, not a migration) | `03_undo_claims_team_b.sql` |
| 4 | `04_tighten_record_tables.sql` | migration tool, byte for byte | `04_undo_tighten_record_tables.sql` |

## What each part does

1. **Notion import can create tickets.** `import_notion_ticket` keeps the applied guard
   exactly (Admin only, a reopened ticket returns `kept`, a missing created date is refused,
   a same-sync rerun returns `skipped`). The one change: a first time import sets
   `record_type = 'active_task'` for open and closed tickets alike. Updates never touch it.
2. **Reopen any closed ticket.** New `reopen_ticket(ticket, reason, response due, action due)`:
   staff roles that work tickets only (Admin, manager, coordinator; onboarding refused),
   reason 3 to 500 characters, closed and not archived, not a one touch log. It opens the
   ticket, starts fresh clocks from that moment, assigns it to the person who reopened it,
   adds one history line "Reopened. Reason: ...". A Notion import that is still quiet is sent
   to the existing Imported from Notion Reopen (unchanged).
3. **Claims go to Team B.** Only the Claims work type role link changes, from the Guest
   Experience day coordinator role to the Property Operations day coordinator role. Its team
   label and backup note are left unchanged (nothing reads them today). Every other work type
   is unchanged. No ticket uses Claims today.
4. **Tighten the record tables.** Removes insert, update and delete rights from signed-in and
   signed-out sessions on `scorecard_records`, `ticket_state_log`, `routine_check_corrections`.
   Reads stay. The record functions run with elevated rights and keep working. Truncate is not
   part of this change; the add-only triggers already refuse it.

## Proof run before staging

- Local database tests: `src/lib/__tests__/fix-batch-1-sql.test.ts` (import before and after,
  rerun, guard, undo; reopen rules; Claims only row; rights and undo).
- Real database, inside one step cancelled at the end (nothing kept, checked afterwards):
  installed parts 1, 2 and 4 from these files (function bodies matched the files exactly),
  then: an Admin import created an open recent ticket, a closed ticket and a ticket with a
  claim, all `active_task`, unassigned, no clocks, no history lines, no staff alerts; a rerun
  returned `skipped` and changed nothing; a missing created date was refused. A coordinator
  reopened the closed Notion import (existing path) and a closed ordinary ticket (new path):
  open, assigned to them, fresh clocks, one history line. Onboarding was refused on both.
  With part 4 in place: coordinator ticket creation, a note, next step, Waiting set and
  cleared, close and reopen all saved and wrote step history; a routine check saved with a
  linked Team B ticket and a correction; the Supervisor queue-open record and a coaching
  record saved; direct writes to the three tables were refused (permission denied).

## App code that depends on part 2

The ticket page Reopen for ordinary closed tickets calls `reopen_ticket`. Until part 2 is
applied that button shows a plain "not available yet" message and changes nothing.
