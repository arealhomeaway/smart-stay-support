# Applied

- When: 2026-11-19 18:28 UTC, after "Approved: apply closure-evidence-breezeway".
- Checksums verified and preflight re-run (all ok) right before apply. apply.sql run once as written.
- Read back: three new closure texts; none mention photo, file, upload, invoice or receipt.
- Maintenance checklist v1 (7d0eb2a4) retired; v2 (bdaa20f2-d1d9-4258-80e0-39bc4db869cc) live with only step 9 question changed (rest of body identical).
- 4 tickets still pinned to v1; 2 existing ticket steps keep the old words.
- 4 audit_log rows written.
- Undo: apply.undo.sql (restores texts, republishes v1 body as v3).
