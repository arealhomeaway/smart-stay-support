# Onboarding kinds 3 (Nov 12 small fix batch): staged, NOT APPLIED

Apply only when approved. Practice runs of the file and its undo pass on an isolated copy:
`src/lib/__tests__/onboarding-kinds-3-sql.test.ts`.

| File | Item | What it does | Undo |
|---|---|---|---|
| 01_owner_outside_notes.sql | 3 | Adds `owner_outside_resolve_notes(program)`: for each owner card whose Task is Done outside Resolve, where it happens, the document name and owner message (Task setting, else its plan step's), and whether the home has a live Active Owner program (not closed or archived). Members and staff only. Additive; `owner_outside_resolve_lines` is unchanged. | 01_owner_outside_notes.undo.sql drops the function |

Until applied, owner cards use the live `owner_outside_resolve_lines`: the default wording with
"document" as the document name, no custom owner message, and the "Once it's signed, come back
here and log your time." sentence when the program the owner is viewing is live.

Grants: revoked from PUBLIC and anon, granted to authenticated and service_role.
Items 1 and 2 need no database change.
