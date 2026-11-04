# Notion ticket import: dry run (read only, nothing imported)

Run: Nov 4, 2026. Source: Notion "Maintenance Ticket Management" via Emily's Notion connection.
Nothing was written to Resolve, Notion, OwnerRez or Breezeway.

## 1. Counts

- Total rows in Notion: **2,892** (Done 2,216; Pending Claim Review with Josh 391; In progress 283; Completed Same Day 2).
- In scope: **758**
  - Open now (In progress or Pending Claim Review with Josh): **674** (459 created in 2026, 215 created in 2025)
  - Closed but created or edited in the last 30 days: **84** (Done 82, Completed Same Day 2)
- Note: "edited in the last 30 days" uses Notion's last edited time, which also changes on trivial edits.

## 2. Field mapping

| Notion property | Filled (of 758) | Resolve ticket field |
|---|---|---|
| Issue Description (title) | 744 | title (14 blank titles: use "Imported Notion ticket" plus home) |
| Issue Status | 758 | status (see section 4) |
| Priority | 701 | priority (see section 4) |
| Assignee | 737 | assigned_to (see section 4) |
| Property Address (relation to PID) | 731 | property_id, via OwnerRez ID (section 3) |
| Created Date | 728 | reported_at (fallback: Notion created time) |
| Due Date | 724 | due_at |
| Date Completed | 243 | resolved_at |
| Notes | 139 | description |
| Breezeway Link | 22 | breezeway_task_url |
| Page ID / page URL | 758 | external_source = "notion", external_id = page ID, external_url |
| Last edited time | 758 | external_synced_at (reference only) |
| Will this be a claim? | 590 | Linked claim (one per ticket), not a ticket field |
| Claim Filed? | 576 | Linked claim stage |
| Is the claim less than $75? | 168 | Linked claim notes |
| Total Damages $ | 455 | Linked claim amount claimed |
| Reimbursed Amount $ | 322 | Linked claim amount recovered |
| Management/Operational Fee | 111 | Linked claim notes |
| Claim Filed Date | 0 | Linked claim filed date (empty, nothing to carry) |

No home in Resolve (keep as an "Imported from Notion" block in the ticket notes):
Submitted by (223), Market (734, derivable from the home), Completed by (75), Guest Informed? (4).

Skip (calculated or buttons, no data of their own): Status_, Outstanding $, Special Handling?, Past 7 Days?, Furniture Warranty Notes and Special Handling Notes (rollups from the home page), and the buttons Closing Claim, Claim Completed?, Claim Reviewed?, Complete?.

There is **no category property** in Notion. Every imported ticket would be a Maintenance Ticket with category "other" unless Emily wants a rule (see decisions).

## 3. Home matching (ID only, never by name)

Resolve homes do not store a Notion page ID, so matching is: ticket's Property Address relation (Notion PID page) to that page's "OwnerRez Internal ID", to the Resolve home with the same OwnerRez ID. Notion writes the ID as "ORP123456" and Resolve as "123456"; the "ORP" prefix is dropped before comparing (same ID, no name involved). Demo homes are excluded.

- Matched: **728**
- Unmatched: **30**
  - 27 have no home linked in Notion
  - 3 link to "21036 Owens Rd, Luther, OK 73054" (OwnerRez 410153), which has no Resolve home
- One ticket links two homes (matched on the first that resolves; flag for review).

Unmatched rows (title, home shown in Notion, status):

- Aircover - Jose Hernandez at 4003 Excess Trash / Additional Cleaning | none | In progress
- 8408 - Full room painting and Carpet Cleaning | none | In progress
- Direct - Ryan & Don Perry at 8408 NW - Guest left the home very trash... | none | In progress
- Aircover - David Abdalla at 14553 Serrano - Oil stains in garage... | none | In progress
- 1016 - Order Coffee pot | none | In progress
- 401 E 10th - Property Turnover Maintenance Review & Owner Quote Prep... | none | In progress
- 453 - order pan set + drinking glass + bowl | none | Done
- 1152 - 845 - not drying again - schedule dryer vent cleaning | none | Done
- 16216 - Paint touch up | none | In progress
- Airbnb - Kristen's Group New Booking - Check-in Apr 16 (2 Days)... | none | In progress
- Timothy Griffith - $300 Refundable Deposit for the three pets. | none | In progress
- Updates Discussion | none | In progress
- Aircover - 1601 - Ricki Rebeiro - House is a mess | none | Pending Claim Review with Josh
- 14 rows with a blank title | none | In progress
- Aircover - Joshua Ramlal at 21036 Owens - nasty and stinks bad | 21036 Owens Rd (OwnerRez 410153) | Pending Claim Review with Josh
- Aircover - Monee Hollins at 21036 Owens Rd - Area Rug Replacement | 21036 Owens Rd (OwnerRez 410153) | Pending Claim Review with Josh
- Aircover - 21036 - DJ Hosford - Damaged Linens, paint stains on floor | 21036 Owens Rd (OwnerRez 410153) | Pending Claim Review with Josh

