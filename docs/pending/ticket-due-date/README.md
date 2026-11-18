# ticket-due-date (staged, not applied)

Due date on Operations tickets (Emily, Nov 18).

## What it changes
- `tickets.due_on` (date, empty allowed).
- `tickets_zz_due_on_default` BEFORE INSERT: when no date is given, Right now and Today are due today, Routine in
  7 days (Central). Runs for every way a ticket is created (Record work, email, Direct Bookings, Breezeway, imports,
  demo). Named to run after the other insert rules so it reads the final priority. A later priority change never
  touches the date.
- Every existing open ticket (not resolved, not closed) gets a date once from its priority and its reported date
  (Central): Right now and Today = reported date, Routine = reported date + 7. Resolved and closed stay empty.
  Then the Notion step below replaces that default where a Notion Due Date exists.
- Open tickets from the Notion import: the Due Date read once (Nov 18) from each ticket's own Notion page, using the
  page link the import kept (`external_id`) and the existing Notion connection. Read only; nothing was written to
  Notion. Values in `notion-due-dates.csv` (ticket, Notion page, Due Date, page archived in Notion).
  682 open imported tickets; 653 had a Due Date; 29 had none and keep the default; 0 failed (3 needed a second try).
- `set_ticket_due_on(ticket, date)`: runs under the caller's own access rules, so only people who can edit the ticket
  change it (others get "You cannot change this ticket."). Writes one history line ("Due date changed from Nov 16 to
  Nov 20") with the person. No reason needed. Picking the same date writes nothing.
- The fill runs quietly (import quiet setting: no alerts, no work item or owner updates) and keeps updated_at.
  One audit row `ticket_due_date.apply`. Undo: `apply.undo.sql`.

## Files
`preflight.sql` (read only), `apply.sql`, `apply.undo.sql`, `practice.sql` (insert apply.sql at the APPLY marker;
always rolls back), `notion-due-dates.csv`, `CHECKSUMS.sha256`.

## Practice (Nov 18, live database, rolled back; 21 of the 653 Notion dates, the full list checked read only)
- 759 of 759 open tickets got a date; 0 resolved or closed; 0 tickets had updated_at, status, priority or owner moved.
- #4930 (Today, opened Nov 16): Nov 16. Notion samples took their Notion dates (#1441: Dec 1).
- New tickets (today Nov 17 Central): Right now Nov 17, Today Nov 17, Routine Nov 24; a given date kept; Routine
  changed to Right now kept Nov 24.
- Admin changed #4930: one history line with the person. Same date again: no change. A coordinator: refused on a demo
  ticket and on someone else's ticket, allowed on their own ticket, with a history line.
- Notices before 1304, after 1304. Triggers back on. Afterwards preflight unchanged.
- Read only, full list: all 653 Notion dates belong to open imported tickets. 628 match the date the import kept,
  20 were changed in Notion since, 5 had none at import.

## Practice (Nov 18 addendum, live database, rolled back)
- The updated fill, run in one transaction and then cancelled: 759 existing open tickets given a default from their
  reported date (Central); 0 open left without a date; 0 resolved or closed given one; 0 open non-Notion tickets off
  the rule. #4930 and #4941 (Today, reported Nov 16): Nov 16. #4960 and #4978 (Today, reported Nov 17): Nov 17.
- The audit row now records: existing open given a default, Notion dates written, and how many kept the default.
- Afterwards: no due date column or trigger left; the paused triggers were back on.

## Apply
Only on `Approved: apply ticket-due-date`: preflight, checksums, apply.sql in one transaction, then counts.
