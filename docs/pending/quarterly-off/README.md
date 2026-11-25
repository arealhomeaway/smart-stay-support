# quarterly-off
Applied Nov 25 2026 on Emily's instruction.
- Paused scheduled job 2 `quarterly-inspection-scheduler` (13:00 UTC nightly), the only thing that opens quarterly review tickets. The two database rules only set due dates, unchanged.
- Switches `quarterly_reviews` (menu + page) and `quarterly_scheduler` set off.
- Archived 54 open tickets, reason "Quarterly reviews not set up yet", ids in undo.csv. Undo: undo.sql.
