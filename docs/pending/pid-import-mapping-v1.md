# PID → Resolve field-by-field import mapping (v1, decision-updated 2026-09-01) — FOR APPROVAL

Planning artifact only. Nothing imported, no schema created or altered, Notion untouched.
All 12 open business decisions were approved by Emily on 2026-09-01 and are recorded in
"Approved decisions" at the end of this document; the mapping rows below reflect them.

## Candidate population
- **157 PID rows** in the import set: the 156 matched by OwnerRez Internal ID **plus 1399 Foxtail Ln** (OwnerRez 494863), which is now approved for inclusion as **In Preparation**.
- **21036 Owens Rd (OwnerRez 410153): EXCLUDED.** Not created in Resolve, Notion row untouched.
- **Excluded:** the Aziz test row (no OwnerRez ID). Not deleted, not modified.
- No Resolve property is ever auto-created from an unmatched PID row. Join key is `ownerrez_property_id` only; address and name matching are prohibited.


## Ownership model applied
| Domain | Owner |
|---|---|
| Property identity, address, listings, reservations, PMS facts | OwnerRez |
| Workflow, status, tasks, approvals, audit history | Resolve |
| Official documents and evidence | ARHA Resolve SharePoint |
| Everything else, until migration is validated | Notion (transition reference) |

## Mapping — all 166 PID fields
Coverage is against the 156-property candidate set.

