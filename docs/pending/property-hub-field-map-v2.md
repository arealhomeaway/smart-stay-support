# Revised authoritative property field map (v2) — FOR APPROVAL

Not implemented. No schema or import work until approved.

Design rules applied
- Not a rebuilt Notion PID. Only fields an ARHA workflow actually consumes.
- Owner-program state is NOT duplicated onto the property. It stays on
  `owner_programs` / `owner_program_properties` and is surfaced by reference.
- People and organisations go to the Contacts architecture
  (`property_owner_contacts`, `vendor_orgs`, `vendor_contacts`), not free text.
- Compliance keeps its structured record (`gatekeeper_requirements`,
  `vendor_documents`, `documents`); the Hub surfaces it, does not flatten it.
- No credentials. No live door codes, alarm codes, utility logins, passwords or
  Wi-Fi passwords. Only a safe reference: which system holds it and who to ask.
- Every imported field carries `source` + `as_of` so a future Rai answer can
  cite the source and the currency of the data.

Key: keep = already exists; add = new column; contact = Contacts record;
ref = pointer/reference only; program = lives on the owner program; doc = file.

## 1. Identity & lifecycle (keep)
id, name, nickname, address_line1, unit, city, state, postal_code,
formatted_address, market, latitude/longitude, active, is_demo, archived_at,
lifecycle_status, onboarding_stage, onboarding_owner, planned/actual closing
and access dates, handoff_accepted_at, ownerrez_property_id,
breezeway_property_id, quarterly review dates.

## 2. Listing & booking posture (add)
| Field | Type | Source | Note |
|---|---|---|---|
| instant_book | bool | OwnerRez/listing | requested |
| min_stay_nights | int | OwnerRez | |
| max_occupancy | int | OwnerRez | |
| bedrooms / bathrooms / sleeps | int | OwnerRez | |
| stay_type | enum str/mtr/both | ARHA | drives SOP selection |
| listing_urls | jsonb | ARHA | public links only |

## 3. Building systems & maintenance (add)
hvac_systems jsonb — per unit: location, filter_size, filter_count, last_changed
water_heater jsonb — type, location, last_service
fireplace jsonb — present, fuel type, service interval, seasonal shutoff
sprinkler_system jsonb — present, controller location, zones, winterize_by
storm_shelter jsonb — present, type, location, access instructions (no codes)
builder_warranty jsonb — builder (→ contact ref), start/end date, claim process,
  warranty documents by `documents` reference
water_shutoff / breaker_panel jsonb — location text (safety, no credentials)
appliance_register jsonb — appliance, brand, model, serial ref, warranty doc ref

## 4. Grounds & services (add)
mowing jsonb — provider (vendor ref), cadence, season window, scope
landscaping jsonb — beds/irrigation notes, seasonal tasks
trash_service jsonb — hauler (vendor/contact ref), bin count, pickup day
recycling jsonb — provider, pickup day/cadence
snow_ice jsonb — provider ref, trigger threshold
pest_control jsonb — provider ref, cadence

## 5. Pool / spa (add)
pool_spa jsonb — present, type, heater, service vendor ref, service cadence,
chemical responsibility, seasonal open/close dates, safety equipment.

## 6. HOA & amenities (contact + add)
hoa_membership jsonb — HOA name, dues cadence, rules doc reference,
  rental restrictions summary, amenity access method (reference, never a code)
HOA people → Contacts (`property_owner_contacts` with role = hoa).
community_amenities jsonb — pool, gym, gate, clubhouse, guest rules.

## 7. Access & parking (add — reference only)
parking jsonb — spaces, type (garage/driveway/street/assigned), permit needed
access_method enum — smart_lock | lockbox | keypad | key_handoff | app
access_credential_ref jsonb — { system, record_locator, who_to_ask } ONLY
garage jsonb — opener count, remote location, opener app system name only
gate_access jsonb — method, system name, no codes

## 8. Security / monitoring (add — reference only)
security_systems jsonb — array of { vendor, kind: ring|camera|alarm|sensor,
placement, exterior_only bool, account_system, who_to_ask }.
Never a login. Guest-visible camera disclosure flag included.

## 9. Utilities (add — no logins)
utilities jsonb — array of { utility, provider (contact/vendor ref),
account_reference (masked/partial), billing_responsibility owner|arha,
transfer_status, service_start }. No usernames or passwords.

## 10. Contacts (Contacts architecture, not property columns)
homeowner, secondary owner, emergency contact, HOA contact, builder/warranty
contact, preferred vendors, neighbour/keyholder — all as contact records with
role, priority, preferred channel and consent notes.

## 11. Compliance (reference)
Surface only: permit/licence status, insurance on file, STR registration,
inspection/assessment status — each a pointer into the compliance record and
`documents`, with `as_of`. No flattened copies.

## 12. Owner program (reference)
Property Hub shows enrolment, phase, approved vs reported hours by reading the
program relationship. No `is_active_owner` column.

## Import plan (after approval)
1. Approve this map.
2. Add columns/jsonb + a `property_field_provenance` table (field, source, as_of,
   updated_by).
3. Import from OwnerRez for the 156 keyed properties; ARHA-only fields imported
   from the current authoritative export, keyed on `ownerrez_property_id`.
4. Six unkeyed properties reconciled by hand before import.
5. Accuracy spot-check on 10 properties before the Hub reads any field.
