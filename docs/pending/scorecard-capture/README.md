# Scorecard capture and archive instead of delete: pending database change

APPLIED Nov 8, 2026 with Emily's written approval. See the note at the end.
Staged Nov 8, 2026. Apply only with Emily's written approval, byte for byte,
in this order, after checking `sha256.txt`. The migration tool runs each file in one
transaction, so none has BEGIN/COMMIT lines. Capture only: nothing here scores or counts.

Until these files are applied, the new buttons answer "This is not ready yet. Nothing was
saved." and the automatic sweep log quietly records nothing. Nothing else changes.

## 1. `01_scorecard_records.sql` (new table, functions, one role row, one settings row)

- Role checks, roles only: Operations Supervisor (`ops_supervisor`, holder or cover),
  Director of Operations (existing `private.is_director`), COO, Operations staff
  (Admin, manager, coordinator). Adds the functional role `coo` (name "COO", nobody in it).
- `public.scorecard_records`: kind, who recorded it, server time, the person it is about,
  home, stay, ticket, short note, details, `refers_to` (for approvals) and
  `about_imported_ticket` (Notion flag, set by the database from the ticket).
  Add only: a trigger refuses every update, delete and truncate; RLS has a read policy only
  and `authenticated` has no insert, update or delete grant. The time is always `now()`.
- `public.scorecard_records_countable` (view): leaves out demo rows, Notion imports and
  archived tickets, so future counts have one filter.
- Functions (caller-authenticated, role checked in the database, server time):
  - `record_arrival_readiness(property, arrival date, stay ref, note)`: Operations staff.
    Saves the stay's check-in time from the home's check-in time and time zone (Central if
    none). One line per home and arrival date.
  - `log_queue_open(source)`: called on page open of Team Queue, Supervisor check and
    Oversight. Logs only for the Operations Supervisor, at most once per 5 minutes per page.
    No button.
  - `record_coaching_conversation(coordinator, strength, improvement, follow-up)`:
    Operations Supervisor only; month taken from server time.
  - `record_corrective_commitment(ticket, commitment, due date)`: Operations Supervisor or
    Director of Operations, guest issue tickets only.
  - `approve_corrective_commitment(record)`: COO only; a new line pointing at the commitment.
  - `record_finance_packet(week ending, complete, note)`: Supervisor or Director; a note is
    required when incomplete.
  - `weekly_submission` is an allowed kind with no writer yet (see the decisions below).
- Setting `guest_rating_channels` (default Airbnb and Vrbo) and
  `set_guest_rating_channels(channels)`: Supervisor or Director; each change is written to
  `audit_log`.

Undo: `01_undo_scorecard_records.sql` removes the record and settings functions and the COO
role row while nobody holds it. It keeps the table, its add-only triggers, the view and the
setting row so nothing recorded is lost. Run it last.

## 2. `02_ticket_times_and_states.sql` (triggers, one new table)

- `tickets_lock_receipt_time`: a signed-in screen can never pick `reported_at` (server time
  on insert); once set it can never change. Trusted server functions (Notion import, routine
  check) keep the time they set.
- `ticket_activity_server_time`: every history line gets server time. Only imported Notion
  comments and demo seeding written by a server function keep their own date.
- `public.ticket_state_log` (add only) and trigger `tickets_log_state`: each time a next
  action is set, changed or completed, and each time Waiting starts, changes or ends, with
  who we wait on, the reason, the next review time, who and when. Quiet imports are skipped.

Undo: `02_undo_ticket_times_and_states.sql` drops the three triggers and their functions and
keeps `ticket_state_log`.

## 3. `03_routine_check_lock.sql` (triggers, one new table, one function)

- A saved routine check cannot be edited or deleted. The only change allowed is linking the
  follow-up ticket once when it has none. Completion time is always server time.
- `public.routine_check_corrections` (add only) and `add_routine_correction(check, note)`
  (staff only, saved checks only).

Undo: `03_undo_routine_check_lock.sql` removes the lock, the stamp and the function; keeps
the corrections table.

## 4. `04_ticket_archive.sql` (policy removed, triggers, two functions)

- Drops `tickets_delete_admin` (Admin and manager could delete). Revokes delete on tickets
  (no delete grant existed). Trigger `tickets_never_delete` refuses every delete and truncate.
- `archive_ticket(ticket, reason)`: Admin or a Supervisor, reason required. Reuses
  `archived_at`, `archived_by`, `archive_reason` and writes a history line.
- `restore_ticket(ticket)`: Admin only, writes a history line.

Undo: `04_undo_ticket_archive.sql` restores the delete policy exactly as it was and removes
the trigger and functions. Archived tickets stay archived.

Undo order: 04, 03, 02, 01.

## Test

`src/lib/__tests__/scorecard-capture-sql.test.ts` loads all four files into an isolated
PostgreSQL with stubbed tables, checks every rule above, then runs the four undo files.
Nothing touches the real database.
