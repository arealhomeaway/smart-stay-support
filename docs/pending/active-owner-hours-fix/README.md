# active-owner-hours-fix (staged, NOT applied)

Apply only after the exact words: `Approved: apply active-owner-hours-fix`

What it changes:
- `private.ao_add_plan_card` and `public.send_task_to_owner_item` write `task_type = 'property_specific'` instead of `'property'` (cards could not save time).
- `public.log_owner_time_entry` and `public.owner_update_time_entry`: "What did you do?" limit 500 to 2,000 characters; the "allowed limits" message is replaced by messages that name the field.
- Backfill: `owner_reviews.task_type` 'property' to 'property_specific' where `property_id` is set (411 rows on Nov 25, ids and previous value in undo.csv).

Nothing else in these functions changes (no new checks). Undo: `apply.undo.sql` restores the four captured definitions and reverses the backfill for exactly the undo.csv ids.

Preflight (Nov 25, read only): rows outside the three valid values with no home = 0. Practice run: not possible from the sandbox (no rights on the private schema); it must run in the apply step inside one transaction.
