# Editable handoff standard and carry-over

Build/test only on top of a008254a. Nothing applied, published or sent; no real home, Task, Ticket, template, account or seat changed.

## Pending application order and undo
1. Prerequisite: `../onboarding-cleanup/0168_handoff_step_duplicates.sql`, preserving explicit legacy/template IDs and duplicate completion by matching handoff step. This prerequisite has not been applied by this work.
2. `0170_standard_schema.sql`: six tables, explicit grants/RLS, Director/Admin edit authority, immutable history, editing/confirmation/read RPCs. Undo: `undo/0170_undo.sql`.
3. `0171_home_status.sql`: live requirement projection and reasoned decisions/read RPCs. Undo: `undo/0171_undo.sql`.
4. `0172_no_block_carryover.sql`: transactional two-step confirmation and canonical Tickets, booking-block acknowledgment, completion linkage. Undo: `undo/0172_undo.sql` restores 0168 behavior.
5. `0173_seed_requirements.sql`: separate pending DATA seed, 50 exact requirements, 49 Proposed, GST-01 Retired. Undo: `undo/0173_seed_undo.sql` retires untouched seeds without deleting history.
6. `0174_seed_link_suggestions.sql`: separate pending DATA seed, 26 suggestions covering 9 requirements. Undo: `undo/0174_suggestions_undo.sql` removes only unconfirmed suggestions. Exact list: `link-suggestions.md`.
All 50 start without confirmed links. 41 have no suggestion. Every suggestion needs a human Confirm link. Keyword matching does not establish full proof coverage. Future application requires an explicit separate go-ahead; seed files are data, not DDL-only migrations.

## Behavior
- Shared standard editor: code/name/category/tier/Done when/Proof needed/status/notes, active template multi-select, within-category order, add/edit/retire and old/new history.
- Home state projects current definitions against current linked Tasks; missing template matches are Needs a linked Task. Reasoned manual done only for missing links; reasoned Not applicable applies per home.
- Both steps remain role-gated, not completion-gated. Acceptance still follows Ready.
- Confirmation includes every open requirement AND every remaining outstanding Task (including nonblocking ones), excluding 0168 handoff-step duplicates. This follows Emily's D7 ownership rule rather than silently dropping nonblocking work.
- Defaults: Operations Supervisor and seven calendar days from Central today. Only Safety/Access/Water require the checkbox at Accept; Ready shows the highlight without it.
- One carry-over per project/item identity and locked project serializes retries. Tickets insert through the ordinary tickets table path used by NewTicketForm; auto-assignment and notification triggers are retained, no duplicated notifications. Tickets use Operations entry, open status, existing P3 default, no guest currently in residence. Work type is not guessed. Existing lifecycle validation governs resolution.
- Linked onboarding Tasks automatically complete when every carry-over Ticket for that Task resolves/closes. Audit records preserve the Ticket cause. SECURITY DEFINER completion runs as table owner, matching protect_handoff_task_state's existing narrow owner bypass; no broad unlock or browser write is added.
- Carry-over count and Ticket links remain visible on home Overview and Handoff until Tickets are resolved/closed.

## Verification
Full tests and automatic typecheck/production build: recorded in final chat. New pure and isolated PostgreSQL tests cover seeds, live links/state, reasons, complete-all Tasks, defaults, carry-over inclusion, duplicate exclusion, standard edit/history, no-block Ready/Accept, safety-only acknowledgment, idempotent retry, canonical completion audit, unchanged role checks and immutable history. Existing 0168 isolated tests remain passing.
Signed-in read-only preview: standard displays exact proposed seed, home shows missing links/category readiness, phone has no horizontal overflow. Editor mutations and steps deliberately disabled until pending RPCs exist, rather than calling live legacy completion-gated RPCs.
Not verified: live standard CRUD/RLS with real role sessions, production Ticket notification delivery, complete production trigger stack and actual closure journey, concurrent acceptance load test, one-click suggestion execution against live data, legacy four-gate handoff routes outside the current two-step tab. No live writes were allowed. Full real-world end-to-end acceptance cannot be claimed.
Rollback code point: a008254a. Apply undo in reverse order and restore that code point if separately authorized. Undo preserves recorded history and Tickets, never deletes accepted work.

## Emily's 10-step preview checklist
No saving or confirming on the shared live database.
1. Open Onboarding > Handoff standard or follow the Workflow Templates link.
2. Confirm Proposed standard, under review and requirement codes/names/proof.
3. Choose Include retired and verify GST-01 is Retired.
4. Inspect categories and Essential/Micah's call/Nonessential tiers.
5. Review link-suggestions.md, noting no links are automatically confirmed.
6. Open a home's Handoff tab and the two step cards.
7. Confirm the listable/booking-block line and essentials/Micah counts.
8. Expand Show all requirements and inspect Needs a linked Task labels.
9. Expand Nonessential and inspect category progress; do not mark Ready or Accept.
10. Repeat at phone width. After separate database authorization, test edit/history, reasoned decisions, confirmation defaults, safety checkbox and idempotent Ticket acceptance only in an isolated test environment.
