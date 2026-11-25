# Auto-assign by seat

Authorized by Emily under Approved: apply ops-simplification, Nov 25.
Scope: one trigger function and one SQL-only one-time scheduled job. No other pending package applies.

`undo.sql` captures the live function exactly, plus its SQL statement terminator.
`apply.sql` preserves the closed/resolved guard and the four assignment writes.
It replaces the automated-source early return with a Notion-only guard and routes automated work through existing `ticket_route_at`.
Untyped Breezeway tickets use the existing Team B display mapping (`automatedTeam`) by passing `po_day` to that same router; no ticket team field changes.
All 41 open Breezeway tickets currently have no role or work type. Without this input mapping they would bypass the coordinator route and fall back to leadership. No routing helper changes.

`schedule.sql` runs Nov 26 at 14:00 UTC (8 AM Central), loops real open unowned non-Notion tickets since go-live, locks each row, uses a separate routing call per row, records assigned IDs/previous values/skipped IDs in audit_log, and unschedules itself. A year guard and audit receipt prevent later repeat assignment. Existing ticket audit/notification triggers remain active.
This is one run, not polling. The cron minute is 14:00 UTC; no exact-second guarantee.

Rollback: apply undo.sql through the migration tool; unschedule only auto-assign-by-seat-20261126 through the data tool. This does not revert future ticket assignments. The spread audit retains previous values for reviewed, selective undo without overwriting later staff work.
No isolated database-schema copy is built; practice uses only a small function/record harness with a controlled router double.
