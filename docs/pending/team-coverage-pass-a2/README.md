# Team & coverage Pass A.2: pending database change

Nothing here has been applied.

| File | What it does | Undo |
|---|---|---|
| 01_oncall_weekday_pattern.sql | Adds `public.oncall_user_for_night(date)`: a dated on-call row wins (shortest, then newest), otherwise the weekday pattern saved in app_settings `oncall_weekday_pattern`. `auto_assign_ticket()` calls it for the overnight lookup; no other line changes. Seeds the pattern once from the latest roster night of each weekday, only if the setting is absent. Also makes `public.seat_on_duty()` treat a seat with no recurring shifts as off duty (it was always on duty). | 01_undo_oncall_weekday_pattern.sql |

- Precheck before applying: live `md5(pg_get_functiondef('public.auto_assign_ticket()'))` = `445e2777b2b6ffd9a2c3e8bb4747a230` (captured 2026-11-04, after Pass A). If it differs, stop.
- Also precheck `md5(pg_get_functiondef('public.seat_on_duty(text,timestamptz)'))` = `6c092e95270690504a379582bf2327c6`; live-capture/public.seat_on_duty.sql is restored by the undo.
- Effect of the empty-seat rule: seats with no shifts today (Director of Operations, Directors, CEO, Finance Lead, Accounting, Active Owner follow-up, onboarding seats) stop counting as on duty, so work owned by them goes to their backup seat, then the Operations Supervisor. The Supervisor last-resort step is unchanged.
- live-capture/public.auto_assign_ticket.sql is the Pass A definition the undo restores.
- Seed today would be Sun Micah Sinor, Mon Micah Sinor, Tue Emily Jimenez, Wed James Almario, Thu Micah Sinor, Fri Emily Jimenez, Sat James Almario.
- Privileges: auto_assign_ticket stays postgres and service_role only. The new helper is execute for authenticated and service_role; PUBLIC and anon are revoked.
- The undo keeps the saved pattern setting, because the screen reads and writes it on its own.
- No tables or columns are added. The on-call eligible list uses the existing `profiles.oncall_eligible` flag; the pattern, grid rows and test account list are app_settings rows written by audited server actions.
- Isolated test: src/lib/__tests__/oncall-pattern-sql.test.ts.
- Until applied: the live roster ends on 2026-11-07, so live app ticket routing has no on-call person after that night and falls to the seat and Supervisor ladder. The screen shows those nights red until the pattern is saved and this file is applied.
