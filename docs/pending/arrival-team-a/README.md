# arrival-team-a (change 3 of 5)
Apply only on "Approved: apply arrival-team-a". Run preflight.sql first: every helper must exist.
Adds step progress, recheck flag and closed-outside columns; new checks go to Team A (role ge_day);
`save_arrival_check_step` and `bulk_close_overdue_arrival_checks` (Supervisor, Directors, Admin).
Existing checks are not moved. Undo: undo/01_arrival_team_a.sql. Practice run not done yet.
