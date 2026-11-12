-- UNDO for PID refresh 2026-11-12 apply.sql. Restores every touched column, provenance row and inserted link.
-- Each home's restore checks the columns still hold the applied values; any change aborts all.
BEGIN;

-- 1012 Wasatch Ct
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster model 893LM MC","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'cc77a4df-0fa2-466d-bd6d-8c4217e84b03'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster model 893LM MC","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1012 Wasatch Ct'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cc77a4df-0fa2-466d-bd6d-8c4217e84b03' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 10121 E. 131st Pl. S.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '4eca9876-0251-4bdc-9cd6-3c22af34fe75'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '10121 E. 131st Pl. S.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '4eca9876-0251-4bdc-9cd6-3c22af34fe75' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1016 NW 191st St
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Overhead door legacy 850","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '14830c3b-9874-4f6b-9de7-4cd891180ba4'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Overhead door legacy 850","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1016 NW 191st St'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '14830c3b-9874-4f6b-9de7-4cd891180ba4' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 10302 S. 230th East Ave
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie Intellicode Garage (G3T-BX G3T-R 3-Button)","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":false,"cart_count":2,"cart_notes":"2","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"No Recycling at this property"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '93223fe9-7ef9-49a6-868d-bb3d62e298b0'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie Intellicode Garage (G3T-BX G3T-R 3-Button)","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":false,"cart_count":2,"cart_notes":"2","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"No Recycling at this property","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '10302 S. 230th East Ave'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '93223fe9-7ef9-49a6-868d-bb3d62e298b0' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '93223fe9-7ef9-49a6-868d-bb3d62e298b0' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 10320 Lightning Creek Dr. (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Overhead garage door, Legacy 850","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"grill":"No Grill","tv_specs":"ROKU Pin: See Guest Access & Credentials","workstation":"Yes","tv_locations":["Primary Bedroom","Other"],"interior_paint":"Unknown"}}$pid$::jsonb)).facts,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"3 Car Garage","mailbox_number":"N/A","cluster_mailbox":false,"mailbox_location":"N/A"}}$pid$::jsonb)).parking,
      updated_at = now()
    WHERE id = '39a26e33-37b5-4009-a157-a24b13aca00c'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Overhead garage door, Legacy 850","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"grill":"No Grill","tv_specs":"ROKU Pin: [removed — credentials are not stored in Resolve]","workstation":"Yes","tv_locations":["Primary Bedroom","Other"],"interior_paint":"Unknown"}$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"3 Car Garage. Per the HOA cars can only be parked in the garage and driveway. Max of 3 cars in driveway. NO street parking.","mailbox_number":"N/A","cluster_mailbox":false,"mailbox_location":"N/A"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '10320 Lightning Creek Dr. (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '39a26e33-37b5-4009-a157-a24b13aca00c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-8061-a449-ced48929fc34', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '39a26e33-37b5-4009-a157-a24b13aca00c' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-8061-a449-ced48929fc34', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '39a26e33-37b5-4009-a157-a24b13aca00c' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';

-- 1039 Swinton Way
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Overhead doors/ Genie","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '97318d4f-137e-4647-b8e6-957836ffaa08'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Overhead doors/ Genie","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1039 Swinton Way'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '97318d4f-137e-4647-b8e6-957836ffaa08' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 105 Summit Bnd
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Access Master","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'cb686c69-2305-46ee-8d57-06a6181e4255'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Access Master","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '105 Summit Bnd'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cb686c69-2305-46ee-8d57-06a6181e4255' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 10549 SE 23rd St
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Not Connected","garage_remote":"Genie model 2028","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'e51e6c1f-2a21-4b2b-a495-54b9160649e2'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Not Connected","garage_remote":"Genie model 2028","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '10549 SE 23rd St'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e51e6c1f-2a21-4b2b-a495-54b9160649e2' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1056 Wildwood Drive
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Mailbox"],"yale_module":"Not Connected","garage_remote":"Any 3 button universal remote should pair.","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '9a82f157-3e48-47f4-ad58-ceca4b38fd02'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Mailbox"],"yale_module":"Not Connected","garage_remote":"Any 3 button universal remote should pair.","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1056 Wildwood Drive'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9a82f157-3e48-47f4-ad58-ceca4b38fd02' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1068 Berrywood Dr.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '8f14ad4c-0264-4114-af90-848989e03521'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1068 Berrywood Dr.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8f14ad4c-0264-4114-af90-848989e03521' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 10845 Sara Ct
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'e6e698a1-3c38-49e4-a877-3bf00894bf21'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '10845 Sara Ct'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e6e698a1-3c38-49e4-a877-3bf00894bf21' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 11109 SW 34th Terrace
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Eufy","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'c7d75c26-103e-40c0-9e0f-79d8f1fd6c94'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Eufy","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11109 SW 34th Terrace'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'c7d75c26-103e-40c0-9e0f-79d8f1fd6c94' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 11249 Pegasus Dr.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"yale_integration_live":false}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{}}$pid$::jsonb)).amenities,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{}}$pid$::jsonb)).facts,
      fireplace = (jsonb_populate_record(NULL::public.properties, $pid${"fireplace":{}}$pid$::jsonb)).fireplace,
      grounds = (jsonb_populate_record(NULL::public.properties, $pid${"grounds":{}}$pid$::jsonb)).grounds,
      hoa = (jsonb_populate_record(NULL::public.properties, $pid${"hoa":{}}$pid$::jsonb)).hoa,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{}}$pid$::jsonb)).hvac,
      legacy_handoff_date = (jsonb_populate_record(NULL::public.properties, $pid${"legacy_handoff_date":null}$pid$::jsonb)).legacy_handoff_date,
      listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":null}$pid$::jsonb)).listing_alias,
      neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":null}$pid$::jsonb)).neighborhood,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"2 Car Garage\nFree Parking on Premises"}}$pid$::jsonb)).parking,
      pool_spa = (jsonb_populate_record(NULL::public.properties, $pid${"pool_spa":{}}$pid$::jsonb)).pool_spa,
      security = (jsonb_populate_record(NULL::public.properties, $pid${"security":{}}$pid$::jsonb)).security,
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{}}$pid$::jsonb)).sprinklers,
      storm_shelter = (jsonb_populate_record(NULL::public.properties, $pid${"storm_shelter":{}}$pid$::jsonb)).storm_shelter,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{}}$pid$::jsonb)).systems,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_split_confirmed":false}}$pid$::jsonb)).utilities,
      warranty = (jsonb_populate_record(NULL::public.properties, $pid${"warranty":{}}$pid$::jsonb)).warranty,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"yale_integration_live":false,"emergency_key_access":"Yes","garage_remote":"Genie https://www.amazon.com/dp/B0DH81245P?ref=fed_asin_title&th=1","key_storage":["Garage Door","Front Door/Smartlock","Front Door - Storm Door"],"lock_brand":"Yale","yale_module":"Connected & Setup","yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"access_notes":"No key necessary","list":["Basketball Court","Pond"]}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"grill":"No Grill","interior_paint":"Yes (Top shelf in the garage)","tv_locations":["Living Room","Primary Bedroom"],"tv_specs":"65\" Roku in Living Room, logged into Roku / 55\" Roku in Primary Bedroom, logged into Roku (Roku is also the TV brand)","workstation":"Yes"}$pid$::jsonb
      AND to_jsonb(fireplace) IS NOT DISTINCT FROM $pid${"fuel_type":"N/A","gas_switch":"N/A","gas_switch_location":"N/A","instructions":"N/A","model":"N/A","present":false}$pid$::jsonb
      AND to_jsonb(grounds) IS NOT DISTINCT FROM $pid${"mowing_cadence":"ARHA Responsible","mowing_days":["Tuesday"]}$pid$::jsonb
      AND to_jsonb(hoa) IS NOT DISTINCT FROM $pid${"notes + external_links":"Waterman Farms HOA: no RVs/commercial vehicles parked on the street, garage must remain usable for parking, no above-ground pools.","present":true}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"14x24x1\nThis air filter is not a paper filter, the filter is metal and must be rinsed and dried fully when cleaning.\nRinse the metal air filter every 90 days (more often with pets or heavy dust); no need to replace it unless damaged.","filter_sizes":["14x24x1"]}$pid$::jsonb
      AND to_jsonb(legacy_handoff_date) IS NOT DISTINCT FROM $pid$"2026-10-02"$pid$::jsonb
      AND to_jsonb(listing_alias) IS NOT DISTINCT FROM $pid$"3BR Home, Noblesville | Extended & Monthly Stays"$pid$::jsonb
      AND to_jsonb(neighborhood) IS NOT DISTINCT FROM $pid$"Waterman Farms"$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"This air filter is not a paper filter, the filter is metal and must be rinsed and dried fully when cleaning.\n\nWater spicket in the backyard was repaired, however it could leak in the future over time."$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"2 Car Garage\nFree Parking on Premises","cluster_mailbox":false,"mailbox_location":"N/A","mailbox_number":"N/A"}$pid$::jsonb
      AND to_jsonb(pool_spa) IS NOT DISTINCT FROM $pid${"present":"None"}$pid$::jsonb
      AND to_jsonb(security) IS NOT DISTINCT FROM $pid${"alarm":"No","battery_type":["Hardwired - No Battery"],"devices":["Driveway","Front Door"],"monitoring_expires_on":"2027-10-08","monitoring_plan":["Active"]}$pid$::jsonb
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${"brand":"N/A","controller_location":"N/A","set_for_season":{"value":"N/A","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid"},"status":"Property Does Not Have Sprinkler System"}$pid$::jsonb
      AND to_jsonb(storm_shelter) IS NOT DISTINCT FROM $pid${"location_access":"N/A"}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"breaker_panel_location":"Garage","co":{"installed":true,"location":"Kitchen"},"fridge_filter":"EveryDrop Filter 1 (EDR1RXD1)","fridge_filter_5yr":false,"smoke":{"batteries_changed_on":"2026-09-21","battery_type":"9-Volt (Lithium)","brand":"First Alert (7 units)","expires_on":"2036-12-31","expires_precision":"year","expires_source_text":"2036","notes":"N/A","power_type":"Hardwired"},"supply_box_location":"Top shelf of master closet","supply_storage":"Closet","water_shutoff_indoor":"Laundry room","water_shutoff_outdoor":"Front yard"}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_split_confirmed":false,"router_location":"In the living room","wifi_ssid":"ARHA"}$pid$::jsonb
      AND to_jsonb(warranty) IS NOT DISTINCT FROM $pid${"builder_present":false,"claim_process + external_links":"N/A","furniture_expires_on":"2029-10-02"}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"cart_count":2,"cart_notes":"2","holiday_notes":"Service is delayed one day on: New Year's Day • Memorial Day • July 4th • Labor Day • Thanksgiving Day • Christmas Day","recycling":true,"recycling_days":"Every other Monday","strict_rules":"N/A","trash_days":["Monday"],"valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'access.emergency_key_access' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'access.garage_remote' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'access.key_storage' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'access.lock_brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'amenities.list' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'facts.grill' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'facts.interior_paint' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'facts.tv_locations' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'facts.workstation' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'fireplace.fuel_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'fireplace.gas_switch' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'fireplace.gas_switch_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'fireplace.instructions' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'fireplace.model' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'fireplace.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'grounds.mowing_cadence' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'grounds.mowing_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'hoa.notes + external_links' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'hoa.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'hvac.filter_sizes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'legacy_handoff_date' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'listing_alias' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'neighborhood' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'parking.cluster_mailbox' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'parking.mailbox_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'parking.mailbox_number' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'pool_spa.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'security.alarm' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'security.battery_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'security.devices' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'security.monitoring_expires_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'security.monitoring_plan' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'sprinklers.brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'sprinklers.controller_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'sprinklers.set_for_season' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'sprinklers.status' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'storm_shelter.location_access' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.breaker_panel_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.co.installed' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.co.location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.fridge_filter_5yr' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.smoke.battery_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.smoke.brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.smoke.expires_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.smoke.expires_precision' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.smoke.expires_source_text' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.smoke.notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.smoke.power_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.supply_box_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.supply_storage' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.water_shutoff_indoor' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.water_shutoff_outdoor' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'utilities.router_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'utilities.wifi_ssid' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'warranty.builder_present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'warranty.claim_process + external_links' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'warranty.furniture_expires_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'waste.cart_count' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'waste.cart_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'waste.holiday_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'waste.recycling' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'waste.recycling_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'waste.strict_rules' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'waste.trash_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 11508 E 94th Pl N
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Overhead door","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":false,"cart_count":1,"cart_notes":"1","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"None: Drop off at recycling center"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '53aed118-974e-4f01-8c7d-ca901677b6d7'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Overhead door","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":false,"cart_count":1,"cart_notes":"1","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"None: Drop off at recycling center","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11508 E 94th Pl N'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '53aed118-974e-4f01-8c7d-ca901677b6d7' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '53aed118-974e-4f01-8c7d-ca901677b6d7' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 11514 S. Locust Ave
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}}$pid$::jsonb)).waste,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"The owner has a membership with \nAmerican Home Pros\n for annual tune ups (HVAC). For general maintenance you can try them, but from past experience, their pricing is high."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '75bc895c-4401-4080-9df7-748efe8f04f1'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"The owner has a membership with \nAmerican Home Pros for annual tune ups (HVAC). For general maintenance you can try them, but from past experience, their pricing is high. \nUpdate: We have free service calls from them until July 2027 please make sure they are the first point of contact for any HVAC related issues."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11514 S. Locust Ave'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '75bc895c-4401-4080-9df7-748efe8f04f1' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '75bc895c-4401-4080-9df7-748efe8f04f1' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80eb-8851-d5c58fdd8485', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '75bc895c-4401-4080-9df7-748efe8f04f1' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 1152 Western Yarrow Ave
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Mailbox"],"yale_module":"Connected & Setup","garage_remote":"Rain bird","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"Not Mentioned"}}$pid$::jsonb)).hvac,
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{"status":"Property Does Not Have Sprinkler System"}}$pid$::jsonb)).sprinklers,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Kitchen island","installed":true},"smoke":{"brand":"First alert","notes":"None","expires_on":"2033-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Alkaline)","expires_precision":"year","expires_source_text":"2033","batteries_changed_on":"2026-02-02"},"fridge_filter":"GE XWFE Refrigerator Water Filter","supply_storage":"Cabinet","fridge_filter_5yr":false,"supply_box_location":"Entry way","water_shutoff_indoor":"Garage","water_shutoff_outdoor":"On curb to the right when looking at the house","breaker_panel_location":"In garage"}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Mailbox"],"yale_module":"Connected & Setup","garage_remote":"Rain bird","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"20x25x4","filter_sizes":["20x25x4"]}$pid$::jsonb
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${"status":"Property Has Sprinkler System and It's On","brand":"Rain bird","controller_location":"Garage","set_for_season":{"value":"N/A","as_of":"2026-11-03T22:21:00.000Z","source":"notion_pid"}}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Kitchen island","installed":true},"smoke":{"brand":"First alert","notes":"None","expires_on":"2033-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Alkaline)","expires_precision":"year","expires_source_text":"2033","batteries_changed_on":"2026-09-16"},"fridge_filter":"GE XWFE Refrigerator Water Filter","supply_storage":"Cabinet","fridge_filter_5yr":false,"supply_box_location":"Entry way","water_shutoff_indoor":"Garage","water_shutoff_outdoor":"On curb to the right when looking at the house","breaker_panel_location":"In garage"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1152 Western Yarrow Ave'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND field_key = 'hvac.filter_sizes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND field_key = 'sprinklers.brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND field_key = 'sprinklers.controller_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND field_key = 'sprinklers.set_for_season' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND field_key = 'sprinklers.status' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';

-- 1169 Blue Sky Lane
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Linear Model: MCT-3","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Kitchen","installed":true},"smoke":{"brand":"First alert","notes":"One smoke alarm was missing we replaced it.","expires_on":"2033-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Lithium)","expires_precision":"year","expires_source_text":"2033","batteries_changed_on":"2025-10-29"},"fridge_filter":"FPPWFU01","supply_storage":"Cabinet","fridge_filter_5yr":false,"supply_box_location":"Primary bedroom closet.","water_shutoff_indoor":"Unsure","water_shutoff_outdoor":"Unsure","breaker_panel_location":"Garage."}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = '1be61e2e-6ca3-41f4-93de-2fe22f440267'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Linear Model: MCT-3","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Kitchen","installed":true},"smoke":{"brand":"First alert","notes":"One smoke alarm was missing we replaced it.","expires_on":"2033-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Lithium)","expires_precision":"year","expires_source_text":"2033","batteries_changed_on":"2026-09-17"},"fridge_filter":"FPPWFU01","supply_storage":"Cabinet","fridge_filter_5yr":false,"supply_box_location":"Primary bedroom closet.","water_shutoff_indoor":"Unsure","water_shutoff_outdoor":"Unsure","breaker_panel_location":"Garage."}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1169 Blue Sky Lane'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1be61e2e-6ca3-41f4-93de-2fe22f440267' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-8065-b0e0-f007b0cb0a2e', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '1be61e2e-6ca3-41f4-93de-2fe22f440267' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';

