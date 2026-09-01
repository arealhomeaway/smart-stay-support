# PID → Resolve import — FINAL NO-WRITE DRY RUN (2026-09-01)

Simulation only. No PID values imported, no schema created or altered, no Resolve property created,
Notion untouched, no OneDrive migration, nothing published. Executed against live Notion PID
(read-only query) and live Resolve `properties` (read-only select).

## Scope executed
| Item | Result |
|---|---|
| PID rows in database | 159 |
| Candidate scope simulated | **157** (156 matched by OwnerRez Internal ID + 1399 Foxtail Ln / OwnerRez 494863 as In Preparation) |
| Excluded — 21036 Owens Rd (OwnerRez 410153) | no reads written, no record created, Notion row untouched |
| Excluded — Aziz test row (no OwnerRez ID) | skipped entirely, not modified |
| Join key | `ownerrez_property_id` only — no address or name matching |

## Projected totals
| Metric | Projected |
|---|---|
| Properties written | 157 (156 UPDATE + 1 INSERT for Foxtail Ln) |
| Field values written | **12,460** |
| Blanks skipped | **2,563** |
| Provenance rows created (`property_field_provenance`, one per written value with `source`, `source_field`, `as_of`) | **12,460** |
| Conflicts logged, not written (`field_conflicts`) | **30** |
| Validation failures (no write) | **51** = 30 authority conflicts + 21 unparseable smoke-detector dates |
| PID fields contributing at least one value | 95 of 166 |
| Credential values read into Resolve | **0** |

## 1. GPS gap-fill (approved rule applied)
- 157 PID GPS values parsed; format/range validated (`abs(lat)<=90`, `abs(lng)<=180`).
- **1 property** has no usable OwnerRez latitude/longitude → PID coordinates proposed (2 values, included in the totals above).
- **6 properties** have both OwnerRez and PID coordinates that differ beyond 0.001° → **OwnerRez wins, no PID write proposed** (recorded as reference-only difference, not a blocking conflict).
- 150 match OwnerRez within tolerance → no write.
- OwnerRez coordinates are never overwritten in any branch.

## 2. PID Listing Photos — EXCLUDED
`Listing Photos` (142 URLs) is excluded from the migration. No secondary listing-photo reference is
retained. OwnerRez remains the sole authoritative source of listing photography; the 156 existing
`primary_photo_*` values from the OwnerRez enrichment are untouched by this import.

## 3. Greater Area exceptions — NONE
Distinct PID values: OKC (82), Tulsa (35), Fort Worth (19), Indy (18), Carlton Landing (3), Houston (2).
All six map 1:1 onto existing Resolve markets. **0 unmappable values, 0 new markets required.**
Neighborhood Name is stored separately (149 values).

## 4. Smoke Detector Expiration — 21 unparseable (excluded from import, flagged for review)
127 clean dates would import; 9 blank; the following 21 do **not** parse and are **not** coerced:

| Property | OwnerRez ID | Source value |
|---|---|---|
| 758 N. Johnson Branch Rd. | 488148 | `07/2035` |
| 3201 Belmont Cir | 479957 | `04/2036` |
| 1908 E Urbana St | 460239 | `9-2034` |
| 1700 NW 179th Ter | 349772 | `10/34` |
| 5253 Tracey Jo Rd | 470695 | `01 2021` |
| 1701 Park Lane Dr. | 349771 | `May 2032 (guest bedrooms) June 2024 (Master bedroom ) May 2035 (Hallway)` |
| 2817 Hazel Hollow | 474143 | `10 years` |
| 1016 NW 191st St | 461754 | `Most smoke detectors are good for 10 years` |
| 1700 Whispering Creek Dr. | 348274 | `Replacement pending` |
| 5923 Hollyhock Lane | 487893 | `I do not see an expiration date` |
| 2208 E. Toledo St. | 483306 | `No idea there's only a manufacturers data inside. Please see photo.` |
| 1039 Swinton Way | 475429 | `No date` |
| 85 Lower Green Way | 480824 | `N/a` |
| 2004 Cedar Ridge Rd. | 480827 | `N/A` |
| 341 Thistlewood Dr | 462238 | `N/A` |
| 15226 High Timber Ln | 463600 | `Unknown` |
| 5047 Skipping Stone Dr | 455967 | `Unknown` |
| 19120 Meadows Crossing Dr. | 347789 | `Unknown` |
| 3000 Meriweather Rd. | 351100 | `Unknown` |
| 4607 S. Lakewood Ave | 411249 | `Unknwon` |
| 3316 NW 176th St. | 350572 | `.` |

Note: month/year-only values (`07/2035`, `04/2036`, `9-2034`, `10/34`, `01 2021`) are ambiguous by
day and were deliberately not coerced. If you want month-precision imported as the first of the
month, that is a one-line rule change and would move 5 of the 21 into the import.

## 5. Authority conflicts logged, never written (30)
OwnerRez always wins for Bedrooms / Bathrooms / Occupancy. PID differences are logged for review.
Counts: max_guests 15, bathrooms 12, bedrooms 3.

