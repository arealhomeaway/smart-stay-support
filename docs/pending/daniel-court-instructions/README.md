# daniel-court-instructions (one-time Breezeway write, done Nov 22)

Requested by the Admin, Nov 22: write each Task's text into the instructions of the 5 open onboarding work orders at
624 Daniel Court whose instructions did not reach Breezeway, keeping any template text under it, the same way new
sends now work. Only these 5 work orders and only their instructions (`description`) were changed.

| Breezeway work order | Number | Before |
|---|---|---|
| New House Setup - Standard Inspection | 177312935 | template text (inspection link) |
| New House Setup - Press Curtains | 177312999 | empty |
| New House Setup - Assemble Boxed Furniture | 177313021 | empty |
| Lawn Care | 177313132 | empty |
| New House Setup - Painting | 177313141 | "Paint the rooms approved on the estimate" |

Text written: the description Resolve sent on Nov 15 (breezeway_outbound_tasks.description), then the template's text
under it when there was one (same rule as instructionsText in src/lib/onboarding-work-order-status.ts).
Each write was read back from Breezeway: all 5 keep the Task's text. Breezeway answered 201 to each.

Files: before.json (instructions before the write, for undo), after.json (what Breezeway shows after).
Undo: set each work order's description back to its `before` value in before.json (empty for 3 of them).
Nothing in the Resolve database was changed by this write; the outbound rows' instructions_set_at stays empty.

## Restored Nov 22 (correction: Breezeway's own instructions stay, Task guidance is never written)
On the Admin's correction, each of the 5 work orders' instructions (`description`) was set back to its `before`
value in before.json (empty for 3). Before writing, each still showed exactly the Nov 22 write. Breezeway answered
201 to each; the read-back matches before.json exactly (empty reads back as empty), and name, date, template,
home and priority are unchanged. Record: restore.json.
