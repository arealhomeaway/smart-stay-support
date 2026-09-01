# Authoritative Property / PID field map v2 — review table (FOR APPROVAL)

Nothing below is imported yet. Approve, amend or strike lines; import follows
approval. The Property Hub shell is already built against these groupings, so
approved fields slot into an existing section without a UI rebuild.

Legend — Edit: Y = editable in Resolve, N = read-only (synced), R = reference
only. Owner: Y = homeowner can see it. Onb / Ops: required for that workflow.

## 1. Property identity

| Display label | Resolve key | Source | Edit | Owner | Onb | Ops | Provenance | Duplication concern |
|---|---|---|---|---|---|---|---|---|
| Property name | `name` | Resolve | Y | Y | Y | Y | updated_at | Notion PID name differs; Resolve wins |
| Nickname | `nickname` | Resolve | Y | Y | – | Y | updated_at | – |
| Market | `market` | Resolve | Y | Y | Y | Y | updated_at | – |
| Lifecycle status | `lifecycle_status` | Resolve | Y | Y | Y | Y | updated_at | – |
| Active | `active` | Resolve | Y | – | – | Y | updated_at | – |
| Demo flag | `is_demo` | Resolve | N | – | – | – | – | never in KPIs |

## 2. Address & location

| Display label | Resolve key | Source | Edit | Owner | Onb | Ops | Provenance | Duplication concern |
|---|---|---|---|---|---|---|---|---|
| Street | `address_line1` | OwnerRez | N | Y | Y | Y | `ownerrez_synced_at` | USPS-verified mailing address may differ; store USPS form as `mailing_address` |
| Unit | `unit` | OwnerRez | N | Y | Y | Y | ownerrez | – |
| City / State / Postal | `city` `state` `postal_code` | OwnerRez | N | Y | Y | Y | ownerrez | – |
| Mailing address (USPS) | `mailing_address` *(add)* | ARHA | Y | – | Y | – | manual, as_of | replaces the Asana "official mailing address" step |
| Geocoded address | `formatted_address` | Google Maps | N | – | – | Y | `geocoded_at` | – |
| Latitude / longitude | `latitude` `longitude` | Google Maps | N | – | – | Y | `geocoded_at` | – |

## 3. Property facts

| Display label | Resolve key | Source | Edit | Owner | Onb | Ops | Provenance | Duplication concern |
|---|---|---|---|---|---|---|---|---|
| Bedrooms / bathrooms / sleeps | `bedrooms` `bathrooms` `sleeps` *(add)* | OwnerRez | N | Y | Y | Y | ownerrez as_of | Notion PID copy retired |
| Maximum occupancy | `max_occupancy` *(add)* | OwnerRez | N | Y | – | Y | ownerrez | – |
| Minimum stay | `min_stay_nights` *(add)* | OwnerRez | N | – | – | Y | ownerrez | – |
| Instant book | `instant_book` *(add)* | OwnerRez | N | – | – | Y | ownerrez | – |
| Stay type (STR / MTR / both) | `stay_type` *(add)* | ARHA | Y | Y | Y | Y | manual as_of | drives SOP selection |
| Listing links | `listing_urls` *(add, jsonb)* | ARHA | Y | Y | – | Y | manual | public links only |
| HVAC systems | `hvac_systems` *(add, jsonb)* | ARHA PID | Y | – | Y | Y | manual as_of | filter sizes today live in Breezeway photos |
| Water heater | `water_heater` *(add, jsonb)* | ARHA PID | Y | – | Y | Y | manual as_of | – |
| Appliance register | `appliance_register` *(add, jsonb)* | ARHA PID | Y | – | Y | Y | manual as_of | warranty docs by `documents` ref, not copies |
| Fireplace / sprinkler / storm shelter | `fireplace` `sprinkler_system` `storm_shelter` *(add, jsonb)* | ARHA PID | Y | – | Y | Y | manual as_of | – |
| Builder warranty | `builder_warranty` *(add, jsonb)* | ARHA PID | Y | Y | Y | Y | manual as_of | builder is a Contact ref, not free text |

