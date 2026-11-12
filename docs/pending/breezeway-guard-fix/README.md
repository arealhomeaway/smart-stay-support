# Breezeway guard fix (staged, not applied)

Found while adding the guard test. The live change of Nov 12 (`audit_log` action
`breezeway_guard_onboarding_untied`) reads `NEW.source_type` in a condition that also runs
for `public.work_orders`, which has no `source_type` column. Every insert into `work_orders`
now stops with `record "new" has no field "source_type"`, including demo practice rows that
were allowed before. The table has no rows and `internal_work_orders` is off, so nothing has
failed yet.

- `01_refuse_internal_work_orders.sql`: same rules, with the onboarding check inside a
  `breezeway_outbound_tasks` block.
- `undo/01_refuse_internal_work_orders.sql`: restores the current live definition.
- Test: `src/lib/__tests__/breezeway-guard-onboarding-sql.test.ts`.

Apply only with approval.
