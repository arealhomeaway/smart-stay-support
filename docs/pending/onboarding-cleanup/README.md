# Approved onboarding cleanup: staged changes only

Nothing here has been applied. No production data, email, account or storage changes were executed.

## Handoff matches
Each of Foxtail, Buckland, 3915 W 104th and Fitzgerald has exactly these four duplicate steps:
1. 20. Conduct the Director of Onboarding review: complete when marked ready.
2. 21. Conduct the Operational Readiness Review: complete at acceptance.
3. 22. Complete formal Operations acceptance: complete at acceptance.
4. 23. Confirm systems and activate Live status: complete at acceptance.
Galveston: no equivalent found by the read-only title/stage inventory; semantic equivalence of all differently worded steps is not verified.
All 16 legacy Tasks have no template link. The pending SQL uses their explicitly verified immutable Task IDs, plus the four canonical template step IDs and dedicated tags for future use. No automatic title matching, template editing or link repair.
Exact IDs are enumerated in 0168_handoff_step_duplicates.sql in the same order as the above titles per home. Existing blocks_handoff flags remain untouched. UI consumes the pending shared read-only predicate only when it exists; until application today's counts remain authoritative.

## Files
- 0168_handoff_step_duplicates.sql: canonical readiness predicate, matching-step completion, history, shared read-only exclusion.
- undo/0168_undo.sql: restores captured existing readiness/acceptance behavior and removes helper functions. Does not erase completed Tasks or history.
- 0169_released_activity_conversations.sql: additive review link on append-only owner_request_messages and caller-checked RPCs; no second work item or thread store. No email or notification sends introduced.
- undo/0169_undo.sql: removes RPCs/policy/index, retains the nullable link and append-only history; column marked deprecated.

## B3 finding
Released program activities in owner_reviews are not the same records as Opportunities in work_items. Both are displayed in shared attention/waiting/completed/draft groups. Foxtail shows 22 program activities plus 3 open Opportunities (25 waiting); other home inventories had 22 awaiting program activities each, with Fitzgerald also 1 answered and 4 closed. The quoted Oct 27 32/54 release batch identity/count reconciliation is NOT VERIFIED. Review conversation replies are disabled until the pending extension is applied. Homeowner-facing integration with the new thread is NOT built in this scoped staff-screen cleanup.

## Verification
Full suite: 1634 passed, 5 skipped, 0 failed. 14 new isolated cleanup tests include canonical setup ordering, manual/no-enroll, retained Retry, both item kinds, groups, 14-day boundary, next five and stages, role labels, and handoff SQL ID exclusion/completion/audit/anonymous refusal.
Automatic typecheck and production build: build OK. No manual build/typecheck run (hosting harness runs both).
Read-only signed-in preview: Add property opened, manual choice switched, both owner item sources loaded, existing Opportunity detail opened, handoff loaded, phone horizontal overflow false. No submit/reply/reorder/ready/accept action invoked.
Unverified: pending conversation SQL integration/execution/RLS tests, owner-facing replies, real intake/enrollment/Retry, no-enroll role rendering, OwnerRez listing completion, resources/video on a released activity, full template-version stage labels, semantic equivalents on Galveston, and 32/54 reconciliation. New UI still reuses existing OpportunityDetail copy/actions.
Rollback code point before this work: 43c84a74073a281fc1d8eea5b694218c2d46fb8a. Database remains at its original state.

## Emily's 10-step preview checklist (no live writes)
1. On Onboarding Home open Add property.
2. Confirm OwnerRez default and the editable homeowner fields; do not select/import a real home.
3. Switch to Add manually and inspect address/name/email.
4. Toggle Start onboarding and inspect the template picker and Creates line.
5. Select Yes, Active Owner; inspect closing-date requirement/notes/welcome information; Cancel.
6. On a real property's Overview follow the Active Owner summary link.
7. Compare Opportunities and program activities in Waiting on homeowner; do not reply.
8. Expand Completed and Drafts, open each kind's details and close; do not edit or reorder.
9. Open Handoff, inspect two step cards, overdue/next, stage progress and disabled Ready; do not mark ready or accept.
10. Repeat at phone width; expand Show all by stage and open/close a Task without saving.
