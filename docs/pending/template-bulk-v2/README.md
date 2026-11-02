# Template bulk edit v2 (staged, not applied)

Adds `bulk_update_onboarding_template_steps_v2` (conditions, homeowner need, active) and the readiness probe `template_bulk_v2_ready()`.

- Same permission rule as the existing bulk action: `private.is_onboarding_leader(auth.uid())`, caller-authenticated (not SECURITY DEFINER), one transaction, one audit row via `private.write_onboarding_template_bulk_audit`.
- Business Decision sets `requires_owner_approval`; steps that block handoff are skipped and reported, never silently changed.
- Nothing is replaced: no existing function, policy, trigger or grant changes, so no base64 capture is needed. The existing bulk function's fingerprint and ACL are in `live-capture/` for a before/after check.
- Grants: EXECUTE for authenticated and service_role only; PUBLIC and anon revoked.
- Until applied, the app hides the three fields (the probe fails and the screen falls back).
- Apply: `01_bulk_v2.sql` through the migration tool (no BEGIN/COMMIT in the file). Undo: `undo.sql`.
- Never touches home plans or Tasks; tested in `src/lib/__tests__/template-bulk-v2-sql.test.ts`.
