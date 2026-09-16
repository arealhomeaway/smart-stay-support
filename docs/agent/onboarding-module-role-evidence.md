# Onboarding module and role evidence

This maps the existing build to local evidence. It does not certify authenticated acceptance. The same applicability engine feeds stage release, the property workspace, handoff snapshots and independent financial/field readiness. No new modules or operating policies were added.

## Module mapping

`src/lib/onboarding-scope.ts` is the canonical applicability engine. `splitByScope` preserves an explicit Not Applicable reason and propagates parent exclusions to nested work. Unknown work stays in scope. The module matrix in `onboarding-scope.test.ts` exercises every module below; existing tests cover nested exclusions, Full Furnishing/No Furnishings and keeping appliance delivery independent of furniture scope.

| Module | Existing work that exercises applicability | Evidence and review path |
| --- | --- | --- |
| Full Furnishing / No Furnishings | Design, mood board, furniture purchase, assembly and staging | Existing template work and stage capture; No Furnishings excludes furnishing work while retaining access, repairs and safety. |
| Utilities | Utility account transfer | Utility metadata/credential references, applicable task evidence and stage review. |
| Repairs | Make-ready repairs | Task/evidence, canonical financial authority and linked field work; unresolved authority blocks handoff. |
| Smart lock | Smart lock setup | Access task and reviewed fact/equipment proposals; owner payloads exclude credentials. |
| Existing appliances | Existing appliance assessment | Applicable task evidence and reviewed equipment/property proposals. |
| New appliances | New appliance delivery | Purchase/approval, linked field completion and equipment evidence; independent of furniture scope. |
| Pool | Pool service setup | Applicable task/equipment/safety evidence and current field completion. |
| HOA | HOA covenant documents | Applicable task and attached document metadata; stage review retains the evidence snapshot. |
| Cameras | Camera setup | Applicable installation evidence and restricted credential references. |
| Furniture warranty | Furniture warranty registration | Warranty references/evidence when furnishing/module scope applies. |
| Landscaping | Landscaping service | Applicable task and linked field work; explicit carryover cannot waive financial authority. |
| Active Owner | Active Owner participation | Explicit canonical Owner/Property enrollment; participation clock and owner opportunity/time history remain separate from Onboarding project state. |

The evidence mechanism is shared; a module does not get a second checklist or a parallel lifecycle. Metadata tests do not prove a real attachment is readable in isolated storage. Authenticated acceptance must exercise at least one completed and one blocked/out-of-scope example per module, including changed evidence after review.

## Role and queue mapping

| Surface / responsibility | Local implementation and evidence | Acceptance still needed |
| --- | --- | --- |
| Field staff | Server workspace projection and My Work select assigned tasks; role cannot gain team access through URL filters. `onboarding-assigned-workspace`, `onboarding-team-view` and workspace access tests. | Assigned and unrelated field sessions; direct detail/action routes. |
| PM / Project Lead | Project assignments govern execution; hub workload uses the project PM rather than legacy Property assignment. Project capture/submission remains separate from Director approval. | Two project leads, reassignment while a draft is open, correct workload label. |
| Director of Onboarding | Protected capability governs stage review and first handoff gate; `onboarding-hub` tests distinguish PM execution and Director review. | Same person as PM still submits and reviews in separate actions. |
| Operations Director | Operational-readiness gate only when current capability permits it. | Stale seat/coverage and direct endpoint attempts. |
| Operations acceptance / supervisor | Separate acceptance and Live confirmation, with readiness compared again. | Acceptance followed by competing readiness change before Live. |
| Platform owner | Explicit admin preview of a selected owner program; preview remains read-only. | Switching owner/program/demo modes without stale private UI. |
| Active Owner | Owner-only enabled account, canonical program/property projection, exact reviewed history. | Two unrelated owner sessions and excluded/transferred/demo Properties. |
| Attention / blocked / risk | One derived summary combines applicable tasks, independent financial/field blockers and pending facts. Missing readiness cannot appear ready. | Source links lead to the exact blocker and correctly return to the filtered hub. |
| Review / awaiting my review | Shared pure lens logic uses the current protected gate capability; stage reviews drill into filtered work and handoffs into the handoff area. | Each reviewer sees only its current actionable gate. |
| Corrections | Task/stage corrections plus returned handoff context; existing filtered work view. | Correct stage/revision and retained correction evidence. |
| Upcoming / handoffs | Canonical project target date, with existing task-date fallback; 7/14/30-day views. | Date boundary/time-zone display and contextual Back. |
| Workload / QA | Canonical PM context; production counts and workload exclude QA even when test rows are shown. | Full/No Furnishing QA visibility without changing production metrics. |

`onboarding-hub.test.ts`, `onboarding-lifecycle.test.ts`, `onboarding-work-views.test.ts`, role capability tests and the isolated responsibility/readiness migrations are local evidence. The six workspace areas remain Overview, Work, Property, Financial, Handoff and History. Full desktop/390px, real JWT/RLS and simultaneous-session acceptance require an approved isolated environment; no shared migration or live data was used.
