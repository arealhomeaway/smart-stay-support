# routing-skip-supervisor-off

Emily's answer to the change 5 question: ticket routing skips an Operations Supervisor who has time off at that moment, the same rule handoffs follow since 0378. When nobody is eligible the ticket stays unassigned on its team and shows in that team's queue.

Files:
- 01: `coordinator_for` Supervisor fallback skips an `off` override.
- 02: `ticket_route_at` (non-coordinator work) Supervisor fallback, same rule.
Nothing else changes: coordinators, lunch, other team, on call, clocks, alerts, urgency.

Steps: run preflight.sql (both fingerprints must match before*.sql captures), apply 01+02 through the migration tool, read back both definitions. Undo: undo.sql restores both captured definitions.

Apply only on: **Approved: apply routing-skip-supervisor-off**
