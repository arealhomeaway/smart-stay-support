# Availability Finder property-field checkpoint — 2026-09-18

Source: current repository schema, `property-enrichment.server.ts`, and the read-only OwnerRez integration audit. This is code/source evidence, not a live completeness audit of every property.

| Field | Verified repository source | Finder use | Remaining limit |
|---|---|---|---|
| Bedrooms, bathrooms, maximum guests | OwnerRez `/properties` enrichment maps these into nullable `properties` columns with provenance | Minimum filters; “Not listed” when absent; PDF facts | Current population/completeness needs browser review. Missing values fail required minimum filters. |
| Property type | OwnerRez `/properties` `property_type` mapped into nullable `properties.property_type` | Offered only from values on current OwnerRez-synced results | Current vocabulary and completeness need browser review. |
| Coordinates, address, image, public URL | Existing property record, geocoding, OwnerRez enrichment and public-link validation | Distance/map, result details, PDF image/link | Unlocated properties are excluded; missing/invalid public links block PDF export. |
| Reservation dates, status, block flag | OwnerRez `/bookings` read endpoint | Available/Conditional/Unavailable | A complete availability/restriction endpoint remains unverified; Operations confirms final availability. |
| Pet-friendly status, pet count limit | No verified enrichment mapping or typed property column. Earlier OwnerRez audit lists `max_pets` as future enrichment. | Pet-friendly required fails closed on unknown. “No pets needed” does not restrict. PDF says “Not specified.” | Confirm an authoritative structured OwnerRez field and mapping before claiming pet-friendly matches or showing a pet-count control. |
| Parking, fenced yard, washer/dryer, workspace, accessibility, single-level | `properties.amenities` and `properties.parking` are untyped JSON; no verified key/value contract or OwnerRez enrichment mapping exists. | No amenity choices are offered until structured values are verified. | Confirm exact source keys, boolean meaning, provenance and coverage. Never infer from photos or descriptions. |

The filter state and selected map property live in the finder URL. The visible map and list receive the same filtered array. Explicit PDF selection is separate from the filtered population. An internal property-detail link carries the existing navigation-origin token so Back can restore the finder URL and practical scroll position. External public listings open in a new browser tab, leaving the finder state intact.
