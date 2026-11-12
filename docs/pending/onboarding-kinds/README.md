# Onboarding Task kinds, owner approvals and notices (Nov 12 build). NOT APPLIED.

Lovable staged these files and did not apply them. Apply in order, after reading. Each has an undo.

| File | What it does | Undo |
| --- | --- | --- |
| 01_task_kinds.sql | Adds `task_kind` (default `do_it`) and `kind_settings` to plan steps and Tasks; backfills existing Tasks only by the approved rule (Work order by title, Send to the homeowner when the step needs the owner's approval or a business decision, else Do it) with user triggers paused for that one statement and one audit row; a new Task copies its step's kind. | 01_task_kinds.undo.sql (keeps the columns and their values, removes the copy trigger and value rules) |
| 02_owner_items.sql | Fix 24 `owner_item_approve` and `owner_item_is_approval`; fix 25 status follows the last speaker (owner answer = answered, staff reply = awaiting_owner); fix 26 `owner_item_reply` notifies the assigned person, else the Project Manager and the Director of Onboarding, plus followers. | 02_owner_items.undo.sql (restores the live `owner_item_reply` from live-capture/) |

Until applied, the screens fall back safely: the step editor hides "Kind of Task", Tasks use the approved rule for their kind, Approve is not offered to owners, and owner replies notify as today.

Checked on an isolated copy: `bun test src/lib/__tests__/onboarding-kinds-sql.test.ts` (9 pass), including both undo files.
Part D (Claude): set kinds on the Standard plan steps and publish; load the six onboarding email templates; retire "Add the owner to the Owners Database"; confirm Breezeway matches with the Admin.
