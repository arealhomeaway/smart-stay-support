# ao-guard-engine-fix (approved by the Admin, Nov 15 2026; applied live at the Admin's instruction, no staging)

Applied as `drizzle/migrations/0338_ao_guard_engine_fix.sql` (identical to `apply.sql`), Nov 15 21:40 UTC. Audit row `ao_guard_engine_fix_applied`.

What it does, in one transaction:
1. `private.guard_owner_lifecycle_writes`: the owner_reviews wording check skips `recommendation` and `outcome` only when all of these hold: UPDATE, trusted owner, transaction-local flag `resolve.ao_engine_item_update` = 'on', and the item is linked to an `ao_home_plan_cards` row. Every other field, path and table branch is unchanged.
2. `private.ao_unlock` (Task done trigger, Unlock now, plan start, handoff) and `public.ao_process_clocks` (ARHA takeover) set that flag around their single owner_reviews update and restore it right after.
   Relocking writes only status and available_from, which the guard never blocked, so it needed no change.
3. N02 back to locked on 1399 Foxtail Ln, 3915 W 104th St S, 9211 Fitzgerald Dr where the owner had not started it (same rule as A33/N10). Prior values in `private.ao_n02_relock_backup_20261115`. No email or notice.

Files: `00_preflight.sql`, `apply.sql`, `apply.undo.sql` (restores the three captured steps and N02, drops the backup), `live-capture/`, `checksums.sha256`.
Live test: run on the demo home inside a transaction that cancels itself, so nothing was kept (fingerprint before and after identical).
