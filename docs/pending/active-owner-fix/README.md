# Active Owner fix (Nov 11) — staged, NOT applied

Approved spec: "Active Owner Fix Spec" (Emily, Nov 11). Files 01 to 04 were applied by the Admin on Nov 11
(checked Nov 12 against the live functions); 05a, 05b and 06 are staged and NOT applied. Apply only with the
approving Admin's go, in this order, each with its undo ready.

| Order | File | What it does | Undo |
| --- | --- | --- | --- |
| 1 | `01_fix1_plan_cards_read.sql` | Fix 1 alone: signed-in users may run `private.owner_current_property_for_actor`. Policies unchanged. | `01_fix1_plan_cards_read.undo.sql` |
| 2 | `02_engine.sql` | Fixes 2, 3, 4, 6, 7: second homes, one shared rule for preview and turn on, the plan is ready email and the one daily email (9 AM Central setting), plans start at enrollment, the Active Owner label rules, Start plans for enrolled homes (preview + all or none), handoff opens A33 and N10, send to the owner completes the Task and the owner talks it through in the same item. | `02_engine.undo.sql` (run after the 04 undo) |
| 3 | `03_retire_a56.sql` | Fix 6: A56 retired through the card action (version + history). | `03_retire_a56.undo.sql` |
| 4 | `04_active_owner_label.sql` | Fix 4: creates the Admin owned Active Owner label and puts it on every home now included in a live program. Starts no plan. | `04_active_owner_label.undo.sql` |
| 5a | `05a_v2_to_standard_dry_run.sql` | Fix 5 dry run, read only. Output of Nov 11: `05a_dry_run_output_nov11.txt` (run with the home name in place of the display helper, which this sandbox role may not run). | none (writes nothing) |
| 5b | `05b_v2_to_standard_move.sql` | Fix 5 move of the four V2 homes, ONLY after the dry run is approved. Changed Nov 11 (Admin): every V2 Task is archived (who and when, receipts, nothing deleted); every Standard step is created, open and assigned as the plan assigns it, except the steps in the confirmed done list at the top of the file (empty until the Admin's checklist), which are created completed with the note "Done before Resolve, confirmed by the COO, Nov 11"; no title matching. Stops with nothing written if a listed step needs a homeowner decision, is a handoff step or is not on the home's plan, or if a home's handoff is already accepted. The same list must be pasted into 05a. | `05b_v2_to_standard_move.undo.sql` (exact, from receipts: un-archives those V2 Tasks, archives the created Tasks) |
| 6 | `06_operations_stage_and_admin.sql` | Added Nov 11 (Admin). Needs 01 to 04; independent of 05a/05b. At the operations stage: anytime cards are added (open, or by their own lock), never skipped; A33 and N10 open with no lock when a plan starts on a handed off home, the same as at handoff; an operations card that waits on an onboarding step the home does not have (A51 today) is not added, and A14 and A35 stay out until the Breezeway bridge (one rule, `private.ao_ops_card_rule`, read by the preview, the turn on, Start plans for enrolled homes and the handoff step). Admin passes every onboarding and Active Owner role check: the three that refused an Admin (Mark ready, deciding a step review, recording a review edit) now allow an Admin, recorded as the Admin with the time; `admin_passes_role_checks` lets the screens show those buttons only once 06 is applied. Item 6 (added Nov 11, Admin): demo programs and demo homes run the engine like real ones (plan start at enrollment or from the switch, the label, lock and unlock, reminder and takeover, Send to the owner, the owner conversation); a demo home matches only a demo program and a real home only a real program; every notice a demo item creates is marked skipped for email and SMS (new staff notice guard `private.ao_demo_staff_notice`); real accounts never see demo items in Needs you now; demo homes already in a live demo program get the label now (receipts in audit_log `ao_fix06_demo_label`). Start plans for enrolled homes stays real homes only. Live text of the fifteen replaced functions is in `live-capture/06/`. | `06_operations_stage_and_admin.undo.sql` (exact live text back for all fifteen, the demo labels it added removed from the receipts, the three added functions and the trigger removed) |
| then | in the app | Program oversight, Admin: Start plans for enrolled homes → Preview → approve → Turn on. Apply 06 first so the three handed off homes get their anytime cards. | per home switch off |

`live-capture/` holds the live function text captured read only on Nov 11; the 02 undo restores
`ao_set_home_automation`, `ao_preview_home_automation` and `owner_business_decision_guard` from it.
`CHECKSUMS.sha256` covers every file here.

## Proofs
- `src/lib/__tests__/active-owner-fix-sql.test.ts`, `active-owner-fix-plan-move.test.ts` and
  `active-owner-fix-06.test.ts` run every file above on an isolated PostgreSQL copy built from the live table shapes and the live engine
  functions, including every undo.
- Real database practice: `practice_active_owner_fix.sql` (BEGIN … ROLLBACK). It could not run from
  this sandbox: its database role has no rights on the `private` schema ("permission denied for
  schema private"), so the practice must be run by whoever applies, before applying.

## Points for the approving Admin
- Fix 5 (changed Nov 11): 05b archives every V2 Task and creates the Standard plan; only steps in the
  confirmed done list start completed. See the 05a output for the counts per home.
- Fix 7 changes the current rule that a homeowner decision gates a Task: a Task sent as an owner item
  completes on send and the decision lives on the owner item (register O9 tasks would complete on send).
- A card whose linked Task is already finished when a plan starts is Already covered (Fix 5 wording,
  applied to every home so preview and turn on agree).
- A handed off home gets operations cards only: anytime cards are skipped at the operations stage (02 as applied).
  06 changes this: anytime cards are added at the operations stage (register O5).
- 06 changes register O4: an Admin may also mark a home ready (the Director of Onboarding still may).
- 06 item 6: a named staff member using the Demo view (not a test account) will not see demo owner replies in
  Needs you now; test accounts do. The demo plan is ready notice merges later demo starts into the same unread
  notice, the same as a real program with homeowner email off.
