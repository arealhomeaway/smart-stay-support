# PID refresh dry run, Nov 12, 2026 (approved by the Admin)

DRY RUN ONLY. Nothing was written to properties, provenance, links, conflicts or any table; no switch changed; Notion was only read.
`apply.sql` and `apply.undo.sql` have NOT been run. Apply only with approval.

- Source: Notion PID data source `5d086f00-6da6-44a6-bab4-7eb5e8547baf` (database `1444658d-5f4f-80e2-8d3a-f1d8f2758cd3`), read Nov 12, 2026.
- Mapping: `docs/pending/pid-import-mapping-v1.md` (166 rows, 91 Import).
- Code: `scripts/pid-refresh-dry-run.ts`. Its constants, transforms, credential scrub and field-planning loop are copied unchanged from the Sep 1 importer `scripts/pid-import.ts`; only matching, the refresh rules and the output are new.

## Totals

| Measure | Count |
|---|---|
| PID rows read | 169 |
| PID rows matched | 166 (to 165 homes; 401 E. 10th St. has two PID pages) |
| Homes matched | 165 (156 imported Sep 1, 9 never imported) |
| Unmatched PID rows | 3 |
| Proposed fills | 767 (742 values + 25 links) |
| Proposed updates | 58 |
| Resolve changed, Notion differs | 0 |
| OwnerRez conflicts | 88 |
| Two PID pages disagree | 1 |
| Values skipped as invalid | 24 (17 unparseable, 7 withheld as possible codes) |
| Values already the same | 11605 |
| Blank in Notion, skipped | 2594 |

Of the fills, 165 are `access.yale_needs_calibration` on every matched home (147 false, 18 true): the Sep 1 run never read it because the Notion field name has a trailing space ("Yale is Not Calibrated "); the mapping's transform for row 41 says "trim field name", so this run trims it.

## Unmatched PID rows

| PID page | Address | OwnerRez ID | Why |
|---|---|---|---|
| (untitled) (`4114658d-5f4f-805c-bdc7-dd9fed0c9863`) | (no address) | (none) | no OwnerRez ID on the PID page |
| C29-09 Horizon Suites, Sepang (New Property Test Created by Aziz) (`21b4658d-5f4f-81cb-a7da-da869ed18d3c`) | C29-09 Horizon Suites, Sepang, Sepang, Selangor | (none) | no OwnerRez ID on the PID page |
| 21036 Owens Rd (`1664658d-5f4f-801a-a3b7-c0cf1d410a12`) | 21036 Owens Rd Luther, OK 73054, Luther, Oklahoma | 410153 | 21036 Owens Rd, excluded by the Sep 1 decision |

The blank page has no title, address or OwnerRez ID (last edited Nov 7, 2026); it is left untouched.

## Homes named in the request

| Home | OwnerRez | Before | Fills | Updates | Conflicts |
|---|---|---|---|---|---|
| 1464 Buckland Ct. | 496703 | never imported | 13 | 0 | 4 |
| 250 Springfield Xing | 497213 | never imported | 13 | 0 | 6 |
| 2601 W 65th St S | 501998 | never imported | 11 | 0 | 6 |
| 3361 E 153rd St S | 502215 | never imported | 11 | 0 | 6 |
| 3400 N Fern Avenue | 499899 | never imported | 12 | 0 | 4 |
| 401 E. 10th St. | 484034 | partly imported (13 values) | 69 | 3 | 3 |
| 624 Daniel Court | 498633 | never imported | 13 | 0 | 3 |
| 6302 Meadow Path Way | 501851 | never imported | 11 | 0 | 6 |
| 8602 E. Galveston St. | 497214 | never imported | 11 | 0 | 6 |