-- 11720 NW 136th Ter
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Lift Master 953ESTD","emergency_key_access":"No","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '5e230772-bbb1-4558-86c9-46e6ad024d3d'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Lift Master 953ESTD","emergency_key_access":"No","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11720 NW 136th Ter'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '5e230772-bbb1-4558-86c9-46e6ad024d3d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 11736 SW 15th Terr (30D Firm)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Storage Closet","Backdoor"],"yale_module":"Not Connected","garage_remote":"Chamberlain LiftMaster Craftsman Garage Door Opener Remote 893LM 893Max 971LM Universal","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '70d06d5c-d358-4452-ac9a-1fa22b68ce20'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Storage Closet","Backdoor"],"yale_module":"Not Connected","garage_remote":"Chamberlain LiftMaster Craftsman Garage Door Opener Remote 893LM 893Max 971LM Universal","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11736 SW 15th Terr (30D Firm)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '70d06d5c-d358-4452-ac9a-1fa22b68ce20' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1215 N Elder Ave
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Lift master","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '7a65ee79-900e-414d-a496-bb2077d6046c'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Lift master","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1215 N Elder Ave'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '7a65ee79-900e-414d-a496-bb2077d6046c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '7a65ee79-900e-414d-a496-bb2077d6046c' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 13117 NE 9th St
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'bd5becd5-c66c-4691-8b41-1a62eac826e0'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '13117 NE 9th St'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bd5becd5-c66c-4691-8b41-1a62eac826e0' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 13317 Brampton Way
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie garage opener model 2028 & genie opener","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '5dd44c1d-65f8-465e-b29e-fa8f8ba3e617'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie garage opener model 2028 & genie opener","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '13317 Brampton Way'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '5dd44c1d-65f8-465e-b29e-fa8f8ba3e617' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 13325 E 43rd Pl S
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Storage Closet","Backdoor","Front Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Tuesday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'c92c13e5-27d8-4f4e-b0e8-59638169a140'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Storage Closet","Backdoor","Front Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Tuesday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '13325 E 43rd Pl S'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'c92c13e5-27d8-4f4e-b0e8-59638169a140' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'c92c13e5-27d8-4f4e-b0e8-59638169a140' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 136 Magnolia Estates St
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Counter kitchen","installed":false},"smoke":{"brand":"First alert","notes":"None","expires_on":"2033-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Alkaline)","expires_precision":"year","expires_source_text":"2033","batteries_changed_on":"2025-08-13"},"fridge_filter":"Fppwfu01","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"None","water_shutoff_outdoor":"On side walk","breaker_panel_location":"Outside left"}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = 'e7f578f0-4000-4a80-b6d0-70bf2bc45122'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Counter kitchen","installed":false},"smoke":{"brand":"First alert","notes":"None","expires_on":"2033-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Alkaline)","expires_precision":"year","expires_source_text":"2033","batteries_changed_on":"2026-09-04"},"fridge_filter":"Fppwfu01","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"None","water_shutoff_outdoor":"On side walk","breaker_panel_location":"Outside left"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '136 Magnolia Estates St'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e7f578f0-4000-4a80-b6d0-70bf2bc45122' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-8008-bbe8-f5c98ca070dd', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'e7f578f0-4000-4a80-b6d0-70bf2bc45122' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';

-- 1399 Foxtail Ln.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{}}$pid$::jsonb)).amenities,
      compliance = (jsonb_populate_record(NULL::public.properties, $pid${"compliance":{}}$pid$::jsonb)).compliance,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{}}$pid$::jsonb)).external_refs,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{}}$pid$::jsonb)).facts,
      fireplace = (jsonb_populate_record(NULL::public.properties, $pid${"fireplace":{}}$pid$::jsonb)).fireplace,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package,
      grounds = (jsonb_populate_record(NULL::public.properties, $pid${"grounds":{}}$pid$::jsonb)).grounds,
      hoa = (jsonb_populate_record(NULL::public.properties, $pid${"hoa":{}}$pid$::jsonb)).hoa,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{}}$pid$::jsonb)).hvac,
      listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":null}$pid$::jsonb)).listing_alias,
      market = (jsonb_populate_record(NULL::public.properties, $pid${"market":null}$pid$::jsonb)).market,
      neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":null}$pid$::jsonb)).neighborhood,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{}}$pid$::jsonb)).parking,
      pool_spa = (jsonb_populate_record(NULL::public.properties, $pid${"pool_spa":{}}$pid$::jsonb)).pool_spa,
      security = (jsonb_populate_record(NULL::public.properties, $pid${"security":{}}$pid$::jsonb)).security,
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{}}$pid$::jsonb)).sprinklers,
      storm_shelter = (jsonb_populate_record(NULL::public.properties, $pid${"storm_shelter":{}}$pid$::jsonb)).storm_shelter,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{}}$pid$::jsonb)).systems,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{}}$pid$::jsonb)).utilities,
      warranty = (jsonb_populate_record(NULL::public.properties, $pid${"warranty":{}}$pid$::jsonb)).warranty,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{}}$pid$::jsonb)).waste,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"emergency_key_access":"Yes","garage_remote":"LiftMaster","key_storage":["Mailbox","Front Door/Smartlock","Backdoor","Storage Closet","Back Door - Storm Door"],"lock_brand":"Yale","yale_integration_live":false,"yale_module":"Connected & Setup","yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"access_notes":"The CC&Rs do not list specific amenities, access instructions, or fees. The neighborhood ponds are for drainage and views only; swimming, ice skating, and boating are not permitted.","list":["Pond"]}$pid$::jsonb
      AND to_jsonb(compliance) IS NOT DISTINCT FROM $pid${"permit_status":{"text":"No permit required for Greenwood, IN","as_of":"2026-11-05T17:51:00.000Z","source":"notion_pid","reference_only":true},"rental_restrictions":{"text":"No STR rental restrictions","as_of":"2026-11-05T17:51:00.000Z","source":"notion_pid","reference_only":true}}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${"breezeway_url":"https://app.breezeway.io/property/1494604/profile"}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"grill":"No Grill","interior_paint":"Unknown. No extra paint left","tv_locations":["Living Room","Primary Bedroom"],"tv_specs":"55\" Roku QLED TV in Primary Bedroom, logged into Roku. 65\" Roku QLED TV in Living Room, logged into Roku.","workstation":"No"}$pid$::jsonb
      AND to_jsonb(fireplace) IS NOT DISTINCT FROM $pid${"fuel_type":"N/A","gas_switch":"N/A","gas_switch_location":"N/A","instructions":"N/A","model":"N/A","present":false}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb
      AND to_jsonb(grounds) IS NOT DISTINCT FROM $pid${"mowing_cadence":"ARHA Responsible","mowing_days":["Monday"]}$pid$::jsonb
      AND to_jsonb(hoa) IS NOT DISTINCT FROM $pid${"notes + external_links":"The HOA for Lone Pine Farms is administered by Ardsley Management, which can be reached at (317) 253-1401 or via email at indianapolisinfo@drhorton.com.","present":true}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"1 -16×25×4","filter_sizes":["16x25x4"]}$pid$::jsonb
      AND to_jsonb(listing_alias) IS NOT DISTINCT FROM $pid$"Cozy 4BR Home | Greenwood | Pet Friendly"$pid$::jsonb
      AND to_jsonb(market) IS NOT DISTINCT FROM $pid$"Indy"$pid$::jsonb
      AND to_jsonb(neighborhood) IS NOT DISTINCT FROM $pid$"Lone Pine Farms"$pid$::jsonb
      AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"Foxtail Hollow (1399)"$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"No"$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"cluster_mailbox":true,"mailbox_location":"The cluster mailbox #1399 is at the corner of Foxtail Ln and Sumatran Ln, a short walk east of the house. Key is located inside the lock box on the garage trim.","mailbox_number":"1399","summary":"2 Car Garage\nFree Parking on Premises"}$pid$::jsonb
      AND to_jsonb(pool_spa) IS NOT DISTINCT FROM $pid${"present":"None"}$pid$::jsonb
      AND to_jsonb(security) IS NOT DISTINCT FROM $pid${"alarm":"No","battery_type":["Hardwired - No Battery"],"devices":["Front Door","Driveway"],"monitoring_expires_on":"2027-11-15","monitoring_plan":["Active"]}$pid$::jsonb
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${"brand":"N/A","controller_location":"N/A","set_for_season":{"value":"N/A","as_of":"2026-11-05T17:51:00.000Z","source":"notion_pid"},"status":"Property Does Not Have Sprinkler System"}$pid$::jsonb
      AND to_jsonb(storm_shelter) IS NOT DISTINCT FROM $pid${"location_access":"N/A"}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"breaker_panel_location":"Garage","co":{"installed":true,"location":"Kitchen"},"fridge_filter":"EDR1RXD1 (Everydrop Filter 1 / Whirlpool W10295370A compatible)","fridge_filter_5yr":false,"smoke":{"batteries_changed_on":"2026-10-22","battery_type":"9-Volt (Lithium)","brand":"First alert","expires_on":"2034-12-31","expires_precision":"year","expires_source_text":"2034","notes":"N/A","power_type":"Hardwired"},"supply_box_location":"Top shelf of Master closet","supply_storage":"Closet","water_shutoff_indoor":"Closet with furnace","water_shutoff_outdoor":"Near sidewalk"}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"router_location":"Living room","wifi_split_confirmed":false,"wifi_ssid":"ARHA"}$pid$::jsonb
      AND to_jsonb(warranty) IS NOT DISTINCT FROM $pid${"builder_present":false,"claim_process + external_links":"N/A","furniture_expires_on":"2029-11-04"}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"cart_count":2,"cart_notes":"2 trash cans and 1 recycling","holiday_notes":"If one of the following holidays falls on a Monday through Thursday, trash pickup will be delayed by one day one day: New Year's Day • Memorial Day • July 4th • Labor Day • Thanksgiving Day • Christmas Day","recycling":true,"recycling_days":"Every other Thursday.","strict_rules":"N/A","trash_days":["Thursday"],"valet":"No"}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2024$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'access.emergency_key_access' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'access.garage_remote' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'access.key_storage' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'access.lock_brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'amenities.list' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'compliance.permit_status' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'compliance.rental_restrictions' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'facts.grill' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'facts.interior_paint' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'facts.tv_locations' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'facts.workstation' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'fireplace.fuel_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'fireplace.gas_switch' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'fireplace.gas_switch_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'fireplace.instructions' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'fireplace.model' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'fireplace.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'grounds.mowing_cadence' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'grounds.mowing_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'hoa.notes + external_links' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'hoa.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'hvac.filter_sizes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'listing_alias' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'market' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'neighborhood' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'parking.cluster_mailbox' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'parking.mailbox_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'parking.mailbox_number' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'pool_spa.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'security.alarm' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'security.battery_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'security.devices' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'security.monitoring_expires_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'security.monitoring_plan' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'sprinklers.brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'sprinklers.controller_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'sprinklers.set_for_season' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'sprinklers.status' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'storm_shelter.location_access' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.breaker_panel_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.co.installed' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.co.location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.fridge_filter_5yr' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.smoke.battery_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.smoke.brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.smoke.expires_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.smoke.expires_precision' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.smoke.expires_source_text' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.smoke.notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.smoke.power_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.supply_box_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.supply_storage' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.water_shutoff_indoor' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.water_shutoff_outdoor' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'utilities.router_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'utilities.wifi_ssid' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'warranty.builder_present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'warranty.claim_process + external_links' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'warranty.furniture_expires_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'waste.cart_count' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'waste.cart_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'waste.holiday_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'waste.recycling' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'waste.recycling_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'waste.strict_rules' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'waste.trash_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';

-- 14553 Serrano Ridge Rd
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster 38OUT","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Kitchen counter","installed":true},"smoke":{"brand":"First alert","notes":"We are changing them today.","expires_on":"2025-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Lithium)","expires_precision":"year","expires_source_text":"2025","batteries_changed_on":"2025-10-16"},"fridge_filter":"Not Mentioned","supply_storage":"N/A","fridge_filter_5yr":false,"supply_box_location":"None","water_shutoff_indoor":"Unsure","water_shutoff_outdoor":"Unsure","breaker_panel_location":"Garage"}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = 'dafa6257-99d1-4a71-9e18-b02394c6807d'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster 380 UT","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Kitchen counter","installed":true},"smoke":{"brand":"First alert","notes":"We are changing them today.","expires_on":"2025-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Lithium)","expires_precision":"year","expires_source_text":"2025","batteries_changed_on":"2026-09-08"},"fridge_filter":"Not Mentioned","supply_storage":"N/A","fridge_filter_5yr":false,"supply_box_location":"None","water_shutoff_indoor":"Unsure","water_shutoff_outdoor":"Unsure","breaker_panel_location":"Garage"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '14553 Serrano Ridge Rd'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'dafa6257-99d1-4a71-9e18-b02394c6807d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80a5-88d4-ec54ad9b0530', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'dafa6257-99d1-4a71-9e18-b02394c6807d' AND field_key = 'access.garage_remote' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80a5-88d4-ec54ad9b0530', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'dafa6257-99d1-4a71-9e18-b02394c6807d' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';

-- 1464 Buckland Ct.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{}}$pid$::jsonb)).access,
      compliance = (jsonb_populate_record(NULL::public.properties, $pid${"compliance":{}}$pid$::jsonb)).compliance,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{}}$pid$::jsonb)).external_refs,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package,
      market = (jsonb_populate_record(NULL::public.properties, $pid${"market":null}$pid$::jsonb)).market,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{}}$pid$::jsonb)).parking,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{}}$pid$::jsonb)).utilities,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(compliance) IS NOT DISTINCT FROM $pid${"permit_status":{"text":"No permit required for Avon, IN","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true},"rental_restrictions":{"text":"No STR rental restrictions","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${"breezeway_url":"https://app.breezeway.io/property/1509882/profile"}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb
      AND to_jsonb(market) IS NOT DISTINCT FROM $pid$"Indy"$pid$::jsonb
      AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"The Buckland Blue (1464)"$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"2 Car Garage\nFree Parking on Premises"}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_split_confirmed":false}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2021$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1464 Buckland Ct.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'compliance.permit_status' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'compliance.rental_restrictions' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'market' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';

-- 15226 High Timber Ln
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '4cf72297-dd39-4c26-b7ad-006a38923d1b'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '15226 High Timber Ln'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '4cf72297-dd39-4c26-b7ad-006a38923d1b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 15701 E 75th Pl N
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Not Connected","garage_remote":"Lifmaster","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":false,"cart_count":2,"cart_notes":"2","trash_days":["Friday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"None: Drop off at recycling center"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'eeb11e56-921e-4f30-95ef-f044b21b85c2'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Lifmaster","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":false,"cart_count":2,"cart_notes":"2","trash_days":["Friday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"None: Drop off at recycling center","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '15701 E 75th Pl N'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'eeb11e56-921e-4f30-95ef-f044b21b85c2' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'eeb11e56-921e-4f30-95ef-f044b21b85c2' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80ad-b194-d8d87cdbda74', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'eeb11e56-921e-4f30-95ef-f044b21b85c2' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';

-- 15905 Sky Run Dr.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Schlage","key_storage":["Front Door/Smartlock"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Genie Pro ScrewDrive CM8600IC/A","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '10ba8ab8-a497-4a28-b5b7-7d5b01b78782'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Schlage","key_storage":["Front Door/Smartlock"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Genie Pro ScrewDrive CM8600IC/A","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '15905 Sky Run Dr.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '10ba8ab8-a497-4a28-b5b7-7d5b01b78782' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1600 E Quantico St
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","yale_module":"Connected & Setup","yale_integration_live":true}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":"Not Mentioned","cart_notes":"Not Mentioned","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Tuesday"}}$pid$::jsonb)).waste,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"tv_specs":"Smart TV ROKU Pin: See Guest Access & Credentials","workstation":"Not Mentioned","tv_locations":["Primary Bedroom","Living Room"]}}$pid$::jsonb)).facts,
      updated_at = now()
    WHERE id = 'cf867f48-f4df-4710-9e49-10bb17b41ed4'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","yale_module":"Connected & Setup","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":"Not Mentioned","cart_notes":"Not Mentioned","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Tuesday","valet":"No"}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"tv_specs":"Smart TV ROKU Pin: [removed — credentials are not stored in Resolve]","workstation":"Not Mentioned","tv_locations":["Primary Bedroom","Living Room"]}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1600 E Quantico St'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cf867f48-f4df-4710-9e49-10bb17b41ed4' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'cf867f48-f4df-4710-9e49-10bb17b41ed4' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80f9-988d-d0d7a4f962ac', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'cf867f48-f4df-4710-9e49-10bb17b41ed4' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';

