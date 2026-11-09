# Notion PID vs Resolve: reconciliation report (Nov 9, report only)

Read only. No code, file (other than this report) or database was changed. Nothing was published.
Notion time: about 75 seconds in total (5 Notion data requests, no rate limits) plus a size check on every photo link and one timed sample of 13 downloads (kept in memory, nothing saved). Well inside the 40 minute limit; nothing was left unread.

Sources read: Notion PID (173 columns now, 166 pages); Resolve homes, code labels (never code values), links, files, photo attachments, import history. Code fields were checked in memory only with the code import's own rules; only counts were kept.

## Headline

| | Count |
|---|---|
| Notion PID pages | 166 |
| Notion columns today | 173 (166 in the import map, 1 renamed, 7 new) |
| Resolve homes (not demo) | 161 |
| Homes in both | **161** (every Resolve home has a Notion page) |
| Notion pages with no Resolve home | 5 (2 real homes, 1 blank page, 1 test row, 21036 Owens Rd) |
| Resolve homes with no Notion page | 0 |
| Homes the first PID import never reached | 5 (1399 Foxtail Ln., 1464 Buckland Ct., 8602 E. Galveston St., 3400 N Fern Avenue, 624 Daniel Court) |
| Imported value columns compared (map: Import, External Link, Manual Review) | 98 columns, 13,033 Notion values: **11,789 same**, 960 missing, 102 different, 174 wrong place, 8 code removed from text on purpose |
| Photos and files in Notion for these 161 homes | **2,084** in 17 columns |
| Photos already attached next to their item in Resolve | **0** (the photo attachment list is empty) |
| Photos already in Resolve storage (on the Documents tab, not next to the item) | 5 |
| Photos and files to copy | **2,076**, about **4,590 MB** |

## 1. Every Notion property compared

How to read: "Notion has a value" counts the 161 homes in both. "Same" means Resolve holds the same value in the place shown. "Wrong place" means the value is in Resolve but under a name the Home Profile does not read. For code fields only presence is compared, never the code; "N/A" or "None" text in a Notion code field is not a code and was not kept on purpose. OwnerRez stays the authority for the home name, address, bedrooms, bathrooms, occupancy and square footage, so differences there are expected (logged for review, never written).

Why most rows show 5 to 7 missing: the five homes above were added to Resolve after the Sept 1 import and never received their PID values (132 of their 145 Notion values are missing). The rest of the missing values are mostly Notion fields filled in after Sept 1: every one of the 156 imported pages has been edited in Notion since the import.