- 8602 E. Galveston St. is stored in Resolve as `ORP497214`; the join strips the ORP prefix on both sides, as the Sep 1 importer did for Notion.
- 401 E. 10th St. matches two PID pages ("401 E. 10th St." `3574658d…` and "401 E. 10th St. (1)" `4144658d…`). Fields are merged: where only one page has a value it is used; where both differ nothing is proposed (only the Pool & Hot Tub Technician Form link differs).
- 250 Springfield Xing's page (`3e44658d…`, ORP497213, last edited Nov 3) matches. Its permit note reads "No permit required for Greenfield, IN" while the home is in Avon, IN; please check the page.
- 1399 Foxtail Ln. (494863) has no notion_pid provenance (it was created in Resolve on Sep 22), so it is treated as never imported.

## 10 homes with the most proposed changes (fills + updates)

| Home | OwnerRez | Fills | Updates | Conflicts |
|---|---|---|---|---|
| 1399 Foxtail Ln. | 494863 | 86 | 0 | 3 |
| 11249 Pegasus Dr. | 492044 | 77 | 0 | 1 |
| 852 Inland Dr. | 490410 | 77 | 0 | 3 |
| 9211 Fitzgerald Dr. | 492500 | 76 | 0 | 2 |
| 401 E. 10th St. | 484034 | 69 | 3 | 3 |
| 3915 W 104th St. S. | 492465 | 71 | 0 | 1 |
| 2536 NW 116th (12M) | 349768 | 25 | 4 | 1 |
| 1464 Buckland Ct. | 496703 | 13 | 0 | 4 |
| 250 Springfield Xing | 497213 | 13 | 0 | 6 |
| 624 Daniel Court | 498633 | 13 | 0 | 3 |

## Refresh rules as applied

1. Home with no notion_pid provenance: a mapped Notion value is a fill when the Resolve value is blank. If Resolve already held a different value it would be listed as "Resolve changed, Notion differs" (none found).
2. Imported home: a differing value is an update only while the field's provenance row is still `notion_pid` and no newer `property_profile_edits` row (or accepted onboarding fact) names that field. Otherwise it is "Resolve changed, Notion differs". A blank Resolve value is a fill unless another source has taken the field. `property_profile_edits` has 0 rows and no field taken by another source differs, so this count is 0.
3. Blank in Notion never clears a Resolve value (blanks are skipped before planning). Unchecked Notion checkboxes are values, as on Sep 1.

OwnerRez-owned fields are never written: every mapping row with Authority OwnerRez (GPS, OR Property Link, Bedrooms, Bathrooms, Occupancy, Instant Book) and every field whose provenance is an OwnerRez source (for example square footage). This includes blank ones the Sep 1 run used to fill. OwnerRez conflicts by field:

- `max_guests`: 18
- `instant_book`: 15
- `bathrooms`: 14
- `external_refs.ownerrez_url`: 9
- `link:OR Property Link`: 9
- `latitude,longitude`: 7
- `latitude`: 5
- `longitude`: 5
- `living_area_sqft`: 4
- `bedrooms`: 2

Updates by field:

- `operating_notes`: 11
- `systems.smoke.batteries_changed_on`: 7
- `facts.tv_specs`: 6
- `hvac.filter_notes`: 6
- `amenities.access_notes`: 6
- `systems.fridge_filter`: 4
- `parking.summary`: 2
- `access.yale_module`: 2
- `utilities.wifi_ssid`: 2
- `access.lock_brand`: 2
- `sprinklers.status`: 1
- `access.garage_remote`: 1
- `access.key_storage`: 1
- `facts.workstation`: 1
- `hvac.filter_sizes`: 1
- `storm_shelter.location_access`: 1
- `amenities.list`: 1
- `systems.water_shutoff_outdoor`: 1
- `sprinklers.controller_location`: 1
- `external_refs.breezeway_url`: 1

## Values skipped as invalid

Unparseable (same checks as Sep 1):