| # | Notion field | Type | Nonblank | Coverage | Resolve target | Action | Authority | Transform | Validation | Sensitivity | Rationale / dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Property | title | 159 | 100% | properties.name | Exclude | OwnerRez | — | OwnerRez name wins | None | OwnerRez authoritative for PMS name; PID title used only as join label |
| 2 | Property Nickname | rich_text | 158 | 100% | properties.nickname | Import | Notion transition-only | trim | <=80 chars | None | ARHA-only field, no OwnerRez equivalent |
| 3 | Airbnb Name | rich_text | 151 | 97% | properties.listing_alias | Import | Notion transition-only | trim | <=120 chars | None | Cross-channel listing label used in comms |
| 4 | Property Address | rich_text | 159 | 100% | — | Exclude | OwnerRez | — | — | None | Address already authoritative from OwnerRez; no address matching permitted |
| 5 | City | rich_text | 159 | 100% | — | Exclude | OwnerRez | — | — | None | Same as above |
| 6 | State | rich_text | 159 | 100% | — | Exclude | OwnerRez | — | — | None | Same as above |
| 7 | Zip | rich_text | 158 | 100% | — | Exclude | OwnerRez | — | — | None | Same as above |
| 8 | GPS Coordinates | rich_text | 159 | 100% | properties.latitude / longitude | Manual Review | OwnerRez | parse 'lat, lng' decimal pair | abs(lat)<=90, abs(lng)<=180; only fill when OwnerRez geocode missing | None | Fill gaps only; OwnerRez geocode preferred |
| 9 | Greater Area | select | 159 | 100% | properties.market (typed column) + properties.neighborhood | Import | Resolve | map PID Greater Area onto existing Resolve market values; never create a market to mirror Notion; neighborhood kept separately | must resolve to an existing Resolve market; unmappable values → review list, not a new market | None | APPROVED: map onto existing Resolve market structure; only genuinely unmappable values are flagged |
| 10 | Neighborhood Name | rich_text | 151 | 97% | properties.neighborhood | Import | Notion transition-only | trim | <=120 chars | None | Operationally used for routing/context |
| 11 | OwnerRez Internal ID | rich_text | 158 | 100% | join key only | Exclude | OwnerRez | strip 'ORP' prefix | must equal existing properties.ownerrez_property_id | None | Join key; not stored again |
| 12 | OwnerRez Order | number | 157 | 100% | — | Exclude | OwnerRez | — | — | None | Notion sort artifact |
| 13 | OR Property Link | rich_text | 158 | 100% | properties.external_refs.ownerrez_url | External Link | OwnerRez | validate host app.ownerrez.com | https URL | None | Derivable from OwnerRez ID; stored as reference link |
| 14 | BW Property Link | rich_text | 158 | 100% | properties.external_refs.breezeway_url | External Link | Resolve | validate host app.breezeway.io | https URL | None | Breezeway is transitional; link kept until retirement |
| 15 | Home ID | formula | 159 | 100% | — | Exclude | Notion transition-only | — | — | None | Notion formula; Resolve property id supersedes |
| 16 | Status | select | 158 | 100% | properties.lifecycle_status + properties.min_stay_nights / rental_policy.min_stay_months | Import | Resolve | Live → Live; **Live_12M → Live** plus minimum-stay attribute `12 months`; In Preparation → onboarding; Live - Onboarding in Progress → live_onboarding | must map to an existing Resolve lifecycle value; no new Live_12M lifecycle | None | APPROVED: Live_12M means 12-month minimum stay; lifecycle collapses to Live and the 12-month rule is preserved as a separate rental-policy attribute |
| 17 | Status_ | select | 1 | 1% | — | Exclude | Notion transition-only | — | — | None | 1 row populated; abandoned field |
| 18 | Property Tier | select | 155 | 99% | properties.tier | Import | Notion transition-only | uppercase enum | one of PID tier values | None | ARHA-only classification |
| 19 | Handoff Date | date | 153 | 98% | properties.legacy_handoff_date (reference) | Import | Resolve | date only; write **only** where Resolve has no handoff date; tag legacy/reference with `as_of` provenance | <= today; never written when properties.handoff_accepted_at is present | None | APPROVED: fill-only, never overwrites a Resolve-generated handoff date |
| 20 | Active Projects Sheet | relation | 0 | 0% | — | Exclude | Resolve | — | — | None | Obsolete Notion relation id; Resolve onboarding projects supersede |
| 21 | Bedrooms | number | 154 | 99% | properties.bedrooms | Import | OwnerRez | numeric; gap-fill only | 0 < n < 30; difference vs OwnerRez → `field_conflicts`, never written | None | APPROVED: OwnerRez always wins; PID differences logged as conflicts for review |
| 22 | Bathrooms | number | 154 | 99% | properties.bathrooms | Import | OwnerRez | numeric; gap-fill only | 0 < n < 30; difference vs OwnerRez → `field_conflicts`, never written | None | APPROVED: OwnerRez always wins; PID differences logged as conflicts for review |
| 23 | Occupancy Limit | number | 157 | 100% | properties.max_occupancy | Import | OwnerRez | numeric; gap-fill only | 0 < n < 30; difference vs OwnerRez → `field_conflicts`, never written | None | APPROVED: OwnerRez always wins; PID differences logged as conflicts for review |
| 24 | Square Footage | rich_text | 153 | 98% | properties.square_feet | Import | Notion transition-only | strip commas/'sqft' to integer | 100 < n < 20000 | None | Not held in OwnerRez |
| 25 | Property Built Year | number | 158 | 100% | properties.year_built | Import | Notion transition-only | integer | 1900 <= y <= current year | None | Used for warranty/maintenance context |
| 26 | Base Price | number | 152 | 97% | — | Exclude | OwnerRez | — | — | None | Pricing is PMS-controlled and volatile |
| 27 | Instant Book On | checkbox | 159 | 100% | properties.instant_book | Import | OwnerRez | boolean | true/false | None | Requested; reconcile against OwnerRez where exposed |
| 28 | Furniture Package | select | 159 | 100% | properties.furniture_package | Import | Notion transition-only | enum | one of PID select values | None | Onboarding/replacement context |
| 29 | Interior Paint | rich_text | 149 | 96% | properties.facts.interior_paint | Import | Notion transition-only | trim | <=200 chars | None | Touch-up work orders need brand/color |
| 30 | TV Specs | rich_text | 153 | 98% | properties.facts.tv_specs | Import | Notion transition-only | trim | <=300 chars | None | Maintenance reference |
| 31 | Location of TVs? | multi_select | 153 | 98% | properties.facts.tv_locations | Import | Notion transition-only | multi-select to string[] | array of known rooms | None | Maintenance reference |
| 32 | Office or Workstation? | select | 153 | 98% | properties.facts.workstation | Import | Notion transition-only | enum | enum | None | Guest/listing context |
| 33 | Home Grill | select | 150 | 96% | properties.facts.grill | Import | Notion transition-only | enum | enum | None | Amenity/maintenance context |
| 34 | Parking | rich_text | 158 | 100% | properties.parking.summary | Import | Notion transition-only | trim | <=300 chars | None | Arrival guidance |
| 35 | Cluster Mailbox? | select | 143 | 92% | properties.parking.cluster_mailbox | Import | Notion transition-only | boolean from select | true/false | None | Arrival guidance |
| 36 | Cluster Mailbox Location | rich_text | 143 | 92% | properties.parking.mailbox_location | Import | Notion transition-only | trim; extract map URL to external link | <=300 chars | None | Arrival guidance |
| 37 | Mailbox Number | rich_text | 143 | 92% | properties.parking.mailbox_number | Import | Notion transition-only | trim | <=20 chars | Low - physical identifier, staff-only | Arrival guidance; not a credential |
| 38 | Smart Lock Brand | rich_text | 154 | 99% | properties.access.lock_brand | Import | Notion transition-only | enum/trim | <=80 chars | None | System reference, no codes |
| 39 | Yale Smart Module | select | 152 | 97% | properties.access.yale_module | Import | Notion transition-only | enum | enum | None | System reference |
| 40 | Yale Integration - Live and Connected in Breezeway | checkbox | 159 | 100% | properties.access.yale_integration_live | Import | Resolve | boolean | true/false | None | Integration health flag; Breezeway transitional |
| 41 | Yale is Not Calibrated | checkbox | 159 | 100% | properties.access.yale_needs_calibration | Import | Resolve | boolean; trim field name | true/false | None | Drives maintenance follow-up |
| 42 | Keys in Garage Lockbox | multi_select | 151 | 97% | properties.access.key_storage | Import | Notion transition-only | multi-select to string[] | array | Low - location reference, staff-only | Location only; codes excluded |
| 43 | Garage Remote Brand & Model | rich_text | 150 | 96% | properties.access.garage_remote | Import | Notion transition-only | trim | <=120 chars | None | Replacement/repair reference |
| 44 | Key Access Hole for Emergencies | select | 150 | 96% | properties.access.emergency_key_access | Import | Notion transition-only | enum | enum | Low - staff-only | Emergency access reference, no codes |
| 45 | Access Codes | rich_text | 153 | 98% | — | Exclude | External | — | never read into Resolve | SECRET - excluded, value never read or displayed | Credential; replaced by a 'which system holds it / who to ask' reference |
| 46 | Gate Code | rich_text | 152 | 97% | — | Exclude | External | — | never read into Resolve | SECRET - excluded, value never read or displayed | Credential; replaced by a 'which system holds it / who to ask' reference |
| 47 | Alarm Code | rich_text | 153 | 98% | — | Exclude | External | — | never read into Resolve | SECRET - excluded, value never read or displayed | Credential; replaced by a 'which system holds it / who to ask' reference |
| 48 | Garage Keypad Code | rich_text | 150 | 96% | — | Exclude | External | — | never read into Resolve | SECRET - excluded, value never read or displayed | Credential; replaced by a 'which system holds it / who to ask' reference |
| 49 | Garage Trim Lockbox Code | rich_text | 150 | 96% | — | Exclude | External | — | never read into Resolve | SECRET - excluded, value never read or displayed | Credential; replaced by a 'which system holds it / who to ask' reference |
| 50 | Closet Supply Box Code | rich_text | 150 | 96% | — | Exclude | External | — | never read into Resolve | SECRET - excluded, value never read or displayed | Credential; replaced by a 'which system holds it / who to ask' reference |
| 51 | Storage Closet/Cabinet Code | rich_text | 150 | 96% | — | Exclude | External | — | never read into Resolve | SECRET - excluded, value never read or displayed | Credential; replaced by a 'which system holds it / who to ask' reference |
| 52 | WiFi Password | rich_text | 154 | 99% | — | Exclude | External | — | never read into Resolve | SECRET - excluded, value never read or displayed | Credential; replaced by a 'which system holds it / who to ask' reference |
| 53 | Neighborhood Pool Access Key/Fob | rich_text | 70 | 45% | — | Exclude | External | — | never read into Resolve | SECRET - excluded, value never read or displayed | Credential; replaced by a 'which system holds it / who to ask' reference |
| 54 | Security Camera Feed | rich_text | 152 | 97% | property_external_links (kind = camera_portal, staff-only) | External Link | External | keep `{ system, portal_url, who_to_ask }`; strip any embedded login, query-string credential, code or token | https URL; reject any URL carrying credentials | Sensitive - staff-only operational link, no credentials | APPROVED: staff-only operational external link, portal/system reference only |
| 55 | WiFi Network Name | rich_text | 154 | 99% | properties.utilities.wifi_ssid | Import | Notion transition-only | trim | <=64 chars | Low - staff-only | SSID only; password excluded |
| 56 | Confirmed Wifi has a split network | checkbox | 159 | 100% | properties.utilities.wifi_split_confirmed | Import | Notion transition-only | boolean | true/false | None | Smart-device troubleshooting |
| 57 | Router Location | rich_text | 153 | 98% | properties.utilities.router_location | Import | Notion transition-only | trim | <=200 chars | None | Troubleshooting reference |
| 58 | Air Filter Sizes | rich_text | 153 | 98% | properties.hvac.filter_sizes | Import | Notion transition-only | parse to array of size strings | matches NNxNNxN pattern where possible | None | Drives filter-change work orders |
| 59 | Breaker Box Location | rich_text | 150 | 96% | properties.systems.breaker_panel_location | Import | Notion transition-only | trim | <=200 chars | None | Safety/troubleshooting |
| 60 | Indoor Water Shutoff Location | rich_text | 142 | 91% | properties.systems.water_shutoff_indoor | Import | Notion transition-only | trim | <=200 chars | None | Emergency response |
| 61 | Outdoor Water Shutoff Location | rich_text | 150 | 96% | properties.systems.water_shutoff_outdoor | Import | Notion transition-only | trim | <=200 chars | None | Emergency response |
| 62 | Refrigerator Water Filter | rich_text | 153 | 98% | properties.systems.fridge_filter | Import | Notion transition-only | trim | <=120 chars | None | Consumable reordering |
| 63 | House has a 5 Year Old Fridge Water Filter | select | 147 | 94% | properties.systems.fridge_filter_5yr | Import | Notion transition-only | boolean from select | true/false | None | Service interval driver |
| 64 | Smoke Detector Brand | rich_text | 149 | 96% | properties.systems.smoke.brand | Import | Notion transition-only | trim | <=80 chars | None | Life-safety maintenance |
| 65 | Smoke Detector Notes | rich_text | 150 | 96% | properties.systems.smoke.notes | Import | Notion transition-only | trim | <=500 chars | None | Life-safety maintenance |
| 66 | Smoke Detector Expiration | rich_text | 150 | 96% | properties.systems.smoke.expires_on (seeded, dated) | Import | Resolve | free text to date where parseable; one-time seed carrying `as_of` | valid date or null; unparseable → review list | None | APPROVED seasonal/dated seed: reference value only; Resolve Work Orders / Assessments authoritative afterwards |
| 67 | Smoke Detectors Battery Type | select | 150 | 96% | properties.systems.smoke.battery_type | Import | Notion transition-only | enum | enum | None | Supply planning |
| 68 | Smoke Detectors Power Type | select | 150 | 96% | properties.systems.smoke.power_type | Import | Notion transition-only | enum | enum | None | Life-safety maintenance |
| 69 | Detectors Batteries Change Date | date | 150 | 96% | properties.systems.smoke.batteries_changed_on | Import | Resolve | date | <= today | None | Seed only; Resolve work orders become authoritative after import |
| 70 | Carbon Monoxide Detector Installed? | select | 149 | 96% | properties.systems.co.installed | Import | Notion transition-only | boolean from select | true/false | None | Life safety/compliance |
| 71 | Location of Carbon Monoxide Detector | rich_text | 149 | 96% | properties.systems.co.location | Import | Notion transition-only | trim | <=200 chars | None | Life safety |
| 72 | Storage for Supplies | select | 150 | 96% | properties.systems.supply_storage | Import | Notion transition-only | enum | enum | None | Cleaning/turnover ops |
| 73 | Closet Supply Box Location | rich_text | 149 | 96% | properties.systems.supply_box_location | Import | Notion transition-only | trim | <=200 chars | Low - location only | Cleaning/turnover ops; code excluded |
| 74 | Home Has Fireplace? | select | 149 | 96% | properties.fireplace.present | Import | Notion transition-only | boolean from select | true/false | None | Seasonal service |
| 75 | Fireplace Type | select | 135 | 87% | properties.fireplace.fuel_type | Import | Notion transition-only | enum | enum | None | Seasonal service |
| 76 | Fireplace Brand & Model Number | rich_text | 135 | 87% | properties.fireplace.model | Import | Notion transition-only | trim | <=120 chars | None | Parts/repair |
| 77 | Fireplace Instructions | rich_text | 142 | 91% | properties.fireplace.instructions | Import | Notion transition-only | trim; extract URLs to external links | <=1000 chars | None | Guest/staff operation |
| 78 | Gas Fireplace Switch | select | 131 | 84% | properties.fireplace.gas_switch | Import | Notion transition-only | enum | enum | None | Safety/operation |
| 79 | Gas Fireplace Switch Location | rich_text | 120 | 77% | properties.fireplace.gas_switch_location | Import | Notion transition-only | trim; extract URLs | <=200 chars | None | Safety/operation |
| 80 | Storm Shelter Location & Access | rich_text | 97 | 62% | properties.storm_shelter.location_access | Import | Notion transition-only | trim | <=500 chars | Low - staff/guest safety info | Life safety; codes stripped if present |
| 81 | Sprinkler System Status | select | 151 | 97% | properties.sprinklers.status | Import | Notion transition-only | enum | enum | None | Seasonal service |
| 82 | Sprinkler System Brand | rich_text | 140 | 90% | properties.sprinklers.brand | Import | Notion transition-only | trim | <=80 chars | None | Parts/repair |
| 83 | Sprinkler System Location | rich_text | 141 | 90% | properties.sprinklers.controller_location | Import | Notion transition-only | trim | <=200 chars | None | Service access |
| 84 | Sprinkler System Set for Season? | select | 140 | 90% | properties.sprinklers.set_for_season (seeded, dated) | Import | Resolve | boolean from select; one-time seed stamped with `as_of`, displayed as dated reference | true/false + required `as_of` | None | APPROVED: temporary state flag seeded as a clearly dated reference value; Resolve seasonal Work Order owns it going forward |
| 85 | Mowing | select | 153 | 98% | properties.grounds.mowing_cadence | Import | Notion transition-only | enum | enum | None | Recurring service |
| 86 | Mowing Day | multi_select | 148 | 95% | properties.grounds.mowing_days | Import | Notion transition-only | multi-select to weekday array | valid weekday names | None | Recurring service |
| 87 | Trash Day | multi_select | 153 | 98% | properties.waste.trash_days | Import | Notion transition-only | multi-select to weekday array | valid weekday names | None | Turnover ops |
| 88 | Number of Trash Carts | rich_text | 153 | 98% | properties.waste.cart_count | Import | Notion transition-only | parse integer | 0 < n < 20 | None | Turnover ops |
| 89 | Recycling Cart? | select | 153 | 98% | properties.waste.recycling | Import | Notion transition-only | boolean/enum | enum | None | Turnover ops |
| 90 | Recycling Day | rich_text | 152 | 97% | properties.waste.recycling_days | Import | Notion transition-only | normalize to weekday array | valid weekday names | None | Turnover ops |
| 91 | Holiday Trash Day | rich_text | 152 | 97% | properties.waste.holiday_notes | Import | Notion transition-only | trim; extract hauler URLs to external links | <=300 chars | None | Turnover ops |
| 92 | Trash Valet | select | 124 | 79% | properties.waste.valet | Import | Notion transition-only | enum | enum | None | Turnover ops |
| 93 | Trash Valet Vendor | formula | 0 | 0% | — | Exclude | Resolve | — | — | None | Notion formula; Resolve vendor records supersede |
| 94 | Strict Trash Rules | rich_text | 10 | 6% | properties.waste.strict_rules | Import | Notion transition-only | trim | <=500 chars | None | Only 10 rows but HOA-fine risk |
| 95 | Backyard Pool / Hot Tub | select | 154 | 99% | properties.pool_spa.present | Import | Notion transition-only | enum | enum | None | Service + safety |
| 96 | Heated Pool? | select | 7 | 4% | properties.pool_spa.heated | Import | Notion transition-only | boolean from select | true/false | None | Service |
| 97 | Pool Heater Details | rich_text | 4 | 3% | properties.pool_spa.heater | Import | Notion transition-only | trim | <=300 chars | None | Service |
| 98 | Backyard Pool Season | rich_text | 6 | 4% | properties.pool_spa.season | Import | Notion transition-only | trim | <=120 chars | None | Seasonal service |
| 99 | Backyard Pool Service Schedule | rich_text | 6 | 4% | properties.pool_spa.service_schedule | Import | Notion transition-only | trim | <=200 chars | None | Recurring service |
| 100 | Hot Tub Control Panel Location | rich_text | 4 | 3% | properties.pool_spa.control_panel_location | Import | Notion transition-only | trim | <=200 chars | None | Service access |
| 101 | Pool & Hot Tub Technician Form | formula | 159 | 100% | external_links (fillout) | Manual Review | External | host arha.fillout.com | https URL | None | Fillout form — decide keep-temporarily vs replace with Resolve work order |
| 102 | HOA? | select | 148 | 95% | properties.hoa.present | Import | Notion transition-only | boolean from select | true/false | None | Compliance/fines |
| 103 | HOA Notes (General) | rich_text | 67 | 43% | properties.hoa.notes + external_links | Import | Notion transition-only | trim; split HOA site URLs into external links | <=1000 chars | None | Compliance/fines |
| 104 | Neighborhood Amenities? | multi_select | 153 | 98% | properties.amenities.list | Import | Notion transition-only | multi-select to string[] | array | None | Guest context |
| 105 | Neighborhood Amenities Access Information | rich_text | 147 | 94% | properties.amenities.access_notes | Import | Notion transition-only | trim; strip any code/fob values | <=500 chars | Low - access reference, codes stripped | Guest context; credentials excluded |
| 106 | Rental Restriction Notes | rollup | 33 | 21% | properties.compliance.rental_restrictions (reference) | Manual Review | Resolve | rollup to text snapshot with as_of | <=1000 chars | None | Rollup from another database; snapshot only, source stays Notion until compliance record exists |
| 107 | Permit Review Status & Notes | rollup | 35 | 22% | properties.compliance.permit_status (reference) | Manual Review | Resolve | rollup to text snapshot with as_of | <=1000 chars | None | Same as above |
| 108 | Security Cameras | multi_select | 153 | 98% | properties.security.devices | Import | Notion transition-only | multi-select to string[] | array | None | Guest disclosure + maintenance |
| 109 | Camera Battery Type | multi_select | 153 | 98% | properties.security.battery_type | Import | Notion transition-only | multi-select to string[] | array | None | Supply planning |
| 110 | Cameras Monitoring Plan | multi_select | 152 | 97% | properties.security.monitoring_plan | Import | Notion transition-only | multi-select to string[] | array | None | Renewal tracking |
| 111 | Monitoring Plan Exp. Date | date | 104 | 67% | properties.security.monitoring_expires_on | Import | Notion transition-only | date | valid date | None | Renewal tracking |
| 112 | Alarm | select | 153 | 98% | properties.security.alarm | Import | Notion transition-only | enum | enum | None | Emergency response; code excluded |
| 113 | Builder Warranty? | select | 150 | 96% | properties.warranty.builder_present | Import | Notion transition-only | boolean from select | true/false | None | Claim eligibility |
| 114 | Builder Warranty Expiration Date | date | 27 | 17% | properties.warranty.builder_expires_on | Import | Notion transition-only | date | valid date | None | Claim eligibility |
| 115 | Builder Warranty Claim Info | rich_text | 108 | 69% | properties.warranty.claim_process + external_links (builder) | Import | Notion transition-only | trim; split builder URLs into external links | <=1000 chars | None | Claim process |
| 116 | Furniture Warranty Expiration Date | date | 114 | 73% | properties.warranty.furniture_expires_on | Import | Notion transition-only | date | valid date | None | Claim eligibility |
| 117 | Furniture Warranty (Backend) | formula | 159 | 100% | — | Exclude | Resolve | — | — | None | Notion formula derived from the expiration date |
| 118 | Furniture Pick List Link | url | 75 | 48% | external_links (onedrive) | Manual Review | SharePoint | inventory host; do not treat as canonical | https URL | Low | Personal OneDrive links; migrate to ARHA Resolve SharePoint at item 7 |
| 119 | Listing Photos | url | 142 | 91% | external_links (listing media) | Manual Review | OwnerRez | host inventory | https URL | None | OwnerRez photos already imported; keep as reference only |
| 120 | Special Handling | rich_text | 60 | 38% | properties.operating_notes | Import | Notion transition-only | trim | <=1000 chars | Low - may contain owner-sensitive notes; staff-only | High-value operating context |
| 121 | Pending Issues | formula | 0 | 0% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve open tickets |
| 122 | Storm Shelter Photo | files | 0 | 0% | — | Exclude | SharePoint | — | — | None | 0 readable values through the API; revisit at item 7 only if an operational need is identified |
| 123 | Photos of Issues | formula | 0 | 0% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve evidence_items |
| 124 | Outdoor Water Shutoff Location Photo | files | 0 | 0% | — | Exclude | SharePoint | — | — | None | 0 readable values through the API; revisit at item 7 only if an operational need is identified |
| 125 | Days Until Next Inspection (theoretical) | formula | 0 | 0% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve assessment scheduling |
| 126 | Sprinkler Control Panel Photo | files | 0 | 0% | — | Exclude | SharePoint | — | — | None | 0 readable values through the API; revisit at item 7 only if an operational need is identified |
| 127 | Fireplace Switch Location Photo | files | 0 | 0% | — | Exclude | SharePoint | — | — | None | 0 readable values through the API; revisit at item 7 only if an operational need is identified |
| 128 | First Inspection Date | formula | 0 | 0% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve assessment history |
| 129 | Front Photo | files | 0 | 0% | — | Exclude | SharePoint | — | — | None | 0 readable values through the API; revisit at item 7 only if an operational need is identified |
| 130 | Indoor Water Shutoff Location Photo | files | 0 | 0% | — | Exclude | SharePoint | — | — | None | 0 readable values through the API; revisit at item 7 only if an operational need is identified |
| 131 | Onboarding (Backend) | formula | 10 | 6% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve onboarding project record |
| 132 | Hot Tub Control Panel Photo | files | 0 | 0% | — | Exclude | SharePoint | — | — | None | 0 readable values through the API; revisit at item 7 only if an operational need is identified |
| 133 | Last Edit By | last_edited_by | 0 | 0% | — | Exclude | Resolve | — | — | None | Resolve audit_log / property_field_provenance supersede Notion edit metadata |
| 134 | Days Since Last Inspection | formula | 0 | 0% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve assessment scheduling |
| 135 | Compliance Summary | formula | 159 | 100% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve gatekeeper_requirements results |
| 136 | Compliance Rate Status | formula | 159 | 100% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve gatekeeper_requirements results |
| 137 | Compliance Rate | formula | 159 | 100% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve gatekeeper_requirements results |
| 138 | Compliance & Inspections | formula | 0 | 0% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve gatekeeper_requirements results |
| 139 | Yale WiFi Chip | files | 0 | 0% | — | Exclude | SharePoint | — | — | None | 0 readable values through the API; revisit at item 7 only if an operational need is identified |
| 140 | % Complete | formula | 159 | 100% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve onboarding project progress |
| 141 | Router Location Photo | files | 0 | 0% | — | Exclude | SharePoint | — | — | None | 0 readable values through the API; revisit at item 7 only if an operational need is identified |
| 142 | Refrigerator Water Filter Last Change | formula | 0 | 0% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve work order history |
| 143 | Photos of Refrigerator Water Filter and Type | files | 0 | 0% | — | Exclude | SharePoint | — | — | None | 0 readable values through the API; revisit at item 7 only if an operational need is identified |
| 144 | Mailbox Location Photo | files | 0 | 0% | — | Exclude | SharePoint | — | — | None | 0 readable values through the API; revisit at item 7 only if an operational need is identified |
| 145 | Garage Remote Photo | files | 0 | 0% | — | Exclude | SharePoint | — | — | None | 0 readable values through the API; revisit at item 7 only if an operational need is identified |
| 146 | Add a Guest/Owner Inspection | button | 0 | 0% | — | Exclude | Resolve | — | — | None | Notion UI action; Resolve actions supersede |
| 147 | Covenants | files | 0 | 0% | — | Exclude | SharePoint | — | — | None | 0 readable values through the API; revisit at item 7 only if an operational need is identified |
| 148 | ARHA Network_ | formula | 159 | 100% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: No Resolve equivalent required |
| 149 | Breaker Box Photo | files | 0 | 0% | — | Exclude | SharePoint | — | — | None | 0 readable values through the API; revisit at item 7 only if an operational need is identified |
| 150 | Map | place | 0 | 0% | — | Exclude | OwnerRez | — | — | None | Empty; OwnerRez geocode authoritative |
| 151 | Inspection Active Status | formula | 159 | 100% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve assessment scheduling |
| 152 | # of Inspections Completed | formula | 159 | 100% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve assessment history (ticket_visits / work_types) |
| 153 | Added By | created_by | 0 | 0% | — | Exclude | Resolve | — | — | None | Resolve audit_log / property_field_provenance supersede Notion edit metadata |
| 154 | Photo Front Door Lock System | files | 0 | 0% | — | Exclude | SharePoint | — | — | None | 0 readable values through the API; revisit at item 7 only if an operational need is identified |
| 155 | Archive this Property | button | 0 | 0% | — | Exclude | Resolve | — | — | None | Notion UI action; Resolve actions supersede |
| 156 | Owner Intake Form | formula | 159 | 100% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve Active Owner portal / Fillout (transitional) |
| 157 | Smoke Detector Model Number Photo | files | 0 | 0% | — | Exclude | SharePoint | — | — | None | 0 readable values through the API; revisit at item 7 only if an operational need is identified |
| 158 | Last Air Filter Change Date | formula | 0 | 0% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve work order history |
| 159 | Added On | created_time | 0 | 0% | — | Exclude | Resolve | — | — | None | Resolve audit_log / property_field_provenance supersede Notion edit metadata |
| 160 | Tags | multi_select | 0 | 0% | — | Exclude | Notion transition-only | — | — | None | Empty and unused (0 rows) |
| 161 | Last Edit | last_edited_time | 0 | 0% | — | Exclude | Resolve | — | — | None | Resolve audit_log / property_field_provenance supersede Notion edit metadata |
| 162 | Current Due Questions | formula | 0 | 0% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve onboarding task list |
| 163 | What's Missing? | formula | 159 | 100% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve onboarding task list |
| 164 | Photo of Pool Heater | files | 0 | 0% | — | Exclude | SharePoint | — | — | None | 0 readable values through the API; revisit at item 7 only if an operational need is identified |
| 165 | Internal Verification Link | formula | 159 | 100% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve Property Hub |
| 166 | Field Verification Link | formula | 159 | 100% | — | Derive in Resolve | Resolve | — | — | None | Notion formula; replacement: Resolve Property Hub |

