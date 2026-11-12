# Breezeway guard: onboarding sends follow their own switch (already live)

Applied directly on the live database on Nov 12, 2026 (16:05 UTC), not from this repository.
Record: `audit_log` action `breezeway_guard_onboarding_untied`, entity `private.refuse_internal_work_orders`.

Why: register B1 changed the app gate so onboarding Breezeway sends need only
`onboarding_breezeway_send`, but the database guard on `breezeway_outbound_tasks`
still required `internal_work_orders` and refused the first onboarding send.

- `live_refuse_internal_work_orders.sql`: the live definition, copied with pg_get_functiondef.
- `before_refuse_internal_work_orders.sql`: the earlier definition (the audit row's before value); running it is the undo.
- Test: `src/lib/__tests__/breezeway-guard-onboarding-sql.test.ts` runs both in an isolated PostgreSQL.

Known fault in the live definition: see `docs/pending/breezeway-guard-fix/`.
