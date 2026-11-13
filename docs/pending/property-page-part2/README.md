# Property page Part 2: Owner tab, chat and owner communication (staged Nov 13, NOT applied)

Approved by the Admin, Nov 12. Page: one home's Onboarding view (/onboarding/$propertyId).
Nothing here has been run on the live database. Apply only with the Admin's approval.

## Files
| File | What it does |
|---|---|
| 00_preflight.sql | Read-only checks. Stops if the live daily owner email (ao_owner_email_run) changed since it was captured (md5 5d8495f7bf20b40be07d8a3949f04759) or if any table this adds already exists. Run first, same transaction. |
| apply.sql | Additive only. Adds the project chat (home_chats, home_chat_messages, home_chat_reads, home_chat_message_tasks, home_chat_alerts, realtime on messages), Good to know on the owner record with its history table, a kind (note, call, text) on onboarding_notes, weekly owner updates with the per-home auto-send switch and history, one record per automatic owner reminder, the answer-by date for Ask the owner, the in-app-only rule for Task notices written together by a bulk action, and a new body for ao_owner_email_run so reminders join the one daily owner email. |
| apply.undo.sql | Removes everything apply.sql added and puts the captured ao_owner_email_run back exactly. It drops the new tables, so export chat messages, Good to know, logged calls and texts, and weekly updates first if it is undone after use. |
| live-capture/ao_owner_email_run.sql | The live function as captured Nov 13, used by the undo file. |
| checksums.sha256 | sha256 of every file above. |

## How to apply (only with approval)
One transaction: `BEGIN; \i 00_preflight.sql \i apply.sql COMMIT;`

## Rules it enforces (database side)
- Owner chat: read by every staff account that can open onboarding homes and by the home's owners (program members); written by Admin, Director of Onboarding, the home's PM, Designer and Utilities, and the owner. Team chat: staff only for reading and writing; it is never returned to an owner by any query (row level security).
- Files in chat: one of the home's Files folders (Design, Agreements, Estimates and invoices, Photos, Inspections; never Other), already in the home's Files. Changed Nov 13 by Property page Part 3 (3.2), before this was applied; codes never go in chat files.
- Unread owner chat: one email to the owner when a staff message is unread for 15 minutes, at most one per 15 minutes per home; one staff alert when an owner message waits 15 minutes.
- Good to know: PM, Director and Admin; every change writes who and when, a history row and audit_log; direct writes are refused.
- Logged calls and texts: written only by the home's team, the Director or Admin, through log_owner_contact; never counted as owner hours (they are notes, not owner time).
- Weekly update: drafted Friday from 7 AM Central by the five-minute job; sent by PM, Director or Admin; never sent from 3 PM Friday until Monday; auto-send is off for every home and only the Director or Admin turn it on; the PM can pause it.
- Owner reminders: one per owner decision, the business day before it is due (weekends and ao_business_holidays skipped), from 9 AM Central; held for the one daily Active Owner email so all reminders for one owner on one day go in one email; shown in the portal at once.
- Bulk Task actions: when one save writes Task notices of one kind for several Tasks, they are in-app only. A single Task keeps today's email.

## Practice run
- Isolated copy: src/lib/__tests__/property-page-part2-sql.test.ts on PGlite with src/lib/__tests__/fixtures/property-page-part2-schema.sql (16 tests, all pass), including the team chat RLS test and the undo.
- Real database practice was not run: the sandbox connection is read only.