-- 16216 Whistle Creek (30D Firm)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '7e4f8893-7b8d-482c-9906-455fa8cd6367'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '16216 Whistle Creek (30D Firm)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '7e4f8893-7b8d-482c-9906-455fa8cd6367' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1636 NE 32nd St.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"DoorTec and LiftMaster","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '8f21dd67-0732-413a-9fa3-67ec2e59e7bf'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"DoorTec and LiftMaster","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1636 NE 32nd St.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8f21dd67-0732-413a-9fa3-67ec2e59e7bf' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1640 Glade Meadows Dr
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Mailbox"],"yale_module":"Connected & Setup","garage_remote":"Genie/","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '62a2d14c-0081-425f-943c-1b2de5bddf70'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Mailbox"],"yale_module":"Connected & Setup","garage_remote":"Genie/","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1640 Glade Meadows Dr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '62a2d14c-0081-425f-943c-1b2de5bddf70' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 16401 Villa Valeria Way (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"DoorTec","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'a28336e4-ebd6-4af4-8786-f5d7c8eab058'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"DoorTec","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '16401 Villa Valeria Way (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a28336e4-ebd6-4af4-8786-f5d7c8eab058' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1700 NW 179th Ter (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Lift Master","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '047e01ba-eb27-42a3-be1b-eab929f8b970'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Lift Master","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1700 NW 179th Ter (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '047e01ba-eb27-42a3-be1b-eab929f8b970' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1700 Whispering Creek Dr
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"PythonOpener/Genie Remotes","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"grill":"Charcoal Grill","tv_specs":"ROKU Pin: See Guest Access & Credentials\nROKU Email: \ncdunham1119@gmail.com","workstation":"No","tv_locations":["Primary Bedroom","Living Room"],"interior_paint":"Unsure"}}$pid$::jsonb)).facts,
      updated_at = now()
    WHERE id = '96e08138-1c9e-4297-8da8-a6ae1a2f52d7'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"PythonOpener/Genie Remotes","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"grill":"Charcoal Grill","tv_specs":"ROKU Pin: [removed — credentials are not stored in Resolve]\nROKU Email: \ncdunham1119@gmail.com","workstation":"No","tv_locations":["Primary Bedroom","Living Room"],"interior_paint":"Unsure"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1700 Whispering Creek Dr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '96e08138-1c9e-4297-8da8-a6ae1a2f52d7' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '96e08138-1c9e-4297-8da8-a6ae1a2f52d7' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80df-84c1-de33f73dc3ee', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '96e08138-1c9e-4297-8da8-a6ae1a2f52d7' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';

-- 1701 Park Lane Dr.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Eufy","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '549229b6-9f29-4c3d-a74b-3746500d56f4'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Eufy","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1701 Park Lane Dr.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '549229b6-9f29-4c3d-a74b-3746500d56f4' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1722 Westchester Dr
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Kwikset","key_storage":["Front Door/Smartlock","Storage Closet"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"No opener - The garage at this property is compact and does not accommodate a standard vehicle. It is best suited for storage or as additional flex space. Driveway and street parking are available for guest vehicles.","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = 'c2dfe50d-2428-4cfe-b6d7-ca54578a17d1'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Kwikset","key_storage":["Front Door/Smartlock","Storage Closet"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"No opener - The garage at this property is compact and does not accommodate a standard vehicle. It is best suited for storage or as additional flex space. Driveway and street parking are available for guest vehicles.","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1722 Westchester Dr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'c2dfe50d-2428-4cfe-b6d7-ca54578a17d1' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80a7-bae8-f6d0a003b669', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'c2dfe50d-2428-4cfe-b6d7-ca54578a17d1' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 17404 Zinc Dr.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Lock box","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Lift master P3","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '7f279df3-ca27-49ba-bac8-2393b1fc427c'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Lock box","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Lift master P3","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '17404 Zinc Dr.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '7f279df3-ca27-49ba-bac8-2393b1fc427c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 18000 Barracho Dr (30D)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'c0e2b66a-4394-4aa4-b6c5-a9ed4ec6d317'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '18000 Barracho Dr (30D)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'c0e2b66a-4394-4aa4-b6c5-a9ed4ec6d317' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 18104 Calle Way (12M)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Eufy","key_storage":["N/A"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Lift Master","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'e267cab0-6d67-4295-a12a-43a1be6f4f47'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Eufy","key_storage":["N/A"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Lift Master","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '18104 Calle Way (12M)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e267cab0-6d67-4295-a12a-43a1be6f4f47' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 18200 Bodegon Rd. (12M)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"None","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Genie 7155L","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '8554f577-3b7d-4819-8b6d-d5cfbaede637'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"None","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Genie 7155L","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '18200 Bodegon Rd. (12M)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8554f577-3b7d-4819-8b6d-d5cfbaede637' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 18205 Allora Dr. (12M)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Eufy","yale_module":"Not Applicable (Not Yale)","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '5ff5ee5c-1d5b-4cad-a178-6ed53220614c'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Eufy","yale_module":"Not Applicable (Not Yale)","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '18205 Allora Dr. (12M)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '5ff5ee5c-1d5b-4cad-a178-6ed53220614c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 19013 Meadows Crossing (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '307e57dc-3f45-4ad2-98d3-358769feccb9'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '19013 Meadows Crossing (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '307e57dc-3f45-4ad2-98d3-358769feccb9' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 19021 Meadows Crossing (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Schlage","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '7b04bb27-ed86-4e5d-a406-d1265ca67ca3'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Schlage","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '19021 Meadows Crossing (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '7b04bb27-ed86-4e5d-a406-d1265ca67ca3' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1908 E Urbana St
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'ed21dc09-34d2-4c7b-9d1b-2d5eb561a4a7'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1908 E Urbana St'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ed21dc09-34d2-4c7b-9d1b-2d5eb561a4a7' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ed21dc09-34d2-4c7b-9d1b-2d5eb561a4a7' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 19104 Meadows Crossings
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '1d949a24-c216-4e3c-9290-c08997fe688d'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '19104 Meadows Crossings'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1d949a24-c216-4e3c-9290-c08997fe688d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '1d949a24-c216-4e3c-9290-c08997fe688d' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 19117 Meadows Crossing (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = 'ce75f670-ff56-4c14-8159-5072b6d31bc7'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '19117 Meadows Crossing (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ce75f670-ff56-4c14-8159-5072b6d31bc7' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ce75f670-ff56-4c14-8159-5072b6d31bc7' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 19120 Meadows Crossing
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '4b4fdb62-fc3e-4a83-ba0a-391fac682f1d'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '19120 Meadows Crossing'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '4b4fdb62-fc3e-4a83-ba0a-391fac682f1d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '4b4fdb62-fc3e-4a83-ba0a-391fac682f1d' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 2004 Cedar Ridge Rd.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor","Storage Closet"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = 'de4a6e71-6fd8-4c4a-8d58-b935c4173e1f'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor","Storage Closet"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2004 Cedar Ridge Rd.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'de4a6e71-6fd8-4c4a-8d58-b935c4173e1f' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-8091-8112-fad5a8380da7', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'de4a6e71-6fd8-4c4a-8d58-b935c4173e1f' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 2008 Ladera Ln
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Liftmaster model 893LM MC","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'faf5d78e-7f51-479c-9296-1c314fad3c6a'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Liftmaster model 893LM MC","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2008 Ladera Ln'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'faf5d78e-7f51-479c-9296-1c314fad3c6a' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2012 W Black Powder Way
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'c78fb035-de41-40a6-b4bd-1a4384e28e2e'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2012 W Black Powder Way'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'c78fb035-de41-40a6-b4bd-1a4384e28e2e' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2014 E 52nd St
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor","Mailbox"],"yale_module":"Connected & Setup","garage_remote":"Craftsman","emergency_key_access":"No","yale_integration_live":true}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '8e4dec0f-78d4-4dcb-86e5-e0ea2dd5584f'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor","Mailbox"],"yale_module":"Connected & Setup","garage_remote":"Craftsman","emergency_key_access":"No","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2014 E 52nd St'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8e4dec0f-78d4-4dcb-86e5-e0ea2dd5584f' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '8e4dec0f-78d4-4dcb-86e5-e0ea2dd5584f' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 2016 NW 172nd St
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'f3e7d069-bd48-4c6f-94f2-153159dc6b6c'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2016 NW 172nd St'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'f3e7d069-bd48-4c6f-94f2-153159dc6b6c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2017 W. Flintlock Way
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"2 for Chamberlain LiftMaster Craftsman Garage Door Opener Remote 893LM 893Max 971LM Universal - Amazon.com","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '604f62a1-ee82-4b97-afae-0ad9c8afabbc'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"2 for Chamberlain LiftMaster Craftsman Garage Door Opener Remote 893LM 893Max 971LM Universal - Amazon.com","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2017 W. Flintlock Way'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '604f62a1-ee82-4b97-afae-0ad9c8afabbc' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 207 High Point Way
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'ed684fea-2b58-4264-8b43-ca5e1dd8f3cf'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '207 High Point Way'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ed684fea-2b58-4264-8b43-ca5e1dd8f3cf' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2100 Liberty Way Dr.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Universal remotes, Craftsman","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'e5c41afe-3bb6-418b-92ea-2cbf9b565c95'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Universal remotes, Craftsman","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2100 Liberty Way Dr.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e5c41afe-3bb6-418b-92ea-2cbf9b565c95' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 220 SW 167th St. (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Overhead door Odyssey 1000","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '08ed7d90-7ac4-4089-9939-537222300c66'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Overhead door Odyssey 1000","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '220 SW 167th St. (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '08ed7d90-7ac4-4089-9939-537222300c66' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2208 E. Toledo St.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '532ad15b-6f1d-428c-8eba-f1b49c887dc6'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2208 E. Toledo St.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '532ad15b-6f1d-428c-8eba-f1b49c887dc6' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2259 Summer Shore Dr
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Universal","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '27e6f3a9-32e8-471f-932d-eb52891f4526'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Universal","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2259 Summer Shore Dr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '27e6f3a9-32e8-471f-932d-eb52891f4526' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2321 NW 158th (30D)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Eufy","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"ProDrive","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '03d37544-36aa-485f-ba40-900c58451836'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Eufy","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"ProDrive","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2321 NW 158th (30D)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '03d37544-36aa-485f-ba40-900c58451836' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2332 Los Angeles Ave
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'c11cb85a-380f-416e-98d1-15add30737e7'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2332 Los Angeles Ave'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'c11cb85a-380f-416e-98d1-15add30737e7' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 236 N. Starnes St. (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["N/A"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '3e33a82f-0ad2-4659-9d47-a59f72c01a7b'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["N/A","Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '236 N. Starnes St. (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '3e33a82f-0ad2-4659-9d47-a59f72c01a7b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-8084-bdf2-d4679493ddbb', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '3e33a82f-0ad2-4659-9d47-a59f72c01a7b' AND field_key = 'access.key_storage' AND note = 'PID refresh 2026-11-12';

-- 2414 W. Kingsport Ct. S
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Overhead Door","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '6cb09c34-f77a-4795-bb16-1e3a3fe87f4c'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Overhead Door","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2414 W. Kingsport Ct. S'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '6cb09c34-f77a-4795-bb16-1e3a3fe87f4c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 250 Springfield Xing
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{}}$pid$::jsonb)).access,
      compliance = (jsonb_populate_record(NULL::public.properties, $pid${"compliance":{}}$pid$::jsonb)).compliance,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{"notion_pid_url":"https://app.notion.com/3e44658d5f4f81ea90d9fae89cf6579c"}}$pid$::jsonb)).external_refs,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package,
      market = (jsonb_populate_record(NULL::public.properties, $pid${"market":null}$pid$::jsonb)).market,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{}}$pid$::jsonb)).parking,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{}}$pid$::jsonb)).utilities,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(compliance) IS NOT DISTINCT FROM $pid${"permit_status":{"text":"No permit required for Greenfield, IN","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true},"rental_restrictions":{"text":"No STR rental restrictions","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${"notion_pid_url":"https://app.notion.com/3e44658d5f4f81ea90d9fae89cf6579c","breezeway_url":"https://app.breezeway.io/property/1514895/profile"}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb
      AND to_jsonb(market) IS NOT DISTINCT FROM $pid$"Indy"$pid$::jsonb
      AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"Springfield Sanctuary (250)"$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"3 Car Garage\nFree Parking on Premises"}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_split_confirmed":false}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2026$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '250 Springfield Xing'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'compliance.permit_status' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'compliance.rental_restrictions' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'market' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';

-- 2522 S Irvington Ave
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain 950estd mc","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2 trash cans 1 recycling","trash_days":["Friday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Friday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'b5ca6769-c083-4091-b185-d887ff8c7323'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain 950estd mc","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2 trash cans 1 recycling","trash_days":["Friday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Friday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2522 S Irvington Ave'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'b5ca6769-c083-4091-b185-d887ff8c7323' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'b5ca6769-c083-4091-b185-d887ff8c7323' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 2525 Fallview Dr.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'e9706c22-70c6-4b78-8115-11895877b69b'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2525 Fallview Dr.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e9706c22-70c6-4b78-8115-11895877b69b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2527 NE 15th St
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain / Model RJO20","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_ssid":"Arealhomeaway","router_location":"Storage closet.","wifi_split_confirmed":false}}$pid$::jsonb)).utilities,
      updated_at = now()
    WHERE id = '632db464-d193-4671-96cd-1b899a8f2a1a'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain / Model RJO20","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_ssid":"ARHA","router_location":"Storage closet.","wifi_split_confirmed":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2527 NE 15th St'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '632db464-d193-4671-96cd-1b899a8f2a1a' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1d74658d-5f4f-80b4-8012-e5d6e9e7ca53', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '632db464-d193-4671-96cd-1b899a8f2a1a' AND field_key = 'utilities.wifi_ssid' AND note = 'PID refresh 2026-11-12';

-- 2536 NW 116th (12M)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"None","key_storage":["Front Door/Smartlock"],"yale_integration_live":false}}$pid$::jsonb)).access,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"tv_specs":"Smart TV (Not Sure)","workstation":"No","tv_locations":["Primary Bedroom","Living Room"]}}$pid$::jsonb)).facts,
      fireplace = (jsonb_populate_record(NULL::public.properties, $pid${"fireplace":{}}$pid$::jsonb)).fireplace,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"Not Mentioned"}}$pid$::jsonb)).hvac,
      neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":null}$pid$::jsonb)).neighborhood,
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{}}$pid$::jsonb)).sprinklers,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"fridge_filter":"Not Mentioned"}}$pid$::jsonb)).systems,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"On Property Garage (No more Information)"}}$pid$::jsonb)).parking,
      updated_at = now()
    WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"None","key_storage":["Front Door/Smartlock"],"yale_integration_live":false,"emergency_key_access":"Yes","garage_remote":"Unknown","yale_module":"Not Applicable (Not Yale)","yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"tv_specs":"Smart TV (Not Sure)","workstation":"Not Mentioned","tv_locations":["Primary Bedroom","Living Room"],"grill":"No Grill","interior_paint":"Unsure"}$pid$::jsonb
      AND to_jsonb(fireplace) IS NOT DISTINCT FROM $pid${"present":false}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"16x30x1 and 14x20x1","filter_sizes":["16x30x1","14x20x1"]}$pid$::jsonb
      AND to_jsonb(neighborhood) IS NOT DISTINCT FROM $pid$"Unsure"$pid$::jsonb
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${"status":"Property Does Not Have Sprinkler System"}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"fridge_filter":"HAF-CIN","breaker_panel_location":"Garage","co":{"installed":false,"location":"Kitchen"},"fridge_filter_5yr":false,"smoke":{"batteries_changed_on":"2026-09-22","battery_type":"9-Volt (Alkaline)","brand":"First Alert","expires_on":"2030-12-31","expires_precision":"year","expires_source_text":"2030","notes":"None","power_type":"Battery Powered"},"supply_box_location":"Na","supply_storage":"N/A","water_shutoff_outdoor":"At curb"}$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"On Property Garage (\nNo more Information\n)"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'access.emergency_key_access' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'access.garage_remote' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'facts.grill' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'facts.interior_paint' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'fireplace.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'hvac.filter_sizes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'neighborhood' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'sprinklers.status' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.breaker_panel_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.co.installed' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.co.location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.fridge_filter_5yr' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.smoke.battery_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.smoke.brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.smoke.expires_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.smoke.expires_precision' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.smoke.expires_source_text' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.smoke.notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.smoke.power_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.supply_box_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.supply_storage' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.water_shutoff_outdoor' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80cd-b8f1-e1ede5224c97', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'facts.workstation' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80cd-b8f1-e1ede5224c97', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80cd-b8f1-e1ede5224c97', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80cd-b8f1-e1ede5224c97', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';

-- 2601 W 65th St S
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{}}$pid$::jsonb)).access,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{"notion_pid_url":"https://app.notion.com/4134658d5f4f813eb405e425343a2cd2"}}$pid$::jsonb)).external_refs,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package,
      market = (jsonb_populate_record(NULL::public.properties, $pid${"market":null}$pid$::jsonb)).market,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{}}$pid$::jsonb)).parking,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{}}$pid$::jsonb)).utilities,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${"notion_pid_url":"https://app.notion.com/4134658d5f4f813eb405e425343a2cd2","breezeway_url":"https://app.breezeway.io/property/1564238/profile"}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb
      AND to_jsonb(market) IS NOT DISTINCT FROM $pid$"Tulsa"$pid$::jsonb
      AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"Hillside Hollow (2601)"$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"2 Car Garage\nFree Parking on Premises"}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_split_confirmed":false}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2026$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2601 W 65th St S'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'market' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';

-- 2608 SE 38th St
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie Model 2028","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '4ba15ebf-075e-4233-96ab-235dacedd069'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie Model 2028","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2608 SE 38th St'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '4ba15ebf-075e-4233-96ab-235dacedd069' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2617 W Madison St.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Liftmaster 891lm","emergency_key_access":"No","yale_integration_live":false}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '47a804ef-0d9e-4a81-8eb9-6c2b261e1313'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Liftmaster 891lm","emergency_key_access":"No","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2617 W Madison St.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '47a804ef-0d9e-4a81-8eb9-6c2b261e1313' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '47a804ef-0d9e-4a81-8eb9-6c2b261e1313' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 2701 Berkshire Way
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Teeho","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'ffb07311-c1d2-47f2-8759-8d66b9c4efbf'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Teeho","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2701 Berkshire Way'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ffb07311-c1d2-47f2-8759-8d66b9c4efbf' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2817 Hazel Hollow
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Mailbox"],"yale_module":"Connected & Setup","garage_remote":"Doortec","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"There are two returns inside the house. However, those are not getting used. There is a big 5 inch filter in the attic that the owner only wants changed.\nDo not install these filters in the house:\n  • 20x30x1 - 1 \n  • 14x14x1 - 1","filter_sizes":["20x30x1","14x14x1"]}}$pid$::jsonb)).hvac,
      updated_at = now()
    WHERE id = '956cc7c9-1193-409c-a2ab-9bd2fc312646'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Mailbox"],"yale_module":"Connected & Setup","garage_remote":"Doortec","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"There are two returns inside the house. However, those are not getting used. There is a big 5 inch filter in the attic that the owner only wants changed.\nDo not install filters in the house.","filter_sizes":["20x30x1","14x14x1"]}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2817 Hazel Hollow'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '956cc7c9-1193-409c-a2ab-9bd2fc312646' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '2e84658d-5f4f-81ac-8dab-c2270877a1ab', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '956cc7c9-1193-409c-a2ab-9bd2fc312646' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';