## 4. Access

| Display label | Resolve key | Source | Edit | Owner | Onb | Ops | Provenance | Duplication concern |
|---|---|---|---|---|---|---|---|---|
| Access notes | `access_notes` | Resolve | Y | – | Y | Y | updated_at | must contain no codes |
| Access method | `access_method` *(add, enum)* | ARHA | Y | – | Y | Y | manual as_of | – |
| Credential holder | `access_credential_ref` *(add, jsonb)* | ARHA | Y | – | Y | Y | manual as_of | **reference only** — system + who to ask, never a code |
| Parking | `parking` *(add, jsonb)* | ARHA | Y | Y | Y | Y | manual as_of | – |
| Garage / gate | `garage` `gate_access` *(add, jsonb)* | ARHA | Y | – | Y | Y | manual as_of | system name only |

## 5. Utilities

| Display label | Resolve key | Source | Edit | Owner | Onb | Ops | Provenance | Duplication concern |
|---|---|---|---|---|---|---|---|---|
| Utility accounts | `utilities` *(add, jsonb array)* | ARHA | Y | Y (own home) | Y | Y | manual as_of | provider is a Contact/vendor ref; **no logins**, masked account reference only |
| Billing responsibility | inside `utilities[].billing_responsibility` | ARHA | Y | Y | Y | Y | manual as_of | – |
| Transfer status | inside `utilities[].transfer_status` | ARHA | Y | Y | Y | – | manual as_of | replaces the Utilities Coordinator spreadsheet |

## 6. Safety & amenities

| Display label | Resolve key | Source | Edit | Owner | Onb | Ops | Provenance | Duplication concern |
|---|---|---|---|---|---|---|---|---|
| Water shutoff / breaker panel | `water_shutoff` `breaker_panel` *(add, jsonb)* | ARHA | Y | – | Y | Y | manual as_of | location text only |
| Security / cameras | `security_systems` *(add, jsonb)* | ARHA | Y | Y (disclosure) | Y | Y | manual as_of | exterior-only flag + guest disclosure; never a login |
| Wi-Fi notes | `wifi_notes` | Resolve | Y | – | Y | Y | updated_at | **no password** |
| Pool / spa | `pool_spa` *(add, jsonb)* | ARHA | Y | Y | Y | Y | manual as_of | service vendor by ref |
| Community amenities | `community_amenities` *(add, jsonb)* | ARHA | Y | Y | Y | Y | manual as_of | – |

## 7. Operations

| Display label | Resolve key | Source | Edit | Owner | Onb | Ops | Provenance | Duplication concern |
|---|---|---|---|---|---|---|---|---|
| Quarterly review due | `quarterly_review_due_on` | Resolve | N | – | – | Y | trigger | – |
| Last quarterly review | `last_quarterly_review_at` | Resolve | N | – | – | Y | system | – |
| Cleaning region | `cleaning_region_id` | Resolve | Y | – | – | Y | updated_at | – |
| Mowing / landscaping / trash / snow / pest | `mowing` `landscaping` `trash_service` `snow_ice` `pest_control` *(add, jsonb)* | ARHA | Y | Y | Y | Y | manual as_of | provider by vendor ref only |

## 8. Contacts (Contacts architecture — not property columns)

| Display label | Record | Source | Edit | Owner | Onb | Ops | Provenance | Duplication concern |
|---|---|---|---|---|---|---|---|---|
| Homeowner (primary) | `property_owner_contacts` | OwnerRez | N | Y | Y | Y | `synced_at` | authoritative; do not retype into property fields |
| Secondary owner | `property_owner_contacts` | ARHA | Y | Y | Y | Y | manual as_of | – |
| Emergency contact | `property_owner_contacts` role=emergency | ARHA | Y | – | Y | Y | manual as_of | – |
| HOA contact | `property_owner_contacts` role=hoa | ARHA | Y | Y | Y | Y | manual as_of | – |
| Builder / warranty contact | `property_owner_contacts` role=builder | ARHA | Y | Y | Y | Y | manual as_of | – |
| Preferred vendors | `vendor_orgs` / `property_vendor_coverage` | Resolve | Y | N | Y | Y | system | homeowners do not choose vendors |
| Neighbour / keyholder | `property_owner_contacts` role=keyholder | ARHA | Y | – | Y | Y | manual as_of | – |

