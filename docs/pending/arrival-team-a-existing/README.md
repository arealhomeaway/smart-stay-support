# arrival-team-a-existing (staged, not applied)
Change 3, answer 5 (Emily, Nov 25). Moves the open arrival checks that already exist to Team A, the same way
new ones go: check team Guest Experience, ticket role ge_day (Team A). Open only; history untouched.
Old values saved in one audit row; undo puts them back. No owner, status or clock change.
Preflight: preflight.sql. Undo: undo/01_move_open_checks.sql. Practice: not run.
Apply only on: **Approved: apply arrival-team-a-existing**
