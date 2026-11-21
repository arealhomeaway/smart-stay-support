# shannon-hours-links (Nov 21, Admin approved; staged, not applied)

Shannon Linder's program (579cb6ae, 1399 Foxtail Ln; program owner name "Matt & Shannon Linder", login
Matthew Linder) has 65 hour entries, 5,075 minutes, all counted. On Nov 18 she logged 28 of them again with
fuller wording, plus a few double saves. This links each repeat to the entry it replaces, exactly as listed
by Emily (newer <- older), so the existing counting rule (countableParticipationEntries) counts each once.

- 32 rows changed: on each newer entry, `amends_entry_id` = the older entry and `correction_reason` =
  "Homeowner logged this again with an update; replaces the earlier entry." No other field changes.
- Nothing deleted. All 65 entries stay; 32 older ones become "replaced". The three entries Shannon decides
  on (2a353b74, 55229700, 6a93108c) are untouched and still count.
- No email, owner notice, chat line or program event. 32 audit_log rows (owner_time_entry.link_repeat).
- The hours record is locked against any change (trigger owner_time_write_guard). The apply switches that
  one lock off for the single linking statement inside its own transaction and switches it back on, then
  checks it is on. The other hours checks stay on.
- 60 distinct entries are involved: chains 6 and 19 use 4 entries as both newer and older.

## Stops (apply refuses and changes nothing) if
the program does not have exactly 65 entries; any listed id is missing, in another program, or already has
amends_entry_id; any entry was created after 2026-11-18 17:05:42 UTC (second precision: the last entry is
17:05:42.159); the list is not 32 distinct pairs; one of the three to leave alone is listed; fewer or more
than 32 rows change; the read back is not 33 counted entries and 2,523 minutes; the lock is not back on.

## Practice (Nov 21, live database, rolled back)
after apply: 65 entries kept, 32 linked, 33 counted, 2523 counted minutes (42.05 hours) | other fields
unchanged on all 65: t; replaced (older) entries: 32 | the three left alone still counted: t | new owner
notices 0, new emails 0, new program events 0, new chat lines 0, badges 7 -> 7, report refreshed t, audit
rows 32, hours lock on t | lock back on, a change is refused: Participation evidence is immutable. Record a
correction instead. | after undo: 65 counted, 5075 minutes, every row back exactly as before: t

## Files
`preflight.sql` (read only, every row ok = true), `apply.sql`, `apply.undo.sql` (clears exactly these 32
links), `practice.sql`, `SHA256SUMS`.

## Apply
Only on `Approved: apply shannon-hours-links`: checksums, preflight, apply.sql, then read back.