-- 2901 E. 75th St.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Overhead door","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact.nown"}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = 'e0178350-7c7b-43e4-b11d-0bd8c15cee9e'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Overhead door","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2901 E. 75th St.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e0178350-7c7b-43e4-b11d-0bd8c15cee9e' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80ed-8a8b-fb074766880d', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'e0178350-7c7b-43e4-b11d-0bd8c15cee9e' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 2913 NW 188th St (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Lift Master","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'b9f146b2-8320-4808-ae37-425500031a70'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Lift Master","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2913 NW 188th St (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'b9f146b2-8320-4808-ae37-425500031a70' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 3000 Meriweather Rd (30D)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Unknown","key_storage":["None","Front Door/Smartlock"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Liftmaster","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '0c03c4c8-d142-4d56-b73d-22806e0bd511'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Unknown","key_storage":["None","Front Door/Smartlock"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Liftmaster","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3000 Meriweather Rd (30D)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '0c03c4c8-d142-4d56-b73d-22806e0bd511' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 3000 W Charlotte St
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Not Connected","garage_remote":"Over head door","emergency_key_access":"No","yale_integration_live":false}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Monday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '08fe042b-2dad-4487-b515-a38ab3ad07d8'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Not Connected","garage_remote":"Over head door","emergency_key_access":"No","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Monday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3000 W Charlotte St'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '08fe042b-2dad-4487-b515-a38ab3ad07d8' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '08fe042b-2dad-4487-b515-a38ab3ad07d8' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 3012 Piper St
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain LiftMaster Craftsman Garage Door Opener Remote 893LM 893Max 971LM Universal","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"1: 14x30x1","filter_sizes":["14x30x1"]}}$pid$::jsonb)).hvac,
      updated_at = now()
    WHERE id = '4e2f9e8b-dd08-4381-9cab-c3664a4bdad8'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain LiftMaster Craftsman Garage Door Opener Remote 893LM 893Max 971LM Universal","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"1: 14x30x1 & 91-005\n\nThere is a 16x25x4 filter inside the unit in the attic. this needs to be changed every 6 months. (it was changed on Sep 2026 by Silver Creek)","filter_sizes":["14x30x1","16x25x4"]}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3012 Piper St'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '4e2f9e8b-dd08-4381-9cab-c3664a4bdad8' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1c24658d-5f4f-804f-8acc-ddc2000707a8', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '4e2f9e8b-dd08-4381-9cab-c3664a4bdad8' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1c24658d-5f4f-804f-8acc-ddc2000707a8', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '4e2f9e8b-dd08-4381-9cab-c3664a4bdad8' AND field_key = 'hvac.filter_sizes' AND note = 'PID refresh 2026-11-12';

-- 3029 NW 181st
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Schlage","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = 'd1bfd0f9-789c-40c2-b1cf-2ecd97239dc9'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Schlage","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3029 NW 181st'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'd1bfd0f9-789c-40c2-b1cf-2ecd97239dc9' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'd1bfd0f9-789c-40c2-b1cf-2ecd97239dc9' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 3040 NW 183rd St. (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Kwikset","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Genie model 2028","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Kitchen","installed":true},"smoke":{"brand":"First Alert","notes":"None","expires_on":"2027-12-31","power_type":"Hardwired","battery_type":"9-Volt (Alkaline)","expires_precision":"year","expires_source_text":"2027","batteries_changed_on":"2025-08-05"},"fridge_filter":"GF-841","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"N/A","water_shutoff_indoor":"Guest bedroom 1 closet","water_shutoff_outdoor":"At curb to the left of driveway","breaker_panel_location":"Garage"}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = '6b32409d-98f4-4491-9069-0c3823599755'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Kwikset","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Genie model 2028","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Kitchen","installed":true},"smoke":{"brand":"First Alert","notes":"None","expires_on":"2027-12-31","power_type":"Hardwired","battery_type":"9-Volt (Alkaline)","expires_precision":"year","expires_source_text":"2027","batteries_changed_on":"2025-08-05"},"fridge_filter":"GF-841 ( HAF-QIN/EXP)","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"N/A","water_shutoff_indoor":"Guest bedroom 1 closet","water_shutoff_outdoor":"At curb to the left of driveway","breaker_panel_location":"Garage"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3040 NW 183rd St. (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '6b32409d-98f4-4491-9069-0c3823599755' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80ae-8217-e3a02b42882c', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '6b32409d-98f4-4491-9069-0c3823599755' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';

-- 305 W 7th St.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"myQ","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"grill":"No Grill","tv_specs":"Living Room - 305 W 7th ST - 65","workstation":"No","tv_locations":["Living Room","Primary Bedroom"],"interior_paint":"1. Location & quantity - garage \n2. Brand - spectrum paint\n3. Color name & code - white satin lacquer, int mountain ash, \n4. Sheen -satin\n5. Style/location of paint - 5 gallons and 1 gallons all in garage"}}$pid$::jsonb)).facts,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"14x14x1 - 2 locations \n20x25x1","filter_sizes":["14x14x1","20x25x1"]}}$pid$::jsonb)).hvac,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Hallway","installed":true},"smoke":{"brand":"First Alert","notes":"N/A","expires_on":"2035-06-09","power_type":"Hardwired","battery_type":"9-Volt (Alkaline)","expires_precision":"day","expires_source_text":"2035 June 9","batteries_changed_on":"2027-04-22"},"fridge_filter":"Frigidaire","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"Shelf","water_shutoff_indoor":"Garage","water_shutoff_outdoor":"By the street","breaker_panel_location":"Garage"}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = '5e1e71c9-939b-4d06-89a9-f92087160994'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"myQ","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"grill":"No Grill","tv_specs":"Living Room - 305 W 7th ST - 65\nPrimary bedroom- 65","workstation":"No","tv_locations":["Living Room","Primary Bedroom"],"interior_paint":"1. Location & quantity - garage \n2. Brand - spectrum paint\n3. Color name & code - white satin lacquer, int mountain ash, \n4. Sheen -satin\n5. Style/location of paint - 5 gallons and 1 gallons all in garage"}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"14x14x1 - 2 locations  dining and primary bedroom \n20x25x1 hallway","filter_sizes":["14x14x1","20x25x1"]}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Hallway","installed":true},"smoke":{"brand":"First Alert","notes":"N/A","expires_on":"2035-06-09","power_type":"Hardwired","battery_type":"9-Volt (Alkaline)","expires_precision":"day","expires_source_text":"2035 June 9","batteries_changed_on":"2027-04-22"},"fridge_filter":"Frigidaire FPPWFU01","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"Shelf","water_shutoff_indoor":"Garage","water_shutoff_outdoor":"By the street","breaker_panel_location":"Garage"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '305 W 7th St.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '5e1e71c9-939b-4d06-89a9-f92087160994' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3264658d-5f4f-813a-90b9-c65a8f95eabd', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '5e1e71c9-939b-4d06-89a9-f92087160994' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3264658d-5f4f-813a-90b9-c65a8f95eabd', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '5e1e71c9-939b-4d06-89a9-f92087160994' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3264658d-5f4f-813a-90b9-c65a8f95eabd', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '5e1e71c9-939b-4d06-89a9-f92087160994' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';

-- 309 Prince John Dr
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Matantec Model: Digital 382 2 Channel","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Kitchen","installed":true},"smoke":{"brand":"First alert","notes":"Replaced all","expires_on":"2035-12-31","power_type":"Battery Powered","battery_type":"Hardwired (Battery Backup)","expires_precision":"year","expires_source_text":"2035","batteries_changed_on":"2025-12-03"},"fridge_filter":"FPPWFU01","supply_storage":"Cabinet","fridge_filter_5yr":true,"supply_box_location":"Primary bedroom closet.","water_shutoff_indoor":"Unsure","water_shutoff_outdoor":"Left side curb","breaker_panel_location":"Garage"}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = '6cf841a3-8b95-4919-80d1-d9701ba5ffc7'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Matantec Model: Digital 382 2 Channel","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Kitchen","installed":true},"smoke":{"brand":"First alert","notes":"Replaced all","expires_on":"2035-12-31","power_type":"Battery Powered","battery_type":"Hardwired (Battery Backup)","expires_precision":"year","expires_source_text":"2035","batteries_changed_on":"2026-10-15"},"fridge_filter":"FPPWFU01","supply_storage":"Cabinet","fridge_filter_5yr":true,"supply_box_location":"Primary bedroom closet.","water_shutoff_indoor":"Unsure","water_shutoff_outdoor":"Left side curb","breaker_panel_location":"Garage"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '309 Prince John Dr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '6cf841a3-8b95-4919-80d1-d9701ba5ffc7' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80bd-ae79-f1967c95d15a', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '6cf841a3-8b95-4919-80d1-d9701ba5ffc7' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';

-- 3117 Scissortail Way (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"MyQ","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      compliance = (jsonb_populate_record(NULL::public.properties, $pid${"compliance":{}}$pid$::jsonb)).compliance,
      storm_shelter = (jsonb_populate_record(NULL::public.properties, $pid${"storm_shelter":{"location_access":"Garage -use provided pin to depress button to slide door open depress button to slide door open"}}$pid$::jsonb)).storm_shelter,
      updated_at = now()
    WHERE id = 'f8fd08cd-4043-4bb6-83f4-30a726437f08'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"MyQ","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(compliance) IS NOT DISTINCT FROM $pid${"permit_status":{"text":"Permit required in OKC. $1,200","as_of":"2026-11-11T18:51:00.000Z","source":"notion_pid","reference_only":true},"rental_restrictions":{"text":"No STR rental restrictions","as_of":"2026-11-11T18:51:00.000Z","source":"notion_pid","reference_only":true}}$pid$::jsonb
      AND to_jsonb(storm_shelter) IS NOT DISTINCT FROM $pid${"location_access":"Garage - use provided pin: [removed — credentials are not stored in Resolve] depress button to slide door open"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3117 Scissortail Way (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'f8fd08cd-4043-4bb6-83f4-30a726437f08' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'f8fd08cd-4043-4bb6-83f4-30a726437f08' AND field_key = 'compliance.permit_status' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'f8fd08cd-4043-4bb6-83f4-30a726437f08' AND field_key = 'compliance.rental_restrictions' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-806a-847d-d3f6046ef2a0', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'f8fd08cd-4043-4bb6-83f4-30a726437f08' AND field_key = 'storm_shelter.location_access' AND note = 'PID refresh 2026-11-12';

-- 31445 Moore Rd.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain 953ESTD MC","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'de9bbef4-e04a-4b8b-b7da-bf1a54862831'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain 953ESTD MC","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '31445 Moore Rd.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'de9bbef4-e04a-4b8b-b7da-bf1a54862831' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 3200 Birmingham Dr
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Not Connected","garage_remote":"Genie Legacy 850","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '3f2b0d24-9317-49ed-aa05-1cd16ce82673'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Not Connected","garage_remote":"Genie Legacy 850","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3200 Birmingham Dr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '3f2b0d24-9317-49ed-aa05-1cd16ce82673' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 3201 Belmont Circle
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"NA, guest has no access to garage. Owner uses this for storage since there is no garage opener installed.","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'bd9b524c-a688-4455-9458-ecb744ec47e9'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"NA, guest has no access to garage. Owner uses this for storage since there is no garage opener installed.","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3201 Belmont Circle'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bd9b524c-a688-4455-9458-ecb744ec47e9' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 33 Center Lane S
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale at side door, Schlage at front door","key_storage":["Side Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"N/a","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"list":["Pool"],"access_notes":"Carlton Landing requires all vehicles to be registered through the link found  - here .The passcode: See Guest Access & Credentials will use in the form is 250570. Unregistered cars can be ticketed or towed, so please take care of this ahead of time.\n\nThe above information is included in the Breezeway Parking Guidelines."}}$pid$::jsonb)).amenities,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '03258673-f2bd-49c6-9e14-537c6439bc5d'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Schlage at side door.","key_storage":["Side Door/Smartlock"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"N/a","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"list":["Pool"],"access_notes":"Carlton Landing requires all vehicles to be registered through the link found  - \nhere \n. The passcode: [removed — credentials are not stored in Resolve] will use in the form is \n250570\n. Unregistered cars can be ticketed or towed, so please take care of this ahead of time.\n\nThe above information is included in the Breezeway Parking Guidelines."}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"NO PETS ALLOWED\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '33 Center Lane S'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80a6-8a27-f6d45b671a7f', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND field_key = 'access.lock_brand' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80a6-8a27-f6d45b671a7f', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80a6-8a27-f6d45b671a7f', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80a6-8a27-f6d45b671a7f', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 3316 NW 176th
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Schlage","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '301a0990-5c55-4d71-acd1-0d64f6e6b162'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Schlage","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3316 NW 176th'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '301a0990-5c55-4d71-acd1-0d64f6e6b162' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '301a0990-5c55-4d71-acd1-0d64f6e6b162' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 3333 Welling Rd
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Mod: GDR-27 MLT","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '56cf44ac-918b-4bc6-bdc2-83a5d9e83bf6'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Mod: GDR-27 MLT","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3333 Welling Rd'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '56cf44ac-918b-4bc6-bdc2-83a5d9e83bf6' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 3361 E 153rd St S
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{}}$pid$::jsonb)).access,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{"notion_pid_url":"https://app.notion.com/4144658d5f4f817e8d6ef73a23669876"}}$pid$::jsonb)).external_refs,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package,
      market = (jsonb_populate_record(NULL::public.properties, $pid${"market":null}$pid$::jsonb)).market,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{}}$pid$::jsonb)).parking,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{}}$pid$::jsonb)).utilities,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${"notion_pid_url":"https://app.notion.com/4144658d5f4f817e8d6ef73a23669876","breezeway_url":"https://app.breezeway.io/property/1565707/profile"}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb
      AND to_jsonb(market) IS NOT DISTINCT FROM $pid$"Tulsa"$pid$::jsonb
      AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"The Bixby Bloom (3361)"$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"2 Car Garage\nFree Parking on Premises"}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_split_confirmed":false}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2026$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3361 E 153rd St S'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'market' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';

-- 3400 N Fern Avenue
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{}}$pid$::jsonb)).access,
      compliance = (jsonb_populate_record(NULL::public.properties, $pid${"compliance":{}}$pid$::jsonb)).compliance,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{}}$pid$::jsonb)).external_refs,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package,
      market = (jsonb_populate_record(NULL::public.properties, $pid${"market":null}$pid$::jsonb)).market,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{}}$pid$::jsonb)).parking,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{}}$pid$::jsonb)).utilities,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(compliance) IS NOT DISTINCT FROM $pid${"permit_status":{"text":"Permit required for Broken Arrow. $600","as_of":"2026-11-06T21:06:00.000Z","source":"notion_pid","reference_only":true},"rental_restrictions":{"text":"No STR rental restrictions","as_of":"2026-11-06T21:06:00.000Z","source":"notion_pid","reference_only":true}}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${"breezeway_url":"https://app.breezeway.io/property/1542591/profile"}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb
      AND to_jsonb(market) IS NOT DISTINCT FROM $pid$"Tulsa"$pid$::jsonb
      AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"Fernstone House (3400)"$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"2 Car Garage\nFree Parking on Premises"}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_split_confirmed":false}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2026$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3400 N Fern Avenue'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'compliance.permit_status' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'compliance.rental_restrictions' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'market' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';

-- 3405 NW 159th Ter
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'ae9220a0-758b-4f06-9895-ad84fbf6b700'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3405 NW 159th Ter'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ae9220a0-758b-4f06-9895-ad84fbf6b700' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 341 Thistlewood Dr
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Garage Door"],"yale_module":"Connected & Setup","garage_remote":"Overhead door","emergency_key_access":"No","yale_integration_live":true}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"EO Tuesday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'ddd71d00-acda-4feb-91cd-e0d86f38ddb4'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Garage Door"],"yale_module":"Connected & Setup","garage_remote":"Overhead door","emergency_key_access":"No","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"EO Tuesday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '341 Thistlewood Dr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ddd71d00-acda-4feb-91cd-e0d86f38ddb4' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ddd71d00-acda-4feb-91cd-e0d86f38ddb4' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 3613 Upland Ridge Dr.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Lift Master","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'fe424d6a-c98d-4cea-a626-33b088667d9d'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Lift Master","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3613 Upland Ridge Dr.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'fe424d6a-c98d-4cea-a626-33b088667d9d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 3712 N 39th St.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Lift master","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":1,"cart_notes":"1","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '6cafc523-773b-4933-8d3d-9fbfa978e304'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Lift master","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":1,"cart_notes":"1","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3712 N 39th St.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '6cafc523-773b-4933-8d3d-9fbfa978e304' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '6cafc523-773b-4933-8d3d-9fbfa978e304' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 3715 W 109th St S
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Storage Closet"],"yale_module":"Connected & Setup","garage_remote":"Owner Responsible for Items. Reach out to Marc Harper if we need additional remotes.","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"list":["Park","Pond","Walking Trail"],"access_notes":"The Pool Code: See Guest Access & Credentials. This neighborhood has no restrictions for who can use the pool, even guest staying less than 30 days can use it."}}$pid$::jsonb)).amenities,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"grill":"No Grill","tv_specs":"Netflix guest profile code: See Guest Access & Credentials\nHiSense Smart TV's (living room & downstairs game room, no Roku details). \nLogin information: held by the owner — not stored in Resolve the netflix account *Please do not share with guests* email: marc@compasspoints.net Password: held by the owner — not stored in Resolve","workstation":"Yes","tv_locations":["Living Room","Bonus Room"],"interior_paint":"Unknown. Owner Responsible for any repairs"}}$pid$::jsonb)).facts,
      updated_at = now()
    WHERE id = 'f3d27f76-bc0a-48c5-acd6-a7a82001671a'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Storage Closet"],"yale_module":"Connected & Setup","garage_remote":"Owner Responsible for Items. Reach out to Marc Harper if we need additional remotes.","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"list":["Park","Pond","Walking Trail"],"access_notes":"The Pool Code is: 42909. This neighborhood has no restrictions for who can use the pool, even guest staying less than 30 days can use it."}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"grill":"No Grill","tv_specs":"Netflix guest profile code: [removed — credentials are not stored in Resolve]\nHiSense Smart TV's (living room & downstairs game room, no Roku details). \nLogin information: [removed — credentials are not stored in Resolve] the netflix account *Please do not share with guests* email: marc@compasspoints.net Password: [removed — credentials are not stored in Resolve]","workstation":"Yes","tv_locations":["Living Room","Bonus Room"],"interior_paint":"Unknown. Owner Responsible for any repairs"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3715 W 109th St S'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'f3d27f76-bc0a-48c5-acd6-a7a82001671a' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '22d4658d-5f4f-81f4-ba7a-c217f0e98163', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'f3d27f76-bc0a-48c5-acd6-a7a82001671a' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '22d4658d-5f4f-81f4-ba7a-c217f0e98163', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'f3d27f76-bc0a-48c5-acd6-a7a82001671a' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';

