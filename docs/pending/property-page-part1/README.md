# Property page Part 1: staged database change

Approved by the Admin and the Director of Onboarding, Nov 12. **Staged only. Not applied.** Apply only with approval.

## What it adds (additive only, nothing deleted)

| Part | Change | Why |
|---|---|---|
| 1.1 (4) | `property_owners.preferred_method` (text, call, email, telegram or empty) and `property_owners.telegram` (up to 80 characters) | The owner row highlights the preferred method and shows a Telegram button. The live table has neither column. |
| 1.7 | `onboarding_tasks.is_one_off` (default false) and trigger `onboarding_tasks_mark_one_off` (function `private.mark_onboarding_one_off`) | One-off Tasks cannot be told apart today: 374 active Tasks have no template step and no creator, so "no template step" is not enough. The trigger sets the flag on insert only (no template step, not a follow-up, not a carry over, a signed-in creator) and keeps it unchanged on update, so a caller cannot set it. |
| 1.4 | `app_settings` row `onboarding_status_stage_map`, seeded exactly as approved | The Status to stage map. Admin edits it (the existing app_settings Admin-only write rule). `ON CONFLICT DO NOTHING` keeps any existing value. |

Existing Tasks are **not backfilled**: an update would fire the handoff lock, work item sync and history triggers on locked homes. Only Tasks added after apply are marked.

## Files

- `00_preflight.sql`: read-only checks; every row should read `ok = true`.
- `apply.sql`: the change, one transaction.
- `apply.undo.sql`: removes exactly what apply added. Any preferred method, Telegram or Admin edit to the map saved after apply is removed with it.
- `checksums.sha256`: `sha256sum -c checksums.sha256` before running.

## Practice run

`src/lib/__tests__/property-page-part1-sql.test.ts` runs apply, undo and apply again on an isolated PGlite copy with the live column names (4 tests pass): the method check, the one-off rule (plan, follow-up, carry over and caller-set cases), the exact seed and keep-existing rule, and a clean undo.

## Until applied

The page works without it: the owner row reads the columns only when present, the map falls back to the same seeded values in code (`DEFAULT_STATUS_STAGE_MAP`), and Admin's map editor (Home details, Admin only) can already save the row under the existing Admin-only rule; apply then keeps whatever was saved. The owner form offers the two new fields only once the columns exist. Add task works; the one-off flag is set once applied.
