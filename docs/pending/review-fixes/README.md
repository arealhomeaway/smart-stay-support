# Approved code-review fixes, pending database application

Nothing here was applied. No live function is replaced: all three proposed functions and both triggers were confirmed absent. Existing RLS, grants and responsibility triggers remain unchanged. `undo/live-reference-manifest.json` captures five exact live reference definitions with base64, SHA256 and grants; these are reference evidence, not functions to replace.

## Apply and rollback boundaries

1. `01_project_team.sql`: one SECURITY INVOKER transaction plus a narrow audit helper. Existing project authority, Task policies and responsibility triggers still run as the caller. Its undo removes only the two new functions.
2. `02_business_decision.sql`: new template and completion guards. No row backfill. Unrelated edits to pre-existing mismatches remain possible; new business-decision configurations must carry approval=true and new completion requires approved status. Its undo removes only the two new triggers and new guard function.
3. `03_template_corrections.sql`: separate data approval only. Exactly three template flags change; the usual timestamp and non-blocking handoff trigger effects also apply. No existing home Tasks or published version snapshots change. Full original rows are captured in `undo/template-rows.json`. Its undo restores every changed column and original timestamps, with the affected validation/timestamp triggers disabled only inside the rollback transaction and restored before commit. Roll back 03 before 02.

`manifest.json` proves base64 decoding and SHA256 equality for all six SQL files and the full-row data snapshot. Reverify live reference definitions, absence of new objects and unchanged template rows immediately before any application; stop if they differ.

## Three template mismatches requiring separate approval

- Coordinate the cost segregation study: `2dc6f929-eaa5-4e9c-afd0-56400784ad9e`
- Review the Pre-Work Inspection results: `f7c9426a-4642-47f2-b7ec-cfef65b45b94`
- Send the Property Management Agreement through DocuSign: `263f7c5c-5df2-4d0d-943d-e2603a0f8139`

The code refuses to silently repair these existing mismatches during a template save. New business-decision template configurations set the required approval flag through the shared rule.

## Release dependency

The new Project Team caller intentionally has no old separate-write fallback. Publishing that caller before applying 01 makes Project Team saves unavailable with a surfaced function error. Apply the separately authorized SQL before publishing the corresponding code. The database completion protection remains pending until 02 is applied.

## Practice test

Emily's own managed session opened the published 101 Willow Way onboarding page. Read-only data confirmed `is_demo=true`; the page did not explicitly label that home as practice. Testing stopped before selecting/editing any Task. No Save action, rollback or live record write occurred. The template table has no demo flag; no clearly labeled practice template was confirmed. Exact Save error and cause remain unverified.