- 3915 W 104th St. S. (7D Max): Smoke Detector Expiration (unparseable date)
- 5923 Hollyhock Lane: Smoke Detector Expiration (unparseable date)
- 2208 E. Toledo St.: Smoke Detector Expiration (unparseable date)
- 85 Lower Green Way: Smoke Detector Expiration (unparseable date)
- 2004 Cedar Ridge Rd: Smoke Detector Expiration (unparseable date)
- 1039 Swinton Way: Smoke Detector Expiration (unparseable date)
- 2817 Hazel Hollow: Smoke Detector Expiration (unparseable date)
- 15226 High Timber Ln: Smoke Detector Expiration (unparseable date)
- 341 Thistlewood Dr: Smoke Detector Expiration (unparseable date)
- 1016 NW 191st St: Smoke Detector Expiration (unparseable date)
- 5047 Skipping Stone Dr: Smoke Detector Expiration (unparseable date)
- 3316 NW 176th: Smoke Detector Expiration (unparseable date)
- 19120 Meadows Crossing: Smoke Detector Expiration (unparseable date)
- 136 Magnolia Estates St: Square Footage (unparseable)
- 4607 S. Lakewood Ave: Smoke Detector Expiration (unparseable date)
- 3000 Meriweather Rd (30D): Smoke Detector Expiration (unparseable date)
- 1700 Whispering Creek Dr: Smoke Detector Expiration (unparseable date)

Withheld as possible codes (values are not in these files). The Sep 1 scrub misses some forms, so any change whose text still looks like it holds a code or password is withheld:

- 3400 N Fern Avenue (499899): `compliance.permit_status`, fill, flagged in the Notion text
- 8602 E. Galveston St. (497214): `compliance.permit_status`, fill, flagged in the Notion text
- 9211 Fitzgerald Dr. (492500): `hoa.notes + external_links`, fill, flagged in the Notion text
- 730 E 38th St. N. (481007): `facts.interior_paint`, update, flagged in the Resolve text
- 3715 W 109th St S (460190): `amenities.access_notes`, update, flagged in the Notion text
- 5020 S.168th E Ave (30D FIRM) (378665): `hoa.notes + external_links`, update, flagged in the Notion and Resolve text
- 3117 Scissortail Way (30D FIRM) (440216): `compliance.permit_status`, fill, flagged in the Notion text

5020 S.168th E Ave and 730 E 38th St. N. are flagged on the Resolve side: the text already in Resolve (imported Sep 1) looks like it may hold a code. Nothing was changed.

## Could not be mapped

Notion fields that are not in mapping v1 (17; names only, values not used):

- 1. New House Setup Inspection
- 2. Pre-Work Inspection
- 3. Standard Inspection
- 4. Mid Project Review Inspection
- 5. Final Inspection
- 6. Property Handoff Inspection
- Home Inspection Schedule
- Household and Appliances
- Inspection Requests
- Inspections Executed
- Last Inspection Date
- Owner
- Owner Email
- Owner Phone
- Scheduling Due
- Utility Info
- Vendors

Also: Listing Photos stays excluded (OwnerRez photos win); fields 45 to 53 (codes and credentials) are dropped before any value is read; the Sep 1 field keys `hoa.notes + external_links` and `warranty.claim_process + external_links` are kept exactly as stored.

## Files

- `changes.csv`: one row per proposed change: ownerrez_id, home, field_key, current_resolve_value, notion_value, kind (fill, update, conflict), plus conflict_with (Resolve, OwnerRez or Notion) and reason.
- `apply.sql`: one transaction. Each value is set only if Resolve still holds the value seen in this dry run (otherwise the whole file stops), then its provenance row is written (value_source `notion_pid`, as_of 2026-11-12, note "PID refresh 2026-11-12"), and new links are added with source `notion_pid`.
- `apply.undo.sql`: puts back every value, the earlier provenance row (or removes the new one) and removes the added links.
- `checksums.sha256`.

Checked offline on a private copy of today's homes, provenance and links (not the real database): apply.sql changed 165 homes, wrote 800 provenance rows (742 new, 58 replaced) and 25 links; running it a second time stopped at the first value; apply.undo.sql then restored every home, provenance row and link exactly.

If applied, the existing triggers on properties run for each changed home (updated_at, and the owner report version is marked stale).
