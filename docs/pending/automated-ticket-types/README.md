# automated-ticket-types (Nov 25 2026)
Applied (data, on Emily's build 3 instruction): added ticket type "Reported issue" (Team B, po_day); set it on 41 open Breezeway tickets with no type, triggers skipped so no owner, status, date or history change. Undo: undo.sql.
Staged, not applied: apply.sql makes new Breezeway bridge tickets get that type. Undo: apply.undo.sql.
Arrival checks: already set type "Arrival check" on every ticket they create (all 112 typed); no change.
