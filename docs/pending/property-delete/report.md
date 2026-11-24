# Element-by-element status

Checked: source, live database definitions/data, isolated practice, signed-in preview. Published version not checked or changed. No data changed and no deletion/email/send was performed.

| Spec item | Status | Detail |
|---|---|---|
| 1 Authority | Partly | Screen/server implemented, database authority staged; Admin needs no other role. Existing is_director untouched. |
| 2 Onboarding only | Partly | Screen checks property and project handoff state; definitive mutation checks staged. |
| 3 Safety check | Partly | Five categories tested; live database action not installed. Additional stored-file/linked-record blocks disclosed in README. |
| 4 Button location | Built as written | Red Delete property in More actions on the Onboarding home header only; no list/table action. |
| 5 Confirmation | Partly | Exact warning verified; required typed address/reason implemented and tested in rules/SQL, but passing-check form cannot be exercised before application. |
| 6 Atomic removal | Partly | Row transaction and failure rollback practised; external files blocked, other linked history may block, live schema not fully practised. |
| 7 Permanent audit | Partly | Entry fields and counts tested in isolated practice; staged database action not applied. |
| 8 Candidate list | Built as written | Two homes pass the five requested checks; addresses/date/creator listed, none deleted. |

Partly counts as not done. H9 updated exactly to the approved wording. Nothing published.

## Existing files modified
- `docs/decision-register.md`: H9 changed from blanket no-delete to the exact approved onboarding-only exception.
- `src/components/onboarding/home-page/OnboardingHomeHeader.tsx`: existing header retains its actions and adds the new More actions menu, with lifecycle passed through.
- `src/routes/_authenticated/onboarding.$propertyId.tsx`: supplies lifecycle to the existing shared header; other tab/workflow behavior unchanged.
- `AGENTS.md`: adds one architectural rule for the staged action without widening director helpers.
- `roadmap.md`: tracks this request and its unresolved approval/external-file limits; older tasks unchanged.

## Added files
- `src/lib/property-delete.ts`: screen/confirmation predicates.
- `src/lib/property-delete.functions.ts`: caller-authenticated capability/check/delete endpoints, no write fallback.
- `src/components/property/DeletePropertyMenu.tsx`: red More actions entry and guarded dialog.
- `src/lib/__tests__/property-delete.test.ts`: isolated permission/safety/delete/rollback/audit/undo tests.
- This staging folder: SQL, preflight, undo, baseline, checksums and reports.
- Project memory: approved narrow H9 exception only.
