# ao-catch-up-opens (approved by the Admin, Nov 15 2026; applied live at the Admin's instruction, no staging)

Plan catch-up Mark done (`bulk_complete_onboarding_tasks` through `private.plan_catch_up_cards`) no longer marks
cards on a home's plan "already covered". Completing the Task fires the existing `ao_unlock_on_task_complete`
trigger, which calls `private.ao_unlock` exactly as a single Task marked done in the Task drawer does.

- Applied as `drizzle/migrations/0341_ao_catch_up_opens.sql` (identical to `apply.sql`), audit action `ao_catch_up_opens_applied`.
- One added condition in `private.plan_catch_up_cards` (`apply.sql` line 49). Nothing else changed.
- Not needed (`task_not_needed`) still covers cards. Cards already covered stay covered. Held Tasks never reach the step.
- Homes with no plan yet: unchanged (the card is covered when the plan starts, the same as after the drawer).
- Undo: `apply.undo.sql` puts back the Nov 15 capture (`live-capture/plan_catch_up_cards.sql`). Cards opened after the change stay open.
- Practice run: `src/lib/__tests__/ao-catch-up-opens.test.ts` (isolated copy, includes the undo).