-- 3915 W 104th St. S.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"yale_integration_live":false}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{}}$pid$::jsonb)).amenities,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{}}$pid$::jsonb)).facts,
      fireplace = (jsonb_populate_record(NULL::public.properties, $pid${"fireplace":{}}$pid$::jsonb)).fireplace,
      grounds = (jsonb_populate_record(NULL::public.properties, $pid${"grounds":{}}$pid$::jsonb)).grounds,
      hoa = (jsonb_populate_record(NULL::public.properties, $pid${"hoa":{}}$pid$::jsonb)).hoa,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{}}$pid$::jsonb)).hvac,
      listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":null}$pid$::jsonb)).listing_alias,
      neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":null}$pid$::jsonb)).neighborhood,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"2 Car Garage\nFree Parking on Premises"}}$pid$::jsonb)).parking,
      pool_spa = (jsonb_populate_record(NULL::public.properties, $pid${"pool_spa":{}}$pid$::jsonb)).pool_spa,
      security = (jsonb_populate_record(NULL::public.properties, $pid${"security":{}}$pid$::jsonb)).security,
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{}}$pid$::jsonb)).sprinklers,
      storm_shelter = (jsonb_populate_record(NULL::public.properties, $pid${"storm_shelter":{}}$pid$::jsonb)).storm_shelter,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{}}$pid$::jsonb)).systems,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_split_confirmed":false}}$pid$::jsonb)).utilities,
      warranty = (jsonb_populate_record(NULL::public.properties, $pid${"warranty":{}}$pid$::jsonb)).warranty,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"yale_integration_live":false,"emergency_key_access":"Yes","garage_remote":"Chamberlain - https://www.amazon.com/dp/B08CNKBTYJ?ref=fed_asin_title&th=1","key_storage":["Front Door/Smartlock","Backdoor","Garage Door"],"lock_brand":"Yale","yale_module":"Connected & Setup","yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"access_notes":"N/A","list":["Pool","Pond","Walking Trail"]}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"grill":"No Grill","interior_paint":"1. Location & quantity -laundry room 11 cans of exterior paint  2- 5 gallons of interior wall\nPaint. Sherwin Williams \n2. Brand - sherwin williams \n3. Color name & code -NA \n4. Sheen - satin \n5. Style/location of paint - exterior","tv_locations":["Living Room","Primary Bedroom"],"tv_specs":"Living room - 3915 W 104th St - 65, Primary bedroom - 3915 W 104th St - 55","workstation":"No"}$pid$::jsonb
      AND to_jsonb(fireplace) IS NOT DISTINCT FROM $pid${"fuel_type":"N/A","gas_switch":"N/A","gas_switch_location":"N/A","instructions":"N/A","model":"N/A","present":false}$pid$::jsonb
      AND to_jsonb(grounds) IS NOT DISTINCT FROM $pid${"mowing_cadence":"ARHA Responsible","mowing_days":["Tuesday"]}$pid$::jsonb
      AND to_jsonb(hoa) IS NOT DISTINCT FROM $pid${"notes + external_links":"HOA Contact: Green Country HOA Email: greencountryhoa@gmail.com\n\nHOA approval for exterior changes, keep RVs/boats/trailers in the garage, wood privacy fences only (6 ft, not past front line), no clotheslines, and keep the yard maintained.","present":true}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"14-30-1"}$pid$::jsonb
      AND to_jsonb(listing_alias) IS NOT DISTINCT FROM $pid$"Maple Manor | Jenks Family Retreat"$pid$::jsonb
      AND to_jsonb(neighborhood) IS NOT DISTINCT FROM $pid$"Southern Reserve"$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"**Owner does not want to see any diagnostic fees when possible. Owner’s referred handyman vendor - Eleven Eleven lab\n\nHOA needs to be contact on the summer for access to the community pool. No information was given upon request in onboarding.\n\nA cost segregation study will need to be scheduled. The company is planning to call Kati Hand for this. An owner requirement for the active owner program for tax purposes."$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"2 Car Garage\nFree Parking on Premises","cluster_mailbox":false,"mailbox_location":"N/A","mailbox_number":"N/A"}$pid$::jsonb
      AND to_jsonb(pool_spa) IS NOT DISTINCT FROM $pid${"present":"None"}$pid$::jsonb
      AND to_jsonb(security) IS NOT DISTINCT FROM $pid${"alarm":"No","battery_type":["Hardwired - No Battery"],"devices":["Front Door","Garage"],"monitoring_expires_on":"2027-11-08","monitoring_plan":["Active"]}$pid$::jsonb
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${"brand":"N/A","controller_location":"N/A","set_for_season":{"value":"N/A","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid"},"status":"Property Does Not Have Sprinkler System"}$pid$::jsonb
      AND to_jsonb(storm_shelter) IS NOT DISTINCT FROM $pid${"location_access":"N/A"}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"breaker_panel_location":"Garage","co":{"installed":true,"location":"Dining room"},"fridge_filter":"Samsung HAF-QIN/EXP DA97-17376B","fridge_filter_5yr":false,"smoke":{"batteries_changed_on":"2026-10-04","battery_type":"9-Volt (Alkaline)","brand":"siterlink","notes":"7 brand new smoke detectors were ordered on October 16, 2026 and those were installed,  However, after reviewing the photos the handyman sent upon completing the work, we noticed that the manufacturing date is 2020. According to the handyman, they should have approximately four years of useful life remaining.","power_type":"Hardwired"},"supply_box_location":"Located in the top shelf of primary bedroom closet","supply_storage":"Closet","water_shutoff_indoor":"N/Ain water heater closet","water_shutoff_outdoor":"Water heater closet in garage"}$pid$::jsonb
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_split_confirmed":false,"router_location":"Living room","wifi_ssid":"ARHA"}$pid$::jsonb
      AND to_jsonb(warranty) IS NOT DISTINCT FROM $pid${"builder_present":false,"claim_process + external_links":"N/A","furniture_expires_on":"2029-10-28"}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"cart_count":2,"cart_notes":"2","holiday_notes":"Thursday","recycling":true,"recycling_days":"Wednesday","strict_rules":"Trash cans out of street view, out ≤12 hrs before pickup and in ≤12 hrs after","trash_days":["Wednesday"],"valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'access.emergency_key_access' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'access.garage_remote' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'access.key_storage' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'access.lock_brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'amenities.list' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'facts.grill' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'facts.interior_paint' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'facts.tv_locations' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'facts.workstation' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'fireplace.fuel_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'fireplace.gas_switch' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'fireplace.gas_switch_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'fireplace.instructions' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'fireplace.model' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'fireplace.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'grounds.mowing_cadence' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'grounds.mowing_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'hoa.notes + external_links' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'hoa.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'listing_alias' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'neighborhood' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'parking.cluster_mailbox' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'parking.mailbox_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'parking.mailbox_number' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'pool_spa.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'security.alarm' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'security.battery_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'security.devices' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'security.monitoring_expires_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'security.monitoring_plan' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'sprinklers.brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'sprinklers.controller_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'sprinklers.set_for_season' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'sprinklers.status' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'storm_shelter.location_access' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.breaker_panel_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.co.installed' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.co.location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.fridge_filter_5yr' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.smoke.battery_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.smoke.brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.smoke.notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.smoke.power_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.supply_box_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.supply_storage' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.water_shutoff_indoor' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.water_shutoff_outdoor' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'utilities.router_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'utilities.wifi_ssid' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'warranty.builder_present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'warranty.claim_process + external_links' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'warranty.furniture_expires_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'waste.cart_count' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'waste.cart_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'waste.holiday_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'waste.recycling' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'waste.recycling_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'waste.strict_rules' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'waste.trash_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 4003 Bendale Rd
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"Overhead door","emergency_key_access":"No","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '4e542210-74fc-4a9e-b63f-ce2df5030f96'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"Overhead door","emergency_key_access":"No","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4003 Bendale Rd'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '4e542210-74fc-4a9e-b63f-ce2df5030f96' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 401 E. 10th St.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Schlage","yale_integration_live":false}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{}}$pid$::jsonb)).amenities,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{}}$pid$::jsonb)).facts,
      fireplace = (jsonb_populate_record(NULL::public.properties, $pid${"fireplace":{}}$pid$::jsonb)).fireplace,
      grounds = (jsonb_populate_record(NULL::public.properties, $pid${"grounds":{}}$pid$::jsonb)).grounds,
      hoa = (jsonb_populate_record(NULL::public.properties, $pid${"hoa":{}}$pid$::jsonb)).hoa,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{}}$pid$::jsonb)).hvac,
      legacy_handoff_date = (jsonb_populate_record(NULL::public.properties, $pid${"legacy_handoff_date":null}$pid$::jsonb)).legacy_handoff_date,
      listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":null}$pid$::jsonb)).listing_alias,
      neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":null}$pid$::jsonb)).neighborhood,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"2 Car Garage\nFree Parking on Premises"}}$pid$::jsonb)).parking,
      pool_spa = (jsonb_populate_record(NULL::public.properties, $pid${"pool_spa":{"present":"Pool"}}$pid$::jsonb)).pool_spa,
      security = (jsonb_populate_record(NULL::public.properties, $pid${"security":{}}$pid$::jsonb)).security,
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{}}$pid$::jsonb)).sprinklers,
      storm_shelter = (jsonb_populate_record(NULL::public.properties, $pid${"storm_shelter":{}}$pid$::jsonb)).storm_shelter,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{}}$pid$::jsonb)).systems,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_ssid":"HFE 401","wifi_split_confirmed":false}}$pid$::jsonb)).utilities,
      warranty = (jsonb_populate_record(NULL::public.properties, $pid${"warranty":{}}$pid$::jsonb)).warranty,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{}}$pid$::jsonb)).waste,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"FIRST vendor for all maintenance and repairs: Untitled . Contact them first on all work orders before scheduling any other vendor. Only use an alternate only if Ruben is unavailable or unresponsive.\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","yale_integration_live":false,"emergency_key_access":"Yes","garage_remote":"Genie & Chamberlain","key_storage":["Backdoor","Front Door/Smartlock","Garage Door"],"yale_module":"Connected & Setup","yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"access_notes":"N/A","list":["None"]}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"grill":"No Grill","interior_paint":"There are some gallons of paint at the house, but no specific colors listed.","tv_locations":["Living Room","Bonus Room","Primary Bedroom"],"tv_specs":"Bonus Room - 401 E 10th St - 50″ Insignia, 4K UHD — model NS-50F301NA24\nLiving Room - 401 E 10th St - 55″ Insignia, 4K UHD — model NS-55F301NA22\nPrimary bedroom - 401 E 10th St -  43″ TCL, 1080p Full HD — model 43S310R","workstation":"No"}$pid$::jsonb
      AND to_jsonb(fireplace) IS NOT DISTINCT FROM $pid${"fuel_type":"N/A","model":"Unknown. Not currently accessible for guests until we confirm operating instructions.","present":true}$pid$::jsonb
      AND to_jsonb(grounds) IS NOT DISTINCT FROM $pid${"mowing_cadence":"Owner Responsible","mowing_days":["Wednesday"]}$pid$::jsonb
      AND to_jsonb(hoa) IS NOT DISTINCT FROM $pid${"notes + external_links":"No HOA","present":false}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"14x24x1 x2","filter_sizes":["14x24x1"]}$pid$::jsonb
      AND to_jsonb(legacy_handoff_date) IS NOT DISTINCT FROM $pid$"2026-10-29"$pid$::jsonb
      AND to_jsonb(listing_alias) IS NOT DISTINCT FROM $pid$"Spacious Edmond Home | Pool & Game Room"$pid$::jsonb
      AND to_jsonb(neighborhood) IS NOT DISTINCT FROM $pid$"This home is not located within a specific neighborhood. The home is located closest to the cross streets of E 9th St & S Rankin St in Edmond"$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"2 Car Garage\nFree Parking on Premises","cluster_mailbox":false,"mailbox_location":"N/A","mailbox_number":"N/A"}$pid$::jsonb
      AND to_jsonb(pool_spa) IS NOT DISTINCT FROM $pid${"present":"Pool","control_panel_location":"N/A - No hot tub","heated":false,"heater":"N/A - No pool heater","season":"Pool will be opened around may and closed in October","service_schedule":"Pool serviced every Friday no swimming for 2 hours"}$pid$::jsonb
      AND to_jsonb(security) IS NOT DISTINCT FROM $pid${"alarm":"No","battery_type":["None"],"devices":["None","Backyard"],"monitoring_plan":["None"]}$pid$::jsonb
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${"brand":"N/A","controller_location":"N/A","set_for_season":{"value":"N/A","as_of":"2026-11-11T03:25:00.000Z","source":"notion_pid"},"status":"Property Does Not Have Sprinkler System"}$pid$::jsonb
      AND to_jsonb(storm_shelter) IS NOT DISTINCT FROM $pid${"location_access":"N/A"}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"breaker_panel_location":"Laundry room","co":{"installed":true,"location":"Kitchen"},"fridge_filter":"HAF/CIN","fridge_filter_5yr":false,"smoke":{"batteries_changed_on":"2022-01-01","battery_type":"10-Year Sealed Lithium","brand":"First Alert","expires_on":"2032-12-31","expires_precision":"year","expires_source_text":"2032","notes":"N/A","power_type":"Battery Powered"},"supply_box_location":"None","supply_storage":"Closet","water_shutoff_indoor":"N/A","water_shutoff_outdoor":"In the middle of the driveway"}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_ssid":"ARHA 2.4, ARHA 5","wifi_split_confirmed":false,"router_location":"Living room"}$pid$::jsonb
      AND to_jsonb(warranty) IS NOT DISTINCT FROM $pid${"builder_present":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"cart_count":2,"cart_notes":"2","holiday_notes":"If pickup falls on a holiday, it’ll be done the next day (Wednesday).","recycling":true,"recycling_days":"Every other Tuesday","trash_days":["Tuesday"],"valet":"Yes"}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$1968$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact.\n\nNot needed at hand off (Mingees to handle later):\n  • Confirm instructions for operating the fireplace in the basement \n• Full siding repair (multiple places)\n• Haul away fence panels in backyard\n• Backyard landscaping and cleanup\n• Remove stumps and trim all trees/bushes\n• Purchase/install new dining room rug\n• Garage door seal\n• Water damage on garage wall (find and repair the leak source)\n• Door or curtain for pantry\n• Gutters"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'access.emergency_key_access' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'access.garage_remote' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'access.key_storage' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'amenities.list' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'facts.grill' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'facts.interior_paint' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'facts.tv_locations' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'facts.workstation' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'fireplace.fuel_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'fireplace.model' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'fireplace.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'grounds.mowing_cadence' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'grounds.mowing_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'hoa.notes + external_links' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'hoa.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'hvac.filter_sizes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'legacy_handoff_date' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'listing_alias' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'neighborhood' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'parking.cluster_mailbox' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'parking.mailbox_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'parking.mailbox_number' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'pool_spa.control_panel_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'pool_spa.heated' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'pool_spa.heater' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'pool_spa.season' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'pool_spa.service_schedule' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'security.alarm' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'security.battery_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'security.devices' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'security.monitoring_plan' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'sprinklers.brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'sprinklers.controller_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'sprinklers.set_for_season' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'sprinklers.status' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'storm_shelter.location_access' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.breaker_panel_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.co.installed' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.co.location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.fridge_filter_5yr' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.smoke.battery_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.smoke.brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.smoke.expires_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.smoke.expires_precision' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.smoke.expires_source_text' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.smoke.notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.smoke.power_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.supply_box_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.supply_storage' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.water_shutoff_indoor' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.water_shutoff_outdoor' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'utilities.router_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'warranty.builder_present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'waste.cart_count' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'waste.cart_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'waste.holiday_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'waste.recycling' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'waste.recycling_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'waste.trash_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3574658d-5f4f-81d2-bed2-e345f40bca1a', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'access.lock_brand' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3574658d-5f4f-81d2-bed2-e345f40bca1a', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3574658d-5f4f-81d2-bed2-e345f40bca1a', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'utilities.wifi_ssid' AND note = 'PID refresh 2026-11-12';

-- 409 S. 85th St.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie g3bt","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'eef11540-5745-4b8f-8f1f-f02b02ea3417'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie g3bt","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '409 S. 85th St.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'eef11540-5745-4b8f-8f1f-f02b02ea3417' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'eef11540-5745-4b8f-8f1f-f02b02ea3417' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 417 Dauphin Ave.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Kwikset","key_storage":["Front Door/Smartlock","Storage Closet"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '6ffccd48-698b-4c3b-bdac-420ba582bc2d'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Kwikset","key_storage":["Front Door/Smartlock","Storage Closet"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '417 Dauphin Ave.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '6ffccd48-698b-4c3b-bdac-420ba582bc2d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-809c-b4c1-dc8101719004', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '6ffccd48-698b-4c3b-bdac-420ba582bc2d' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 428 Drowsy Water Trl (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Creacity","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '1a251d51-208a-439d-9b0e-f7e2887ae50b'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Creacity","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '428 Drowsy Water Trl (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1a251d51-208a-439d-9b0e-f7e2887ae50b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 4308 NW 158th (30D Firm)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Liftmaster","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"list":["Park","Basketball Court","Pool"],"access_notes":"Pool Access Code: See Guest Access & Credentials \n Pool rules and hours can be found on site on the pool building wall."}}$pid$::jsonb)).amenities,
      updated_at = now()
    WHERE id = 'ab12f1af-3e2e-4cfb-a73a-bb32dc412dc9'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Liftmaster","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"list":["Park","Basketball Court","Pool"],"access_notes":"Pool Access Code: [removed — credentials are not stored in Resolve] \n Pool rules and hours can be found on site on the pool building wall."}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4308 NW 158th (30D Firm)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ab12f1af-3e2e-4cfb-a73a-bb32dc412dc9' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-800f-8485-ed3da65ab8f9', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'ab12f1af-3e2e-4cfb-a73a-bb32dc412dc9' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';

