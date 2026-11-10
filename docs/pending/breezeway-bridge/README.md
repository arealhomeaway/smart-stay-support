# Breezeway bridge (Build 10, Emily Nov 10; register T15, C4, C5, C6)

Status: APPLIED after checks as migration 0323 (byte for byte `01_breezeway_bridge.sql`), and the
webhook note text (`02_webhook_note.sql`). The bridge is OFF, Resolve work orders are OFF, the
safety sweep is scheduled but INACTIVE. Nothing was created or changed in Breezeway.

## What 01 adds (additive only)

- Mirror columns on `breezeway_work_orders` (empty for the existing rows): `tags`, `created_by_id`,
  `created_by_name`, `requested_by`, `reported_issue`, `report_url`, `bridge_keep`.
- Tables: `breezeway_home_tags` (read only Breezeway home tags, for the New House skip) and
  `breezeway_bridge_records` (one record per decision: created, skipped with its reason, or failed;
  unique per task so a ticket or review is made once).
- Switch `internal_work_orders` (off). While off, a trigger refuses any non demo Resolve work order
  and any Breezeway outbound task.
- `set_breezeway_bridge(on)`: Admin only; on moves a forward only start line to that moment; who and
  when are recorded; the switch and start line cannot be changed any other way (guard triggers).
- `private.breezeway_bridge_apply` trigger on every mirror write (webhook, recovery, sweep, manual
  refresh): Reported Issue after the start line on a verified home makes one ordinary ticket (no
  owner, From Breezeway, Team B, normal clocks); finished maintenance after the start line makes one
  Maintenance Review for Team B due 24 hours after the finish time; New House and unverified homes
  are skipped and recorded; cleaning and inspection get nothing. Older work is skipped as "before the
  bridge started", judged by the event time but never later than Breezeway's own last update. A
  failure never breaks the mirror write; it is recorded for Integrations.
- `breezeway_bridge_status()`: Admin only, the true state for Integrations.

## Change from the brief

Database steps may no longer start or stop timed jobs, so the switch does not start the safety
sweep. The sweep (`breezeway-safety-sweep`, every 10 minutes, private scheduler secret) is created
and inactive; on each run it reads the switch and does nothing while the bridge is off.

## Practice

- Isolated copy: `src/lib/__tests__/breezeway-bridge-sql.test.ts` (26 checks, including undo).
- Real database, Nov 10, cancelled at the end on one verified home with fake task numbers:
  `practice_01_breezeway_bridge.sql` (switch and start line refused directly; one ticket for a new
  issue, none on the second update; urgent issue Right now; old issue and old finish skipped; one
  review due 24 hours after finish, none on Approved; New House and other company skipped; nothing
  for cleaning or inspection; nothing while off; work order and outbound inserts refused; 0
  failures). A second cancelled check after applying: ticket clocks 120 and 480 minutes, no owner,
  Team Queue wait time set; review due 24.0 hours after finish. Afterwards: bridge off, no start
  line, no records, no practice rows.

## Undo

Turn the bridge off first. `undo/01_breezeway_bridge.sql` removes what 01 added; tickets and reviews
already made stay. `undo/02_webhook_note.sql` puts the old note back.