## Disposition totals
| Action | Fields |
|---|---|
| Import | 81 |
| Exclude | 47 |
| Derive in Resolve | 21 |
| Manual Review | 15 |
| External Link | 2 |
| **Total** | **166** |

## Document and media link inventory (by destination decision)

### Personal OneDrive — `arealhomeaway-my.sharepoint.com`, 169 links
Not canonical. Sources: Furniture Pick List Link (75), plus embedded links inside Fireplace Instructions, Cluster Mailbox Location, Gas Fireplace Switch Location and HOA Notes.
**Proposal:** inventory now, copy to the ARHA Resolve SharePoint Documents library at item 7 (needs the `Sites.Selected` write grant), then store the Resolve-library URL and retire the personal link. Until then they render as clearly labelled "legacy OneDrive link (not a Resolve document)".

### Ring / camera portals — Ring 94, Blink 2, Alarm.com 1
Source field: Security Camera Feed (152 rows, 97 URLs).
**Proposal:** an operational external link on the Property Hub Security tab: `{ system, portal_url, who_to_ask }`, staff-only, no login values, opening in a new tab. No credentials imported.

### Fillout — `arha.fillout.com`, 8 links
- Pool & Hot Tub Technician Form (8) — **temporarily necessary**: no Resolve equivalent for the technician submission yet. Keep as an external link, flag for replacement by a Resolve work-order form.
- Owner Intake Form (formula) — **superseded** by the Active Owner portal. Do not carry forward.