| # | Notion property | Type | Import map | Notion has a value | Resolve same | Resolve missing or different | of which: missing / different / wrong place / code removed from text | Resolve has, Notion blank | Where Resolve keeps it |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Smoke Detector Brand | rich_text | Import | 154 | 147 | 7 | 7 / 0 / 0 / 0 | 0 | systems.smoke.brand |
| 2 | HOA? | select | Import | 152 | 146 | 6 | 6 / 0 / 0 / 0 | 0 | hoa.present |
| 3 | Sprinkler System Set for Season? | select | Import | 145 | 138 | 7 | 7 / 0 / 0 / 0 | 0 | sprinklers.set_for_season |
| 4 | Storage for Supplies | select | Import | 155 | 148 | 7 | 7 / 0 / 0 / 0 | 0 | systems.supply_storage |
| 5 | Owner Email | rollup | not in map | 155 | 0 | 155 | 155 / 0 / 0 / 0 | 0 | not in import map (new Notion column) |
| 6 | Pending Issues | formula | Derive in Resolve | 0 | 0 | 0 | 0 / 0 / 0 / 0 | 0 | not kept (-) |
| 7 | Backyard Pool / Hot Tub | select | Import | 157 | 152 | 5 | 5 / 0 / 0 / 0 | 0 | pool_spa.present |
| 8 | Key Access Hole for Emergencies | select | Import | 155 | 148 | 7 | 7 / 0 / 0 / 0 | 0 | access.emergency_key_access |
| 9 | Storm Shelter Photo | files | Exclude | 33 | 0 | 33 | 33 / 0 / 0 / 0 | 0 | photo next to "Storm Shelter Location & Access" (property_profile_photos, item storm_shelter) |
| 10 | Photos of Issues | formula | Derive in Resolve | 0 | 0 | 0 | 0 / 0 / 0 / 0 | 0 | not kept (-) |
| 11 | Carbon Monoxide Detector Installed? | select | Import | 154 | 147 | 7 | 7 / 0 / 0 / 0 | 0 | systems.co.installed |
| 12 | Heated Pool? | select | Import | 7 | 6 | 1 | 1 / 0 / 0 / 0 | 0 | pool_spa.heated |
| 13 | Outdoor Water Shutoff Location Photo | files | Exclude | 154 | 0 | 154 | 154 / 0 / 0 / 0 | 0 | photo next to "Outdoor Water Shutoff Location" (property_profile_photos, item water_outdoor) |
| 14 | Days Until Next Inspection (theoretical) | formula | Derive in Resolve | 0 | 0 | 0 | 0 / 0 / 0 / 0 | 0 | not kept (-) |
| 15 | Interior Paint | rich_text | Import | 154 | 146 | 8 | 7 / 1 / 0 / 0 | 0 | facts.interior_paint |
| 16 | State | rich_text | Exclude | 161 | 161 | 0 | 0 / 0 / 0 / 0 | 0 | state (from OwnerRez) |
| 17 | Scheduling Due | formula | not in map | 148 | 0 | 148 | 148 / 0 / 0 / 0 | 0 | not in import map (new Notion column) |
| 18 | Furniture Warranty Expiration Date | date | Import | 118 | 113 | 5 | 5 / 0 / 0 / 0 | 0 | warranty.furniture_expires_on |
| 19 | Router Location | rich_text | Import | 157 | 151 | 6 | 6 / 0 / 0 / 0 | 0 | utilities.router_location |
| 20 | Breaker Box Location | rich_text | Import | 155 | 148 | 7 | 7 / 0 / 0 / 0 | 0 | systems.breaker_panel_location |
| 21 | Trash Valet Vendor | formula | Exclude | 75 | 0 | 75 | 75 / 0 / 0 / 0 | 0 | not kept in Resolve (import map: Exclude) |
| 22 | Location of Carbon Monoxide Detector | rich_text | Import | 154 | 147 | 7 | 7 / 0 / 0 / 0 | 0 | systems.co.location |
| 23 | Storm Shelter Location & Access | rich_text | Import | 101 | 94 | 7 | 6 / 1 / 0 / 0 | 0 | storm_shelter.location_access |
| 24 | Gas Fireplace Switch Location | rich_text | Import | 123 | 118 | 5 | 5 / 0 / 0 / 0 | 0 | fireplace.gas_switch_location |
| 25 | Smoke Detectors Power Type | select | Import | 155 | 148 | 7 | 7 / 0 / 0 / 0 | 0 | systems.smoke.power_type |
| 26 | Strict Trash Rules | rich_text | Import | 15 | 10 | 5 | 5 / 0 / 0 / 0 | 0 | waste.strict_rules |
| 27 | Home Grill | select | Import | 155 | 148 | 7 | 7 / 0 / 0 / 0 | 0 | facts.grill |
| 28 | Sprinkler Control Panel Photo | files | Exclude | 69 | 0 | 69 | 69 / 0 / 0 / 0 | 0 | photo next to "Sprinkler Control Panel Photo" (property_profile_photos, item sprinkler_panel_photo) |
| 29 | Property Address | rich_text | Exclude | 161 | 161 | 0 | 0 / 0 / 0 / 0 | 0 | address_line1 (from OwnerRez) |
| 30 | Fireplace Switch Location Photo | files | Exclude | 83 | 0 | 83 | 83 / 0 / 0 / 0 | 0 | photo next to "Gas Fireplace Switch Location" (property_profile_photos, item gas_switch_location) |
| 31 | First Inspection Date | formula | Derive in Resolve | 0 | 0 | 0 | 0 / 0 / 0 / 0 | 0 | not kept (-) |
| 32 | TV Specs | rich_text | Import | 157 | 145 | 12 | 6 / 2 / 0 / 4 | 0 | facts.tv_specs |
| 33 | Bedrooms | number | Import | 157 | 155 | 2 | 0 / 2 / 0 / 0 | 1 | bedrooms |
| 34 | Sprinkler System Location | rich_text | Import | 146 | 138 | 8 | 7 / 1 / 0 / 0 | 0 | sprinklers.controller_location |
| 35 | Hot Tub Control Panel Location | rich_text | Import | 4 | 3 | 1 | 1 / 0 / 0 / 0 | 0 | pool_spa.control_panel_location |
| 36 | WiFi Password | rich_text | Exclude | 157 (real code 152; N/A or no code 5) | 147 | 5 | 5 real codes missing; N/A text not kept on purpose | 0 | encrypted code (wifi: guest wifi) |
| 37 | Front Photo | files | Exclude | 157 | 0 | 157 | 157 / 0 / 0 / 0 | 0 | photo next to "Front Photo" (property_profile_photos, item front_photo) |
| 38 | Permit Review Status & Notes | rollup | Import | 41 | 35 | 6 | 6 / 0 / 0 / 0 | 0 | compliance.permit_status.text |
| 39 | Indoor Water Shutoff Location Photo | files | Exclude | 110 | 0 | 110 | 110 / 0 / 0 / 0 | 0 | photo next to "Indoor Water Shutoff Location" (property_profile_photos, item water_indoor) |
| 40 | Backyard Pool Service Schedule | rich_text | Import | 7 | 6 | 1 | 1 / 0 / 0 / 0 | 0 | pool_spa.service_schedule |
| 41 | Closet Supply Box Location | rich_text | Import | 154 | 147 | 7 | 7 / 0 / 0 / 0 | 0 | systems.supply_box_location |
| 42 | Home Has Fireplace? | select | Import | 154 | 147 | 7 | 7 / 0 / 0 / 0 | 0 | fireplace.present |
| 43 | Onboarding (Backend) | formula | Derive in Resolve | 4 | 0 | 4 | 4 / 0 / 0 / 0 | 0 | not kept (-) |
| 44 | Trash Valet | select | Import | 157 | 123 | 34 | 34 / 0 / 0 / 0 | 0 | waste.valet |
| 45 | Property Tier | select | Import | 161 | 153 | 8 | 8 / 0 / 0 / 0 | 0 | tier |
| 46 | Hot Tub Control Panel Photo | files | Exclude | 2 | 0 | 2 | 2 / 0 / 0 / 0 | 0 | photo next to "Hot Tub Control Panel Location" (property_profile_photos, item hot_tub_panel) |
| 47 | Mowing | select | Import | 157 | 151 | 6 | 6 / 0 / 0 / 0 | 0 | grounds.mowing_cadence |
| 48 | Bathrooms | number | Import | 157 | 143 | 14 | 0 / 14 / 0 / 0 | 1 | bathrooms |
| 49 | Yale Integration - Live and Connected in Breezeway | checkbox | Import | 73 | 73 | 0 | 0 / 0 / 0 / 0 | 0 | access.yale_integration_live |
| 50 | Gas Fireplace Switch | select | Import | 134 | 129 | 5 | 5 / 0 / 0 / 0 | 0 | fireplace.gas_switch |
| 51 | Outdoor Water Shutoff Location | rich_text | Import | 155 | 147 | 8 | 7 / 1 / 0 / 0 | 0 | systems.water_shutoff_outdoor |
| 52 | Neighborhood Amenities? | multi_select | Import | 157 | 150 | 7 | 6 / 1 / 0 / 0 | 0 | amenities.list |
| 53 | Rental Restriction Notes | rollup | Import | 39 | 33 | 6 | 6 / 0 / 0 / 0 | 0 | compliance.rental_restrictions.text |
| 54 | Recycling Day | rich_text | Import | 157 | 151 | 6 | 6 / 0 / 0 / 0 | 0 | waste.recycling_days |
| 55 | Last Edit By | last_edited_by | Exclude | 161 | 0 | 161 | 161 / 0 / 0 / 0 | 0 | Resolve keeps its own edit history |
| 56 | Furniture Package | select | Import | 161 | 156 | 5 | 5 / 0 / 0 / 0 | 0 | furniture_package |
| 57 | Days Since Last Inspection | formula | Derive in Resolve | 0 | 0 | 0 | 0 / 0 / 0 / 0 | 0 | not kept (-) |
| 58 | Compliance Summary | formula | Derive in Resolve | 161 | 0 | 161 | 161 / 0 / 0 / 0 | 0 | not kept (-) |
| 59 | Compliance Rate Status | formula | Derive in Resolve | 161 | 0 | 161 | 161 / 0 / 0 / 0 | 0 | not kept (-) |
| 60 | Recycling Cart? | select | Import | 157 | 151 | 6 | 6 / 0 / 0 / 0 | 0 | waste.recycling |
| 61 | Pool Heater Details | rich_text | Import | 5 | 4 | 1 | 1 / 0 / 0 / 0 | 0 | pool_spa.heater |
| 62 | Location of TVs? | multi_select | Import | 157 | 151 | 6 | 6 / 0 / 0 / 0 | 0 | facts.tv_locations |
| 63 | Smart Lock Brand | rich_text | Import | 157 | 150 | 7 | 5 / 2 / 0 / 0 | 0 | access.lock_brand |
| 64 | Compliance Rate | formula | Derive in Resolve | 161 | 0 | 161 | 161 / 0 / 0 / 0 | 0 | not kept (-) |
| 65 | House has a 5 Year Old Fridge Water Filter | select | Import | 153 | 146 | 7 | 7 / 0 / 0 / 0 | 0 | systems.fridge_filter_5yr |
| 66 | Compliance & Inspections | formula | Derive in Resolve | 0 | 0 | 0 | 0 / 0 / 0 / 0 | 0 | not kept (-) |
| 67 | Security Camera Feed | rich_text | External Link | 156 | 94 | 62 | 62 / 0 / 0 / 0 | 0 | property_external_links (source_field = Security Camera Feed) |
| 68 | Yale WiFi Chip | files | Exclude | 119 | 0 | 119 | 119 / 0 / 0 / 0 | 0 | photo next to "Yale Smart Module" (property_profile_photos, item yale_module) |
| 69 | Gate Code | rich_text | Exclude | 156 (real code 12; N/A or no code 144) | 12 | 0 | 0 real codes missing; N/A text not kept on purpose | 0 | encrypted code (gate_community: gate / community code) |
| 70 | % Complete | formula | Derive in Resolve | 161 | 0 | 161 | 161 / 0 / 0 / 0 | 0 | not kept (-) |
| 71 | Router Location Photo | files | Exclude | 153 | 0 | 153 | 153 / 0 / 0 / 0 | 0 | photo next to "Router Location" (property_profile_photos, item router_location) |
| 72 | Refrigerator Water Filter Last Change | formula | Derive in Resolve | 0 | 0 | 0 | 0 / 0 / 0 / 0 | 0 | not kept (-) |
| 73 | Access Codes | rich_text | Exclude | 157 (real code 155; N/A or no code 2) | 149 | 6 | 6 real codes missing; N/A text not kept on purpose | 0 | encrypted code (property_access: property access code) |
| 74 | Detectors Batteries Change Date | date | Import | 155 | 141 | 14 | 7 / 7 / 0 / 0 | 0 | systems.smoke.batteries_changed_on |
| 75 | Airbnb Name | rich_text | Import | 156 | 150 | 6 | 6 / 0 / 0 / 0 | 0 | listing_alias |
| 76 | Smoke Detector Expiration | rich_text | Import | 155 | 133 | 22 | 22 / 0 / 0 / 0 | 0 | systems.smoke.expires_source_text (+ parsed expires_on) |
| 77 | Fireplace Type | select | Import | 139 | 133 | 6 | 6 / 0 / 0 / 0 | 0 | fireplace.fuel_type |
| 78 | Trash Day | multi_select | Import | 157 | 151 | 6 | 6 / 0 / 0 / 0 | 0 | waste.trash_days |
| 79 | Pool & Hot Tub Technician Form | formula | External Link | 161 | 8 | 153 | 153 / 0 / 0 / 0 | 0 | property_external_links (source_field = Pool & Hot Tub Technician Form) |
| 80 | Home ID | formula | Exclude | 161 | 0 | 161 | 161 / 0 / 0 / 0 | 0 | not kept in Resolve (import map: Exclude) |
| 81 | Yale is Not Calibrated | checkbox | Import | 18 | 0 | 18 | 18 / 0 / 0 / 0 | 0 | access.yale_needs_calibration |
| 82 | Holiday Trash Day | rich_text | Import | 157 | 151 | 6 | 6 / 0 / 0 / 0 | 0 | waste.holiday_notes |
| 83 | Alarm Code | rich_text | Exclude | 157 (real code 49; N/A or no code 108) | 49 | 0 | 0 real codes missing; N/A text not kept on purpose | 0 | encrypted code (alarm_security: alarm code) |
| 84 | Yale Smart Module | select | Import | 157 | 148 | 9 | 7 / 2 / 0 / 0 | 0 | access.yale_module |
| 85 | Status_ | select | Exclude | 2 | 0 | 2 | 2 / 0 / 0 / 0 | 0 | not kept in Resolve (import map: Exclude) |
| 86 | Photos of Refrigerator Water Filter and Type | files | Exclude | 153 | 0 | 153 | 153 / 0 / 0 / 0 | 0 | photo next to "Photos of Refrigerator Water Filter and Type" (property_profile_photos, item fridge_filter_photos) |
| 87 | Mailbox Location Photo | files | Exclude | 154 | 0 | 154 | 154 / 0 / 0 / 0 | 0 | photo next to "Mailbox Location Photo" (property_profile_photos, item mailbox_photo) |
| 88 | Neighborhood Name | rich_text | Import | 156 | 149 | 7 | 7 / 0 / 0 / 0 | 0 | neighborhood |
| 89 | Backyard Pool Season | rich_text | Import | 7 | 6 | 1 | 1 / 0 / 0 / 0 | 0 | pool_spa.season |
| 90 | Property Built Year | number | Import | 161 | 155 | 6 | 6 / 0 / 0 / 0 | 0 | year_built |
| 91 | OR Property Link | rich_text | External Link | 161 | 156 | 5 | 5 / 0 / 0 / 0 | 0 | property_external_links (source_field = OR Property Link) |
| 92 | Sprinkler System Brand | rich_text | Import | 145 | 138 | 7 | 7 / 0 / 0 / 0 | 0 | sprinklers.brand |
| 93 | Monitoring Plan Exp. Date | date | Import | 108 | 103 | 5 | 5 / 0 / 0 / 0 | 0 | security.monitoring_expires_on |
| 94 | Garage Remote Photo | files | Exclude | 150 | 0 | 150 | 150 / 0 / 0 / 0 | 0 | photo next to "Garage Remote Brand & Model" (property_profile_photos, item garage_remote) |
| 95 | City | rich_text | Exclude | 161 | 154 | 7 | 0 / 7 / 0 / 0 | 0 | city (from OwnerRez) |
| 96 | Builder Warranty Expiration Date | date | Import | 27 | 26 | 1 | 1 / 0 / 0 / 0 | 0 | warranty.builder_expires_on |
| 97 | Number of Trash Carts | rich_text | Import | 157 | 151 | 6 | 6 / 0 / 0 / 0 | 0 | waste.cart_notes (count in waste.cart_count) |
| 98 | Neighborhood Amenities Access Information | rich_text | Import | 151 | 138 | 13 | 6 / 3 / 0 / 4 | 0 | amenities.access_notes |
| 99 | Security Cameras | multi_select | Import | 157 | 151 | 6 | 6 / 0 / 0 / 0 | 0 | security.devices |
| 100 | Closet Supply Box Code | rich_text | Exclude | 155 (real code 60; N/A or no code 95) | 54 | 6 | 6 real codes missing; N/A text not kept on purpose | 0 | encrypted code (supply_storage: closet supply box code) |
| 101 | Furniture Warranty (Backend) | formula | Exclude | 161 | 0 | 161 | 161 / 0 / 0 / 0 | 0 | not kept in Resolve (import map: Exclude) |
| 102 | WiFi Network Name | rich_text | Import | 157 | 150 | 7 | 5 / 2 / 0 / 0 | 0 | utilities.wifi_ssid |
| 103 | Base Price | number | Exclude | 157 | 0 | 157 | 157 / 0 / 0 / 0 | 0 | not kept in Resolve (import map: Exclude) |
| 104 | Builder Warranty Claim Info | rich_text | Import | 113 | 0 | 113 | 5 / 0 / 108 / 0 | 0 | warranty.claim_process |
| 105 | Add a Guest/Owner Inspection | button | Exclude | 0 | 0 | 0 | 0 / 0 / 0 / 0 | 0 | not kept in Resolve (import map: Exclude) |
| 106 | Greater Area | select | Import | 161 | 157 | 4 | 4 / 0 / 0 / 0 | 0 | market |
| 107 | Covenants | files | Exclude | 49 | 0 | 49 | 49 / 0 / 0 / 0 | 0 | photo next to "Covenants" (property_profile_photos, item covenants) |
| 108 | Active Projects Sheet | relation | Exclude | 63 | 0 | 63 | 63 / 0 / 0 / 0 | 0 | not kept in Resolve (import map: Exclude) |
| 109 | ARHA Network_ | formula | Derive in Resolve | 161 | 0 | 161 | 161 / 0 / 0 / 0 | 0 | not kept (-) |
| 110 | Vendors | relation | not in map | 154 | 0 | 154 | 154 / 0 / 0 / 0 | 0 | not in import map (new Notion column) |
| 111 | Refrigerator Water Filter | rich_text | Import | 157 | 147 | 10 | 6 / 4 / 0 / 0 | 0 | systems.fridge_filter |
| 112 | Cluster Mailbox? | select | Import | 147 | 141 | 6 | 6 / 0 / 0 / 0 | 0 | parking.cluster_mailbox |
| 113 | Breaker Box Photo | files | Exclude | 155 | 0 | 155 | 155 / 0 / 0 / 0 | 0 | photo next to "Breaker Box Location" (property_profile_photos, item breaker_box) |
| 114 | Owner | relation | not in map | 161 | 0 | 161 | 161 / 0 / 0 / 0 | 0 | not in import map (new Notion column) |
| 115 | Map | place | Exclude | 157 | 142 | 15 | 0 / 15 / 0 / 0 | 1 | latitude/longitude (geocoded from OwnerRez address) |
| 116 | GPS Coordinates | rich_text | Manual Review | 161 | 152 | 9 | 3 / 6 / 0 / 0 | 0 | latitude/longitude (geocoded from OwnerRez address) |
| 117 | Smoke Detectors Battery Type | select | Import | 155 | 148 | 7 | 7 / 0 / 0 / 0 | 0 | systems.smoke.battery_type |
| 118 | Confirmed Wifi has a split network | checkbox | Import | 12 | 12 | 0 | 0 / 0 / 0 / 0 | 0 | utilities.wifi_split_confirmed |
| 119 | Inspection Active Status | formula | Derive in Resolve | 161 | 0 | 161 | 161 / 0 / 0 / 0 | 0 | not kept (-) |
| 120 | Garage Keypad Code | rich_text | Exclude | 155 (real code 92; N/A or no code 63) | 86 | 6 | 6 real codes missing; N/A text not kept on purpose | 0 | encrypted code (garage: garage keypad code) |
| 121 | Fireplace Brand & Model Number | rich_text | Import | 139 | 133 | 6 | 6 / 0 / 0 / 0 | 0 | fireplace.model |
| 122 | Mowing Day | multi_select | Import | 152 | 147 | 5 | 5 / 0 / 0 / 0 | 0 | grounds.mowing_days |
| 123 | Fireplace Instructions | rich_text | Import | 145 | 140 | 5 | 5 / 0 / 0 / 0 | 0 | fireplace.instructions |
| 124 | # of Inspections Completed | formula | Derive in Resolve | 161 | 0 | 161 | 161 / 0 / 0 / 0 | 0 | not kept (-) |
| 125 | Alarm | select | Import | 157 | 151 | 6 | 6 / 0 / 0 / 0 | 0 | security.alarm |
| 126 | Added By | created_by | Exclude | 161 | 0 | 161 | 161 / 0 / 0 / 0 | 0 | Resolve keeps its own edit history |
| 127 | Photo Front Door Lock System | files | Exclude | 151 | 0 | 151 | 151 / 0 / 0 / 0 | 0 | photo next to "Photo Front Door Lock System" (property_profile_photos, item front_door_lock_photo) |
| 128 | Archive this Property | button | Exclude | 0 | 0 | 0 | 0 / 0 / 0 / 0 | 0 | not kept in Resolve (import map: Exclude) |
| 129 | Neighborhood Pool Access Key/Fob | rich_text | Exclude | 76 (real code 7; N/A or no code 69) | 6 | 1 | 1 real codes missing; N/A text not kept on purpose | 0 | encrypted code (property_access: neighborhood pool access / community / pool access code) |
| 130 | HOA Notes (General) | rich_text | Import | 72 | 0 | 72 | 6 / 0 / 66 / 0 | 0 | hoa.notes |
| 131 | Owner Intake Form | formula | Derive in Resolve | 161 | 0 | 161 | 161 / 0 / 0 / 0 | 0 | not kept (-) |
| 132 | Smoke Detector Model Number Photo | files | Exclude | 154 | 0 | 154 | 154 / 0 / 0 / 0 | 0 | photo next to "Smoke Detector Model Number Photo" (property_profile_photos, item smoke_model_photo) |
| 133 | Storage Closet/Cabinet Code | rich_text | Exclude | 155 (real code 140; N/A or no code 15) | 134 | 6 | 6 real codes missing; N/A text not kept on purpose | 0 | encrypted code (supply_storage: storage closet / cabinet code) |
| 134 | Last Air Filter Change Date | formula | Derive in Resolve | 0 | 0 | 0 | 0 / 0 / 0 / 0 | 0 | not kept (-) |
| 135 | Office or Workstation? | select | Import | 157 | 150 | 7 | 6 / 1 / 0 / 0 | 0 | facts.workstation |
| 136 | Smoke Detector Notes | rich_text | Import | 155 | 148 | 7 | 7 / 0 / 0 / 0 | 0 | systems.smoke.notes |
| 137 | Home Inspection Schedule | relation | not in map | 121 | 0 | 121 | 121 / 0 / 0 / 0 | 0 | not in import map (new Notion column) |
| 138 | Sprinkler System Status | select | Import | 156 | 148 | 8 | 7 / 1 / 0 / 0 | 0 | sprinklers.status |
| 139 | Instant Book On | checkbox | Import | 83 | 76 | 7 | 1 / 6 / 0 / 0 | 0 | instant_book |
| 140 | Handoff Date | date | Import | 157 | 151 | 6 | 6 / 0 / 0 / 0 | 0 | handoff_accepted_at, else legacy_handoff_date |
| 141 | OwnerRez Internal ID | rich_text | Exclude | 161 | 161 | 0 | 0 / 0 / 0 / 0 | 0 | ownerrez_property_id (join key) |
| 142 | Added On | created_time | Exclude | 161 | 0 | 161 | 0 / 161 / 0 / 0 | 0 | Resolve created_at (Resolve keeps its own) |
| 143 | Square Footage | rich_text | Import | 157 | 152 | 5 | 0 / 5 / 0 / 0 | 1 | living_area_sqft (OwnerRez wins) |
| 144 | Tags | multi_select | Exclude | 0 | 0 | 0 | 0 / 0 / 0 / 0 | 0 | not kept in Resolve (import map: Exclude) |
| 145 | Cameras Monitoring Plan | multi_select | Import | 156 | 150 | 6 | 6 / 0 / 0 / 0 | 0 | security.monitoring_plan |
| 146 | Mailbox Number | rich_text | Import | 147 | 141 | 6 | 6 / 0 / 0 / 0 | 0 | parking.mailbox_number |
| 147 | Occupancy Limit | number | Import | 160 | 144 | 16 | 3 / 13 / 0 / 0 | 1 | max_guests |
| 148 | Inspection Requests | relation | not in map | 137 | 0 | 137 | 137 / 0 / 0 / 0 | 0 | not in import map (new Notion column) |
| 149 | Zip | rich_text | Exclude | 161 | 155 | 6 | 0 / 6 / 0 / 0 | 0 | postal_code (from OwnerRez) |
| 150 | Last Edit | last_edited_time | Exclude | 161 | 0 | 161 | 161 / 0 / 0 / 0 | 0 | Resolve keeps its own edit history |
| 151 | Property Nickname | rich_text | Import | 161 | 156 | 5 | 5 / 0 / 0 / 0 | 0 | nickname |
| 152 | Parking | rich_text | Import | 161 | 154 | 7 | 5 / 2 / 0 / 0 | 0 | parking.summary |
| 153 | Current Due Questions | formula | Derive in Resolve | 0 | 0 | 0 | 0 / 0 / 0 / 0 | 0 | not kept (-) |
| 154 | Air Filter Sizes | rich_text | Import | 157 | 145 | 12 | 6 / 6 / 0 / 0 | 0 | hvac.filter_notes |
| 155 | Garage Trim Lockbox Code | rich_text | Exclude | 155 (real code 91; N/A or no code 64) | 85 | 6 | 6 real codes missing; N/A text not kept on purpose | 0 | encrypted code (lockbox: garage trim lockbox code) |
| 156 | What's Missing? | formula | Derive in Resolve | 129 | 0 | 129 | 129 / 0 / 0 / 0 | 0 | not kept (-) |
| 157 | OwnerRez Order | number | Exclude | 161 | 0 | 161 | 161 / 0 / 0 / 0 | 0 | not kept in Resolve (import map: Exclude) |
| 158 | BW Property Link | rich_text | External Link | 161 | 154 | 7 | 6 / 1 / 0 / 0 | 0 | property_external_links (source_field = BW Property Link) |
| 159 | Photo of Pool Heater | files | Exclude | 3 | 0 | 3 | 3 / 0 / 0 / 0 | 0 | photo next to "Photo of Pool Heater" (property_profile_photos, item pool_heater_photo) |
| 160 | Internal Verification Link | formula | Derive in Resolve | 161 | 0 | 161 | 161 / 0 / 0 / 0 | 0 | not kept (-) |
| 161 | Owner Phone | rollup | not in map | 151 | 0 | 151 | 151 / 0 / 0 / 0 | 0 | not in import map (new Notion column) |
| 162 | Status | select | Import | 161 | 156 | 5 | 0 / 5 / 0 / 0 | 0 | lifecycle_status |
| 163 | Builder Warranty? | select | Import | 155 | 149 | 6 | 6 / 0 / 0 / 0 | 0 | warranty.builder_present |
| 164 | Camera Battery Type | multi_select | Import | 157 | 151 | 6 | 6 / 0 / 0 / 0 | 0 | security.battery_type |
| 165 | Cluster Mailbox Location | rich_text | Import | 147 | 141 | 6 | 6 / 0 / 0 / 0 | 0 | parking.mailbox_location |
| 166 | Special Handling | rich_text | Import | 71 | 48 | 23 | 12 / 11 / 0 / 0 | 0 | operating_notes |
| 167 | Field Verification Link | formula | Derive in Resolve | 161 | 0 | 161 | 161 / 0 / 0 / 0 | 0 | not kept (-) |
| 168 | Indoor Water Shutoff Location | rich_text | Import | 146 | 140 | 6 | 6 / 0 / 0 / 0 | 0 | systems.water_shutoff_indoor |
| 169 | Garage Remote Brand & Model | rich_text | Import | 155 | 147 | 8 | 7 / 1 / 0 / 0 | 0 | access.garage_remote |
| 170 | Furniture Pick List Link | url | External Link | 80 | 38 | 42 | 42 / 0 / 0 / 0 | 0 | property_external_links (source_field = Furniture Pick List Link) |
| 171 | Keys in Garage Lockbox | multi_select | Import | 155 | 148 | 7 | 6 / 1 / 0 / 0 | 0 | access.key_storage |
| 172 | Listing Photos | url | Manual Review | 146 | 0 | 146 | 146 / 0 / 0 / 0 | 0 | not kept (external_links (listing media)) |
| 173 | Property | title | Exclude | 161 | 150 | 11 | 0 / 11 / 0 / 0 | 0 | name (from OwnerRez) |
### Examples of "different" (Notion today vs Resolve)
Most are Notion edits made after the Sept 1 import; the rest are OwnerRez values that win by rule. Wording that mentions people was left out of this report.

