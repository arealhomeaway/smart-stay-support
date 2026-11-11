# Build 18: six small decided fixes (Emily, Nov 10, about 10:50 PM)

Status: applied after the isolated tests and a cancelled practice on the real database passed.
Schema part applied as `drizzle/migrations/0333_build18_no_pay_dates_and_edit_selected.sql`
(identical to `01_build18.sql`). Data part applied once with `02_build18_data.sql`.
Nothing was published, released, sent or emailed.

| File | What it does |
| --- | --- |
| 01_build18.sql | Item 2: `private.bonus_compute` and `public.bonus_payouts` without the `pays_on` key (bodies otherwise identical; ACLs kept by CREATE OR REPLACE); `private.bonus_pays_on` kept, marked DEPRECATED. Item 6b: new read only `public.can_bulk_edit_home_tasks(uuid)` (authenticated and service_role only). |
| 01_build18.undo.sql | Restores both bonus functions exactly as live before (body md5 bonus_compute 6867858004942898aef3d63d446fd60c, bonus_payouts 312ad97f3cbd370c4f7c6c7814c9035a), clears the comment, drops the helper. |
| 02_build18_data.sql | Item 4: eight titles through `ao_card_save` (title only). Item 5: A15 and A41 to retired through `ao_card_set_status`. Item 6c: three OwnerRez reviews `published_date_known = false`. Acts as the approving Admin so history records who and when. Every step matches the exact current value, so a repeat changes nothing. |
| 02_build18_data.undo.sql | Puts the old titles back, A15 and A41 back to draft, the three reviews back to known, through the same paths (history stays add only). |
| practice_build18.sql | The cancelled practice (rolled back on purpose). The run used the same steps minus the repeat block. |

Live checks after apply: function bodies match the staged text (md5 bonus_compute
028c4dc788d7e55efe29d4316cf0ab04, bonus_payouts 61c6842b3bec3b5274d939a1a3320072); a live card
for the Operations Supervisor and the Director of Operations has no pay date; the eight titles
match the request exactly; for every card only title (or status and retired_at), version and
updated_at changed; ten history rows, one per card, by the approving Admin; A27, A28 and A58
unchanged; the three reviews read date unknown with their stored dates unchanged (the review
trigger also moves `updated_at`).

Cancelled practice result (rolled back): ten card history rows, the new titles, A15 and A41
retired, A27/A28/A58 unchanged, three reviews date unknown, payouts list with no pay date, the
Admin may use Edit selected on the newest onboarding home. Afterwards the live rows read back
unchanged (A15 draft v6, A41 draft v4, N05 v2, P16 v3, no helper function).

References kept for A15 and A41 (nothing removed): A15 has one card to Task map row (rejected),
one step link suggestion (lock accepted), its history rows and one de-duplication event; A41 has
one card to Task map row (suggested), one step link suggestion (rejected), its history rows and
one de-duplication event. Neither is on any home plan.

Item 1 (sweep) and items 2, 3, 6a and 6b are code; they reach the team only when Emily publishes.
