# Owner behind follow-ups (staged, not applied)
1. 01_followup_tasks.sql: new follow-up table, open-per-home guard, read policy, close_owner_followup. Undo: 01_followup_tasks.undo.sql.
2. 02_clear_false_alarms.data.sql: closes the 7 real-home call/text items caused by withdrawn activities. Receipt: before-rows.json. Undo: 02_clear_false_alarms.undo.sql.
Not touched: 6 practice-home items and the Linder 25-hour checkpoint item (hour pace, not waiting items). Emily to decide.
Checks after 01: anon and PUBLIC have no privilege on the table or function; anon SECURITY DEFINER set unchanged (69).