-- 4308 S 177th Pl E
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Liftmaster","emergency_key_access":"No","yale_integration_live":false}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":false,"cart_count":3,"cart_notes":"3","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '517ccf34-a2de-4aca-9984-fc58c8a8d7bb'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Liftmaster","emergency_key_access":"No","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":false,"cart_count":3,"cart_notes":"3","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4308 S 177th Pl E'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '517ccf34-a2de-4aca-9984-fc58c8a8d7bb' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '517ccf34-a2de-4aca-9984-fc58c8a8d7bb' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 4317 NW 19th
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"No garage - converted into bedroom","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = 'e72e942a-f53f-4397-89fa-0383795fbc55'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"No garage - converted into bedroom","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4317 NW 19th'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e72e942a-f53f-4397-89fa-0383795fbc55' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e72e942a-f53f-4397-89fa-0383795fbc55' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 441 Belmont
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Eufy","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Two remotes model gdr- 34","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '53eaf44b-5021-48eb-babb-9cfdca9fb52b'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Eufy","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Two remotes model gdr- 34","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '441 Belmont'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '53eaf44b-5021-48eb-babb-9cfdca9fb52b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 4513 Black Mesa Ln
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["None"],"yale_module":"Connected & Setup","garage_remote":"Overhead door legacy 850","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '72cd8885-be51-4f6b-8fe9-2aab4173d34c'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["None"],"yale_module":"Connected & Setup","garage_remote":"Overhead door legacy 850","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4513 Black Mesa Ln'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '72cd8885-be51-4f6b-8fe9-2aab4173d34c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 453 Blue Crow Lane
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"Genie model- G3T-A","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Wall kitchen","installed":false},"smoke":{"brand":"First alert","notes":"None to mention","expires_on":"2029-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Lithium)","expires_precision":"year","expires_source_text":"2029","batteries_changed_on":"2025-06-22"},"fridge_filter":"Fppwfu01","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"Hallway","water_shutoff_indoor":"Unsure","water_shutoff_outdoor":"Right side curb","breaker_panel_location":"Garage"}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = '8c6b2765-57d4-4e05-9632-218ddf636258'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"Genie model- G3T-A","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Wall kitchen","installed":false},"smoke":{"brand":"First alert","notes":"None to mention","expires_on":"2029-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Lithium)","expires_precision":"year","expires_source_text":"2029","batteries_changed_on":"2026-09-22"},"fridge_filter":"Fppwfu01","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"Hallway","water_shutoff_indoor":"Unsure","water_shutoff_outdoor":"Right side curb","breaker_panel_location":"Garage"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '453 Blue Crow Lane'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8c6b2765-57d4-4e05-9632-218ddf636258' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80eb-bdeb-eec4e67f1cac', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '8c6b2765-57d4-4e05-9632-218ddf636258' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';

-- 4607 S. Lakewood Ave
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"No","yale_integration_live":true}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '5988af9f-e3b2-4ea3-973e-f8e7b8f86eea'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"No","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4607 S. Lakewood Ave'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '5988af9f-e3b2-4ea3-973e-f8e7b8f86eea' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '5988af9f-e3b2-4ea3-973e-f8e7b8f86eea' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 4607 W. Union St.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '4c0686e1-cead-4595-8dcc-633451238ad9'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4607 W. Union St.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '4c0686e1-cead-4595-8dcc-633451238ad9' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 4718 E Shadowbrook Dr
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '3eb869c8-205a-456f-86b8-d6a41f251e50'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4718 E Shadowbrook Dr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '3eb869c8-205a-456f-86b8-d6a41f251e50' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 4816 Hazy Hollow Ln
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Overhead Door","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'af09b54d-b334-4bee-a911-2af50a902a2b'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Overhead Door","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4816 Hazy Hollow Ln'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'af09b54d-b334-4bee-a911-2af50a902a2b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 5020 S.168th E Ave (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["None"],"yale_module":"Not Connected","garage_remote":"Unknown","emergency_key_access":"No","yale_integration_live":false}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":"Not Mentioned","cart_notes":"Not Mentioned","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday"}}$pid$::jsonb)).waste,
      hoa = (jsonb_populate_record(NULL::public.properties, $pid${"hoa":{"present":true,"notes + external_links":"https://trinitycreekhoa.com/contact-us/\nPh: 918-901-9311\nAddress: 9246 S Sheridan Rd, Suite 209, Tulsa, OK 74133 - call when you get there and they can bring down the pool card\n\nPortal to make payment for new pool card: https://resident.gozego.com/payments/summary\nLogin: See Guest Access & Credentials\nMatrix3161!"}}$pid$::jsonb)).hoa,
      updated_at = now()
    WHERE id = '53dd007c-4a89-4d96-9feb-e8467787a527'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["None"],"yale_module":"Not Connected","garage_remote":"Unknown","emergency_key_access":"No","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":"Not Mentioned","cart_notes":"Not Mentioned","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday","valet":"No"}$pid$::jsonb
      AND to_jsonb(hoa) IS NOT DISTINCT FROM $pid${"present":true,"notes + external_links":"https://trinitycreekhoa.com/contact-us/\nPh: 918-901-9311\nAddress: 9246 S Sheridan Rd, Suite 209, Tulsa, OK 74133 - call when you get there and they can bring down the pool card\n\nPortal to make payment for new pool card: https://resident.gozego.com/payments/summary\nLogin: [removed — credentials are not stored in Resolve]\nMatrix3161!"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5020 S.168th E Ave (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '53dd007c-4a89-4d96-9feb-e8467787a527' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '53dd007c-4a89-4d96-9feb-e8467787a527' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-8005-8d0c-ea1b9b94fa36', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '53dd007c-4a89-4d96-9feb-e8467787a527' AND field_key = 'hoa.notes + external_links' AND note = 'PID refresh 2026-11-12';

-- 5034 N 35th St
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor","Storage Closet"],"yale_module":"Connected & Setup","garage_remote":"Linkmaster","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":1,"cart_notes":"1 Trash Cart Each","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'b3a2afd8-96d4-4699-a91e-9c21ea1f115b'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor","Storage Closet"],"yale_module":"Connected & Setup","garage_remote":"Linkmaster","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":1,"cart_notes":"1 Trash Cart Each","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5034 N 35th St'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'b3a2afd8-96d4-4699-a91e-9c21ea1f115b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'b3a2afd8-96d4-4699-a91e-9c21ea1f115b' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 504 S. 47th St
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Liftmaster","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '2e868dc3-3eec-4d4d-bc2c-5dccbda23987'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Liftmaster","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '504 S. 47th St'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '2e868dc3-3eec-4d4d-bc2c-5dccbda23987' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '2e868dc3-3eec-4d4d-bc2c-5dccbda23987' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 5047 Skipping Stone Dr
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"EO Wednesday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '1bff641f-0107-4fe4-93fe-6ecf8735b38d'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"EO Wednesday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5047 Skipping Stone Dr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1bff641f-0107-4fe4-93fe-6ecf8735b38d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '1bff641f-0107-4fe4-93fe-6ecf8735b38d' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 508 NW 183rd St
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Overhead Door Legacy 850","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '1ac5de62-3a33-464d-8c9c-dbd132d15bab'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Overhead Door Legacy 850","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '508 NW 183rd St'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1ac5de62-3a33-464d-8c9c-dbd132d15bab' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 509 Houndstooth Dr (30D Firm)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"Garage Remote Control & Model GDR-27 MLT","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"list":["Pool","Park","Playground"],"access_notes":"Not Mentioned"}}$pid$::jsonb)).amenities,
      updated_at = now()
    WHERE id = '652a1979-a6ec-43ed-b684-2bc1aa9548bf'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"Garage Remote Control & Model GDR-27 MLT","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"list":["Pool","Park","Playground"],"access_notes":"ARHA can fill out the pool access card form (attached in comments) then send it Christina for approval and next steps to receive the card.\nContact: Christina Villarreal\nCVillarreal@insightam.com\n (972) 993-6746"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '509 Houndstooth Dr (30D Firm)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '652a1979-a6ec-43ed-b684-2bc1aa9548bf' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-803a-89ec-f0084e75f682', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '652a1979-a6ec-43ed-b684-2bc1aa9548bf' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';

-- 5217 NW 109th St. (30D Firm)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Storage Closet"],"yale_module":"Connected & Setup","garage_remote":"Genie model 1155","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '061cde8a-0565-4aeb-8e36-d558c317576b'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Storage Closet"],"yale_module":"Connected & Setup","garage_remote":"Genie model 1155","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5217 NW 109th St. (30D Firm)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '061cde8a-0565-4aeb-8e36-d558c317576b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80ea-8f84-dbe3f80b34e9', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '061cde8a-0565-4aeb-8e36-d558c317576b' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 525 23rd Ave
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Not Connected","garage_remote":"Overhead Door Legacy 850","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '6aef16ba-91c0-416c-8b60-8ed7a140de4b'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Not Connected","garage_remote":"Overhead Door Legacy 850","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '525 23rd Ave'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '6aef16ba-91c0-416c-8b60-8ed7a140de4b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 5253 Tracey Jo Rd
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor","Garage Door"],"yale_module":"Connected & Setup","garage_remote":"Lift masters","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '908cc8ce-268b-402c-a2aa-8c7aefb67975'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor","Garage Door"],"yale_module":"Connected & Setup","garage_remote":"Lift masters","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5253 Tracey Jo Rd'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '908cc8ce-268b-402c-a2aa-8c7aefb67975' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 5512 Hidden Trail Ln.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie Legacy 850","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'd4eab150-8c1c-4804-8ac4-a15e697b6c82'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie Legacy 850","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5512 Hidden Trail Ln.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'd4eab150-8c1c-4804-8ac4-a15e697b6c82' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 5671 Teak Ln.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'dc7e0b00-9bde-4bfd-a94b-bd164801ba6b'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5671 Teak Ln.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'dc7e0b00-9bde-4bfd-a94b-bd164801ba6b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 5923 Hollyhock Lane
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Mailbox"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '970d75a6-bf28-4439-b138-46f6749cc0dd'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Mailbox"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5923 Hollyhock Lane'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '970d75a6-bf28-4439-b138-46f6749cc0dd' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 6017 S. 13th St (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Lift master","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Monday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'be144356-fec0-44ce-83fa-4dc052194c93'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Lift master","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Monday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6017 S. 13th St (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'be144356-fec0-44ce-83fa-4dc052194c93' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'be144356-fec0-44ce-83fa-4dc052194c93' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 624 Daniel Court
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{}}$pid$::jsonb)).access,
      compliance = (jsonb_populate_record(NULL::public.properties, $pid${"compliance":{}}$pid$::jsonb)).compliance,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{}}$pid$::jsonb)).external_refs,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package,
      market = (jsonb_populate_record(NULL::public.properties, $pid${"market":null}$pid$::jsonb)).market,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{}}$pid$::jsonb)).parking,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{}}$pid$::jsonb)).utilities,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(compliance) IS NOT DISTINCT FROM $pid${"permit_status":{"text":"No permit required for Westfield, IN","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true},"rental_restrictions":{"text":"No STR rental restrictions","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${"breezeway_url":"https://app.breezeway.io/property/1529710/profile"}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb
      AND to_jsonb(market) IS NOT DISTINCT FROM $pid$"Indy"$pid$::jsonb
      AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"Dovetail Court (624)"$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"2 Car Garage\nFree Parking on Premises"}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_split_confirmed":false}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2002$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '624 Daniel Court'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'compliance.permit_status' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'compliance.rental_restrictions' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'market' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';

-- 628 Joy Ct
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Not Connected","garage_remote":"Lift master","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Kitchen","installed":true},"smoke":{"brand":"Kdde","notes":"None","expires_on":"2031-12-31","power_type":"Battery Powered","battery_type":"AA Battery","expires_precision":"year","expires_source_text":"2031","batteries_changed_on":"2025-10-29"},"fridge_filter":"Not Mentioned","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"N/a","water_shutoff_indoor":"Nothing to mention","water_shutoff_outdoor":"Next to fire hydrant","breaker_panel_location":"Outside"}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = '1652e0d6-8577-4cc1-82ee-fd477c929427'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Not Connected","garage_remote":"Lift master","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Kitchen","installed":true},"smoke":{"brand":"Kdde","notes":"None","expires_on":"2031-12-31","power_type":"Battery Powered","battery_type":"AA Battery","expires_precision":"year","expires_source_text":"2031","batteries_changed_on":"2026-09-07"},"fridge_filter":"Not Mentioned","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"N/a","water_shutoff_indoor":"Nothing to mention","water_shutoff_outdoor":"Next to fire hydrant","breaker_panel_location":"Outside"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '628 Joy Ct'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1652e0d6-8577-4cc1-82ee-fd477c929427' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-801f-a2f4-d04889af2a78', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '1652e0d6-8577-4cc1-82ee-fd477c929427' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';

-- 6302 Meadow Path Way
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{}}$pid$::jsonb)).access,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{"notion_pid_url":"https://app.notion.com/4104658d5f4f812e9cb3d36092e2fbc5"}}$pid$::jsonb)).external_refs,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package,
      market = (jsonb_populate_record(NULL::public.properties, $pid${"market":null}$pid$::jsonb)).market,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{}}$pid$::jsonb)).parking,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{}}$pid$::jsonb)).utilities,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${"notion_pid_url":"https://app.notion.com/4104658d5f4f812e9cb3d36092e2fbc5","breezeway_url":"https://app.breezeway.io/property/1563499/profile"}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb
      AND to_jsonb(market) IS NOT DISTINCT FROM $pid$"Indy"$pid$::jsonb
      AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"Meadow Path Hideaway (6302)"$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"2 Car Garage \nFree Parking on Premises"}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_split_confirmed":false}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2024$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6302 Meadow Path Way'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'market' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';

-- 6312 Red Cliff Dr
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Mailbox"],"yale_module":"Connected & Setup","garage_remote":"Not labeled","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '677bb1df-ce30-447c-a129-4ad3488c51bc'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Mailbox"],"yale_module":"Connected & Setup","garage_remote":"Not labeled","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6312 Red Cliff Dr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '677bb1df-ce30-447c-a129-4ad3488c51bc' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 64 Turtle Loop
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor","Side Door/Smartlock","Pool House (Storage Closet)"],"yale_module":"Connected & Setup","garage_remote":"Liftmaster","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"NO PETS ALLOWED\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = 'aed01e56-0bbb-4720-b81c-996bffcb6c21'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor","Side Door/Smartlock","Pool House (Storage Closet)"],"yale_module":"Connected & Setup","garage_remote":"Liftmaster","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"NO PETS ALLOWED\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '64 Turtle Loop'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'aed01e56-0bbb-4720-b81c-996bffcb6c21' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80d7-b304-e4412a7aed48', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'aed01e56-0bbb-4720-b81c-996bffcb6c21' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 6629 S 22nd Ct E
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor","Front Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"Linkmaster","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":1,"cart_notes":"1","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Monday"}}$pid$::jsonb)).waste,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"list":["Not Mentioned"],"access_notes":"There is a community pool (only available for guests 30+ days). A waiver is required to be completed per tenant in order to gain access. It is saved to the property’s one drive folder. It and the rules are also attached to this field as a comment."}}$pid$::jsonb)).amenities,
      updated_at = now()
    WHERE id = '656e8354-e4f6-43b2-9029-116fdef25e8a'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor","Front Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"Linkmaster","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":1,"cart_notes":"1","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Monday","valet":"No"}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"list":["Pool"],"access_notes":"There is a community pool (only available for guests 30+ days). A waiver is required to be completed per tenant in order to gain access. It is saved to the property’s one drive folder. It and the rules are also attached to this field as a comment. The owner has to complete the waiver."}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6629 S 22nd Ct E'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '656e8354-e4f6-43b2-9029-116fdef25e8a' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '656e8354-e4f6-43b2-9029-116fdef25e8a' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-800f-9797-ee9f8347a7db', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '656e8354-e4f6-43b2-9029-116fdef25e8a' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-800f-9797-ee9f8347a7db', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '656e8354-e4f6-43b2-9029-116fdef25e8a' AND field_key = 'amenities.list' AND note = 'PID refresh 2026-11-12';

