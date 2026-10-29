# After-handoff owner plan, Phases 1 and 2 (pending, NOT applied)

Apply in order: `01_plan_and_schedule.sql`, then `02_perform_handoff_step.sql`.
Undo in order: `undo-perform_handoff_step.sql`, then `undo-01_plan_and_schedule.sql`.

- `undo-perform_handoff_step.sql` is the exact live `perform_handoff_step(uuid,text,jsonb,boolean)` read on Oct 29, 2026 via base64 + sha256. Definition bytes sha256 `27814fdbb3f5eb641ede9b736a052248fd0270849872fda58a7aa7f30ec9f031` (matches live and `../cover-accept/apply.sql`); the file adds only a trailing `;`. Live ACL: `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}` (CREATE OR REPLACE keeps it).
- `check.diff`: the only change adds `PERFORM private.schedule_after_handoff(pr.id,pr.property_id);` inside the accepted branch's final IF.
- Nothing here creates work items, owner notifications or emails, or calls a release function. No backfill: only acceptances after apply schedule anything.
- `01` also inserts the `active_owner_followup` seat (team `operations`) held by the current Director of Operations holder.
- Isolated tests: `src/lib/__tests__/after-handoff-rpc.test.ts`.
