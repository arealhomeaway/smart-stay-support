# Applied

- When: 2026-11-21 17:41 UTC, after "Approved: apply shannon-hours-links".
- Checksums verified and preflight re-run right before apply: all 9 checks ok (65 entries, none linked,
  last entry 2026-11-18 17:05:42.159 UTC). apply.sql run once as written, in one transaction.
- Read back (live): 65 entries kept, 32 linked with the agreed reason, 32 older entries replaced,
  33 counted, 2,523 counted minutes (42.05 hours). The three left alone still count.
- Hours lock (owner_time_write_guard) back on; the other hours triggers on.
- Created since the apply started: 0 owner notices, 0 emails, 0 program events, 0 home chat lines,
  0 owner messages, 0 new hour entries. Badges unchanged (7). 32 audit_log rows (owner_time_entry.link_repeat).
- Undo: apply.undo.sql.

## Correction (17:46 UTC)
The 17:42 read back showed 0 emails, but the regular five-minute pass at 17:45:02 then re-scored her pace
on the lower total and sent one "Significantly behind" alert: owner_notifications af61e216 (progress_pace,
email sent 17:45:05 to the program login), owner_program_events alert_sent, email_log 421a0536. Practice
could not show this because it rolled back before any pass ran. The same pace alert does not repeat inside
seven days unless more urgent; Significantly behind is already the most urgent pace state.
