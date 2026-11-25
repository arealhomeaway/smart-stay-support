# Property delete fix (staged only)

Found during the approved apply of `property-delete` (migration 0372): the safety check fails for every home with "column t.ctid does not exist", because `onboarding_stage_captures` in the removal list is a view, not a table. No home was deleted; the failure happens before any removal.

- `01_fix.sql`: removes that one name from the removal list. Nothing else changes. Director helpers, safety rules, audit and the direct-delete guard stay as applied.
- `undo.sql`: puts the list back exactly as in 0372.
- Preflight: confirm `onboarding_stage_captures` is relkind `v` and is the only non-table in the list (checked Nov 25, 2026, 01:10 UTC: yes).

Apply only on `Approved: apply property-delete-fix`.