| Notion property | Home | Notion now | Resolve |
|---|---|---|---|
| Interior Paint | 730 E 38th St. N. | Garage 1 exterior of 5 galon super paint  evening blue 1 exterior 5 galon super paint tric | 1. Location & quantity - garage several 2. Brand - sherwin Williams  3. Color name & code  |
| Storm Shelter Location & Access | 3117 Scissortail Way | Garage - use provided pin to depress button to slide door open | Garage -use provided pin to depress button to slide door open depress button to slide door |
| TV Specs | 730 E 38th St. N. | 65" TCL ROKU TV in Living Room  55” TCL ROKU TV in Primary Bedroom | 65" TCL TV in Living Room, 55” TV in Primary Bedroom |
| TV Specs | 305 W 7th St. | Living Room - 305 W 7th ST - 65 Primary bedroom- 65 | Living Room - 305 W 7th ST - 65 |
| Bedrooms | 1908 E Urbana St | 5 | 4 |
| Bedrooms | 18104 Calle Way (12M) | 3 | 4 |
| Sprinkler System Location | 8408 NW 162nd (30D FIRM) | Garage | Garahe |
| Bathrooms | 9211 Fitzgerald Dr. (7D Max) | 2.5 | 3 |
| Bathrooms | 7317 NW 159th Ter. (30D FIRM) | 3.5 | 4 |
| Outdoor Water Shutoff Location | 730 E 38th St. N. | aside the mailbox | I do not see one on the outside of the house if there is it’s in the water meter box and i |
| Neighborhood Amenities? | 6629 S 22nd Ct E | Pool | Not Mentioned |
| Smart Lock Brand | 401 E. 10th St. | Yale | Schlage |
| Smart Lock Brand | 33 Center Lane S | Schlage at side door. | Yale at side door, Schlage at front door |
| Detectors Batteries Change Date | 14553 Serrano Ridge Rd | 2026-09-08 | 2025-10-16 |
| Detectors Batteries Change Date | 628 Joy Ct | 2026-09-07 | 2025-10-29 |
| Yale Smart Module | 33 Center Lane S | Not Applicable (Not Yale) | Not Connected |
| Yale Smart Module | 15701 E 75th Pl N | Connected & Setup | Not Connected |
| City | 85 Lower Green Way | Carlton Landing | Eufaula |
| City | 1722 Westchester Dr | Oklahoma City | The Village |
| Neighborhood Amenities Access Information | 7317 NW 159th Ter. (30D FIRM) | Pool rules can be found in the guidebook custom fields, and also save to onedrive - here.  | Pool rules can be found in the guidebook custom fields, and also save to onedrive - here.  |
| Neighborhood Amenities Access Information | 6629 S 22nd Ct E | There is a community pool (only available for guests 30+ days). A waiver is required to be | There is a community pool (only available for guests 30+ days). A waiver is required to be |
| WiFi Network Name | 401 E. 10th St. | ARHA 2.4, ARHA 5 | HFE 401 |
| WiFi Network Name | 2527 NE 15th St | ARHA | Arealhomeaway |
| Refrigerator Water Filter | 730 E 38th St. N. | Samsung Water Filter NSF | Samsung Water Filter |
| Refrigerator Water Filter | 305 W 7th St. | Frigidaire FPPWFU01 | Frigidaire |
| Map | 31445 Moore Rd. | 30.19337,-95.64274 | 30.1954183,-95.6428895 |
| Map | 85 Lower Green Way | 35.20599,-95.54934 | 35.2066292,-95.5482734 |
| GPS Coordinates | 2208 E. Toledo St. | 36.03479830, -95.77131550 | 36.035157,-95.764617 |
| GPS Coordinates | 7351 Red Rock Rd | 39.88891960, -85.94354741 | 39.8889196,-85.9418308 |
| Office or Workstation? | 2536 NW 116th (12M) | Not Mentioned | No |
| Sprinkler System Status | 1152 Western Yarrow Ave | Property Has Sprinkler System and It's On | Property Does Not Have Sprinkler System |
| Instant Book On | 3915 W 104th St. S. (7D Max) | true | false |
| Instant Book On | 9211 Fitzgerald Dr. (7D Max) | true | false |
| Square Footage | 85 Lower Green Way | 2,606 | 2236 |
| Square Footage | 136 Magnolia Estates St | Not Mentioned | 1772 |
| Occupancy Limit | 1464 Buckland Ct. | 8 | 6 |
| Occupancy Limit | 852 Inland Dr. | 8 | 6 |
| Zip | 1399 Foxtail Ln. (7D Max) | 46413 | 46143 |
| Zip | 2208 E. Toledo St. | 74011 | 74012 |
| Parking | 10320 Lightning Creek Dr. (30D FIRM) | 3 Car Garage. Per the HOA cars can only be parked in the garage and driveway. Max of 3 car | 3 Car Garage |
| Parking | 2536 NW 116th (12M) | On Property Garage ( No more Information ) | On Property Garage (No more Information) |
| Air Filter Sizes | 730 E 38th St. N. | 1- 14x24x1  1- 14x30x1 | 14x24x1 - 1 14x30x1 - 1 |
| Air Filter Sizes | 305 W 7th St. | 14x14x1 - 2 locations  dining and primary bedroom  20x25x1 hallway | 14x14x1 - 2 locations  20x25x1 |
| BW Property Link | 85 Lower Green Way | https://app.breezeway.io/property/1295307/profile | https://app.breezeway.io/property/1295302/profile |
| Status | 1399 Foxtail Ln. (7D Max) | Live | onboarding |
| Status | 3915 W 104th St. S. (7D Max) | Live | onboarding |
| Garage Remote Brand & Model | 14553 Serrano Ridge Rd | LiftMaster 380 UT | LiftMaster 38OUT |
| Keys in Garage Lockbox | 236 N. Starnes St. (31D FIRM) | N/A, Front Door/Smartlock, Backdoor | N/A |
| Property | 3400 N Fern Avenue W. | 3400 N Fern Avenue W. | 3400 N Fern Avenue |
| Property | 1399 Foxtail Ln. (7D Max) | 1399 Foxtail Ln. (7D Max) | 1399 Foxtail Ln. |