## 9. HOA

| Display label | Resolve key | Source | Edit | Owner | Onb | Ops | Provenance | Duplication concern |
|---|---|---|---|---|---|---|---|---|
| HOA membership | `hoa_membership` *(add, jsonb)* | ARHA | Y | Y | Y | Y | manual as_of | rules doc by `documents` ref |
| Rental restrictions | inside `hoa_membership.rental_restrictions` | ARHA | Y | Y | Y | Y | manual as_of | – |
| Amenity access | inside `hoa_membership.amenity_access` | ARHA | Y | Y | Y | Y | manual as_of | reference, never a code |

## 10. Vendor / service relationships

| Display label | Record | Source | Edit | Owner | Onb | Ops | Provenance | Duplication concern |
|---|---|---|---|---|---|---|---|---|
| Assigned vendors by trade | `property_vendor_coverage` | Resolve | Y | N | Y | Y | system | – |
| Vendor documents / compliance | `vendor_documents` | Resolve | Y | N | Y | Y | system | – |

## 11. External system identifiers

| Display label | Resolve key | Source | Edit | Owner | Onb | Ops | Provenance | Duplication concern |
|---|---|---|---|---|---|---|---|---|
| OwnerRez property id | `ownerrez_property_id` | OwnerRez | Y (link) | N | Y | Y | `ownerrez_synced_at` | import key — 156/162 keyed, 6 by hand |
| Breezeway home id | `breezeway_property_id` | Breezeway | Y (link) | N | – | Y | `breezeway_synced_at` | transitional system |
| Notion page id | *(not imported)* | Notion | – | – | – | – | – | reference/archive only |

## 12. Onboarding status

| Display label | Resolve key | Source | Edit | Owner | Onb | Ops | Provenance | Duplication concern |
|---|---|---|---|---|---|---|---|---|
| Onboarding stage | `onboarding_stage` | Resolve | Y | Y | Y | Y | updated_at | – |
| Onboarding owner | `onboarding_owner` | Resolve | Y | – | Y | – | updated_at | now seat-resolved |
| Planned / actual closing | `planned_closing_on` `actual_closing_on` | Resolve | Y | Y | Y | Y | updated_at | drives task dates |
| Access date | `actual_access_on` | Resolve | Y | Y | Y | Y | updated_at | – |
| Handoff accepted | `handoff_accepted_at` | Resolve | N | Y | Y | Y | system | – |

## 13. Compliance & reference

| Display label | Record | Source | Edit | Owner | Onb | Ops | Provenance | Duplication concern |
|---|---|---|---|---|---|---|---|---|
| STR permit / licence status | `gatekeeper_requirements` + `documents` | ARHA | Y | Y | Y | Y | as_of | pointer only, never flattened onto the property |
| Insurance on file | `documents` | ARHA | Y | Y | Y | Y | as_of | – |
| Inspection / **assessment** status | `documents` / onboarding task | ARHA | Y | Y | Y | – | as_of | "Inspection" renamed to Assessment |

## 14. Source / provenance (applies to every imported field)

| Display label | Resolve key | Source | Notes |
|---|---|---|---|
| Field source | `property_field_provenance.source` *(new table)* | system | OwnerRez / ARHA / Google / Breezeway |
| As of | `property_field_provenance.as_of` | system | shown next to the value in the Hub |
| Updated by | `property_field_provenance.updated_by` | system | audit trail |

## Explicitly NOT imported

Door codes, alarm codes, Wi-Fi passwords, utility logins, any password, any
credential. Owner-program state (enrolment, phase, hours) is never copied onto
the property — it is read from the program.