## 4. Value lists

Status (Resolve allows open, in_progress, closed and others):
- In progress (283 open) -> in_progress
- Pending Claim Review with Josh (391) -> in_progress, with the linked claim open and "Waiting on: claim review"
- Done (82) -> closed
- Completed Same Day (2) -> closed

Priority (Resolve allows P1 to P3 only):
- Urgent (21) -> P1
- High (58) -> P2
- Medium (569) -> P3
- Low (53) -> P3 (no P4)
- Blank (57) -> P3
- Medium -> P3 and High -> P2 is a proposal. Emily to confirm.

Assignee:
- Micah Sinor (560) -> Micah Sinor
- Romeo Canales (111) -> Romeo Canales
- Mike Cacatian (31) -> Mike Cacatian
- James Almario (0 in scope) -> James Almario
- Qym Fuenteblanca (25): **no Resolve login**
- Avy Vergara (2): **no Resolve login**
- Nelson Mahilom (1): **no Resolve login**
- General (7) and blank (21): no person; leave unassigned for the home's Pod

Category: none in Notion (see section 2).

## 5. Duplicates against the 37 Resolve tickets

- 30 of the 37 are demo tickets; 7 are real (refs 576, 577, 578, 581, 582, 627, 628).
- No Resolve ticket carries a Notion page ID in its external ID or source reference. **0 ID duplicates.**
- The 7 real tickets were compared by home and date only as a check, not as a match rule: none of them came from Notion (all created in Resolve since Sep 29). Two are QA demos and one is "test".
- Within Notion, each page ID is unique, so the import cannot double up as long as it keys on page ID.

## 6. Attachments and comments (in-scope rows)

- Comments: **3,884** on 731 tickets. They can come across as read-only ticket history entries with original author name and date (authors become text, not Resolve users).
- Files and photos: **2,531** on 543 tickets (comment attachments plus files in the page body). Notion gives only short-lived download links (about an hour), so files must be downloaded and re-uploaded into Resolve's file storage during the import; links cannot be stored.
- Page body text: 88 tickets have written content in the page itself; carry as notes.
- Notion rate-limits reads heavily; the counting pass took about 15 minutes. A real import with file copying should run in batches over a few hours.

## 7. Recommended plan

1. Small database change needed before import (approval required): Resolve homes have no field for the Notion page ID, and nothing records an imported comment's original author/date. Matching via OwnerRez ID works without it. A unique rule on (external_source, external_id) for tickets would guarantee no duplicates on reruns.
2. Import in two passes: first the 758 tickets with fields and linked claims, no files; Emily reviews a sample of 20; then comments and files.
3. Unmatched 30 rows: import with no home only if Emily agrees; otherwise list them for manual linking. Add 21036 Owens Rd only if it is still managed.
4. Mark every imported ticket "Imported from Notion" with the Notion link, and do not start response clocks or alerts for them (past SLA times would fire immediately).

## Decisions for Emily

- Priority mapping (Medium and Low both to P3?).
- Qym Fuenteblanca, Avy Vergara, Nelson Mahilom have no Resolve login: create logins, reassign, or leave unassigned?
- Category: all "other", or a keyword rule from the title?
- 391 "Pending Claim Review with Josh": create a linked claim for each, or only where "Will this be a claim?" is Yes (589 of all in scope)?
- 215 open tickets from 2025: import, or close them in Notion first?
- 30 unmatched rows and 21036 Owens Rd.
- Approve the small database change in step 1.
