# Team & coverage Pass A: pending database change

Nothing here has been applied.

| File | What it does | Undo |
|---|---|---|
| 01_auto_assign_ticket_overrides.sql | App ticket routing honors off/cover overrides and the seat available flag (seat_holder_at / seat_eligible_now); single-night on-call entries win over weekly rotation (shortest entry, then newest). | 01_undo_auto_assign_ticket_overrides.sql |

- live-capture/public.auto_assign_ticket.sql is the exact live definition (md5 bb01f74f2f5190e030db136938487556, captured 2026-11-04).
- Only public.auto_assign_ticket() changes. Privileges stay postgres and service_role only.
- Isolated test: src/lib/__tests__/auto-assign-overrides-sql.test.ts.
- Until applied, the screen already shows single nights winning, but live app ticket routing still picks any matching on-call row and still ignores overrides.
