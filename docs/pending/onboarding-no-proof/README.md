# onboarding-no-proof (staged, not applied)

Decisions O7 and O8 changed by the Admin on Nov 22: onboarding Tasks no longer require or ask for proof.
Apply only on the exact words `Approved: apply onboarding-no-proof`.

## What apply.sql does (one transaction, one audit row `onboarding_no_proof.apply`)
Removes only these three checks, inside each live definition, so every other rule stays exactly as it is.
Owners and grants are kept. No Task, template, card or saved note is changed.
1. `bulk_complete_onboarding_tasks` (Mark done, one Task or many): no longer refuses a save without a 5 character
   note. A note and a file stay optional and are saved when given.
2. `complete_onboarding_from_breezeway`: no longer skips a Task that has no proof note.
3. `create_onboarding_handoff`: no longer refuses a handoff because a Task has no proof note. Its message reads
   "Required work, approvals or blockers prevent handoff."
Each check must be found exactly once, or nothing changes.

## Order with other staged changes
`mark-done-breezeway` replaces `bulk_complete_onboarding_tasks` and checks its exact current text. Apply
`mark-done-breezeway` first if you want both: this change then works on its version too. If this one is applied
first, `mark-done-breezeway` stops at its own safety check and needs to be staged again.

## Preflight (read only, Nov 22): all 5 checks ok
Mark done md5 df428d93e7af3945e5b8d488f525f97d, Breezeway completion md5 4fb5966f917aea2286ef64c341549772,
handoff md5 a05f1c6078a26640b75f08c80b063865; not applied before.

## Practice (Nov 22, live database, rolled back), 3400 N Fern Avenue as the Director of Onboarding
- Before: Mark done on "Purchase essentials" with no note: refused ("Add a note that says where the proof is").
- After apply: the same Mark done saved 1, held 0. The Task is done, by the Director, with no note.
- Proof checks left in the three functions: 0. Notices 0, emails 0.
- After undo: all three definitions match before exactly.

## Undo
apply.undo.sql puts the three checks back exactly (reverse of apply.sql) and writes one audit row.