-- 6847 Cardiff Dr
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Lift Master","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"EO Monday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '3a248822-b22f-4c2c-ab8c-56ff4f9a06e0'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Lift Master","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"EO Monday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6847 Cardiff Dr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '3a248822-b22f-4c2c-ab8c-56ff4f9a06e0' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '3a248822-b22f-4c2c-ab8c-56ff4f9a06e0' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 7006 E 154th St S
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Lift master and chamberlain","emergency_key_access":"No","yale_integration_live":true}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":1,"cart_notes":"1","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '806c6bbc-6723-426a-a5e7-ead187813d5f'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Lift master and chamberlain","emergency_key_access":"No","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":1,"cart_notes":"1","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '7006 E 154th St S'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '806c6bbc-6723-426a-a5e7-ead187813d5f' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '806c6bbc-6723-426a-a5e7-ead187813d5f' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 7071 Richardson Ct
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor","Garage Door"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '91aac2de-0b98-444a-81a8-2de074e0d265'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor","Garage Door"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '7071 Richardson Ct'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '91aac2de-0b98-444a-81a8-2de074e0d265' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 721 Dusty Trail
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Schlage","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Lift master","emergency_key_access":"No","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'c9777558-269b-4c12-b0ac-7a53cc960ebb'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Schlage","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Lift master","emergency_key_access":"No","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '721 Dusty Trail'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'c9777558-269b-4c12-b0ac-7a53cc960ebb' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 721 Vaquero St.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Mailbox"],"yale_module":"Not Connected","garage_remote":"Lift Master 891LM MC","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '3b0a17c2-8cda-43a7-ae82-8103feaf4811'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Mailbox"],"yale_module":"Not Connected","garage_remote":"Lift Master 891LM MC","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '721 Vaquero St.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '3b0a17c2-8cda-43a7-ae82-8103feaf4811' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 724 Abilene Way
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Lift Master","emergency_key_access":"No","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '326291cd-a35d-4055-9f87-e7ad1d34eec2'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Lift Master","emergency_key_access":"No","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '724 Abilene Way'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '326291cd-a35d-4055-9f87-e7ad1d34eec2' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 730 E 38th St. N.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor","Storage Closet"],"yale_module":"Connected & Setup","garage_remote":"Liftmaster","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"grill":"No Grill","tv_specs":"65\" TCL TV in Living Room, 55” TV in Primary Bedroom","workstation":"Yes","tv_locations":["Primary Bedroom","Living Room"],"interior_paint":"1. Location & quantity - garage several\n2. Brand - sherwin Williams \n3. Color name & code - 7004 , JH70-30\n4. Sheen - flat\n5. Style/location of paint -"}}$pid$::jsonb)).facts,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"14x24x1 - 1\n14x30x1 - 1","filter_sizes":["14x24x1","14x30x1"]}}$pid$::jsonb)).hvac,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Entryway","installed":true},"smoke":{"brand":"First Alert","notes":"N/A","expires_on":"2035-12-31","power_type":"Hardwired","battery_type":"9-Volt (Alkaline)","expires_precision":"year","expires_source_text":"2035","batteries_changed_on":"2026-05-22"},"fridge_filter":"Samsung Water Filter","supply_storage":"Cabinet","fridge_filter_5yr":false,"supply_box_location":"Shelf","water_shutoff_indoor":"Water heater closet","water_shutoff_outdoor":"I do not see one on the outside of the house if there is it’s in the water meter box and it’s flooded","breaker_panel_location":"Garage"}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = '0c98e172-9027-4020-9c16-d5dfd1774b2c'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor","Storage Closet"],"yale_module":"Connected & Setup","garage_remote":"Liftmaster","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"grill":"No Grill","tv_specs":"65\" TCL ROKU TV in Living Room \n55” TCL ROKU TV in Primary Bedroom","workstation":"Yes","tv_locations":["Primary Bedroom","Living Room"],"interior_paint":"Garage\n1 exterior of 5 galon super paint  evening blue\n1 exterior 5 galon super paint tricorn-black\n2 galon interior emerald ligh gray\n2 galon interior snowbound"}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"1- 14x24x1 \n1- 14x30x1","filter_sizes":["14x24x1","14x30x1"]}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Entryway","installed":true},"smoke":{"brand":"First Alert","notes":"N/A","expires_on":"2035-12-31","power_type":"Hardwired","battery_type":"9-Volt (Alkaline)","expires_precision":"year","expires_source_text":"2035","batteries_changed_on":"2026-05-22"},"fridge_filter":"Samsung Water Filter NSF","supply_storage":"Cabinet","fridge_filter_5yr":false,"supply_box_location":"Shelf","water_shutoff_indoor":"Water heater closet","water_shutoff_outdoor":"aside the mailbox","breaker_panel_location":"Garage"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '730 E 38th St. N.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3374658d-5f4f-818b-a1c3-e172e6748505', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND field_key = 'facts.interior_paint' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3374658d-5f4f-818b-a1c3-e172e6748505', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3374658d-5f4f-818b-a1c3-e172e6748505', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3374658d-5f4f-818b-a1c3-e172e6748505', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3374658d-5f4f-818b-a1c3-e172e6748505', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND field_key = 'systems.water_shutoff_outdoor' AND note = 'PID refresh 2026-11-12';

-- 7317 NW 159th Ter. (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Garage Door"],"yale_module":"Not Connected","garage_remote":"Overhead door Legacy 850","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"list":["Pool","Playground","Basketball Court"],"access_notes":"Pool rules can be found in the guidebook custom fields, and also save to onedrive - here. The pool is expected to be open seasonally during the summer time."}}$pid$::jsonb)).amenities,
      updated_at = now()
    WHERE id = 'ff7a1ed4-c055-47fe-ba79-4763d5a1bf01'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Garage Door"],"yale_module":"Not Connected","garage_remote":"Overhead door Legacy 850","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"list":["Pool","Playground","Basketball Court"],"access_notes":"Pool rules can be found in the guidebook custom fields, and also save to onedrive - here. The pool is open seasonally, estimated from Memorial Day weekend through Labor Day, open from 10am–10pm."}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '7317 NW 159th Ter. (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ff7a1ed4-c055-47fe-ba79-4763d5a1bf01' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3ac4658d-5f4f-80a1-9d74-f5444c6802d8', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'ff7a1ed4-c055-47fe-ba79-4763d5a1bf01' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';

