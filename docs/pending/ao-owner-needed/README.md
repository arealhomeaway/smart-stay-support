# ao-owner-needed (approved by the Admin, Nov 15 2026; applied as part of the build at the requester's instruction)

What it does, in one transaction (`apply.sql`):
1. Adds `ao_library_cards.owner_needed` (boolean, not null, default false); true for exactly A22, A24, A40, P01, P02, A03, A25, A26, A27, A28, A30, A39, A58, P03, P04.
2. `private.ao_unlock` (the one step every open path uses: plan start, Task done, Unlock now, handoff) sets deadline_at, reminder_at, cutoff_at and owner_reviews.respond_by only when owner_needed; otherwise all four stay empty.
   `public.ao_process_clocks` skips any card with no deadline (no reminder, no expiry, no ARHA takeover).
3. `private.ao_plan_outcomes`: the live-home "team-work card with no step opens" line is removed, so an until_linked_step_done card is locked until its Task is done or Unlock now, on every home.
   `private.ao_ops_card_rule`: A33 and N10 are `stays_locked` instead of `opens_at_handoff`; A14 and A35 stay `waits_for_bridge`; A51 keeps its existing rule.
   `private.ao_on_handoff`: opens nothing by itself; an operations card not yet on the plan is added with its normal outcome (A33 and N10 locked).
4. Switched-on homes: clears the four dates on every open, unfinished, non-owner-needed card; puts A33 and N10 back to locked on 1399 Foxtail Ln, 3915 W 104th St S and 9211 Fitzgerald Dr where the owner has not started them. Prior values kept in `private.ao_owner_needed_backup_20261115`. One audit_log row `ao_owner_needed_applied` with per-home counts. No email or notice.

Files: `00_preflight.sql` (same check that opens apply.sql), `apply.sql`, `apply.undo.sql` (restores the five captured steps, every changed value, then removes the column and backup), `live-capture/` (live definitions, Nov 15), `checksums.sha256`.
Practice run: `src/lib/__tests__/ao-owner-needed-sql.test.ts` (isolated copy, includes exact undo).

Finding (not changed here): the live owner-item guard `private.guard_owner_lifecycle_writes` refuses any change to owner_reviews.recommendation and outcome on non-ticket items. `ao_unlock` rewrites recommendation when a locked card opens and `ao_process_clocks` writes outcome on takeover, so Task done / Unlock now on a locked card and the ARHA takeover both fail. The practice run shows both.