| Property | Field | OwnerRez (kept) | PID (logged) |
|---|---|---|---|
| 9211 Fitzgerald Dr. | max_guests | 6 | 8 |
| 11249 Pegasus Dr. | max_guests | 8 | 6 |
| 852 Inland Dr. | max_guests | 6 | 8 |
| 401 E. 10th St. | bedrooms | 4 | 1 |
| 401 E. 10th St. | bathrooms | 3 | 1 |
| 401 E. 10th St. | max_guests | 6 | 10 |
| 7317 NW 159th Ter. | bathrooms | 4 | 3.5 |
| 8332 Welder Pl. | bathrooms | 3 | 2.5 |
| 5923 Hollyhock Lane | bathrooms | 3 | 2.5 |
| 3201 Belmont Cir | bathrooms | 2 | 1.5 |
| 64 Turtle Loop | bathrooms | 7 | 5.5 |
| 85 Lower Green Way | bathrooms | 3 | 2.5 |
| 85 Lower Green Way | max_guests | 12 | 10 |
| 33 Center Lane S | bathrooms | 4 | 3.5 |
| 7422 S. Granite Ave. | bathrooms | 3 | 2.5 |
| 2004 Cedar Ridge Rd. | bathrooms | 3 | 2.5 |
| 2004 Cedar Ridge Rd. | max_guests | 7 | 8 |
| 1039 Swinton Way | max_guests | 6 | 8 |
| 2817 Hazel Hollow | bathrooms | 3 | 2.5 |
| 816 Lakeview Dr | max_guests | 8 | 6 |
| 5253 Tracey Jo Rd | max_guests | 8 | 6 |
| 2414 W. Kingsport Ct S | max_guests | 8 | 6 |
| 15226 High Timber Ln | max_guests | 8 | 6 |
| 1016 NW 191st St | max_guests | 7 | 8 |
| 1908 E Urbana St | bedrooms | 4 | 5 |
| 16401 Villa Valeria Way | max_guests | 8 | 6 |
| 721 Dusty Trail | max_guests | 7 | 8 |
| 5512 Hidden Trail lane | bathrooms | 2 | 22 (obvious PID typo) |
| 18200 Bodegon Rd. (12M) | max_guests | 5 | 6 |
| 18104 Calle Way (12M) | bedrooms | 4 | 3 |

Most bathroom differences are half-bath rounding in OwnerRez (2.5 vs 3). Nothing is overwritten either way.

## 6. Other validation behaviour observed
- **Handoff Date**: 151 PID values; written only where Resolve has no handoff date. No Resolve-generated handoff date is overwritten; imported values are tagged legacy/reference with `as_of`.
- **Status / Live_12M**: 157 values map to existing lifecycle values; `Live_12M` → `Live` plus a separate 12-month minimum-stay attribute. No new lifecycle created.
- **Seasonal / dated snapshots** (sprinkler season, detector battery dates, compliance/permit and rental-restriction rollups) are seeded once with `as_of` and are explicitly reference-only.
- No other validation failures (no out-of-range numerics, no malformed external URLs after credential stripping).

## 7. Schema changes required before import
Nothing below exists yet; all of it would need one migration (with GRANTs + RLS) prior to import.

**`properties` — new typed columns (drive filtering/analytics/routing/lifecycle):**
`nickname` (exists), `listing_alias`, `neighborhood`, `tier`, `furniture_package`, `instant_book`,
`square_feet`, `year_built`, `min_stay_months`, `legacy_handoff_date`.

**`properties` — new grouped JSONB columns (descriptive domains, 1 column per domain):**
`facts`, `access`, `systems`, `utilities`, `security`, `fireplace`, `pool_spa`, `sprinklers`,
`grounds`, `waste`, `parking`, `amenities`, `hoa`, `warranty`, `storm_shelter`, `compliance`,
`external_refs`, `operating_notes`.

**New table `property_external_links`** — `property_id`, `kind` (`camera_portal`, `fillout_form`,
`legacy_onedrive`, `builder_warranty`, `hoa`), `label`, `url`, `system`, `who_to_ask`, `as_of`,
`is_canonical` (false for legacy OneDrive), staff-only RLS, GRANTs to `authenticated`/`service_role`.

**Existing tables reused, no schema change:** `property_field_provenance`, `field_conflicts`, `audit_log`.

## 8. Exact records that would be inserted/updated
| Table | Operation | Rows |
|---|---|---|
| `properties` | UPDATE (enrichment columns only; identity/OwnerRez fields untouched) | 156 |
| `properties` | INSERT (1399 Foxtail Ln, OwnerRez 494863, lifecycle In Preparation) | 1 |
| `property_external_links` | INSERT | ~381 (camera portal 150, Pool & Hot Tub Fillout 157, legacy OneDrive furniture pick list 74) + builder/HOA links where present |
| `property_field_provenance` | INSERT | 12,460 |
| `field_conflicts` | INSERT | 30 |
| `audit_log` | INSERT | 1 batch record |

## 9. Confirmations
- **PID Listing Photos excluded.** OwnerRez remains authoritative for listing photography; existing OwnerRez photos are untouched.
- **All credential/security fields excluded and their values never read, stored, logged or reproduced:** Access Codes, Gate Code, Alarm Code, Garage Keypad Code, Garage Trim Lockbox Code, Closet Supply Box Code, Storage Closet/Cabinet Code, WiFi Password, Neighborhood Pool Access Key/Fob. Camera links are stored as portal/system references only, with any embedded credential or query-string token stripped; URLs carrying credentials are rejected outright.
- **21036 Owens Rd and the Aziz test row receive zero writes** in Resolve and zero modifications in Notion.
- **No duplicate source of truth introduced.** OwnerRez keeps identity/address/listing/PMS facts; Resolve keeps workflow/status/approvals/audit; SharePoint remains the intended document store; Notion stays a transition reference with provenance recorded on every imported value.
- **Notion was queried read-only.** No page, property or row was created, updated or deleted.

## 10. Recommendation
**GO** for the real import, with the 157-property scope exactly as simulated, subject to:
1. the schema migration in section 7 being applied and reviewed first,
2. the 30 authority conflicts landing in `field_conflicts` for staff review (not blocking),
3. the 21 unparseable smoke-detector values remaining unimported until Operations decides on the
   month-precision rule (5 of 21 recoverable if approved).

No blocking defect was found in the dry run.
