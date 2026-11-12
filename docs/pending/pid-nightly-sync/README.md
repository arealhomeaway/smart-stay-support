# Nightly copy from the PID (staged, Nov 12, 2026)

Approved by the Admin, Nov 12: until the inspection forms move into Resolve, Resolve copies from the
Notion PID every night with the same mapping and rules as the Nov 12 refresh. Built switched OFF.
Nothing here has been applied. Nothing is published.

## Order
1. Approve and apply the first refresh (`docs/pending/pid-refresh-2026-11-12/apply.sql`).
2. Apply `01_pid_nightly_sync.sql` (undo: `undo/01_pid_nightly_sync.sql`). It adds the switch
   `pid_nightly_sync` OFF, the review list `pid_sync_review_items` (Admin read), From the PID values
   `property_pid_extra_fields` (staff read), three private tables, and three service-role functions.
3. The Admin turns `pid_nightly_sync` on. The next 2 AM Central pass of the existing five-minute job
   starts the first night. No new scheduled job is created.

## What a night does
- Reads the PID (169 pages today), its field list, and the titles of the records its linked fields point at. Read only.
- Same rules as the dry run (`src/lib/pid-sync/plan.ts`; checked row for row against `pid-refresh-2026-11-12/changes.csv`: 914 of 914 identical).
  Fills; updates only where the value still came from notion_pid and nobody changed it in Resolve
  since (a newer profile edit, an accepted fact, or a value that no longer matches what the last copy wrote).
  Blank in Notion never clears. OwnerRez-owned fields are never written. The home's status is never changed.
- Codes: the nine code fields go only to Guest Access & Credentials, encrypted (Sep 1 rules); a code
  saved or archived in Resolve is kept. Text elsewhere that may hold a code is not copied; it goes to
  the encrypted code list for review once (keyed fingerprint, never the text).
- One home, one transaction (`pid_sync_apply_home`): every value is written only if Resolve still holds
  what the run read; any difference undoes the whole home and it shows as an error.
- One summary row per run on Admin > Integrations (`integration_events`, system `notion_pid`): homes
  touched, fills, updates, skipped, on the review list, errors; plus the review list.
- Notion unreachable: nothing is written and the run shows the error. A long night continues on the
  next five-minute pass; a run not finished after 6 hours is closed as failed.

## From the PID (item 4)
PID fields with no place on the property page today, shown read-only under "From the PID", labeled
"As of" the copy date. Count = homes with a value in today's PID.

| Field | Type | Homes |
|---|---|---|
| 1. New House Setup Inspection | linked | 0 |
| 2. Pre-Work Inspection | linked | 0 |
| 3. Standard Inspection | linked | 0 |
| 4. Mid Project Review Inspection | linked | 0 |
| 5. Final Inspection | linked | 0 |
| 6. Property Handoff Inspection | linked | 0 |
| Active Projects Sheet | linked | 66 |
| Base Price | number | 159 |
| BW Property Link | text | 167 |
| Breaker Box Photo | photos (count) | 158 |
| Fireplace Switch Location Photo | photos (count) | 83 |
| Garage Remote Photo | photos (count) | 153 |
| Home Inspection Schedule | linked | 122 |
| Hot Tub Control Panel Photo | photos (count) | 3 |
| Household and Appliances | linked | 0 |
| Indoor Water Shutoff Location Photo | photos (count) | 111 |
| Inspection Requests | linked | 138 |
| Inspections Executed | linked | 1 |
| Last Inspection Date | rollup | 0 |
| Listing Photos | link | 149 |
| Map | place | 159 |
| OR Property Link | text | 167 |
| Outdoor Water Shutoff Location Photo | photos (count) | 157 |
| Owner | linked | 168 |
| Owner Email | rollup | 161 |
| Owner Phone | rollup | 156 |
| OwnerRez Internal ID | text | 167 |
| OwnerRez Order | number | 164 |
| Permit Review Status & Notes | rollup | 42 |
| Rental Restriction Notes | rollup | 40 |
| Router Location Photo | photos (count) | 156 |
| Special Handling | text | 73 |
| Status_ | select | 4 |
| Storm Shelter Photo | photos (count) | 35 |
| Tags | multi select | 0 |
| Utility Info | linked | 0 |
| Vendors | linked | 157 |
| Yale Integration - Live and Connected in Breezeway | checkbox | 169 |
| Yale WiFi Chip | photos (count) | 122 |

Excluded as in the Sep 1 mapping: 26 formulas and 2 buttons. Not repeated: Property, City, State and Zip
(the address shows in Quick Overview) and the nine code fields (Guest Access & Credentials).
Photo fields show how many photos the PID holds; the photos themselves wait for the second PID import (register P7).
Ten linked fields point at Notion lists the connection cannot read (the six inspection stages,
Household and Appliances, Inspections Executed, Utility Info, Last Inspection Date); they stay empty.

## Checks
`src/lib/__tests__/pid-nightly-sync.test.ts` (rules), `pid-nightly-sync-sql.test.ts` (this file in an
isolated PostgreSQL), `pid-nightly-sync-run.test.ts` (the nightly run with a fake database and Notion).
