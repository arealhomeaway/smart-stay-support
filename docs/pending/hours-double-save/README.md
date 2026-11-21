# hours-double-save (Nov 21, Admin approved; staged, not applied)

Homeowner hour saves (Log hours, Edit, Add more) refuse a new entry from the same homeowner in the same
program with the same date, same minutes and same description (spacing and capitals ignored) as an entry
saved in the last 10 minutes. The answer is "Already saved."; the screen keeps what she typed.

- New rule `private.owner_time_recent_repeat` (one rule for both actions).
- `public.log_owner_time_entry`: today's action (captured in live-capture/, md5 of body
  eebeaa3064236750e229914ce101b3af) plus one check just before the save. Nothing else changes.
- `public.owner_update_time_entry`: the homeowner-reopen action (md5 f360b0cfed229f21574863e160365db7)
  plus two checks: a second click on an entry already changed answers "Already saved." when her change is
  on file (otherwise the existing "already updated" message), and a change that copies another entry saved
  in the last 10 minutes is refused. The entry being changed and its earlier versions are left out, and
  when she adds a note the repeat must already carry that note, so a real second Add more still saves.
- Needs homeowner-reopen applied first. Staff corrections and the returned-entry resubmit are unchanged.
- Two clicks that arrive at the very same moment are already kept apart by the program lock: the second
  gets the existing "being updated, refresh" message. The screen now sends only one click.

## Practice (Nov 21, live database, rolled back; demo home, demo owner)
1 first log saved; 2 same again: Already saved.; 3 spacing and capitals: Already saved.; 4 different
minutes saved; 5 edit saved, amends first true; 6 edit clicked twice: Already saved.; 7 add more saved;
8 add more clicked twice: Already saved.; 9 a different add more on the newest version saved; 10 older
version, new note: This entry was already updated. Refresh to see the latest version.; 11 edit into a copy
of another recent entry: Already saved.; 12 totals: 3 current entries, 96 minutes, 6 saved in all |
13 after undo: the same repeat saves again; log action back to today's t; rule removed t; edit action back
to homeowner-reopen t.
The practice ran homeowner-reopen sections 1 and 2, then apply.sql, the cases, apply.undo.sql (comment lines
trimmed in the run; statements identical, confirmed by the md5 read back).

## Files
`preflight.sql` (read only; run after homeowner-reopen), `apply.sql`, `apply.undo.sql`, `practice.sql`,
`live-capture/log_owner_time_entry.sql`, `SHA256SUMS`.

## Apply order
1. shannon-hours-links  2. homeowner-reopen  3. hours-double-save. Each only on its own
`Approved: apply <folder>`.
