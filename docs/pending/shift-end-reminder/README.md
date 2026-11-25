# shift-end-reminder (change 5 of 5, item 1)

Adds `notify_my_shift_end`: the signed-in team member adds one in-app notice ("Prepare your handoffs") for their own shift end, at most once per shift end, only within 31 minutes of it. No email, no other person, no ticket change.

Until applied, the banner still shows on every page; only the bell notice is missing (the screen ignores the missing function).

Steps: run preflight.sql, apply 01_shift_end_notice.sql through the migration tool, read back with `SELECT proname FROM pg_proc WHERE proname='notify_my_shift_end'`. Undo: undo.sql.

Apply only on: **Approved: apply shift-end-reminder**

## 02_handoff_skip_supervisor_off.sql (item 4)
Live check: coordinators on time off are already skipped by routing and handoff defaults (`seat_eligible_now` reads `off` overrides). The Operations Supervisor fallback in `shift_handoff_defaults` used `seat_holder_at`, which ignores `off`, so a handoff could default to a Supervisor on time off. This file skips that. Undo: `undo_02.sql` restores the captured definition. Ticket routing (`coordinator_for`) is not changed.
