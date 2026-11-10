# Databases, Tickets tabs: the one database step

Emily, Nov 9 (register P3, N2, N4, T12, C1, H9). Build 1 of 7. No publish.

## What it does
`01_imported_tickets_switch.sql` adds one row to the switch list: `imported_tickets_page`, **off**.
It only lets an Admin turn the old imported tickets lists back on in Admin > Workflow controls.
The code already treats a missing switch as off, so the screens behave the same before and after this row.

No table, column, rule, trigger, permission or scheduled job changes. No ticket, claim or home row is touched.

## Apply
Data change, applied with the database data tool (not a schema migration), after the checks pass.
`ON CONFLICT (key) DO NOTHING` makes a second run harmless.

## Undo
`01_undo_imported_tickets_switch.sql` removes only that row. Nothing else depends on it.

## Checks
`sha256.txt` holds the checksums of both files.