### Builder / warranty — 5 links (drhorton, capitalhomes, homesbytaber, rwcwarranty)
**Proposal:** property warranty reference under `properties.warranty.claim_process` external links, alongside builder contact records.

### HOA / community — 8 links (sonomahoa, councilridgehoa, trinitycreekhoa, stonehorsehoa, magnoliaridgehoa, southforklife, vintageokc, gozego)
**Proposal:** property HOA reference under `properties.hoa` external links, plus an HOA contact record where a person is named.

### Other hosts
OwnerRez 159 and Breezeway 157 — system deep links, kept as reference. best-trash 2 (hauler), Outlook 3, Smartsheet 1, YouTube 2, Google Maps 1 — kept as inline external links on the owning field only.

### Notion file properties — 17, all empty
Front Photo, Covenants, Breaker Box Photo, both Water Shutoff photos, Sprinkler Control Panel, Fireplace Switch Location, Hot Tub Control Panel, Yale WiFi Chip, Router Location, Refrigerator Water Filter, Mailbox Location, Garage Remote, Photo Front Door Lock System, Smoke Detector Model Number, Pool Heater, Storm Shelter. All return 0 readable values through the connector. **Excluded** — no current operational requirement identified. Property photos already come from OwnerRez (156/156).

## Utilities and compliance discovered
- **Utilities:** WiFi SSID (154), split-network confirmation (159), router location (153), trash hauler (153 + best-trash links), recycling (153), water shutoff points (142/150), breaker panel (150). No utility accounts, logins or billing credentials exist in the PID — nothing of that kind is imported.
- **Compliance:** Permit Review Status & Notes (rollup, 35) and Rental Restriction Notes (rollup, 33), both sourced from a separate Notion database. Proposed as dated text snapshots referenced from the Hub, not as authoritative compliance records — `gatekeeper_requirements` and `documents` remain authoritative.

