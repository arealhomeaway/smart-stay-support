# onboarding-task-views (applied Nov 23 as migration 0369)

Onboarding filters, search and views (Nov 23, items 4 and 6). Apply only on the exact words
`Approved: apply onboarding-task-views`.

## What apply.sql does (one transaction, additive, one audit row `onboarding_task_views.apply`)
1. The existing per-person record `saved_views` also holds My Tasks rows: named views and one row of
   each person's last choices (Group by home included). Rows stay private to their owner (existing rule).
2. New actions `my_tasks_views`, `save_my_tasks_view` (same name replaces), `archive_my_tasks_view`
   (archive, never delete) and `save_my_tasks_prefs`. Onboarding team only, signed-in only.
3. `save_onboarding_home_columns` now accepts the full ordered list for the Onboarding Project
   Database (every column but Home can be moved or hidden, plus the new Stager / on-site team column).
   Older saved lists still read the same.
Nothing else changes: no Task, home, notice, email, permission, clock or job.

## Screen (built in preview)
Before apply, My Tasks and the Project Database keep each person's choices in their own browser, and
Views says saved views are not available yet. After apply they are saved for the person.

## Preflight (read only, Nov 23): all 9 checks ok

## Practice (Nov 23, live database, rolled back)
- Same view name saved twice: replaced, one row. Last choices saved twice: one row.
- Valid ordered columns accepted; unknown and repeated columns refused.
- Homeowner-only login: reads 0, every save and archive refused.
- Teammate archives own view once; second archive refused.
- 0 staff notices, 0 owner notices, 0 emails.
- Undo restored the old page rule and the old columns action and wrote its audit line.

## Undo
apply.undo.sql copies the My Tasks rows into one audit line, archives them, turns new-form column lists
back into the older list of extras, removes the four new actions and the new index, and restores the
old rules and the old columns action.
