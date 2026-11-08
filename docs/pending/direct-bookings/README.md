# Direct Bookings (staged, not applied)

Apply in order, only when approved:
1. `01_direct_bookings.sql`: new lead columns (kind, owner, reply, outcome), `direct_booking_approvals`, role helpers, settings read/save, atomic Start, approval with 2 minute Director alert, reply/follow-up/outcome recording, in-app alerts to Guest Experience and Reservations on shift, daily sent-quotes list.
2. `02_seed_direct_bookings.sql`: settings (Nov 9 to 23 approval period, 3 bed $189, 4 bed $199, 2 and 5 bed not set) and the two editable reply templates.

Undo in reverse: `02_undo_seed_direct_bookings.sql`, then `01_undo_direct_bookings.sql`.
All changes are additive; existing lead rows are not changed. Checksums in `sha256.txt`.