## 2. Photos and files

Resolve has no photo attached next to any item yet (0 rows). Five Notion files are already in Resolve storage as home documents, not next to their item: 2 front photos (1399 Foxtail Ln., 3915 W 104th St. S.) and 3 covenant PDFs (9211 Fitzgerald Dr.). Two other name matches were coincidences with Ticket photos and are not counted.

Where the files really are: only 247 are Notion-hosted (their links expire about an hour after each read). 1,836 are links to the original Owner Intake Fillout uploads, which do not expire. 1 Covenants entry is a web page, not a file; 2 Fillout links are broken (one Indoor Water Shutoff photo, one Yale WiFi Chip photo). File types: 1,983 JPEG, 51 PNG, 6 WEBP, 4 HEIC, 66 PDF. Largest file 20.3 MB, typical 1.9 MB, 7 over 10 MB.

| Notion photo/file property | Goes next to (Home Profile item) | Section | Homes with files | Files in Notion | Notion-hosted (link expires ~1 h) | Fillout upload links (do not expire) | Other / broken | MB to copy | Already in Resolve storage | Attached to the right item | Missing |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Storm Shelter Photo | Storm Shelter Location & Access | Home Systems & Features | 33 | 35 | 4 | 31 | 0 | 92.3 | 0 | 0 | 35 |
| Outdoor Water Shutoff Location Photo | Outdoor Water Shutoff Location | Home Systems & Features | 154 | 158 | 8 | 150 | 0 | 791.4 | 0 | 0 | 158 |
| Sprinkler Control Panel Photo | Sprinkler Control Panel Photo | Home Systems & Features | 69 | 83 | 5 | 78 | 0 | 175.0 | 0 | 0 | 83 |
| Fireplace Switch Location Photo | Gas Fireplace Switch Location | Home Profile | 83 | 99 | 11 | 88 | 0 | 205.3 | 0 | 0 | 99 |
| Front Photo | Front Photo | Quick Overview | 157 | 157 | 119 | 38 | 0 | 220.7 | 2 | 0 | 155 |
| Indoor Water Shutoff Location Photo | Indoor Water Shutoff Location | Home Systems & Features | 110 | 112 | 7 | 105 | 1 | 216.5 | 0 | 0 | 111 |
| Hot Tub Control Panel Photo | Hot Tub Control Panel Location | Pool and Hot Tub | 2 | 3 | 1 | 2 | 0 | 6.3 | 0 | 0 | 3 |
| Yale WiFi Chip | Yale Smart Module | Onboarding & Setup | 119 | 125 | 0 | 125 | 1 | 211.2 | 0 | 0 | 124 |
| Router Location Photo | Router Location | Onboarding & Setup | 153 | 160 | 2 | 158 | 0 | 290.3 | 0 | 0 | 160 |
| Photos of Refrigerator Water Filter and Type | Photos of Refrigerator Water Filter and Type | Home Systems & Features | 153 | 170 | 9 | 161 | 0 | 282.2 | 0 | 0 | 170 |
| Mailbox Location Photo | Mailbox Location Photo | Entry & Access Details | 154 | 167 | 15 | 152 | 0 | 513.1 | 0 | 0 | 167 |
| Garage Remote Photo | Garage Remote Brand & Model | Entry & Access Details | 150 | 212 | 12 | 200 | 0 | 429.5 | 0 | 0 | 212 |
| Covenants | Covenants | Property, Vendor, and Neighborhood Details | 49 | 65 | 26 | 38 | 1 | 175.7 | 3 | 0 | 61 |
| Breaker Box Photo | Breaker Box Location | Home Systems & Features | 155 | 178 | 7 | 171 | 0 | 354.3 | 0 | 0 | 178 |
| Photo Front Door Lock System | Photo Front Door Lock System | Entry & Access Details | 151 | 166 | 6 | 160 | 0 | 320.9 | 0 | 0 | 166 |
| Smoke Detector Model Number Photo | Smoke Detector Model Number Photo | Security & Monitoring | 154 | 190 | 14 | 176 | 0 | 310.5 | 0 | 0 | 190 |
| Photo of Pool Heater | Photo of Pool Heater | Pool and Hot Tub | 3 | 4 | 1 | 3 | 0 | 3.8 | 0 | 0 | 4 |
| **Total** | | | 1849 home-items | **2084** | 247 | 1836 | 3 | **4598.6** | 5 | 0 | **2076** |
How the copy would work: an Admin-only, resumable server runner like the ticket import. Per home it re-reads that one Notion page right before copying (so a Notion-hosted link is never older than a few seconds and is never saved), downloads each file, uploads it to Resolve's private file storage, records it as an internal home document, then attaches it to its item with the existing "add home photo" action (home + item + document). That attachment is exactly what the Home Profile reads to show a photo next to its label. Each file gets a key built from the Notion page, column and file, so a rerun never copies twice; failures are retried 3 times and listed. Resolve file storage grows from about 1.5 GB to about 6.1 GB.

