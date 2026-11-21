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