-- 7351 Red Rock Rd
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'eedf6963-8cf0-45fc-b67e-2d910c79e6c4'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '7351 Red Rock Rd'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'eedf6963-8cf0-45fc-b67e-2d910c79e6c4' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 7380 S 69th E Ave
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"No Smart Module","garage_remote":"Chamberlain","emergency_key_access":"No","yale_integration_live":false}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2 trash 1 recycling","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Monday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'd14ba1d6-ae17-4c4f-9d09-134e6f84d5d3'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"No Smart Module","garage_remote":"Chamberlain","emergency_key_access":"No","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2 trash 1 recycling","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Monday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '7380 S 69th E Ave'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'd14ba1d6-ae17-4c4f-9d09-134e6f84d5d3' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'd14ba1d6-ae17-4c4f-9d09-134e6f84d5d3' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 7422 S. Granite Ave.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Door lock","key_storage":["Garage Door","HVAC","Crawl Space"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '4b0b54da-5608-4f92-8f1f-73328b83c73d'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Door lock","key_storage":["Garage Door","HVAC","Crawl Space"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '7422 S. Granite Ave.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '4b0b54da-5608-4f92-8f1f-73328b83c73d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-808f-925a-e30ea33884c2', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '4b0b54da-5608-4f92-8f1f-73328b83c73d' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 758 N. Johnson Branch Rd.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Garage doors","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'fc1cb579-d655-4558-a85d-2164026606a7'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"Garage doors","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '758 N. Johnson Branch Rd.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'fc1cb579-d655-4558-a85d-2164026606a7' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 815 E Fulton St.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor","Storage Closet"],"yale_module":"Connected & Setup","garage_remote":"Guardian","emergency_key_access":"No","yale_integration_live":false}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Tuesday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'ad110483-8a1a-4285-9f4f-d432f5d1dbda'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor","Storage Closet"],"yale_module":"Connected & Setup","garage_remote":"Guardian","emergency_key_access":"No","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Tuesday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '815 E Fulton St.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ad110483-8a1a-4285-9f4f-d432f5d1dbda' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = 'ad110483-8a1a-4285-9f4f-d432f5d1dbda' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 816 Lakeview Dr
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Lift master","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'fd6a681a-df09-4aef-a417-c47339b28fa6'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Lift master","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '816 Lakeview Dr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'fd6a681a-df09-4aef-a417-c47339b28fa6' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 817 Halley Dr.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Mailbox","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Door Tec","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '1ffa9bde-a0cb-44c5-be33-bcad961e0c56'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Mailbox","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Door Tec","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '817 Halley Dr.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1ffa9bde-a0cb-44c5-be33-bcad961e0c56' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 8217 NW 151st St. (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Not Connected","garage_remote":"Overhead legacy 850","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '00e1a3f9-be07-4ba7-9455-b81ad0938014'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Not Connected","garage_remote":"Overhead legacy 850","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8217 NW 151st St. (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '00e1a3f9-be07-4ba7-9455-b81ad0938014' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 8316 NW 142nd
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain and Overhead","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'f9638a06-f514-43a7-aafc-833ac34a817c'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain and Overhead","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8316 NW 142nd'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'f9638a06-f514-43a7-aafc-833ac34a817c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 8332 Welder Pl.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster Chamberlain Craftsman Universal Garage Door Opener Remote","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'bfbca778-19f4-4c1f-a0dd-b08986f22f51'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster Chamberlain Craftsman Universal Garage Door Opener Remote","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8332 Welder Pl.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bfbca778-19f4-4c1f-a0dd-b08986f22f51' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 8408 NW 162nd (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Teeho","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Genie model 2028","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{"brand":"Hyrdo-Rain","status":"Property Has Sprinkler System and It's Off","set_for_season":{"as_of":"2026-08-30T04:11:00.000Z","value":true,"source":"notion_pid"},"controller_location":"Garahe"}}$pid$::jsonb)).sprinklers,
      updated_at = now()
    WHERE id = 'cca8fac9-9179-4e29-aa1d-343ac036b95d'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Teeho","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"Genie model 2028","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${"brand":"Hyrdo-Rain","status":"Property Has Sprinkler System and It's Off","set_for_season":{"as_of":"2026-08-30T04:11:00.000Z","value":true,"source":"notion_pid"},"controller_location":"Garage"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8408 NW 162nd (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cca8fac9-9179-4e29-aa1d-343ac036b95d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-801a-97ac-f2907cb749b7', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'cca8fac9-9179-4e29-aa1d-343ac036b95d' AND field_key = 'sprinklers.controller_location' AND note = 'PID refresh 2026-11-12';

-- 845 Alexandria
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Mailbox"],"yale_module":"Connected & Setup","garage_remote":"Lift master","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'e479337c-fb9c-4513-bcee-e96f24f300ee'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Mailbox"],"yale_module":"Connected & Setup","garage_remote":"Lift master","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '845 Alexandria'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e479337c-fb9c-4513-bcee-e96f24f300ee' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 85 Lower Green Way
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Back/Side door - Yale\n\nFront door - Kwikset (Does not work, no batteries)","key_storage":["Side Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"None. The garage is a storage place. It is not accessible for parking.","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"list":["Pool","Basketball Court","Park","Walking Trail","Playground"],"access_notes":"Carlton Landing requires all vehicles to be registered through the link found  - here .The passcode: See Guest Access & Credentials will use in the form is 447732. Unregistered cars can be ticketed or towed, so please take care of this ahead of time.\n\nThe above information is included in the Breezeway Parking Guidelines."}}$pid$::jsonb)).amenities,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{"ownerrez_url":"https://app.ownerrez.com/properties/480824/info","breezeway_url":"https://app.breezeway.io/property/1295302/profile"}}$pid$::jsonb)).external_refs,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '82f30000-1b78-42a9-a965-5caf68c508c4'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Back/Side door - Yale\n\nFront door - Kwikset (Does not work, no batteries)","key_storage":["Side Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"None. The garage is a storage place. It is not accessible for parking.","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"list":["Pool","Basketball Court","Park","Walking Trail","Playground"],"access_notes":"Carlton Landing requires all vehicles to be registered through the link found  - \nhere \n. The passcode: [removed — credentials are not stored in Resolve] will use in the form is \n447732\n. Unregistered cars can be ticketed or towed, so please take care of this ahead of time.\n\nThe above information is included in the Breezeway Parking Guidelines."}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${"ownerrez_url":"https://app.ownerrez.com/properties/480824/info","breezeway_url":"https://app.breezeway.io/property/1295307/profile"}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"NO PETS ALLOWED\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '85 Lower Green Way'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '82f30000-1b78-42a9-a965-5caf68c508c4' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80fa-ad64-e8cf118433ba', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '82f30000-1b78-42a9-a965-5caf68c508c4' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80fa-ad64-e8cf118433ba', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '82f30000-1b78-42a9-a965-5caf68c508c4' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80fa-ad64-e8cf118433ba', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '82f30000-1b78-42a9-a965-5caf68c508c4' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 852 Inland Dr.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"yale_integration_live":false}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{}}$pid$::jsonb)).amenities,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{}}$pid$::jsonb)).facts,
      fireplace = (jsonb_populate_record(NULL::public.properties, $pid${"fireplace":{}}$pid$::jsonb)).fireplace,
      grounds = (jsonb_populate_record(NULL::public.properties, $pid${"grounds":{}}$pid$::jsonb)).grounds,
      hoa = (jsonb_populate_record(NULL::public.properties, $pid${"hoa":{}}$pid$::jsonb)).hoa,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{}}$pid$::jsonb)).hvac,
      legacy_handoff_date = (jsonb_populate_record(NULL::public.properties, $pid${"legacy_handoff_date":null}$pid$::jsonb)).legacy_handoff_date,
      listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":null}$pid$::jsonb)).listing_alias,
      neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":null}$pid$::jsonb)).neighborhood,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"2 Car Garage\nFree Parking on Premises"}}$pid$::jsonb)).parking,
      pool_spa = (jsonb_populate_record(NULL::public.properties, $pid${"pool_spa":{}}$pid$::jsonb)).pool_spa,
      security = (jsonb_populate_record(NULL::public.properties, $pid${"security":{}}$pid$::jsonb)).security,
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{}}$pid$::jsonb)).sprinklers,
      storm_shelter = (jsonb_populate_record(NULL::public.properties, $pid${"storm_shelter":{}}$pid$::jsonb)).storm_shelter,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{}}$pid$::jsonb)).systems,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_split_confirmed":false}}$pid$::jsonb)).utilities,
      warranty = (jsonb_populate_record(NULL::public.properties, $pid${"warranty":{}}$pid$::jsonb)).warranty,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"yale_integration_live":false,"emergency_key_access":"Yes","garage_remote":"Genie -LiftMaster Chamberlain Craftsman Universal Garage Door Opener Remote - https://www.amazon.com/dp/B08CNKBTYJ?ref_=ppx_hzod_title_dt_b_fed_asin_title_4_10&th=1","key_storage":["Front Door/Smartlock","Storage Closet","Storage Building","Garage Door"],"lock_brand":"Yale","yale_module":"Connected & Setup","yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"access_notes":"N/A","list":["None"]}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"grill":"No Grill","interior_paint":"N/A","tv_locations":["Living Room","Primary Bedroom"],"tv_specs":"852 Inland Dr Living room - 75,  852 INLAND DR - 55 Primary bedroom","workstation":"Yes"}$pid$::jsonb
      AND to_jsonb(fireplace) IS NOT DISTINCT FROM $pid${"fuel_type":"N/A","gas_switch":"N/A","gas_switch_location":"N/A","instructions":"N/A","model":"N/A","present":false}$pid$::jsonb
      AND to_jsonb(grounds) IS NOT DISTINCT FROM $pid${"mowing_cadence":"ARHA Responsible","mowing_days":["Wednesday"]}$pid$::jsonb
      AND to_jsonb(hoa) IS NOT DISTINCT FROM $pid${"notes + external_links":"no holiday decor over 30 days; pets/vehicles/RVs in garage only; mailboxes/decks/fences/outbuildings need approval; maintain yards & exterior colors uniformly.","present":true}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"14×24×1","filter_sizes":["14x24x1"]}$pid$::jsonb
      AND to_jsonb(legacy_handoff_date) IS NOT DISTINCT FROM $pid$"2026-10-06"$pid$::jsonb
      AND to_jsonb(listing_alias) IS NOT DISTINCT FROM $pid$"3BR Home, Avon IN | Extended & Monthly Stays"$pid$::jsonb
      AND to_jsonb(neighborhood) IS NOT DISTINCT FROM $pid$"Austin Lakes North"$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Back Storage is locked not available for guest and nothing is inside that room, Key is in the garage trim lockbox.   Spare front door key is the storage closet"$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"2 Car Garage\nFree Parking on Premises","cluster_mailbox":false,"mailbox_location":"N/A","mailbox_number":"N/A"}$pid$::jsonb
      AND to_jsonb(pool_spa) IS NOT DISTINCT FROM $pid${"present":"None"}$pid$::jsonb
      AND to_jsonb(security) IS NOT DISTINCT FROM $pid${"alarm":"No","battery_type":["Hardwired - No Battery"],"devices":["Front Door","Garage"],"monitoring_expires_on":"2027-10-09","monitoring_plan":["Active"]}$pid$::jsonb
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${"brand":"N/A","controller_location":"N/A","set_for_season":{"value":"N/A","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid"},"status":"Property Does Not Have Sprinkler System"}$pid$::jsonb
      AND to_jsonb(storm_shelter) IS NOT DISTINCT FROM $pid${"location_access":"N/A"}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"breaker_panel_location":"Garage","co":{"installed":true,"location":"Kitchen"},"fridge_filter":"Frigidaire PurePour PWF-1 refrigerator water filter — FPPWFU01","fridge_filter_5yr":false,"smoke":{"batteries_changed_on":"2026-09-25","battery_type":"9-Volt (Alkaline)","brand":"Siterwell","expires_on":"2035-09-30","expires_precision":"month","expires_source_text":"September 2035","notes":"N/A","power_type":"Hardwired"},"supply_box_location":"Top shelf in master closet","supply_storage":"Closet","water_shutoff_indoor":"Garage","water_shutoff_outdoor":"Close to the sidewalk"}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_split_confirmed":false,"router_location":"Master bedroom","wifi_ssid":"ARHA"}$pid$::jsonb
      AND to_jsonb(warranty) IS NOT DISTINCT FROM $pid${"builder_present":false,"claim_process + external_links":"N/A","furniture_expires_on":"2029-10-06"}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"cart_count":3,"cart_notes":"3","holiday_notes":"service may be delayed by up to 7 days around the following holidays","recycling":true,"recycling_days":"every other Thursday","strict_rules":"Garbage/Trash containers are only permitted to be left outside for trash collection Containers cannot be permanently stored in front of or alongside a home Must be kept in an enclosed garage on non-trash collection days","trash_days":["Thursday"],"valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'access.emergency_key_access' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'access.garage_remote' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'access.key_storage' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'access.lock_brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'amenities.list' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'facts.grill' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'facts.interior_paint' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'facts.tv_locations' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'facts.workstation' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'fireplace.fuel_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'fireplace.gas_switch' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'fireplace.gas_switch_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'fireplace.instructions' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'fireplace.model' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'fireplace.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'grounds.mowing_cadence' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'grounds.mowing_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'hoa.notes + external_links' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'hoa.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'hvac.filter_sizes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'legacy_handoff_date' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'listing_alias' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'neighborhood' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'parking.cluster_mailbox' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'parking.mailbox_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'parking.mailbox_number' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'pool_spa.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'security.alarm' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'security.battery_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'security.devices' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'security.monitoring_expires_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'security.monitoring_plan' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'sprinklers.brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'sprinklers.controller_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'sprinklers.set_for_season' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'sprinklers.status' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'storm_shelter.location_access' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.breaker_panel_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.co.installed' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.co.location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.fridge_filter_5yr' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.smoke.battery_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.smoke.brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.smoke.expires_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.smoke.expires_precision' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.smoke.expires_source_text' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.smoke.notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.smoke.power_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.supply_box_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.supply_storage' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.water_shutoff_indoor' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.water_shutoff_outdoor' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'utilities.router_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'utilities.wifi_ssid' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'warranty.builder_present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'warranty.claim_process + external_links' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'warranty.furniture_expires_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'waste.cart_count' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'waste.cart_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'waste.holiday_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'waste.recycling' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'waste.recycling_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'waste.strict_rules' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'waste.trash_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 8602 E. Galveston St.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{}}$pid$::jsonb)).access,
      compliance = (jsonb_populate_record(NULL::public.properties, $pid${"compliance":{}}$pid$::jsonb)).compliance,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{}}$pid$::jsonb)).external_refs,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{}}$pid$::jsonb)).parking,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{}}$pid$::jsonb)).utilities,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(compliance) IS NOT DISTINCT FROM $pid${"permit_status":{"text":"Permit required in Broken Arrow. $600","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true},"rental_restrictions":{"text":"No STR rental restrictions","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${"breezeway_url":"https://app.breezeway.io/property/1514896/profile"}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb
      AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"Rosewood on Galveston (8602)"$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"2 Car Garage\nFree Parking on Premises"}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_split_confirmed":false}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2026$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8602 E. Galveston St.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'compliance.permit_status' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'compliance.rental_restrictions' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';

-- 8708 Scirocco Circle
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '1e60c99a-e779-4d77-be8d-c8452f991a2d'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Genie","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8708 Scirocco Circle'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1e60c99a-e779-4d77-be8d-c8452f991a2d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 8910 N 73rd Pl E
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"Lift master","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'fd0972a5-3501-4d1f-a33b-53cfaa184ec4'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"Lift master","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8910 N 73rd Pl E'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'fd0972a5-3501-4d1f-a33b-53cfaa184ec4' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 9008 Scarlet Blvd (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '3f2435d5-406c-47f1-b943-4e34d4f839c1'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9008 Scarlet Blvd (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '3f2435d5-406c-47f1-b943-4e34d4f839c1' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 904 NE 34th Ter
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '7c33e4d9-2a9c-4924-bec0-67f337d3849d'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Chamberlain","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '904 NE 34th Ter'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '7c33e4d9-2a9c-4924-bec0-67f337d3849d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 9100 NW 123rd (30D Firm)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"DoorTec","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'c46466fa-9e9d-4b75-a4ed-715c75be06bf'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Backdoor"],"yale_module":"Connected & Setup","garage_remote":"DoorTec","emergency_key_access":"Yes","yale_integration_live":true,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9100 NW 123rd (30D Firm)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'c46466fa-9e9d-4b75-a4ed-715c75be06bf' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 9120 Yassir Blvd (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Eufy","key_storage":["Front Door/Smartlock"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'bf746f13-5146-4c9a-ac6c-f42206ca2257'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Eufy","key_storage":["Front Door/Smartlock"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9120 Yassir Blvd (30D FIRM)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bf746f13-5146-4c9a-ac6c-f42206ca2257' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 9211 Fitzgerald Dr.
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"yale_integration_live":false}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{}}$pid$::jsonb)).amenities,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{}}$pid$::jsonb)).facts,
      fireplace = (jsonb_populate_record(NULL::public.properties, $pid${"fireplace":{}}$pid$::jsonb)).fireplace,
      grounds = (jsonb_populate_record(NULL::public.properties, $pid${"grounds":{}}$pid$::jsonb)).grounds,
      hoa = (jsonb_populate_record(NULL::public.properties, $pid${"hoa":{}}$pid$::jsonb)).hoa,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{}}$pid$::jsonb)).hvac,
      listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":null}$pid$::jsonb)).listing_alias,
      neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":null}$pid$::jsonb)).neighborhood,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"2 Car Garage\nFree Parking on Premises"}}$pid$::jsonb)).parking,
      pool_spa = (jsonb_populate_record(NULL::public.properties, $pid${"pool_spa":{}}$pid$::jsonb)).pool_spa,
      security = (jsonb_populate_record(NULL::public.properties, $pid${"security":{}}$pid$::jsonb)).security,
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{}}$pid$::jsonb)).sprinklers,
      storm_shelter = (jsonb_populate_record(NULL::public.properties, $pid${"storm_shelter":{}}$pid$::jsonb)).storm_shelter,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{}}$pid$::jsonb)).systems,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_split_confirmed":false}}$pid$::jsonb)).utilities,
      warranty = (jsonb_populate_record(NULL::public.properties, $pid${"warranty":{}}$pid$::jsonb)).warranty,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"yale_integration_live":false,"emergency_key_access":"Yes","garage_remote":"R27- GDR-27 MLT - https://www.amazon.com/dp/B08CNKBTYJ?ref=fed_asin_title&th=1","key_storage":["Front Door/Smartlock","Backdoor","Garage Door"],"lock_brand":"Yale","yale_module":"Connected & Setup","yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"access_notes":"N/A","list":["Pond","Walking Trail"]}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"grill":"No Grill","interior_paint":"1. Wall color - agreeable gray SW7029\n2. Sheen - matte\n\nNo additional paint left at the property.","tv_locations":["Living Room","Primary Bedroom"],"tv_specs":"Living room -  9211 Fitzgerald Dr - 65” Roku TV, Primary Bedroom -  9211 Fitzgerald Dr - 55” Roku TV, Bonus Room -  9211 Fitzgerald Dr - 55” Roku TV","workstation":"Yes"}$pid$::jsonb
      AND to_jsonb(fireplace) IS NOT DISTINCT FROM $pid${"fuel_type":"N/A","gas_switch":"N/A","gas_switch_location":"N/A","instructions":"N/A","model":"N/A","present":false}$pid$::jsonb
      AND to_jsonb(grounds) IS NOT DISTINCT FROM $pid${"mowing_cadence":"ARHA Responsible","mowing_days":["Monday"]}$pid$::jsonb
      AND to_jsonb(hoa) IS NOT DISTINCT FROM $pid${"notes + external_links":"HOA Contact: Tried and True Management Morgan: Morgan@triedandtruemanagement.com Kim: Kim@triedandtruemanagement.com\n\nGet written HOA approval before any exterior change (no reply in 30 days means denied). No sheds, above-ground pools, chain-link or front-yard fences (6 ft max), no boats or RVs outside the garage, and nothing permanent in easements. Dues: $450 at transfer, plus annual dues up to +10%/yr with 8% late interest and liens. Home businesses can’t have customers, and fences, landscaping, and your own changes aren’t covered by the builder warranty.","present":true}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"1: 16×24×4","filter_sizes":["16x24x4"]}$pid$::jsonb
      AND to_jsonb(listing_alias) IS NOT DISTINCT FROM $pid$"4BR | Sleeps 8, Study & Bonus Room"$pid$::jsonb
      AND to_jsonb(neighborhood) IS NOT DISTINCT FROM $pid$"Fields of New Bethel"$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Intro meeting notes - 9211 Fitzgerald \n- Per the intro meeting notes, the designated plumber, HVAC contractor, and electrician must be used for at least 2 years.\n- Per the intro meeting notes, the builder will arrange meetings around 8 months and 10 months after closing.\n\nHVAC Contractor - Chris Chittum Enterprises LLC\nPlumber - R.T. Moore\nElectrical - ARCXIS\n\n**Owner does not want to see any diagnostic fees when possible."$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"2 Car Garage\nFree Parking on Premises","cluster_mailbox":false,"mailbox_location":"N/A","mailbox_number":"N/A"}$pid$::jsonb
      AND to_jsonb(pool_spa) IS NOT DISTINCT FROM $pid${"present":"None"}$pid$::jsonb
      AND to_jsonb(security) IS NOT DISTINCT FROM $pid${"alarm":"No","battery_type":["Hardwired - No Battery"],"devices":["Front Door","Driveway"],"monitoring_expires_on":"2027-10-27","monitoring_plan":["Active"]}$pid$::jsonb
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${"brand":"N/A","controller_location":"N/A","set_for_season":{"value":"N/A","as_of":"2026-11-05T21:46:00.000Z","source":"notion_pid"},"status":"Property Does Not Have Sprinkler System"}$pid$::jsonb
      AND to_jsonb(storm_shelter) IS NOT DISTINCT FROM $pid${"location_access":"N/A"}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"breaker_panel_location":"Garage","co":{"installed":true,"location":"Kitchen"},"fridge_filter":"Everydrop","fridge_filter_5yr":false,"smoke":{"batteries_changed_on":"2026-10-07","battery_type":"9-Volt (Lithium)","brand":"First alert","expires_on":"2036-12-31","expires_precision":"year","expires_source_text":"2036","notes":"N/A","power_type":"Hardwired"},"supply_box_location":"Master closet top shelf","supply_storage":"Closet","water_shutoff_indoor":"Closet under staircase","water_shutoff_outdoor":"Near the street"}$pid$::jsonb
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_split_confirmed":false,"router_location":"Living room","wifi_ssid":"ARHA"}$pid$::jsonb
      AND to_jsonb(warranty) IS NOT DISTINCT FROM $pid${"builder_expires_on":"2027-09-10","builder_present":true,"claim_process + external_links":"Dr. Horton- Christopher Bishop CSBishop@drhorton.com - 317-552-9067\n\n- The designated plumber, HVAC contractor, and electrician must be used for at least 2 years.\n\nWarranty request: https://www.drhorton.com/Warranty\n- The builder will arrange meetings around 8 months and 10 months after closing.\n- Fixtures: 1 year of coverage.\n- Mechanicals inside the walls: 2 years of coverage.\n- Roof: 4 years of coverage.\n- Foundation and load-bearing framing: 10 years of coverage.\n- RWC homeowner warranty exclusions: Section II, page 5.\n- RWC contact for matters beyond 2 years: 717-561-4480.","furniture_expires_on":"2029-10-27"}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"cart_count":2,"cart_notes":"2","holiday_notes":"Saturday","recycling":true,"recycling_days":"Every Other Friday","strict_rules":"Keep trash in enclosed cans out of street and neighbor view, don’t let it pile up, and dumping anywhere in the subdivision costs at least $150 (pickup: City of Indianapolis, 317-917-7300).","trash_days":["Friday"],"valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr.'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'access.emergency_key_access' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'access.garage_remote' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'access.key_storage' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'access.lock_brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'amenities.list' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'facts.grill' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'facts.interior_paint' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'facts.tv_locations' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'facts.workstation' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'fireplace.fuel_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'fireplace.gas_switch' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'fireplace.gas_switch_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'fireplace.instructions' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'fireplace.model' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'fireplace.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'grounds.mowing_cadence' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'grounds.mowing_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'hoa.notes + external_links' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'hoa.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'hvac.filter_sizes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'listing_alias' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'neighborhood' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'parking.cluster_mailbox' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'parking.mailbox_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'parking.mailbox_number' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'pool_spa.present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'security.alarm' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'security.battery_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'security.devices' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'security.monitoring_expires_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'security.monitoring_plan' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'sprinklers.brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'sprinklers.controller_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'sprinklers.set_for_season' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'sprinklers.status' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'storm_shelter.location_access' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.breaker_panel_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.co.installed' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.co.location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.fridge_filter_5yr' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.smoke.battery_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.smoke.brand' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.smoke.expires_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.smoke.expires_precision' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.smoke.expires_source_text' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.smoke.notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.smoke.power_type' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.supply_box_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.supply_storage' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.water_shutoff_indoor' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.water_shutoff_outdoor' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'utilities.router_location' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'utilities.wifi_ssid' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'warranty.builder_expires_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'warranty.builder_present' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'warranty.claim_process + external_links' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'warranty.furniture_expires_on' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'waste.cart_count' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'waste.cart_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'waste.holiday_notes' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'waste.recycling' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'waste.recycling_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'waste.strict_rules' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'waste.trash_days' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 9213 Anaum Ln (30D Firm)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Eufy","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"liftmaster","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '9eb43a4f-5557-4041-8066-f53b42d0ffb2'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Eufy","key_storage":["Backdoor"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"liftmaster","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9213 Anaum Ln (30D Firm)'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9eb43a4f-5557-4041-8066-f53b42d0ffb2' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 9235 E 133rd St S
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"overhead door and lifmaster","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":false,"cart_count":2,"cart_notes":"2","trash_days":["Friday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '792d6764-76e9-40e1-8bfc-e79b5dae44ee'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"overhead door and lifmaster","emergency_key_access":"Yes","yale_integration_live":false,"yale_needs_calibration":false}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":false,"cart_count":2,"cart_notes":"2","trash_days":["Friday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9235 E 133rd St S'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '792d6764-76e9-40e1-8bfc-e79b5dae44ee' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DELETE FROM public.property_field_provenance WHERE property_id = '792d6764-76e9-40e1-8bfc-e79b5dae44ee' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- Links added by the refresh.
DELETE FROM public.property_external_links WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND kind = 'system' AND url = 'https://app.breezeway.io/property/1565707/profile' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND kind = 'system' AND url = 'https://app.breezeway.io/property/1564238/profile' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND kind = 'system' AND url = 'https://app.breezeway.io/property/1563499/profile' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND kind = 'system' AND url = 'https://app.breezeway.io/property/1542591/profile' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND kind = 'system' AND url = 'https://app.breezeway.io/property/1529710/profile' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND kind = 'system' AND url = 'https://app.breezeway.io/property/1514895/profile' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND kind = 'system' AND url = 'https://app.breezeway.io/property/1514896/profile' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND kind = 'system' AND url = 'https://app.breezeway.io/property/1509882/profile' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND kind = 'system' AND url = 'https://app.breezeway.io/property/1494604/profile' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND kind = 'camera_portal' AND url = 'https://account.ring.com/account/dashboard?l=38ab7465-5308-4bc6-b18f-86c31d46b9c8' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND kind = 'legacy_onedrive' AND url = 'https://arealhomeaway-my.sharepoint.com/:f:/p/info/IgD4qXqglNXTQ7RM_sBVC-CRAZaMEv3I930Qy3fwIvZf6CI?e=s2DOXo' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND kind = 'reference' AND url = 'https://www.amazon.com/dp/B08CNKBTYJ?ref=fed_asin_title&th=1' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND kind = 'camera_portal' AND url = 'https://account.ring.com/account/dashboard?l=0441de51-a23e-4406-ba4c-9f95ca6c8eaa' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND kind = 'legacy_onedrive' AND url = 'https://arealhomeaway-my.sharepoint.com/:x:/p/info/IQALtIApLQNnR4gXp9IrdIkOAVdHJqoRLaAXzRG9_DW4LtI?e=AIgFBr' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND kind = 'reference' AND url = 'https://www.amazon.com/dp/B08CNKBTYJ?ref=fed_asin_title&th=1' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND kind = 'camera_portal' AND url = 'https://account.ring.com/account/dashboard?l=e3cc0088-0a8d-4c1d-b5f0-ab7ab39dc710' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND kind = 'builder' AND url = 'https://www.drhorton.com/Warranty' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND kind = 'legacy_onedrive' AND url = 'https://arealhomeaway-my.sharepoint.com/:x:/p/info/IQCLb1VbxTfhR5seFx_wVVyYAay_4sHqQqE49PAt_SYfzvI?e=2LBANe' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND kind = 'reference' AND url = 'https://www.amazon.com/dp/B0DH81245P?ref=fed_asin_title&th=1' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND kind = 'camera_portal' AND url = 'https://account.ring.com/account/dashboard?l=48cc62ba-579f-48e8-9a3f-ec61247146a1' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND kind = 'legacy_onedrive' AND url = 'https://arealhomeaway-my.sharepoint.com/:x:/p/info/IQDpZulpB62MRLNgXXDly5fGAWNfkJ-jKmAdfzxS2JgdcfE?e=kcgyHi' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND kind = 'reference' AND url = 'https://www.amazon.com/dp/B08CNKBTYJ?ref_=ppx_hzod_title_dt_b_fed_asin_title_4_10&th=1' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND kind = 'camera_portal' AND url = 'https://account.ring.com/account/dashboard?l=4017fdb0-9280-4981-81d5-6f65a058afd8' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND kind = 'legacy_onedrive' AND url = 'https://arealhomeaway-my.sharepoint.com/:x:/p/info/IQBcg59L-S1CRaLBAoH170T_AdmAwzN1Ae3r_-p1_7chtR4?e=4YPNBa' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;
DELETE FROM public.property_external_links WHERE property_id = '82f30000-1b78-42a9-a965-5caf68c508c4' AND kind = 'system' AND url = 'https://app.breezeway.io/property/1295307/profile' AND source = 'notion_pid' AND as_of = '2026-11-12'::timestamptz;

COMMIT;