## 3. Homes in one place but not the other

**In Notion, not in Resolve (5):**
| Notion page | OwnerRez ID | Notion status | Note |
|---|---|---|---|
| 6302 Meadow Path Way (Indianapolis, IN) | 501851 | In Preparation | created in Notion Nov 6; no Resolve home |
| 250 Springfield Xing (Avon, IN) | 497213 | In Preparation | created in Notion Sep 23; no Resolve home |
| (blank page, no title) | none | Live | created Nov 7, every field empty |
| C29-09 Horizon Suites, Sepang (test row) | none | blank | test row, excluded by decision |
| 21036 Owens Rd | 410153 | No Longer Managing | excluded by decision |

**In Resolve, not in Notion: 0.** Note: 8602 E. Galveston St. has its OwnerRez ID saved in Resolve with an "ORP" prefix (ORP497214); it matches once the prefix is ignored, but the first import's strict match skipped it.

**Address differences (street matches in all 161; 13 differ in city or zip):**
| Notion | Resolve | Difference |
|---|---|---|
| 1399 Foxtail Ln. (7D Max) | 1399 Foxtail Ln. | zip: Notion "46413" / Resolve "46143" |
| 2208 E. Toledo St. | 2208 E. Toledo St. | zip: Notion "74011" / Resolve "74012" |
| 85 Lower Green Way | 85 Lower Green Way | city: Notion "Carlton Landing" / Resolve "Eufaula" |
| 33 Center Lane S | 33 Center Lane S | zip: Notion "74432" / Resolve "74332" |
| 1722 Westchester Dr | 1722 Westchester Dr | city: Notion "Oklahoma City" / Resolve "The Village" |
| 417 Dauphin Ave. | 417 Dauphin Ave. | zip: Notion "73034" / Resolve "73003" |
| 4317 NW 19th | 4317 NW 19th | city: Notion "OKC" / Resolve "Oklahoma City" |
| 16216 Whistle Creek | 16216 Whistle Creek (30D Firm) | city: Notion "Edmond" / Resolve "Oklahoma City" |
| 2701 Berkshire Way | 2701 Berkshire Way | city: Notion "The Village" / Resolve "Oklahoma City" |
| 15905 Sky Run Dr. | 15905 Sky Run Dr. | zip: Notion "73013" / Resolve "73012" |
| 509 Houndstooth Dr (30D Firm) | 509 Houndstooth Dr (30D Firm) | city: Notion "Fort Worth" / Resolve "Ft. Worth" |
| 4816 Hazy Hollow Ln | 4816 Hazy Hollow Ln | city: Notion "Ft. Worth" / Resolve "Crowley" |
| 845 Alexandria | 845 Alexandria | zip: Notion "76058" / Resolve "76058-6216" |
Spelling only (no real difference): 4317 NW 19th (OKC / Oklahoma City), 509 Houndstooth Dr (Fort Worth / Ft. Worth), 845 Alexandria (zip+4). 1399 Foxtail Ln.'s Notion zip 46413 looks like a typo (OwnerRez 46143).

