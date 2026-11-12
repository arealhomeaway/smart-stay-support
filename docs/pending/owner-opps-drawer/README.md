# Owner Opportunities and Task Drawer: staged database changes

Approved by the Admin, Nov 11. NOTHING HERE IS APPLIED. Apply only when the Admin approves, in this order.
Each file acts as the approving Admin where it writes rows, so history records who and when. Repeats change nothing.

| Order | File | What it does | Undo |
| --- | --- | --- | --- |
| 1 | `01_library_cards.sql` | Part C. Retires the 5 Optional Library cards that repeat plan cards (kept, never deleted; started Opportunities and their videos stay). Adds the 3 unique ones to the card library as released "anytime" cards (codes N15, N16, N17, the next free numbers; wording copied from the library; no hour estimate). Marks N05, N06, N07, N08, N12, P16, P17, P18 once per owner. Every change has an audit or card history row. | `01_library_cards.undo.sql` (brings the 5 back from the receipts, retires the 3 added cards, clears once per owner; deletes nothing) |
| 2 | `02_portal_plan_and_once_per_owner.sql` | Needs 01. New read `ao_owner_portal_plan` (same rows and access as `ao_owner_plan`, plus stage window, owner item and once per owner). `ao_submit_card`: answering a once per owner card completes every other open copy on the owner's homes in the same program, each with its own record. | `02_portal_plan_and_once_per_owner.undo.sql` (the live `ao_submit_card` text exactly; drops the new read) |
| 3 | `03_owner_notice_wording.sql` | A5. The homeowner bell shows the stored title and body of `ao_plan_ready`, `ao_daily` and `ao_home_live`. Every other kind is the live text unchanged. | `03_owner_notice_wording.undo.sql` (live text exactly) |
| 4 | `04_task_started_and_draft_work_orders.sql` | B1 Mark as started: two additive columns and one caller-authenticated action with an audit row (status, clocks and completion unchanged). B2.2: the Breezeway save also accepts "Draft work order:" titles; only that one title test changes and Send to Breezeway stays behind its switch (off). | `04_task_started_and_draft_work_orders.undo.sql` (live Breezeway save text exactly; drops the action; leaves the two columns, which nothing else reads) |

Files 03 and 04 are independent of 01 and 02.

Until each file is applied the screens fall back safely: the Opportunities page reads `ao_owner_portal_plan` when present and `ao_owner_plan` otherwise; Mark as started shows only once its column exists; Draft work order Tasks show the Breezeway section but saving a number on one waits for file 04.

`live-capture/` holds the live function text each file replaces, read on Nov 11.

Tests: `src/lib/__tests__/owner-opps-drawer-sql.test.ts` runs 01 to 04 and their undo files on an isolated copy.
Cancelled practice on the real database (BEGIN, file, undo, ROLLBACK) could not run: the sandbox database role may not change these tables or functions (`must be owner`, `permission denied for schema public`). Every attempt rolled back; nothing changed.
