# PID → Resolve migration — execution results

Date: 2026-09-01 · Mode: APPLIED · Script: `scripts/pid-import.ts` (re-runnable, idempotent)

## Totals

| Metric | Result |
| --- | --- |
| Properties created | 1 (1399 Foxtail Ln., lifecycle `onboarding` = In Preparation) |
| Properties updated | 157 (156 matched + Foxtail) |
| PID values written | 11,676 |
| Provenance rows (`notion_pid`) | 11,676 |
| Blanks skipped | 2,452 |
| Conflicts logged, not written | 34 |
| Manual-review records | 17 |
| Credential fields skipped | 1,361 (values never read into memory) |
| Secrets redacted from free text | 11 |
| External links created | 475 (all staff-only) |
| Failed / partial writes | 0 |

Matching was strictly by `ownerrez_property_id`. No name or address matching.

## Exclusions honoured

- 21036 Owens Rd (`410153`) — zero writes.
- Aziz test row (no OwnerRez ID) — untouched.
- Nine credential/security-code fields — permanently excluded; values never
  imported, logged or echoed in errors.
- PID Listing Photos — excluded; OwnerRez remains authoritative for photography.

A free-text scrubber was added after a password was found typed into a
descriptive TV Specs field. Any password/passcode/door-code pattern in narrative
copy is replaced with `[removed — credentials are not stored in Resolve]`
before the value is planned or written. 11 occurrences were redacted.

## External links by category

| Category | Count |
| --- | --- |
| system (OwnerRez / Breezeway / other portals) | 313 |
| camera_portal (Ring / Blink / Alarm.com, no credentials) | 97 |
| legacy_onedrive (non-canonical, pending SharePoint) | 39 |
| hoa | 8 |
| fillout_form (temporary) | 8 |
| builder / warranty | 5 |
| reference | 5 |

Owner Intake Fillout was not carried forward.

## Smoke detector expirations

133 properties received an expiration with source precision preserved:

- day precision: 10
- month precision: 13 (last calendar day of the stated month)
- year precision: 110 (last calendar day of the stated year)

`expires_precision` and `expires_source_text` are stored alongside every value,
and provenance notes that precision came from the source. 15 narrative values
("Unknown", "10 years", "Replacement pending", ".", etc.) were left unwritten
for manual review.

Note vs. the approved dry run: the earlier count of "127 day-precision" values
came from coercing bare-year entries to January 1. That coercion was removed —
those 110 values are now stored explicitly as year precision.

## Authority conflicts (logged, never written)

| Field | Count |
| --- | --- |
| max_guests | 15 |
| bathrooms | 12 |
| bedrooms | 3 |
| living_area_sqft | 4 |

OwnerRez values were retained in every case; PID values are recorded in
`field_conflicts` as open items for review.

## Geocoding

- Foxtail geocoded from the OwnerRez address via Google Maps:
  `1399 Foxtail Ln, Greenwood, IN 46143, USA` → 39.5622172, -86.1485706,
  `geocode_source = google_maps`.
- 0 properties are missing coordinates.
- 6 PID GPS values differ from the derived pin; OwnerRez/derived wins, no write.
- PID GPS fallback used: 0 times.

## Greater Area

Zero unmappable values. All PID values map to existing markets (OKC, Tulsa,
Fort Worth, Indy, Carlton Landing, Houston). No new markets created.

## Rollback / recovery

No failures occurred, so no rollback was needed. The importer is idempotent:
PID-owned descriptive groups are rebuilt rather than merged, and PID provenance
and links are replaced per property on each run, so it can be re-run safely.

## Tests

- `bun test`: 151 pass, 0 fail
- typecheck: clean
- Database linter: 3 pre-existing issues unrelated to this migration
  (2 RLS-enabled-no-policy on other tables, 1 extension in public).
  `property_external_links` has policies and is staff-only.

## Recommendation

GO for publication review, with two open follow-ups for the team:
the 34 authority conflicts and the 15 unparseable expiration values.