**Status differences (5):** 1399 Foxtail Ln., 3915 W 104th St. S. and 9211 Fitzgerald Dr. are Live in Notion but in Onboarding in Resolve. 7317 NW 159th Ter. is No Longer Managing in Notion and 3000 Meriweather Rd is Sold in Notion; both are active in Resolve.

## 4. How the Home Profile decides what to show

One list in Resolve holds the ten Notion sections, every Notion label in Notion's order, and where each label's value lives: a home field, a named part of a grouped home field, an encrypted code (by kind and name), a saved link (by the Notion column it came from), a photo attached to that item, a system value (address, area, map pin, status, handoff, edit history), or a linked list (inspections). A label shows when it has a value, a code on file, a link or a photo; empty labels hide behind Show empty fields. Yes/No values show as Yes or No, lists are joined with commas, dated notes show their text. Codes show only their name until the logged Show. A photo shows only when it has been attached to that item.

**Labels that show empty although Notion has a value, by cause:**

A. Import map excluded it (never imported):
- All 16 photo labels (2,076 files; see section 2), including Front Photo 157 homes, Breaker Box 155, Smoke Detector Model Number 154, Mailbox Location 154, Outdoor Water Shutoff 154, Router Location 153, Fridge Water Filter 153, Photo Front Door Lock System 151, Garage Remote 150, Yale Smart Module 119, Indoor Water Shutoff 110, Gas Fireplace Switch Location 83, Sprinkler Control Panel 69, Storm Shelter 33, Photo of Pool Heater 3, Hot Tub Control Panel 2.
- Covenants: 49 homes, 65 files in Notion; the page expects a link for this label.
- Home Inspection Schedule (121 homes) and Inspection Requests (137): left as Nothing here yet by your decision; their import comes later.

