# Build 16 database change (Emily, Nov 11)

Files
- `01_build16.sql`: the change (additive).
- `01_build16.undo.sql`: puts back the live rules exactly.
- `02_practice_cancelled.sql`: the cancelled practice (run after 01 in one step; its final RAISE cancels everything).
- `CHECKSUMS.sha256`.

What it does
1. Two switches, OFF: `arrival_ready_button` (the per person Ready for arrival button; the arrival check replaces it) and `finance_packet_button` (the retired weekly finance packet).
2. Direct Bookings settings save for Admin only (register A11). The Operations Supervisor and the Director of Operations still open the page read only.
3. When a Breezeway work order linked to a ticket reaches finished (Finished, Approved or Closed), or is linked while already finished, the ticket's next step becomes "Check the finished work" with one history line. Quiet Notion imports, archived and closed tickets are untouched. No clock, SLA, alert, routing or status change.

Not changed: routing, clocks, alerts, scheduled jobs, syncs, permissions other than the settings save.

Practice (Nov 11, cancelled): live ticket step "Check the finished work", quiet import unchanged, one history line, one state log line, both switches off, settings refused for a caller who is not Admin. Afterwards: no switch rows, no function, no linked orders, no history lines remained.

Schedule (A1, not in this file): the `breezeway-safety-sweep` job is scheduled and active every 10 minutes. While the bridge is off it records its run and does nothing else.
