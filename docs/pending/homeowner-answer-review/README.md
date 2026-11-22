# homeowner-answer-review (staged, not applied)

Reviewed for homeowner answers under My homeowners on My Tasks (Admin, Nov 22, item 5).
Apply only on the exact words `Approved: apply homeowner-answer-review`.

## What apply.sql does (one transaction, additive, one audit row `homeowner_answer_review.apply`)
1. New record `homeowner_answer_reviews`: one row per review of one homeowner answer (the card, owner item,
   approval or change it is on, the answer's latest time, who reviewed it, when). Rows can never be changed or
   removed. Staff can read it.
2. New action `mark_homeowner_answer_reviewed`: the home's assigned Project Manager presses Reviewed; the Director
   of Onboarding and Admin cover. The answer must belong to that home. Pressing twice saves one review. One audit
   line per review.
3. A newer answer from the homeowner is not covered by the earlier review, so it returns to the review list.
Nothing existing changes: no Task, card, owner item, approval, notice, email or permission.

## Screen (built in preview)
Before apply, My homeowners keeps its "Homeowner answered or finished" 7-day list. Once applied it shows
"Homeowner answers to review" (every answer not reviewed yet, no 7-day limit, task name and answer shown, Reviewed
button) and a folded "Reviewed" list with who reviewed each one and when.

## Preflight (read only, Nov 22): all 5 checks ok

## Practice (Nov 22, live database, rolled back), 3400 N Fern Avenue
- Project Manager marks a card answer reviewed: saved. Same press again: saved once (already).
- Project Manager of other homes (not Director, not Admin) on Fern: refused.
- Fern Project Manager with an answer from 624 Daniel Court: refused (not on this home).
- Director of Onboarding on Fern: saved.
- A newer answer on the first card: saved as a second review (first card now has 2).
- Changing or removing a review: refused. 3 reviews, 3 audit lines, 0 notices, 0 emails.
- After undo: record and action gone; the 3 reviews kept in the undo audit line.

## Undo
apply.undo.sql copies every saved review into one audit line, then removes the action, the append-only rule and
the record. My homeowners then shows its 7-day list again.