B. Field not imported yet:
- The 5 homes added after Sept 1: every label (132 values) and their codes (36 real codes: WiFi 5, door access 6, garage keypad 6, garage trim lockbox 6, closet supply box 6, storage closet 6, pool access 1).
- Yale is Not Calibrated: 18 homes. Notion renamed the column (a space was added to the end), so the import never matched it.
- Trash Valet: 32 homes say No in Notion and are blank in Resolve (filled in Notion after Sept 1).
- Smoke Detector Expiration: 15 homes with wording that is not a date ("Unknown", "10 years", and so on), held for review; plus the 5 new homes and 2 filled later.
- About 300 other values Notion filled in after Sept 1, 1 or 2 per label.

C. Wrong place (the value is in Resolve, the page reads another spot):
- HOA Notes (General): 66 homes. Saved under "notes + external_links" instead of "notes".
- Builder Warranty Claim Info: 108 homes. Saved under "claim_process + external_links" instead of "claim_process".
- Neighborhood Pool Access Key/Fob: 4 community/pool codes are saved as Gate/community codes, so they show under Other codes, not on this label.
- 5 files already stored sit on the Documents tab, not next to Front Photo or Covenants.

D. Not a gap (Notion has text but nothing to show):
- Code fields holding "N/A", "None" or a note without a code: Gate Code 144, Alarm Code 108, Closet Supply Box Code 95, Garage Trim Lockbox 64, Garage Keypad 63, Neighborhood Pool Access 69, Storage Closet 15, WiFi Password 5, Access Codes 2.
- Pool & Hot Tub Technician Form: 153 homes say "No pool or hot tub" or similar; only 8 have a form link and all 8 are in Resolve.
- Security Camera Feed: 57 homes have a note and no link (for example "Cameras are not connected"); 5 Ring account links are not saved as links.
- Furniture Pick List Link: 37 homes have a note and no link (for example "Owner Furnished"); 5 old OneDrive links are not saved.
- Not on the Home Profile by design: Listing Photos (146 links, OwnerRez photos win), Base Price, OwnerRez Order, Home ID, Status_, Notion formulas (Compliance, % Complete, What's Missing?, verification links, and so on) and the new Owner, Owner Email, Owner Phone, Vendors and Scheduling Due columns.

## 5. Estimate to close every gap (not started)

One second PID import, Admin-only, resumable, time-limited, in batches of 5 homes (33 batches), each batch re-reading its 5 Notion pages fresh:

| Part | Amount |
|---|---|
| Values to fill for the 5 unimported homes | 132 values + 36 codes (codes through the encrypted code path) |
| Values Notion filled or changed since Sept 1 | about 300 filled + 102 changed (Notion-owned fields only; OwnerRez-owned fields stay as they are) |
| Renamed column (Yale is Not Calibrated) and Trash Valet | 18 + 32 |
| Values to move to the spot the page reads | 66 HOA Notes + 108 Builder Warranty Claim Info + 4 pool codes |
| Photos and files to copy and attach next to their item | **2,076 files, about 4,590 MB** (plus 5 already stored to attach, 2 broken links to list) |
| Notion reads | about 165 (one per home, just before its files) |
| Per batch | about 63 files / 140 MB, about 2 to 3 minutes (timed sample: 0.46 s per file download, 3.6 MB/s; upload and attach roughly double it) |
| Total | about 70 to 100 minutes of running: 3 sittings under a 40-minute limit, resumable between them |

Before it runs: a fresh full backup with Verify, a dry run with counts, and the staged database step with undo for the value moves (register rule: database changes staged with undo, applied only on approval).

## Decisions for Emily
1. Notion edits after Sept 1 (about 300 filled, 102 changed): should Notion's value win in the second import for Notion-owned fields? No one has edited a Home Profile value in Resolve yet (0 edits), so nothing typed in Resolve would be lost today.
2. Wrong place (66 HOA Notes, 108 Builder Warranty Claim Info, 4 pool codes): move the values to the spot the page reads (data step with undo), or change the page to read the old spot. Recommended: move the values.
3. Covenants are files in Notion (65) but a link on the page: show the files next to the Covenants label.
4. Two homes only in Notion (6302 Meadow Path Way, 250 Springfield Xing, both In Preparation): add them through Onboarding's Add a home, or wait?
5. Status differences: 7317 NW 159th Ter. (No Longer Managing) and 3000 Meriweather Rd (Sold) are active in Resolve; Foxtail, 3915 W 104th and 9211 Fitzgerald are Live in Notion but Onboarding in Resolve. Which is right?
6. Fix 8602 E. Galveston St.'s OwnerRez ID (remove "ORP") as part of the second import?
7. Notes without links (57 camera notes, 37 pick list notes) and the 5 Ring and 5 OneDrive links: keep the note text next to the label, or leave out?
8. 4 HEIC photos may not preview in every browser: copy as they are, or convert?
9. 13 city/zip differences: OwnerRez stays the authority; correct the 5 real zip differences in OwnerRez?

### Home Profile labels empty in Resolve while Notion has a value (all labels)

| Section | Label | Notion has a value | Resolve shows it | Empty in Resolve |
|---|---|---|---|---|
| Home Inspections & Pending Maintenance | Home Inspection Schedule | 121 | 0 | 121 |
| Home Inspections & Pending Maintenance | Inspection Requests | 137 | 0 | 137 |
| Quick Overview | Property Nickname | 161 | 156 | 5 |
| Quick Overview | Airbnb Name | 156 | 150 | 6 |
| Quick Overview | Property Built Year | 161 | 155 | 6 |
| Quick Overview | Occupancy Limit | 160 | 158 | 3 |
| Quick Overview | Property Tier | 161 | 153 | 8 |
| Quick Overview | Parking | 161 | 156 | 5 |
| Quick Overview | Instant Book On | 83 | 156 | 1 |
| Quick Overview | Front Photo | 157 | 0 | 157 |
| Quick Overview | OR Property Link | 161 | 156 | 5 |
| Quick Overview | BW Property Link | 161 | 155 | 6 |
| Entry & Access Details | Smart Lock Brand | 157 | 152 | 5 |
| Entry & Access Details | Access Codes | 155 real codes | 149 | 6 |
| Entry & Access Details | Keys in Garage Lockbox | 155 | 149 | 6 |
| Entry & Access Details | Garage Trim Lockbox Code | 91 real codes | 85 | 6 |
| Entry & Access Details | Garage Keypad Code | 92 real codes | 86 | 6 |
| Entry & Access Details | Gate Code | 12 real codes | 12 | 0 |
| Entry & Access Details | Key Access Hole for Emergencies | 155 | 148 | 7 |
| Entry & Access Details | Photo Front Door Lock System | 151 | 0 | 151 |
| Entry & Access Details | Garage Remote Brand & Model | 155 | 148 | 7 |
| Entry & Access Details | Mailbox Number | 147 | 141 | 6 |
| Entry & Access Details | Mailbox Location Photo | 154 | 0 | 154 |
| Entry & Access Details | Cluster Mailbox? | 147 | 141 | 6 |
| Entry & Access Details | Cluster Mailbox Location | 147 | 141 | 6 |
| Entry & Access Details | Storage for Supplies | 155 | 148 | 7 |
| Entry & Access Details | Closet Supply Box Location | 154 | 147 | 7 |
| Entry & Access Details | Closet Supply Box Code | 60 real codes | 54 | 6 |
| Entry & Access Details | Storage Closet/Cabinet Code | 140 real codes | 134 | 6 |
| Home Profile | Home Has Fireplace? | 154 | 147 | 7 |
| Home Profile | Fireplace Type | 139 | 133 | 6 |
| Home Profile | Fireplace Brand & Model Number | 139 | 133 | 6 |
| Home Profile | Gas Fireplace Switch | 134 | 129 | 5 |
| Home Profile | Gas Fireplace Switch Location | 123 | 118 | 5 |
| Home Profile | Fireplace Instructions | 145 | 140 | 5 |
| Home Profile | Interior Paint | 154 | 147 | 7 |
| Home Profile | Home Grill | 155 | 148 | 7 |
| Home Profile | Office or Workstation? | 157 | 151 | 6 |
| Home Profile | TV Specs | 157 | 151 | 6 |
| Home Profile | Location of TVs? | 157 | 151 | 6 |
| Home Profile | Furniture Package | 161 | 156 | 5 |
| Home Profile | Furniture Warranty Expiration Date | 118 | 113 | 5 |
| Onboarding & Setup | WiFi Network Name | 157 | 152 | 5 |
| Onboarding & Setup | WiFi Password | 152 real codes | 147 | 5 |
| Onboarding & Setup | Router Location | 157 | 151 | 6 |
| Onboarding & Setup | Yale Smart Module | 157 | 150 | 7 |
| Onboarding & Setup | Yale is Not Calibrated | 18 | 0 | 18 |
| Onboarding & Setup | Builder Warranty? | 155 | 149 | 6 |
| Onboarding & Setup | Builder Warranty Expiration Date | 27 | 26 | 1 |
| Onboarding & Setup | Builder Warranty Claim Info | 113 | 0 | 113 |
| Onboarding & Setup | Furniture Pick List Link | 80 | 38 | 42 |
| Security & Monitoring | Alarm | 157 | 151 | 6 |
| Security & Monitoring | Alarm Code | 49 real codes | 49 | 0 |
| Security & Monitoring | Security Cameras | 157 | 151 | 6 |
| Security & Monitoring | Camera Battery Type | 157 | 151 | 6 |
| Security & Monitoring | Security Camera Feed | 156 | 94 | 62 |
| Security & Monitoring | Cameras Monitoring Plan | 156 | 150 | 6 |
| Security & Monitoring | Monitoring Plan Exp. Date | 108 | 103 | 5 |
| Security & Monitoring | Smoke Detector Brand | 154 | 147 | 7 |
| Security & Monitoring | Smoke Detector Notes | 155 | 148 | 7 |
| Security & Monitoring | Smoke Detector Expiration | 155 | 133 | 22 |
| Security & Monitoring | Smoke Detectors Power Type | 155 | 148 | 7 |
| Security & Monitoring | Smoke Detectors Battery Type | 155 | 148 | 7 |
| Security & Monitoring | Detectors Batteries Change Date | 155 | 148 | 7 |
| Security & Monitoring | Smoke Detector Model Number Photo | 154 | 0 | 154 |
| Security & Monitoring | Carbon Monoxide Detector Installed? | 154 | 147 | 7 |
| Security & Monitoring | Location of Carbon Monoxide Detector | 154 | 147 | 7 |
| Home Systems & Features | Breaker Box Location | 155 | 148 | 7 |
| Home Systems & Features | Indoor Water Shutoff Location | 146 | 140 | 6 |
| Home Systems & Features | Outdoor Water Shutoff Location | 155 | 148 | 7 |
| Home Systems & Features | Sprinkler System Brand | 145 | 138 | 7 |
| Home Systems & Features | Sprinkler System Location | 146 | 139 | 7 |
| Home Systems & Features | Sprinkler Control Panel Photo | 69 | 0 | 69 |
| Home Systems & Features | Sprinkler System Status | 156 | 149 | 7 |
| Home Systems & Features | Sprinkler System Set for Season? | 145 | 138 | 7 |
| Home Systems & Features | House has a 5 Year Old Fridge Water Filter | 153 | 146 | 7 |
| Home Systems & Features | Refrigerator Water Filter | 157 | 151 | 6 |
| Home Systems & Features | Photos of Refrigerator Water Filter and Type | 153 | 0 | 153 |
| Home Systems & Features | Storm Shelter Location & Access | 101 | 95 | 6 |
| Pool and Hot Tub | Backyard Pool / Hot Tub | 157 | 152 | 5 |
| Pool and Hot Tub | Heated Pool? | 7 | 6 | 1 |
| Pool and Hot Tub | Pool Heater Details | 5 | 4 | 1 |
| Pool and Hot Tub | Photo of Pool Heater | 3 | 0 | 3 |
| Pool and Hot Tub | Backyard Pool Season | 7 | 6 | 1 |
| Pool and Hot Tub | Backyard Pool Service Schedule | 7 | 6 | 1 |
| Pool and Hot Tub | Hot Tub Control Panel Location | 4 | 3 | 1 |
| Pool and Hot Tub | Pool & Hot Tub Technician Form | 161 | 8 | 153 |
| Property, Vendor, and Neighborhood Details | Neighborhood Name | 156 | 149 | 7 |
| Property, Vendor, and Neighborhood Details | HOA? | 152 | 146 | 6 |
| Property, Vendor, and Neighborhood Details | HOA Notes (General) | 72 | 0 | 72 |
| Property, Vendor, and Neighborhood Details | Covenants | 49 | 0 | 49 |
| Property, Vendor, and Neighborhood Details | Neighborhood Amenities? | 157 | 151 | 6 |
| Property, Vendor, and Neighborhood Details | Neighborhood Amenities Access Information | 151 | 145 | 6 |
| Property, Vendor, and Neighborhood Details | Neighborhood Pool Access Key/Fob | 7 real codes | 6 | 1 |
| Property, Vendor, and Neighborhood Details | Strict Trash Rules | 15 | 10 | 5 |
| Property, Vendor, and Neighborhood Details | Trash Day | 157 | 151 | 6 |
| Property, Vendor, and Neighborhood Details | Recycling Cart? | 157 | 151 | 6 |
| Property, Vendor, and Neighborhood Details | Recycling Day | 157 | 151 | 6 |
| Property, Vendor, and Neighborhood Details | Holiday Trash Day | 157 | 151 | 6 |
| Property, Vendor, and Neighborhood Details | Number of Trash Carts | 157 | 140 | 17 |
| Property, Vendor, and Neighborhood Details | Trash Valet | 157 | 123 | 34 |
| Property, Vendor, and Neighborhood Details | Mowing | 157 | 151 | 6 |
| Property, Vendor, and Neighborhood Details | Mowing Day | 152 | 147 | 5 |
| Maintenance & Upkeep | Air Filter Sizes | 157 | 151 | 6 |
| Documents and Media (Compliance) | Rental Restriction Notes | 39 | 33 | 6 |
| Documents and Media (Compliance) | Permit Review Status & Notes | 41 | 35 | 6 |
