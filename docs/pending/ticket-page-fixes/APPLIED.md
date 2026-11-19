# Applied

- When: 2026-11-19 19:55 UTC, after "Approved: apply ticket-page-fixes".
- Checksums verified and preflight re-run (all ok) right before apply. apply.sql run once as written, recorded as drizzle/migrations/0357_ticket_page_fixes.sql.
- Read back: answer guard replaced, trigger still attached; Immediate maintenance text is the new text.
- Maintenance checklist v2 (bdaa20f2) retired; v3 (7f78f4ea-cecd-4b13-85b2-7335e681d674) live; step 9 answer reads "Checked" (value uploaded); rest of body identical to v2.
- 1 ticket still pinned to v2, 21 saved answers unchanged.
- 3 audit_log rows written.
- Live check, undone: a team edit on an open ticket's finished step changed the note on the same row (still 1 row); changing who answered was refused. Nothing kept.
- Undo: apply.undo.sql.