## Dry-run summary (no writes performed)
| Measure | Projected |
|---|---|
| Properties in scope | 156 |
| Properties expected to receive at least one value | 156 (100%) |
| Fields written per property | up to 81 |
| Populated values projected | ~10,759 |
| Blank source cells skipped | ~1,877 |
| Sensitive values excluded (never read into Resolve) | ~1,282 across 9 credential fields |
| Provenance rows created | one per written value, ~10,759 (`property_field_provenance`: field, source `notion_pid`, `as_of`, updated_by) |
| Conflicts expected | only on Bedrooms / Bathrooms / Occupancy Limit / GPS / Status vs OwnerRez-or-Resolve values — logged to `field_conflicts`, never auto-overwritten |
| Unresolved mappings | 15 Manual Review fields |
| Rows held out | 2 (Owens Rd, Foxtail Ln) + 1 excluded test row |

Identity fields (`name`, address, city, state, zip, `ownerrez_property_id`, lat/lng where OwnerRez supplied it) are write-protected in the planned importer: PID values for those fields cannot be written under any condition.

## Decisions needed from Emily
1. **21036 Owens Rd** — Live in the PID and OwnerRez (410153) but absent from Resolve. Add it to Resolve, or confirm it is out of scope?
2. **1399 Foxtail Ln** — pre-launch (OwnerRez 494863). Bring into Resolve now as In Preparation, or wait for handoff?
3. **`Live_12M` status (4 properties)** — is this MTR? Which Resolve lifecycle value should it map to?
4. **Greater Area vs Resolve market** — approve mapping PID areas onto existing Resolve markets, or create markets to match the PID?
5. **Handoff Date (153)** — import only where Resolve has no handoff date, or never import (Resolve handoff workflow authoritative)?
6. **Fact conflicts (Bedrooms/Bathrooms/Occupancy)** — confirm OwnerRez always wins and PID differences are logged as conflicts for review.
7. **Seasonal state fields** (Sprinkler Set for Season, Detector battery dates, filter dates) — import as a one-time seed with an `as_of` date, or leave to Resolve work orders only?
8. **Ring/camera portal links** — approve storing the portal URL as a staff-only operational link with no credentials.
9. **Pool & Hot Tub Technician Fillout form** — keep as a temporary external link, or schedule replacement by a Resolve work-order form now?
10. **Personal OneDrive links (169)** — approve inventory-now / migrate-at-item-7, with legacy links labelled non-canonical in the interim.
11. **Compliance rollups (permits, rental restrictions)** — approve dated snapshots surfaced as reference, source of truth staying outside the Hub.
12. **Storage shape** — approve grouped JSONB blocks on `properties` (per the v2 field map) rather than ~81 flat columns.

Nothing proceeds to schema or import until these are answered.
