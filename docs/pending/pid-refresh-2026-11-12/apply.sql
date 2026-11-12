-- PID refresh 2026-11-12: DRY RUN OUTPUT. NOT RUN. Apply only with approval.
-- Makes exactly the proposed fills and updates in changes.csv, with provenance rows (value_source notion_pid).
-- Every home's UPDATE checks that the touched columns still hold the values seen in the dry run; any change aborts all.
BEGIN;

-- 10302 S. 230th East Ave (OwnerRez 446094): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":false,"cart_count":2,"cart_notes":"2","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"No Recycling at this property","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '93223fe9-7ef9-49a6-868d-bb3d62e298b0'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":false,"cart_count":2,"cart_notes":"2","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"No Recycling at this property"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '10302 S. 230th East Ave'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('93223fe9-7ef9-49a6-868d-bb3d62e298b0', 'waste.valet', 'notion_pid', '18c4658d-5f4f-80b5-8a08-dce3402682b5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 10320 Lightning Creek Dr. (30D FIRM) (OwnerRez 401685): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"grill":"No Grill","tv_specs":"ROKU Pin: [removed — credentials are not stored in Resolve]","workstation":"Yes","tv_locations":["Primary Bedroom","Other"],"interior_paint":"Unknown"}}$pid$::jsonb)).facts,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"3 Car Garage. Per the HOA cars can only be parked in the garage and driveway. Max of 3 cars in driveway. NO street parking.","mailbox_number":"N/A","cluster_mailbox":false,"mailbox_location":"N/A"}}$pid$::jsonb)).parking,
      updated_at = now()
    WHERE id = '39a26e33-37b5-4009-a157-a24b13aca00c'
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"grill":"No Grill","tv_specs":"ROKU Pin: See Guest Access & Credentials","workstation":"Yes","tv_locations":["Primary Bedroom","Other"],"interior_paint":"Unknown"}$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"3 Car Garage","mailbox_number":"N/A","cluster_mailbox":false,"mailbox_location":"N/A"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '10320 Lightning Creek Dr. (30D FIRM)'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('39a26e33-37b5-4009-a157-a24b13aca00c', 'facts.tv_specs', 'notion_pid', '1664658d-5f4f-8061-a449-ced48929fc34', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('39a26e33-37b5-4009-a157-a24b13aca00c', 'parking.summary', 'notion_pid', '1664658d-5f4f-8061-a449-ced48929fc34', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 11249 Pegasus Dr. (OwnerRez 492044): 74 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"yale_integration_live":false,"emergency_key_access":"Yes","garage_remote":"Genie https://www.amazon.com/dp/B0DH81245P?ref=fed_asin_title&th=1","key_storage":["Garage Door","Front Door/Smartlock","Front Door - Storm Door"],"lock_brand":"Yale","yale_module":"Connected & Setup"}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"access_notes":"No key necessary","list":["Basketball Court","Pond"]}}$pid$::jsonb)).amenities,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"grill":"No Grill","interior_paint":"Yes (Top shelf in the garage)","tv_locations":["Living Room","Primary Bedroom"],"tv_specs":"65\" Roku in Living Room, logged into Roku / 55\" Roku in Primary Bedroom, logged into Roku (Roku is also the TV brand)","workstation":"Yes"}}$pid$::jsonb)).facts,
      fireplace = (jsonb_populate_record(NULL::public.properties, $pid${"fireplace":{"fuel_type":"N/A","gas_switch":"N/A","gas_switch_location":"N/A","instructions":"N/A","model":"N/A","present":false}}$pid$::jsonb)).fireplace,
      grounds = (jsonb_populate_record(NULL::public.properties, $pid${"grounds":{"mowing_cadence":"ARHA Responsible","mowing_days":["Tuesday"]}}$pid$::jsonb)).grounds,
      hoa = (jsonb_populate_record(NULL::public.properties, $pid${"hoa":{"notes + external_links":"Waterman Farms HOA: no RVs/commercial vehicles parked on the street, garage must remain usable for parking, no above-ground pools.","present":true}}$pid$::jsonb)).hoa,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"14x24x1\nThis air filter is not a paper filter, the filter is metal and must be rinsed and dried fully when cleaning.\nRinse the metal air filter every 90 days (more often with pets or heavy dust); no need to replace it unless damaged.","filter_sizes":["14x24x1"]}}$pid$::jsonb)).hvac,
      legacy_handoff_date = (jsonb_populate_record(NULL::public.properties, $pid${"legacy_handoff_date":"2026-10-02"}$pid$::jsonb)).legacy_handoff_date,
      listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":"3BR Home, Noblesville | Extended & Monthly Stays"}$pid$::jsonb)).listing_alias,
      neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":"Waterman Farms"}$pid$::jsonb)).neighborhood,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"This air filter is not a paper filter, the filter is metal and must be rinsed and dried fully when cleaning.\n\nWater spicket in the backyard was repaired, however it could leak in the future over time."}$pid$::jsonb)).operating_notes,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"2 Car Garage\nFree Parking on Premises","cluster_mailbox":false,"mailbox_location":"N/A","mailbox_number":"N/A"}}$pid$::jsonb)).parking,
      pool_spa = (jsonb_populate_record(NULL::public.properties, $pid${"pool_spa":{"present":"None"}}$pid$::jsonb)).pool_spa,
      security = (jsonb_populate_record(NULL::public.properties, $pid${"security":{"alarm":"No","battery_type":["Hardwired - No Battery"],"devices":["Driveway","Front Door"],"monitoring_expires_on":"2027-10-08","monitoring_plan":["Active"]}}$pid$::jsonb)).security,
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{"brand":"N/A","controller_location":"N/A","set_for_season":{"value":"N/A","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid"},"status":"Property Does Not Have Sprinkler System"}}$pid$::jsonb)).sprinklers,
      storm_shelter = (jsonb_populate_record(NULL::public.properties, $pid${"storm_shelter":{"location_access":"N/A"}}$pid$::jsonb)).storm_shelter,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"breaker_panel_location":"Garage","co":{"installed":true,"location":"Kitchen"},"fridge_filter":"EveryDrop Filter 1 (EDR1RXD1)","fridge_filter_5yr":false,"smoke":{"batteries_changed_on":"2026-09-21","battery_type":"9-Volt (Lithium)","brand":"First Alert (7 units)","expires_on":"2036-12-31","expires_precision":"year","expires_source_text":"2036","notes":"N/A","power_type":"Hardwired"},"supply_box_location":"Top shelf of master closet","supply_storage":"Closet","water_shutoff_indoor":"Laundry room","water_shutoff_outdoor":"Front yard"}}$pid$::jsonb)).systems,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_split_confirmed":false,"router_location":"In the living room","wifi_ssid":"ARHA"}}$pid$::jsonb)).utilities,
      warranty = (jsonb_populate_record(NULL::public.properties, $pid${"warranty":{"builder_present":false,"claim_process + external_links":"N/A","furniture_expires_on":"2029-10-02"}}$pid$::jsonb)).warranty,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"cart_count":2,"cart_notes":"2","holiday_notes":"Service is delayed one day on: New Year's Day • Memorial Day • July 4th • Labor Day • Thanksgiving Day • Christmas Day","recycling":true,"recycling_days":"Every other Monday","strict_rules":"N/A","trash_days":["Monday"],"valet":"No"}}$pid$::jsonb)).waste,
      instant_book = (jsonb_populate_record(NULL::public.properties, $pid${"instant_book":true}$pid$::jsonb)).instant_book,
      updated_at = now()
    WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"yale_integration_live":false}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(fireplace) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(grounds) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(hoa) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(legacy_handoff_date) IS NOT DISTINCT FROM NULL
      AND to_jsonb(listing_alias) IS NOT DISTINCT FROM NULL
      AND to_jsonb(neighborhood) IS NOT DISTINCT FROM NULL
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"2 Car Garage\nFree Parking on Premises"}$pid$::jsonb
      AND to_jsonb(pool_spa) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(security) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(storm_shelter) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM NULL
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_split_confirmed":false}$pid$::jsonb
      AND to_jsonb(warranty) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(instant_book) IS NOT DISTINCT FROM $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'access.emergency_key_access', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'access.garage_remote', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'access.key_storage', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'access.lock_brand', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'access.yale_module', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'amenities.access_notes', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'amenities.list', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'facts.grill', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'facts.interior_paint', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'facts.tv_locations', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'facts.tv_specs', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'facts.workstation', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'fireplace.fuel_type', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'fireplace.gas_switch', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'fireplace.gas_switch_location', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'fireplace.instructions', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'fireplace.model', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'fireplace.present', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'grounds.mowing_cadence', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'grounds.mowing_days', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'hoa.notes + external_links', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'hoa.present', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'hvac.filter_notes', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'hvac.filter_sizes', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'legacy_handoff_date', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'listing_alias', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'neighborhood', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'operating_notes', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'parking.cluster_mailbox', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'parking.mailbox_location', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'parking.mailbox_number', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'pool_spa.present', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'security.alarm', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'security.battery_type', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'security.devices', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'security.monitoring_expires_on', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'security.monitoring_plan', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'sprinklers.brand', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'sprinklers.controller_location', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'sprinklers.set_for_season', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'sprinklers.status', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'storm_shelter.location_access', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.breaker_panel_location', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.co.installed', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.co.location', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.fridge_filter', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.fridge_filter_5yr', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.smoke.batteries_changed_on', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.smoke.battery_type', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.smoke.brand', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.smoke.expires_on', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.smoke.expires_precision', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.smoke.expires_source_text', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.smoke.notes', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.smoke.power_type', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.supply_box_location', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.supply_storage', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.water_shutoff_indoor', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.water_shutoff_outdoor', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'tier', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'utilities.router_location', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'utilities.wifi_ssid', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'warranty.builder_present', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'warranty.claim_process + external_links', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'warranty.furniture_expires_on', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'waste.cart_count', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'waste.cart_notes', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'waste.holiday_notes', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'waste.recycling', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'waste.recycling_days', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'waste.strict_rules', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'waste.trash_days', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'waste.valet', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'instant_book', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 11508 E 94th Pl N (OwnerRez 454815): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":false,"cart_count":1,"cart_notes":"1","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"None: Drop off at recycling center","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '53aed118-974e-4f01-8c7d-ca901677b6d7'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":false,"cart_count":1,"cart_notes":"1","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"None: Drop off at recycling center"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11508 E 94th Pl N'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('53aed118-974e-4f01-8c7d-ca901677b6d7', 'waste.valet', 'notion_pid', '1eb4658d-5f4f-81fa-a697-cb68e30a9fef', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 11514 S. Locust Ave (OwnerRez 425054): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}}$pid$::jsonb)).waste,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"The owner has a membership with \nAmerican Home Pros for annual tune ups (HVAC). For general maintenance you can try them, but from past experience, their pricing is high. \nUpdate: We have free service calls from them until July 2027 please make sure they are the first point of contact for any HVAC related issues."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '75bc895c-4401-4080-9df7-748efe8f04f1'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"The owner has a membership with \nAmerican Home Pros\n for annual tune ups (HVAC). For general maintenance you can try them, but from past experience, their pricing is high."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11514 S. Locust Ave'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('75bc895c-4401-4080-9df7-748efe8f04f1', 'waste.valet', 'notion_pid', '1664658d-5f4f-80eb-8851-d5c58fdd8485', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('75bc895c-4401-4080-9df7-748efe8f04f1', 'operating_notes', 'notion_pid', '1664658d-5f4f-80eb-8851-d5c58fdd8485', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1152 Western Yarrow Ave (OwnerRez 419166): 7 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"20x25x4","filter_sizes":["20x25x4"]}}$pid$::jsonb)).hvac,
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{"status":"Property Has Sprinkler System and It's On","brand":"Rain bird","controller_location":"Garage","set_for_season":{"value":"N/A","as_of":"2026-11-03T22:21:00.000Z","source":"notion_pid"}}}$pid$::jsonb)).sprinklers,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Kitchen island","installed":true},"smoke":{"brand":"First alert","notes":"None","expires_on":"2033-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Alkaline)","expires_precision":"year","expires_source_text":"2033","batteries_changed_on":"2026-09-16"},"fridge_filter":"GE XWFE Refrigerator Water Filter","supply_storage":"Cabinet","fridge_filter_5yr":false,"supply_box_location":"Entry way","water_shutoff_indoor":"Garage","water_shutoff_outdoor":"On curb to the right when looking at the house","breaker_panel_location":"In garage"}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8'
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"Not Mentioned"}$pid$::jsonb
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${"status":"Property Does Not Have Sprinkler System"}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Kitchen island","installed":true},"smoke":{"brand":"First alert","notes":"None","expires_on":"2033-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Alkaline)","expires_precision":"year","expires_source_text":"2033","batteries_changed_on":"2026-02-02"},"fridge_filter":"GE XWFE Refrigerator Water Filter","supply_storage":"Cabinet","fridge_filter_5yr":false,"supply_box_location":"Entry way","water_shutoff_indoor":"Garage","water_shutoff_outdoor":"On curb to the right when looking at the house","breaker_panel_location":"In garage"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1152 Western Yarrow Ave'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a24773ac-4762-499f-8349-d4a1703a0af8', 'hvac.filter_sizes', 'notion_pid', '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a24773ac-4762-499f-8349-d4a1703a0af8', 'sprinklers.brand', 'notion_pid', '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a24773ac-4762-499f-8349-d4a1703a0af8', 'sprinklers.controller_location', 'notion_pid', '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a24773ac-4762-499f-8349-d4a1703a0af8', 'sprinklers.set_for_season', 'notion_pid', '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a24773ac-4762-499f-8349-d4a1703a0af8', 'hvac.filter_notes', 'notion_pid', '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a24773ac-4762-499f-8349-d4a1703a0af8', 'sprinklers.status', 'notion_pid', '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a24773ac-4762-499f-8349-d4a1703a0af8', 'systems.smoke.batteries_changed_on', 'notion_pid', '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1169 Blue Sky Lane (OwnerRez 418726): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Kitchen","installed":true},"smoke":{"brand":"First alert","notes":"One smoke alarm was missing we replaced it.","expires_on":"2033-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Lithium)","expires_precision":"year","expires_source_text":"2033","batteries_changed_on":"2026-09-17"},"fridge_filter":"FPPWFU01","supply_storage":"Cabinet","fridge_filter_5yr":false,"supply_box_location":"Primary bedroom closet.","water_shutoff_indoor":"Unsure","water_shutoff_outdoor":"Unsure","breaker_panel_location":"Garage."}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = '1be61e2e-6ca3-41f4-93de-2fe22f440267'
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Kitchen","installed":true},"smoke":{"brand":"First alert","notes":"One smoke alarm was missing we replaced it.","expires_on":"2033-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Lithium)","expires_precision":"year","expires_source_text":"2033","batteries_changed_on":"2025-10-29"},"fridge_filter":"FPPWFU01","supply_storage":"Cabinet","fridge_filter_5yr":false,"supply_box_location":"Primary bedroom closet.","water_shutoff_indoor":"Unsure","water_shutoff_outdoor":"Unsure","breaker_panel_location":"Garage."}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1169 Blue Sky Lane'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('1be61e2e-6ca3-41f4-93de-2fe22f440267', 'systems.smoke.batteries_changed_on', 'notion_pid', '1664658d-5f4f-8065-b0e0-f007b0cb0a2e', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1215 N Elder Ave (OwnerRez 409727): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '7a65ee79-900e-414d-a496-bb2077d6046c'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1215 N Elder Ave'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('7a65ee79-900e-414d-a496-bb2077d6046c', 'waste.valet', 'notion_pid', '1664658d-5f4f-8027-9f1c-dae1dbd47770', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 13325 E 43rd Pl S (OwnerRez 428972): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Tuesday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'c92c13e5-27d8-4f4e-b0e8-59638169a140'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Tuesday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '13325 E 43rd Pl S'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('c92c13e5-27d8-4f4e-b0e8-59638169a140', 'waste.valet', 'notion_pid', '1664658d-5f4f-80c1-996a-f7b3cad4084f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 136 Magnolia Estates St (OwnerRez 433281): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Counter kitchen","installed":false},"smoke":{"brand":"First alert","notes":"None","expires_on":"2033-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Alkaline)","expires_precision":"year","expires_source_text":"2033","batteries_changed_on":"2026-09-04"},"fridge_filter":"Fppwfu01","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"None","water_shutoff_outdoor":"On side walk","breaker_panel_location":"Outside left"}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = 'e7f578f0-4000-4a80-b6d0-70bf2bc45122'
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Counter kitchen","installed":false},"smoke":{"brand":"First alert","notes":"None","expires_on":"2033-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Alkaline)","expires_precision":"year","expires_source_text":"2033","batteries_changed_on":"2025-08-13"},"fridge_filter":"Fppwfu01","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"None","water_shutoff_outdoor":"On side walk","breaker_panel_location":"Outside left"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '136 Magnolia Estates St'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e7f578f0-4000-4a80-b6d0-70bf2bc45122', 'systems.smoke.batteries_changed_on', 'notion_pid', '1664658d-5f4f-8008-bbe8-f5c98ca070dd', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1399 Foxtail Ln. (OwnerRez 494863): 84 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"emergency_key_access":"Yes","garage_remote":"LiftMaster","key_storage":["Mailbox","Front Door/Smartlock","Backdoor","Storage Closet","Back Door - Storm Door"],"lock_brand":"Yale","yale_integration_live":false,"yale_module":"Connected & Setup"}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"access_notes":"The CC&Rs do not list specific amenities, access instructions, or fees. The neighborhood ponds are for drainage and views only; swimming, ice skating, and boating are not permitted.","list":["Pond"]}}$pid$::jsonb)).amenities,
      compliance = (jsonb_populate_record(NULL::public.properties, $pid${"compliance":{"permit_status":{"text":"No permit required for Greenwood, IN","as_of":"2026-11-05T17:51:00.000Z","source":"notion_pid","reference_only":true},"rental_restrictions":{"text":"No STR rental restrictions","as_of":"2026-11-05T17:51:00.000Z","source":"notion_pid","reference_only":true}}}$pid$::jsonb)).compliance,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{"breezeway_url":"https://app.breezeway.io/property/1494604/profile","ownerrez_url":"https://app.ownerrez.com/properties/494863/info"}}$pid$::jsonb)).external_refs,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"grill":"No Grill","interior_paint":"Unknown. No extra paint left","tv_locations":["Living Room","Primary Bedroom"],"tv_specs":"55\" Roku QLED TV in Primary Bedroom, logged into Roku. 65\" Roku QLED TV in Living Room, logged into Roku.","workstation":"No"}}$pid$::jsonb)).facts,
      fireplace = (jsonb_populate_record(NULL::public.properties, $pid${"fireplace":{"fuel_type":"N/A","gas_switch":"N/A","gas_switch_location":"N/A","instructions":"N/A","model":"N/A","present":false}}$pid$::jsonb)).fireplace,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package,
      grounds = (jsonb_populate_record(NULL::public.properties, $pid${"grounds":{"mowing_cadence":"ARHA Responsible","mowing_days":["Monday"]}}$pid$::jsonb)).grounds,
      hoa = (jsonb_populate_record(NULL::public.properties, $pid${"hoa":{"notes + external_links":"The HOA for Lone Pine Farms is administered by Ardsley Management, which can be reached at (317) 253-1401 or via email at indianapolisinfo@drhorton.com.","present":true}}$pid$::jsonb)).hoa,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"1 -16×25×4","filter_sizes":["16x25x4"]}}$pid$::jsonb)).hvac,
      instant_book = (jsonb_populate_record(NULL::public.properties, $pid${"instant_book":true}$pid$::jsonb)).instant_book,
      listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":"Cozy 4BR Home | Greenwood | Pet Friendly"}$pid$::jsonb)).listing_alias,
      market = (jsonb_populate_record(NULL::public.properties, $pid${"market":"Indy"}$pid$::jsonb)).market,
      neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":"Lone Pine Farms"}$pid$::jsonb)).neighborhood,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"Foxtail Hollow (1399)"}$pid$::jsonb)).nickname,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"No"}$pid$::jsonb)).operating_notes,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"cluster_mailbox":true,"mailbox_location":"The cluster mailbox #1399 is at the corner of Foxtail Ln and Sumatran Ln, a short walk east of the house. Key is located inside the lock box on the garage trim.","mailbox_number":"1399","summary":"2 Car Garage\nFree Parking on Premises"}}$pid$::jsonb)).parking,
      pool_spa = (jsonb_populate_record(NULL::public.properties, $pid${"pool_spa":{"present":"None"}}$pid$::jsonb)).pool_spa,
      security = (jsonb_populate_record(NULL::public.properties, $pid${"security":{"alarm":"No","battery_type":["Hardwired - No Battery"],"devices":["Front Door","Driveway"],"monitoring_expires_on":"2027-11-15","monitoring_plan":["Active"]}}$pid$::jsonb)).security,
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{"brand":"N/A","controller_location":"N/A","set_for_season":{"value":"N/A","as_of":"2026-11-05T17:51:00.000Z","source":"notion_pid"},"status":"Property Does Not Have Sprinkler System"}}$pid$::jsonb)).sprinklers,
      storm_shelter = (jsonb_populate_record(NULL::public.properties, $pid${"storm_shelter":{"location_access":"N/A"}}$pid$::jsonb)).storm_shelter,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"breaker_panel_location":"Garage","co":{"installed":true,"location":"Kitchen"},"fridge_filter":"EDR1RXD1 (Everydrop Filter 1 / Whirlpool W10295370A compatible)","fridge_filter_5yr":false,"smoke":{"batteries_changed_on":"2026-10-22","battery_type":"9-Volt (Lithium)","brand":"First alert","expires_on":"2034-12-31","expires_precision":"year","expires_source_text":"2034","notes":"N/A","power_type":"Hardwired"},"supply_box_location":"Top shelf of Master closet","supply_storage":"Closet","water_shutoff_indoor":"Closet with furnace","water_shutoff_outdoor":"Near sidewalk"}}$pid$::jsonb)).systems,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"router_location":"Living room","wifi_split_confirmed":false,"wifi_ssid":"ARHA"}}$pid$::jsonb)).utilities,
      warranty = (jsonb_populate_record(NULL::public.properties, $pid${"warranty":{"builder_present":false,"claim_process + external_links":"N/A","furniture_expires_on":"2029-11-04"}}$pid$::jsonb)).warranty,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"cart_count":2,"cart_notes":"2 trash cans and 1 recycling","holiday_notes":"If one of the following holidays falls on a Monday through Thursday, trash pickup will be delayed by one day one day: New Year's Day • Memorial Day • July 4th • Labor Day • Thanksgiving Day • Christmas Day","recycling":true,"recycling_days":"Every other Thursday.","strict_rules":"N/A","trash_days":["Thursday"],"valet":"No"}}$pid$::jsonb)).waste,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2024}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(compliance) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(fireplace) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL
      AND to_jsonb(grounds) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(hoa) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(instant_book) IS NOT DISTINCT FROM NULL
      AND to_jsonb(listing_alias) IS NOT DISTINCT FROM NULL
      AND to_jsonb(market) IS NOT DISTINCT FROM NULL
      AND to_jsonb(neighborhood) IS NOT DISTINCT FROM NULL
      AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(pool_spa) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(security) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(storm_shelter) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM NULL
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(warranty) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'access.emergency_key_access', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'access.garage_remote', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'access.key_storage', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'access.lock_brand', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'access.yale_integration_live', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'access.yale_module', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'amenities.access_notes', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'amenities.list', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'compliance.permit_status', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'compliance.rental_restrictions', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'external_refs.breezeway_url', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'external_refs.ownerrez_url', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'facts.grill', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'facts.interior_paint', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'facts.tv_locations', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'facts.tv_specs', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'facts.workstation', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'fireplace.fuel_type', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'fireplace.gas_switch', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'fireplace.gas_switch_location', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'fireplace.instructions', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'fireplace.model', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'fireplace.present', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'furniture_package', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'grounds.mowing_cadence', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'grounds.mowing_days', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'hoa.notes + external_links', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'hoa.present', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'hvac.filter_notes', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'hvac.filter_sizes', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'instant_book', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'listing_alias', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'market', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'neighborhood', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'nickname', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'operating_notes', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'parking.cluster_mailbox', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'parking.mailbox_location', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'parking.mailbox_number', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'parking.summary', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'pool_spa.present', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'security.alarm', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'security.battery_type', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'security.devices', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'security.monitoring_expires_on', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'security.monitoring_plan', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'sprinklers.brand', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'sprinklers.controller_location', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'sprinklers.set_for_season', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'sprinklers.status', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'storm_shelter.location_access', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.breaker_panel_location', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.co.installed', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.co.location', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.fridge_filter', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.fridge_filter_5yr', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.smoke.batteries_changed_on', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.smoke.battery_type', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.smoke.brand', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.smoke.expires_on', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.smoke.expires_precision', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.smoke.expires_source_text', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.smoke.notes', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.smoke.power_type', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.supply_box_location', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.supply_storage', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.water_shutoff_indoor', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.water_shutoff_outdoor', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'tier', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'utilities.router_location', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'utilities.wifi_split_confirmed', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'utilities.wifi_ssid', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'warranty.builder_present', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'warranty.claim_process + external_links', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'warranty.furniture_expires_on', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'waste.cart_count', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'waste.cart_notes', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'waste.holiday_notes', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'waste.recycling', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'waste.recycling_days', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'waste.strict_rules', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'waste.trash_days', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'waste.valet', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'year_built', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 14553 Serrano Ridge Rd (OwnerRez 423193): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster 380 UT","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Kitchen counter","installed":true},"smoke":{"brand":"First alert","notes":"We are changing them today.","expires_on":"2025-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Lithium)","expires_precision":"year","expires_source_text":"2025","batteries_changed_on":"2026-09-08"},"fridge_filter":"Not Mentioned","supply_storage":"N/A","fridge_filter_5yr":false,"supply_box_location":"None","water_shutoff_indoor":"Unsure","water_shutoff_outdoor":"Unsure","breaker_panel_location":"Garage"}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = 'dafa6257-99d1-4a71-9e18-b02394c6807d'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Mailbox","Front Door/Smartlock"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster 38OUT","emergency_key_access":"Yes","yale_integration_live":false}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Kitchen counter","installed":true},"smoke":{"brand":"First alert","notes":"We are changing them today.","expires_on":"2025-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Lithium)","expires_precision":"year","expires_source_text":"2025","batteries_changed_on":"2025-10-16"},"fridge_filter":"Not Mentioned","supply_storage":"N/A","fridge_filter_5yr":false,"supply_box_location":"None","water_shutoff_indoor":"Unsure","water_shutoff_outdoor":"Unsure","breaker_panel_location":"Garage"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '14553 Serrano Ridge Rd'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('dafa6257-99d1-4a71-9e18-b02394c6807d', 'access.garage_remote', 'notion_pid', '1664658d-5f4f-80a5-88d4-ec54ad9b0530', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('dafa6257-99d1-4a71-9e18-b02394c6807d', 'systems.smoke.batteries_changed_on', 'notion_pid', '1664658d-5f4f-80a5-88d4-ec54ad9b0530', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1464 Buckland Ct. (OwnerRez 496703): 13 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"yale_integration_live":false}}$pid$::jsonb)).access,
      compliance = (jsonb_populate_record(NULL::public.properties, $pid${"compliance":{"permit_status":{"text":"No permit required for Avon, IN","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true},"rental_restrictions":{"text":"No STR rental restrictions","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}}}$pid$::jsonb)).compliance,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{"breezeway_url":"https://app.breezeway.io/property/1509882/profile","ownerrez_url":"https://app.ownerrez.com/properties/496703/info"}}$pid$::jsonb)).external_refs,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package,
      instant_book = (jsonb_populate_record(NULL::public.properties, $pid${"instant_book":false}$pid$::jsonb)).instant_book,
      market = (jsonb_populate_record(NULL::public.properties, $pid${"market":"Indy"}$pid$::jsonb)).market,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"The Buckland Blue (1464)"}$pid$::jsonb)).nickname,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"2 Car Garage\nFree Parking on Premises"}}$pid$::jsonb)).parking,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_split_confirmed":false}}$pid$::jsonb)).utilities,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2021}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(compliance) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL
      AND to_jsonb(instant_book) IS NOT DISTINCT FROM NULL
      AND to_jsonb(market) IS NOT DISTINCT FROM NULL
      AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM NULL
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1464 Buckland Ct.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'access.yale_integration_live', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'compliance.permit_status', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'compliance.rental_restrictions', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'external_refs.breezeway_url', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'external_refs.ownerrez_url', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'furniture_package', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'instant_book', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'market', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'nickname', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'parking.summary', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'tier', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'utilities.wifi_split_confirmed', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'year_built', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 15701 E 75th Pl N (OwnerRez 418086): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":false,"cart_count":2,"cart_notes":"2","trash_days":["Friday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"None: Drop off at recycling center","valet":"No"}}$pid$::jsonb)).waste,
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"Lifmaster","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = 'eeb11e56-921e-4f30-95ef-f044b21b85c2'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":false,"cart_count":2,"cart_notes":"2","trash_days":["Friday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"None: Drop off at recycling center"}$pid$::jsonb
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["Front Door/Smartlock","Backdoor"],"yale_module":"Not Connected","garage_remote":"Lifmaster","emergency_key_access":"Yes","yale_integration_live":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '15701 E 75th Pl N'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('eeb11e56-921e-4f30-95ef-f044b21b85c2', 'waste.valet', 'notion_pid', '1664658d-5f4f-80ad-b194-d8d87cdbda74', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('eeb11e56-921e-4f30-95ef-f044b21b85c2', 'access.yale_module', 'notion_pid', '1664658d-5f4f-80ad-b194-d8d87cdbda74', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1600 E Quantico St (OwnerRez 407261): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":"Not Mentioned","cart_notes":"Not Mentioned","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Tuesday","valet":"No"}}$pid$::jsonb)).waste,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"tv_specs":"Smart TV ROKU Pin: [removed — credentials are not stored in Resolve]","workstation":"Not Mentioned","tv_locations":["Primary Bedroom","Living Room"]}}$pid$::jsonb)).facts,
      updated_at = now()
    WHERE id = 'cf867f48-f4df-4710-9e49-10bb17b41ed4'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":"Not Mentioned","cart_notes":"Not Mentioned","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Tuesday"}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"tv_specs":"Smart TV ROKU Pin: See Guest Access & Credentials","workstation":"Not Mentioned","tv_locations":["Primary Bedroom","Living Room"]}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1600 E Quantico St'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cf867f48-f4df-4710-9e49-10bb17b41ed4', 'waste.valet', 'notion_pid', '1664658d-5f4f-80f9-988d-d0d7a4f962ac', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cf867f48-f4df-4710-9e49-10bb17b41ed4', 'facts.tv_specs', 'notion_pid', '1664658d-5f4f-80f9-988d-d0d7a4f962ac', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1700 Whispering Creek Dr (OwnerRez 348274): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."}$pid$::jsonb)).operating_notes,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"grill":"Charcoal Grill","tv_specs":"ROKU Pin: [removed — credentials are not stored in Resolve]\nROKU Email: \ncdunham1119@gmail.com","workstation":"No","tv_locations":["Primary Bedroom","Living Room"],"interior_paint":"Unsure"}}$pid$::jsonb)).facts,
      updated_at = now()
    WHERE id = '96e08138-1c9e-4297-8da8-a6ae1a2f52d7'
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"grill":"Charcoal Grill","tv_specs":"ROKU Pin: See Guest Access & Credentials\nROKU Email: \ncdunham1119@gmail.com","workstation":"No","tv_locations":["Primary Bedroom","Living Room"],"interior_paint":"Unsure"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1700 Whispering Creek Dr'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('96e08138-1c9e-4297-8da8-a6ae1a2f52d7', 'operating_notes', 'notion_pid', '1664658d-5f4f-80df-84c1-de33f73dc3ee', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('96e08138-1c9e-4297-8da8-a6ae1a2f52d7', 'facts.tv_specs', 'notion_pid', '1664658d-5f4f-80df-84c1-de33f73dc3ee', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1722 Westchester Dr (OwnerRez 480829): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = 'c2dfe50d-2428-4cfe-b6d7-ca54578a17d1'
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1722 Westchester Dr'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('c2dfe50d-2428-4cfe-b6d7-ca54578a17d1', 'operating_notes', 'notion_pid', '3184658d-5f4f-80a7-bae8-f6d0a003b669', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1908 E Urbana St (OwnerRez 460239): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'ed21dc09-34d2-4c7b-9d1b-2d5eb561a4a7'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1908 E Urbana St'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ed21dc09-34d2-4c7b-9d1b-2d5eb561a4a7', 'waste.valet', 'notion_pid', '22b4658d-5f4f-811b-8ff1-f97bb9697ba5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 19104 Meadows Crossings (OwnerRez 340884): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '1d949a24-c216-4e3c-9290-c08997fe688d'
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '19104 Meadows Crossings'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('1d949a24-c216-4e3c-9290-c08997fe688d', 'operating_notes', 'notion_pid', '1664658d-5f4f-8041-89f0-f9a03af55afa', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 19117 Meadows Crossing (30D FIRM) (OwnerRez 348614): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = 'ce75f670-ff56-4c14-8159-5072b6d31bc7'
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '19117 Meadows Crossing (30D FIRM)'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ce75f670-ff56-4c14-8159-5072b6d31bc7', 'operating_notes', 'notion_pid', '1664658d-5f4f-803d-94ec-fbc71706bc20', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 19120 Meadows Crossing (OwnerRez 347789): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '4b4fdb62-fc3e-4a83-ba0a-391fac682f1d'
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '19120 Meadows Crossing'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('4b4fdb62-fc3e-4a83-ba0a-391fac682f1d', 'operating_notes', 'notion_pid', '1664658d-5f4f-808e-b16e-e84c1ce41ed9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2004 Cedar Ridge Rd. (OwnerRez 480827): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = 'de4a6e71-6fd8-4c4a-8d58-b935c4173e1f'
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2004 Cedar Ridge Rd.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('de4a6e71-6fd8-4c4a-8d58-b935c4173e1f', 'operating_notes', 'notion_pid', '3184658d-5f4f-8091-8112-fad5a8380da7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2014 E 52nd St (OwnerRez 409665): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '8e4dec0f-78d4-4dcb-86e5-e0ea2dd5584f'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2014 E 52nd St'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8e4dec0f-78d4-4dcb-86e5-e0ea2dd5584f', 'waste.valet', 'notion_pid', '1664658d-5f4f-80e9-9065-f53cb89d7ef0', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 236 N. Starnes St. (30D FIRM) (OwnerRez 483140): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","key_storage":["N/A","Front Door/Smartlock","Backdoor"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":true}}$pid$::jsonb)).access,
      updated_at = now()
    WHERE id = '3e33a82f-0ad2-4659-9d47-a59f72c01a7b'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale","key_storage":["N/A"],"yale_module":"Connected & Setup","garage_remote":"LiftMaster","emergency_key_access":"Yes","yale_integration_live":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '236 N. Starnes St. (30D FIRM)'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('3e33a82f-0ad2-4659-9d47-a59f72c01a7b', 'access.key_storage', 'notion_pid', '3184658d-5f4f-8084-bdf2-d4679493ddbb', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 250 Springfield Xing (OwnerRez 497213): 13 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"yale_integration_live":false}}$pid$::jsonb)).access,
      compliance = (jsonb_populate_record(NULL::public.properties, $pid${"compliance":{"permit_status":{"text":"No permit required for Greenfield, IN","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true},"rental_restrictions":{"text":"No STR rental restrictions","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}}}$pid$::jsonb)).compliance,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{"notion_pid_url":"https://app.notion.com/3e44658d5f4f81ea90d9fae89cf6579c","breezeway_url":"https://app.breezeway.io/property/1514895/profile","ownerrez_url":"https://app.ownerrez.com/properties/497213/info"}}$pid$::jsonb)).external_refs,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package,
      instant_book = (jsonb_populate_record(NULL::public.properties, $pid${"instant_book":false}$pid$::jsonb)).instant_book,
      market = (jsonb_populate_record(NULL::public.properties, $pid${"market":"Indy"}$pid$::jsonb)).market,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"Springfield Sanctuary (250)"}$pid$::jsonb)).nickname,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"3 Car Garage\nFree Parking on Premises"}}$pid$::jsonb)).parking,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_split_confirmed":false}}$pid$::jsonb)).utilities,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2026}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(compliance) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${"notion_pid_url":"https://app.notion.com/3e44658d5f4f81ea90d9fae89cf6579c"}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL
      AND to_jsonb(instant_book) IS NOT DISTINCT FROM NULL
      AND to_jsonb(market) IS NOT DISTINCT FROM NULL
      AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM NULL
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '250 Springfield Xing'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'access.yale_integration_live', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'compliance.permit_status', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'compliance.rental_restrictions', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'external_refs.breezeway_url', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'external_refs.ownerrez_url', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'furniture_package', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'instant_book', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'market', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'nickname', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'parking.summary', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'tier', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'utilities.wifi_split_confirmed', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'year_built', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2522 S Irvington Ave (OwnerRez 410055): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2 trash cans 1 recycling","trash_days":["Friday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Friday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'b5ca6769-c083-4091-b185-d887ff8c7323'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2 trash cans 1 recycling","trash_days":["Friday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Friday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2522 S Irvington Ave'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('b5ca6769-c083-4091-b185-d887ff8c7323', 'waste.valet', 'notion_pid', '1664658d-5f4f-80a4-9dcb-e87b971a650f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2527 NE 15th St (OwnerRez 453185): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_ssid":"ARHA","router_location":"Storage closet.","wifi_split_confirmed":false}}$pid$::jsonb)).utilities,
      updated_at = now()
    WHERE id = '632db464-d193-4671-96cd-1b899a8f2a1a'
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_ssid":"Arealhomeaway","router_location":"Storage closet.","wifi_split_confirmed":false}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2527 NE 15th St'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('632db464-d193-4671-96cd-1b899a8f2a1a', 'utilities.wifi_ssid', 'notion_pid', '1d74658d-5f4f-80b4-8012-e5d6e9e7ca53', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2536 NW 116th (12M) (OwnerRez 349768): 28 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"None","key_storage":["Front Door/Smartlock"],"yale_integration_live":false,"emergency_key_access":"Yes","garage_remote":"Unknown","yale_module":"Not Applicable (Not Yale)"}}$pid$::jsonb)).access,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"tv_specs":"Smart TV (Not Sure)","workstation":"Not Mentioned","tv_locations":["Primary Bedroom","Living Room"],"grill":"No Grill","interior_paint":"Unsure"}}$pid$::jsonb)).facts,
      fireplace = (jsonb_populate_record(NULL::public.properties, $pid${"fireplace":{"present":false}}$pid$::jsonb)).fireplace,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"16x30x1 and 14x20x1","filter_sizes":["16x30x1","14x20x1"]}}$pid$::jsonb)).hvac,
      neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":"Unsure"}$pid$::jsonb)).neighborhood,
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{"status":"Property Does Not Have Sprinkler System"}}$pid$::jsonb)).sprinklers,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"fridge_filter":"HAF-CIN","breaker_panel_location":"Garage","co":{"installed":false,"location":"Kitchen"},"fridge_filter_5yr":false,"smoke":{"batteries_changed_on":"2026-09-22","battery_type":"9-Volt (Alkaline)","brand":"First Alert","expires_on":"2030-12-31","expires_precision":"year","expires_source_text":"2030","notes":"None","power_type":"Battery Powered"},"supply_box_location":"Na","supply_storage":"N/A","water_shutoff_outdoor":"At curb"}}$pid$::jsonb)).systems,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"On Property Garage (\nNo more Information\n)"}}$pid$::jsonb)).parking,
      updated_at = now()
    WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"None","key_storage":["Front Door/Smartlock"],"yale_integration_live":false}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"tv_specs":"Smart TV (Not Sure)","workstation":"No","tv_locations":["Primary Bedroom","Living Room"]}$pid$::jsonb
      AND to_jsonb(fireplace) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"Not Mentioned"}$pid$::jsonb
      AND to_jsonb(neighborhood) IS NOT DISTINCT FROM NULL
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"fridge_filter":"Not Mentioned"}$pid$::jsonb
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"On Property Garage (No more Information)"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M)'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'access.emergency_key_access', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'access.garage_remote', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'access.yale_module', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'facts.grill', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'facts.interior_paint', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'fireplace.present', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'hvac.filter_sizes', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'neighborhood', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'sprinklers.status', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.breaker_panel_location', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.co.installed', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.co.location', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.fridge_filter_5yr', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.smoke.batteries_changed_on', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.smoke.battery_type', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.smoke.brand', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.smoke.expires_on', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.smoke.expires_precision', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.smoke.expires_source_text', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.smoke.notes', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.smoke.power_type', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.supply_box_location', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.supply_storage', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.water_shutoff_outdoor', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'facts.workstation', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'hvac.filter_notes', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'parking.summary', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.fridge_filter', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2601 W 65th St S (OwnerRez 501998): 11 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"yale_integration_live":false}}$pid$::jsonb)).access,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{"notion_pid_url":"https://app.notion.com/4134658d5f4f813eb405e425343a2cd2","breezeway_url":"https://app.breezeway.io/property/1564238/profile","ownerrez_url":"https://app.ownerrez.com/properties/501998/info"}}$pid$::jsonb)).external_refs,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package,
      instant_book = (jsonb_populate_record(NULL::public.properties, $pid${"instant_book":false}$pid$::jsonb)).instant_book,
      market = (jsonb_populate_record(NULL::public.properties, $pid${"market":"Tulsa"}$pid$::jsonb)).market,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"Hillside Hollow (2601)"}$pid$::jsonb)).nickname,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"2 Car Garage\nFree Parking on Premises"}}$pid$::jsonb)).parking,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_split_confirmed":false}}$pid$::jsonb)).utilities,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2026}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${"notion_pid_url":"https://app.notion.com/4134658d5f4f813eb405e425343a2cd2"}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL
      AND to_jsonb(instant_book) IS NOT DISTINCT FROM NULL
      AND to_jsonb(market) IS NOT DISTINCT FROM NULL
      AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM NULL
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2601 W 65th St S'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'access.yale_integration_live', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'external_refs.breezeway_url', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'external_refs.ownerrez_url', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'furniture_package', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'instant_book', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'market', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'nickname', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'parking.summary', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'tier', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'utilities.wifi_split_confirmed', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'year_built', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2617 W Madison St. (OwnerRez 406964): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '47a804ef-0d9e-4a81-8eb9-6c2b261e1313'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2617 W Madison St.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('47a804ef-0d9e-4a81-8eb9-6c2b261e1313', 'waste.valet', 'notion_pid', '1664658d-5f4f-80f2-89f8-d8b081d5bdc2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2817 Hazel Hollow (OwnerRez 474143): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"There are two returns inside the house. However, those are not getting used. There is a big 5 inch filter in the attic that the owner only wants changed.\nDo not install filters in the house.","filter_sizes":["20x30x1","14x14x1"]}}$pid$::jsonb)).hvac,
      updated_at = now()
    WHERE id = '956cc7c9-1193-409c-a2ab-9bd2fc312646'
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"There are two returns inside the house. However, those are not getting used. There is a big 5 inch filter in the attic that the owner only wants changed.\nDo not install these filters in the house:\n  • 20x30x1 - 1 \n  • 14x14x1 - 1","filter_sizes":["20x30x1","14x14x1"]}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2817 Hazel Hollow'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('956cc7c9-1193-409c-a2ab-9bd2fc312646', 'hvac.filter_notes', 'notion_pid', '2e84658d-5f4f-81ac-8dab-c2270877a1ab', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2901 E. 75th St. (OwnerRez 480826): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = 'e0178350-7c7b-43e4-b11d-0bd8c15cee9e'
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact.nown"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2901 E. 75th St.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0178350-7c7b-43e4-b11d-0bd8c15cee9e', 'operating_notes', 'notion_pid', '3184658d-5f4f-80ed-8a8b-fb074766880d', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3000 W Charlotte St (OwnerRez 411823): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Monday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '08fe042b-2dad-4487-b515-a38ab3ad07d8'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Monday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3000 W Charlotte St'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('08fe042b-2dad-4487-b515-a38ab3ad07d8', 'waste.valet', 'notion_pid', '1664658d-5f4f-80de-a1e9-e38d00273370', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3012 Piper St (OwnerRez 451638): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"1: 14x30x1 & 91-005\n\nThere is a 16x25x4 filter inside the unit in the attic. this needs to be changed every 6 months. (it was changed on Sep 2026 by Silver Creek)","filter_sizes":["14x30x1","16x25x4"]}}$pid$::jsonb)).hvac,
      updated_at = now()
    WHERE id = '4e2f9e8b-dd08-4381-9cab-c3664a4bdad8'
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"1: 14x30x1","filter_sizes":["14x30x1"]}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3012 Piper St'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('4e2f9e8b-dd08-4381-9cab-c3664a4bdad8', 'hvac.filter_notes', 'notion_pid', '1c24658d-5f4f-804f-8acc-ddc2000707a8', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('4e2f9e8b-dd08-4381-9cab-c3664a4bdad8', 'hvac.filter_sizes', 'notion_pid', '1c24658d-5f4f-804f-8acc-ddc2000707a8', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3029 NW 181st (OwnerRez 347550): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = 'd1bfd0f9-789c-40c2-b1cf-2ecd97239dc9'
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3029 NW 181st'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('d1bfd0f9-789c-40c2-b1cf-2ecd97239dc9', 'operating_notes', 'notion_pid', '1664658d-5f4f-8086-8eb5-dc9df55a74b5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3040 NW 183rd St. (30D FIRM) (OwnerRez 388604): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Kitchen","installed":true},"smoke":{"brand":"First Alert","notes":"None","expires_on":"2027-12-31","power_type":"Hardwired","battery_type":"9-Volt (Alkaline)","expires_precision":"year","expires_source_text":"2027","batteries_changed_on":"2025-08-05"},"fridge_filter":"GF-841 ( HAF-QIN/EXP)","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"N/A","water_shutoff_indoor":"Guest bedroom 1 closet","water_shutoff_outdoor":"At curb to the left of driveway","breaker_panel_location":"Garage"}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = '6b32409d-98f4-4491-9069-0c3823599755'
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Kitchen","installed":true},"smoke":{"brand":"First Alert","notes":"None","expires_on":"2027-12-31","power_type":"Hardwired","battery_type":"9-Volt (Alkaline)","expires_precision":"year","expires_source_text":"2027","batteries_changed_on":"2025-08-05"},"fridge_filter":"GF-841","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"N/A","water_shutoff_indoor":"Guest bedroom 1 closet","water_shutoff_outdoor":"At curb to the left of driveway","breaker_panel_location":"Garage"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3040 NW 183rd St. (30D FIRM)'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('6b32409d-98f4-4491-9069-0c3823599755', 'systems.fridge_filter', 'notion_pid', '1664658d-5f4f-80ae-8217-e3a02b42882c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 305 W 7th St. (OwnerRez 479698): 3 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"grill":"No Grill","tv_specs":"Living Room - 305 W 7th ST - 65\nPrimary bedroom- 65","workstation":"No","tv_locations":["Living Room","Primary Bedroom"],"interior_paint":"1. Location & quantity - garage \n2. Brand - spectrum paint\n3. Color name & code - white satin lacquer, int mountain ash, \n4. Sheen -satin\n5. Style/location of paint - 5 gallons and 1 gallons all in garage"}}$pid$::jsonb)).facts,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"14x14x1 - 2 locations  dining and primary bedroom \n20x25x1 hallway","filter_sizes":["14x14x1","20x25x1"]}}$pid$::jsonb)).hvac,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Hallway","installed":true},"smoke":{"brand":"First Alert","notes":"N/A","expires_on":"2035-06-09","power_type":"Hardwired","battery_type":"9-Volt (Alkaline)","expires_precision":"day","expires_source_text":"2035 June 9","batteries_changed_on":"2027-04-22"},"fridge_filter":"Frigidaire FPPWFU01","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"Shelf","water_shutoff_indoor":"Garage","water_shutoff_outdoor":"By the street","breaker_panel_location":"Garage"}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = '5e1e71c9-939b-4d06-89a9-f92087160994'
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"grill":"No Grill","tv_specs":"Living Room - 305 W 7th ST - 65","workstation":"No","tv_locations":["Living Room","Primary Bedroom"],"interior_paint":"1. Location & quantity - garage \n2. Brand - spectrum paint\n3. Color name & code - white satin lacquer, int mountain ash, \n4. Sheen -satin\n5. Style/location of paint - 5 gallons and 1 gallons all in garage"}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"14x14x1 - 2 locations \n20x25x1","filter_sizes":["14x14x1","20x25x1"]}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Hallway","installed":true},"smoke":{"brand":"First Alert","notes":"N/A","expires_on":"2035-06-09","power_type":"Hardwired","battery_type":"9-Volt (Alkaline)","expires_precision":"day","expires_source_text":"2035 June 9","batteries_changed_on":"2027-04-22"},"fridge_filter":"Frigidaire","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"Shelf","water_shutoff_indoor":"Garage","water_shutoff_outdoor":"By the street","breaker_panel_location":"Garage"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '305 W 7th St.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('5e1e71c9-939b-4d06-89a9-f92087160994', 'facts.tv_specs', 'notion_pid', '3264658d-5f4f-813a-90b9-c65a8f95eabd', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('5e1e71c9-939b-4d06-89a9-f92087160994', 'hvac.filter_notes', 'notion_pid', '3264658d-5f4f-813a-90b9-c65a8f95eabd', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('5e1e71c9-939b-4d06-89a9-f92087160994', 'systems.fridge_filter', 'notion_pid', '3264658d-5f4f-813a-90b9-c65a8f95eabd', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 309 Prince John Dr (OwnerRez 440620): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Kitchen","installed":true},"smoke":{"brand":"First alert","notes":"Replaced all","expires_on":"2035-12-31","power_type":"Battery Powered","battery_type":"Hardwired (Battery Backup)","expires_precision":"year","expires_source_text":"2035","batteries_changed_on":"2026-10-15"},"fridge_filter":"FPPWFU01","supply_storage":"Cabinet","fridge_filter_5yr":true,"supply_box_location":"Primary bedroom closet.","water_shutoff_indoor":"Unsure","water_shutoff_outdoor":"Left side curb","breaker_panel_location":"Garage"}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = '6cf841a3-8b95-4919-80d1-d9701ba5ffc7'
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Kitchen","installed":true},"smoke":{"brand":"First alert","notes":"Replaced all","expires_on":"2035-12-31","power_type":"Battery Powered","battery_type":"Hardwired (Battery Backup)","expires_precision":"year","expires_source_text":"2035","batteries_changed_on":"2025-12-03"},"fridge_filter":"FPPWFU01","supply_storage":"Cabinet","fridge_filter_5yr":true,"supply_box_location":"Primary bedroom closet.","water_shutoff_indoor":"Unsure","water_shutoff_outdoor":"Left side curb","breaker_panel_location":"Garage"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '309 Prince John Dr'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('6cf841a3-8b95-4919-80d1-d9701ba5ffc7', 'systems.smoke.batteries_changed_on', 'notion_pid', '1664658d-5f4f-80bd-ae79-f1967c95d15a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3117 Scissortail Way (30D FIRM) (OwnerRez 440216): 3 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      compliance = (jsonb_populate_record(NULL::public.properties, $pid${"compliance":{"permit_status":{"text":"Permit required in OKC. $1,200","as_of":"2026-11-11T18:51:00.000Z","source":"notion_pid","reference_only":true},"rental_restrictions":{"text":"No STR rental restrictions","as_of":"2026-11-11T18:51:00.000Z","source":"notion_pid","reference_only":true}}}$pid$::jsonb)).compliance,
      storm_shelter = (jsonb_populate_record(NULL::public.properties, $pid${"storm_shelter":{"location_access":"Garage - use provided pin: [removed — credentials are not stored in Resolve] depress button to slide door open"}}$pid$::jsonb)).storm_shelter,
      updated_at = now()
    WHERE id = 'f8fd08cd-4043-4bb6-83f4-30a726437f08'
      AND to_jsonb(compliance) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(storm_shelter) IS NOT DISTINCT FROM $pid${"location_access":"Garage -use provided pin to depress button to slide door open depress button to slide door open"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3117 Scissortail Way (30D FIRM)'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('f8fd08cd-4043-4bb6-83f4-30a726437f08', 'compliance.permit_status', 'notion_pid', '1664658d-5f4f-806a-847d-d3f6046ef2a0', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('f8fd08cd-4043-4bb6-83f4-30a726437f08', 'compliance.rental_restrictions', 'notion_pid', '1664658d-5f4f-806a-847d-d3f6046ef2a0', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('f8fd08cd-4043-4bb6-83f4-30a726437f08', 'storm_shelter.location_access', 'notion_pid', '1664658d-5f4f-806a-847d-d3f6046ef2a0', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 33 Center Lane S (OwnerRez 480825): 5 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Schlage at side door.","key_storage":["Side Door/Smartlock"],"yale_module":"Not Applicable (Not Yale)","garage_remote":"N/a","emergency_key_access":"Yes","yale_integration_live":false}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"list":["Pool"],"access_notes":"Carlton Landing requires all vehicles to be registered through the link found  - \nhere \n. The passcode: [removed — credentials are not stored in Resolve] will use in the form is \n250570\n. Unregistered cars can be ticketed or towed, so please take care of this ahead of time.\n\nThe above information is included in the Breezeway Parking Guidelines."}}$pid$::jsonb)).amenities,
      hoa = (jsonb_populate_record(NULL::public.properties, $pid${"hoa":{"present":false,"notes + external_links":"Contact: You can reach Taylor at \ntaylor@carltonlanding.com\n or 918-707-6138 ext 101."}}$pid$::jsonb)).hoa,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"NO PETS ALLOWED\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '03258673-f2bd-49c6-9e14-537c6439bc5d'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Yale at side door, Schlage at front door","key_storage":["Side Door/Smartlock"],"yale_module":"Not Connected","garage_remote":"N/a","emergency_key_access":"Yes","yale_integration_live":false}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"list":["Pool"],"access_notes":"Carlton Landing requires all vehicles to be registered through the link found  - here .The passcode: See Guest Access & Credentials will use in the form is 250570. Unregistered cars can be ticketed or towed, so please take care of this ahead of time.\n\nThe above information is included in the Breezeway Parking Guidelines."}$pid$::jsonb
      AND to_jsonb(hoa) IS NOT DISTINCT FROM $pid${"present":false,"notes + external_links":"Contact: You can reach Taylor at taylor@carltonlanding.com or 918-707-6138 ext 101."}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '33 Center Lane S'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('03258673-f2bd-49c6-9e14-537c6439bc5d', 'access.lock_brand', 'notion_pid', '3184658d-5f4f-80a6-8a27-f6d45b671a7f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('03258673-f2bd-49c6-9e14-537c6439bc5d', 'access.yale_module', 'notion_pid', '3184658d-5f4f-80a6-8a27-f6d45b671a7f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('03258673-f2bd-49c6-9e14-537c6439bc5d', 'amenities.access_notes', 'notion_pid', '3184658d-5f4f-80a6-8a27-f6d45b671a7f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('03258673-f2bd-49c6-9e14-537c6439bc5d', 'hoa.notes + external_links', 'notion_pid', '3184658d-5f4f-80a6-8a27-f6d45b671a7f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('03258673-f2bd-49c6-9e14-537c6439bc5d', 'operating_notes', 'notion_pid', '3184658d-5f4f-80a6-8a27-f6d45b671a7f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3316 NW 176th (OwnerRez 350572): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '301a0990-5c55-4d71-acd1-0d64f6e6b162'
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3316 NW 176th'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('301a0990-5c55-4d71-acd1-0d64f6e6b162', 'operating_notes', 'notion_pid', '1664658d-5f4f-801b-a66d-cb8f41ee47de', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3361 E 153rd St S (OwnerRez 502215): 11 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"yale_integration_live":false}}$pid$::jsonb)).access,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{"notion_pid_url":"https://app.notion.com/4144658d5f4f817e8d6ef73a23669876","breezeway_url":"https://app.breezeway.io/property/1565707/profile","ownerrez_url":"https://app.ownerrez.com/properties/502215/info"}}$pid$::jsonb)).external_refs,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package,
      instant_book = (jsonb_populate_record(NULL::public.properties, $pid${"instant_book":false}$pid$::jsonb)).instant_book,
      market = (jsonb_populate_record(NULL::public.properties, $pid${"market":"Tulsa"}$pid$::jsonb)).market,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"The Bixby Bloom (3361)"}$pid$::jsonb)).nickname,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"2 Car Garage\nFree Parking on Premises"}}$pid$::jsonb)).parking,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_split_confirmed":false}}$pid$::jsonb)).utilities,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2026}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${"notion_pid_url":"https://app.notion.com/4144658d5f4f817e8d6ef73a23669876"}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL
      AND to_jsonb(instant_book) IS NOT DISTINCT FROM NULL
      AND to_jsonb(market) IS NOT DISTINCT FROM NULL
      AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM NULL
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3361 E 153rd St S'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'access.yale_integration_live', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'external_refs.breezeway_url', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'external_refs.ownerrez_url', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'furniture_package', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'instant_book', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'market', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'nickname', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'parking.summary', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'tier', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'utilities.wifi_split_confirmed', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'year_built', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3400 N Fern Avenue (OwnerRez 499899): 13 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"yale_integration_live":false}}$pid$::jsonb)).access,
      compliance = (jsonb_populate_record(NULL::public.properties, $pid${"compliance":{"permit_status":{"text":"Permit required for Broken Arrow. $600","as_of":"2026-11-06T21:06:00.000Z","source":"notion_pid","reference_only":true},"rental_restrictions":{"text":"No STR rental restrictions","as_of":"2026-11-06T21:06:00.000Z","source":"notion_pid","reference_only":true}}}$pid$::jsonb)).compliance,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{"breezeway_url":"https://app.breezeway.io/property/1542591/profile","ownerrez_url":"https://app.ownerrez.com/properties/499899/info"}}$pid$::jsonb)).external_refs,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package,
      instant_book = (jsonb_populate_record(NULL::public.properties, $pid${"instant_book":false}$pid$::jsonb)).instant_book,
      market = (jsonb_populate_record(NULL::public.properties, $pid${"market":"Tulsa"}$pid$::jsonb)).market,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"Fernstone House (3400)"}$pid$::jsonb)).nickname,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"2 Car Garage\nFree Parking on Premises"}}$pid$::jsonb)).parking,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_split_confirmed":false}}$pid$::jsonb)).utilities,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2026}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(compliance) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL
      AND to_jsonb(instant_book) IS NOT DISTINCT FROM NULL
      AND to_jsonb(market) IS NOT DISTINCT FROM NULL
      AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM NULL
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3400 N Fern Avenue'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'access.yale_integration_live', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'compliance.permit_status', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'compliance.rental_restrictions', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'external_refs.breezeway_url', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'external_refs.ownerrez_url', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'furniture_package', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'instant_book', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'market', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'nickname', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'parking.summary', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'tier', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'utilities.wifi_split_confirmed', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'year_built', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 341 Thistlewood Dr (OwnerRez 462238): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"EO Tuesday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'ddd71d00-acda-4feb-91cd-e0d86f38ddb4'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"EO Tuesday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '341 Thistlewood Dr'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ddd71d00-acda-4feb-91cd-e0d86f38ddb4', 'waste.valet', 'notion_pid', '2464658d-5f4f-8164-a9a8-eef1718f6588', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3712 N 39th St. (OwnerRez 418090): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":1,"cart_notes":"1","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '6cafc523-773b-4933-8d3d-9fbfa978e304'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":1,"cart_notes":"1","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3712 N 39th St.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('6cafc523-773b-4933-8d3d-9fbfa978e304', 'waste.valet', 'notion_pid', '1664658d-5f4f-80d9-948b-f82d93a6e95c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3715 W 109th St S (OwnerRez 460190): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"list":["Park","Pond","Walking Trail"],"access_notes":"The Pool Code is: 42909. This neighborhood has no restrictions for who can use the pool, even guest staying less than 30 days can use it."}}$pid$::jsonb)).amenities,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"grill":"No Grill","tv_specs":"Netflix guest profile code: [removed — credentials are not stored in Resolve]\nHiSense Smart TV's (living room & downstairs game room, no Roku details). \nLogin information: [removed — credentials are not stored in Resolve] the netflix account *Please do not share with guests* email: marc@compasspoints.net Password: [removed — credentials are not stored in Resolve]","workstation":"Yes","tv_locations":["Living Room","Bonus Room"],"interior_paint":"Unknown. Owner Responsible for any repairs"}}$pid$::jsonb)).facts,
      updated_at = now()
    WHERE id = 'f3d27f76-bc0a-48c5-acd6-a7a82001671a'
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"list":["Park","Pond","Walking Trail"],"access_notes":"The Pool Code: See Guest Access & Credentials. This neighborhood has no restrictions for who can use the pool, even guest staying less than 30 days can use it."}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"grill":"No Grill","tv_specs":"Netflix guest profile code: See Guest Access & Credentials\nHiSense Smart TV's (living room & downstairs game room, no Roku details). \nLogin information: held by the owner — not stored in Resolve the netflix account *Please do not share with guests* email: marc@compasspoints.net Password: held by the owner — not stored in Resolve","workstation":"Yes","tv_locations":["Living Room","Bonus Room"],"interior_paint":"Unknown. Owner Responsible for any repairs"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3715 W 109th St S'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('f3d27f76-bc0a-48c5-acd6-a7a82001671a', 'amenities.access_notes', 'notion_pid', '22d4658d-5f4f-81f4-ba7a-c217f0e98163', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('f3d27f76-bc0a-48c5-acd6-a7a82001671a', 'facts.tv_specs', 'notion_pid', '22d4658d-5f4f-81f4-ba7a-c217f0e98163', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3915 W 104th St. S. (OwnerRez 492465): 68 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"yale_integration_live":false,"emergency_key_access":"Yes","garage_remote":"Chamberlain - https://www.amazon.com/dp/B08CNKBTYJ?ref=fed_asin_title&th=1","key_storage":["Front Door/Smartlock","Backdoor","Garage Door"],"lock_brand":"Yale","yale_module":"Connected & Setup"}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"access_notes":"N/A","list":["Pool","Pond","Walking Trail"]}}$pid$::jsonb)).amenities,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"grill":"No Grill","interior_paint":"1. Location & quantity -laundry room 11 cans of exterior paint  2- 5 gallons of interior wall\nPaint. Sherwin Williams \n2. Brand - sherwin williams \n3. Color name & code -NA \n4. Sheen - satin \n5. Style/location of paint - exterior","tv_locations":["Living Room","Primary Bedroom"],"tv_specs":"Living room - 3915 W 104th St - 65, Primary bedroom - 3915 W 104th St - 55","workstation":"No"}}$pid$::jsonb)).facts,
      fireplace = (jsonb_populate_record(NULL::public.properties, $pid${"fireplace":{"fuel_type":"N/A","gas_switch":"N/A","gas_switch_location":"N/A","instructions":"N/A","model":"N/A","present":false}}$pid$::jsonb)).fireplace,
      grounds = (jsonb_populate_record(NULL::public.properties, $pid${"grounds":{"mowing_cadence":"ARHA Responsible","mowing_days":["Tuesday"]}}$pid$::jsonb)).grounds,
      hoa = (jsonb_populate_record(NULL::public.properties, $pid${"hoa":{"notes + external_links":"HOA Contact: Green Country HOA Email: greencountryhoa@gmail.com\n\nHOA approval for exterior changes, keep RVs/boats/trailers in the garage, wood privacy fences only (6 ft, not past front line), no clotheslines, and keep the yard maintained.","present":true}}$pid$::jsonb)).hoa,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"14-30-1"}}$pid$::jsonb)).hvac,
      listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":"Maple Manor | Jenks Family Retreat"}$pid$::jsonb)).listing_alias,
      neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":"Southern Reserve"}$pid$::jsonb)).neighborhood,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"**Owner does not want to see any diagnostic fees when possible. Owner’s referred handyman vendor - Eleven Eleven lab\n\nHOA needs to be contact on the summer for access to the community pool. No information was given upon request in onboarding.\n\nA cost segregation study will need to be scheduled. The company is planning to call Kati Hand for this. An owner requirement for the active owner program for tax purposes."}$pid$::jsonb)).operating_notes,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"2 Car Garage\nFree Parking on Premises","cluster_mailbox":false,"mailbox_location":"N/A","mailbox_number":"N/A"}}$pid$::jsonb)).parking,
      pool_spa = (jsonb_populate_record(NULL::public.properties, $pid${"pool_spa":{"present":"None"}}$pid$::jsonb)).pool_spa,
      security = (jsonb_populate_record(NULL::public.properties, $pid${"security":{"alarm":"No","battery_type":["Hardwired - No Battery"],"devices":["Front Door","Garage"],"monitoring_expires_on":"2027-11-08","monitoring_plan":["Active"]}}$pid$::jsonb)).security,
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{"brand":"N/A","controller_location":"N/A","set_for_season":{"value":"N/A","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid"},"status":"Property Does Not Have Sprinkler System"}}$pid$::jsonb)).sprinklers,
      storm_shelter = (jsonb_populate_record(NULL::public.properties, $pid${"storm_shelter":{"location_access":"N/A"}}$pid$::jsonb)).storm_shelter,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"breaker_panel_location":"Garage","co":{"installed":true,"location":"Dining room"},"fridge_filter":"Samsung HAF-QIN/EXP DA97-17376B","fridge_filter_5yr":false,"smoke":{"batteries_changed_on":"2026-10-04","battery_type":"9-Volt (Alkaline)","brand":"siterlink","notes":"7 brand new smoke detectors were ordered on October 16, 2026 and those were installed,  However, after reviewing the photos the handyman sent upon completing the work, we noticed that the manufacturing date is 2020. According to the handyman, they should have approximately four years of useful life remaining.","power_type":"Hardwired"},"supply_box_location":"Located in the top shelf of primary bedroom closet","supply_storage":"Closet","water_shutoff_indoor":"N/Ain water heater closet","water_shutoff_outdoor":"Water heater closet in garage"}}$pid$::jsonb)).systems,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_split_confirmed":false,"router_location":"Living room","wifi_ssid":"ARHA"}}$pid$::jsonb)).utilities,
      warranty = (jsonb_populate_record(NULL::public.properties, $pid${"warranty":{"builder_present":false,"claim_process + external_links":"N/A","furniture_expires_on":"2029-10-28"}}$pid$::jsonb)).warranty,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"cart_count":2,"cart_notes":"2","holiday_notes":"Thursday","recycling":true,"recycling_days":"Wednesday","strict_rules":"Trash cans out of street view, out ≤12 hrs before pickup and in ≤12 hrs after","trash_days":["Wednesday"],"valet":"No"}}$pid$::jsonb)).waste,
      instant_book = (jsonb_populate_record(NULL::public.properties, $pid${"instant_book":true}$pid$::jsonb)).instant_book,
      updated_at = now()
    WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"yale_integration_live":false}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(fireplace) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(grounds) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(hoa) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(listing_alias) IS NOT DISTINCT FROM NULL
      AND to_jsonb(neighborhood) IS NOT DISTINCT FROM NULL
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"2 Car Garage\nFree Parking on Premises"}$pid$::jsonb
      AND to_jsonb(pool_spa) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(security) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(storm_shelter) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_split_confirmed":false}$pid$::jsonb
      AND to_jsonb(warranty) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(instant_book) IS NOT DISTINCT FROM $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'access.emergency_key_access', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'access.garage_remote', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'access.key_storage', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'access.lock_brand', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'access.yale_module', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'amenities.access_notes', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'amenities.list', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'facts.grill', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'facts.interior_paint', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'facts.tv_locations', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'facts.tv_specs', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'facts.workstation', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'fireplace.fuel_type', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'fireplace.gas_switch', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'fireplace.gas_switch_location', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'fireplace.instructions', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'fireplace.model', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'fireplace.present', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'grounds.mowing_cadence', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'grounds.mowing_days', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'hoa.notes + external_links', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'hoa.present', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'hvac.filter_notes', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'listing_alias', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'neighborhood', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'operating_notes', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'parking.cluster_mailbox', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'parking.mailbox_location', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'parking.mailbox_number', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'pool_spa.present', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'security.alarm', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'security.battery_type', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'security.devices', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'security.monitoring_expires_on', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'security.monitoring_plan', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'sprinklers.brand', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'sprinklers.controller_location', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'sprinklers.set_for_season', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'sprinklers.status', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'storm_shelter.location_access', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.breaker_panel_location', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.co.installed', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.co.location', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.fridge_filter', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.fridge_filter_5yr', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.smoke.batteries_changed_on', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.smoke.battery_type', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.smoke.brand', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.smoke.notes', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.smoke.power_type', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.supply_box_location', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.supply_storage', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.water_shutoff_indoor', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.water_shutoff_outdoor', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'utilities.router_location', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'utilities.wifi_ssid', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'warranty.builder_present', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'warranty.claim_process + external_links', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'warranty.furniture_expires_on', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'waste.cart_count', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'waste.cart_notes', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'waste.holiday_notes', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'waste.recycling', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'waste.recycling_days', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'waste.strict_rules', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'waste.trash_days', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'waste.valet', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'instant_book', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 401 E. 10th St. (OwnerRez 484034): 143 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"lock_brand":"Yale","yale_integration_live":false,"emergency_key_access":"Yes","garage_remote":"Genie & Chamberlain","key_storage":["Backdoor","Front Door/Smartlock","Garage Door"],"yale_module":"Connected & Setup"}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"access_notes":"N/A","list":["None"]}}$pid$::jsonb)).amenities,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"grill":"No Grill","interior_paint":"There are some gallons of paint at the house, but no specific colors listed.","tv_locations":["Living Room","Bonus Room","Primary Bedroom"],"tv_specs":"Bonus Room - 401 E 10th St - 50″ Insignia, 4K UHD — model NS-50F301NA24\nLiving Room - 401 E 10th St - 55″ Insignia, 4K UHD — model NS-55F301NA22\nPrimary bedroom - 401 E 10th St -  43″ TCL, 1080p Full HD — model 43S310R","workstation":"No"}}$pid$::jsonb)).facts,
      fireplace = (jsonb_populate_record(NULL::public.properties, $pid${"fireplace":{"fuel_type":"N/A","model":"Unknown. Not currently accessible for guests until we confirm operating instructions.","present":true}}$pid$::jsonb)).fireplace,
      grounds = (jsonb_populate_record(NULL::public.properties, $pid${"grounds":{"mowing_cadence":"Owner Responsible","mowing_days":["Wednesday"]}}$pid$::jsonb)).grounds,
      hoa = (jsonb_populate_record(NULL::public.properties, $pid${"hoa":{"notes + external_links":"No HOA","present":false}}$pid$::jsonb)).hoa,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"14x24x1 x2","filter_sizes":["14x24x1"]}}$pid$::jsonb)).hvac,
      legacy_handoff_date = (jsonb_populate_record(NULL::public.properties, $pid${"legacy_handoff_date":"2026-10-29"}$pid$::jsonb)).legacy_handoff_date,
      listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":"Spacious Edmond Home | Pool & Game Room"}$pid$::jsonb)).listing_alias,
      neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":"This home is not located within a specific neighborhood. The home is located closest to the cross streets of E 9th St & S Rankin St in Edmond"}$pid$::jsonb)).neighborhood,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"2 Car Garage\nFree Parking on Premises","cluster_mailbox":false,"mailbox_location":"N/A","mailbox_number":"N/A"}}$pid$::jsonb)).parking,
      pool_spa = (jsonb_populate_record(NULL::public.properties, $pid${"pool_spa":{"present":"Pool","control_panel_location":"N/A - No hot tub","heated":false,"heater":"N/A - No pool heater","season":"Pool will be opened around may and closed in October","service_schedule":"Pool serviced every Friday no swimming for 2 hours"}}$pid$::jsonb)).pool_spa,
      security = (jsonb_populate_record(NULL::public.properties, $pid${"security":{"alarm":"No","battery_type":["None"],"devices":["None","Backyard"],"monitoring_plan":["None"]}}$pid$::jsonb)).security,
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{"brand":"N/A","controller_location":"N/A","set_for_season":{"value":"N/A","as_of":"2026-11-10T19:18:00.000Z","source":"notion_pid"},"status":"Property Does Not Have Sprinkler System"}}$pid$::jsonb)).sprinklers,
      storm_shelter = (jsonb_populate_record(NULL::public.properties, $pid${"storm_shelter":{"location_access":"N/A"}}$pid$::jsonb)).storm_shelter,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"breaker_panel_location":"Laundry room","co":{"installed":true,"location":"Kitchen"},"fridge_filter":"HAF/CIN","fridge_filter_5yr":false,"smoke":{"batteries_changed_on":"2022-01-01","battery_type":"10-Year Sealed Lithium","brand":"First Alert","expires_on":"2032-12-31","expires_precision":"year","expires_source_text":"2032","notes":"N/A","power_type":"Battery Powered"},"supply_box_location":"None","supply_storage":"Closet","water_shutoff_indoor":"N/A","water_shutoff_outdoor":"In the middle of the driveway"}}$pid$::jsonb)).systems,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_ssid":"ARHA 2.4, ARHA 5","wifi_split_confirmed":false,"router_location":"Living room"}}$pid$::jsonb)).utilities,
      warranty = (jsonb_populate_record(NULL::public.properties, $pid${"warranty":{"builder_present":false}}$pid$::jsonb)).warranty,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"cart_count":2,"cart_notes":"2","holiday_notes":"If pickup falls on a holiday, it’ll be done the next day (Wednesday).","recycling":true,"recycling_days":"Every other Tuesday","trash_days":["Tuesday"],"valet":"Yes"}}$pid$::jsonb)).waste,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":1968}$pid$::jsonb)).year_built,
      instant_book = (jsonb_populate_record(NULL::public.properties, $pid${"instant_book":true}$pid$::jsonb)).instant_book,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact.\n\nNot needed at hand off (Mingees to handle later):\n  • Confirm instructions for operating the fireplace in the basement \n• Full siding repair (multiple places)\n• Haul away fence panels in backyard\n• Backyard landscaping and cleanup\n• Remove stumps and trim all trees/bushes\n• Purchase/install new dining room rug\n• Garage door seal\n• Water damage on garage wall (find and repair the leak source)\n• Door or curtain for pantry\n• Gutters"}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"lock_brand":"Schlage","yale_integration_live":false}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(fireplace) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(grounds) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(hoa) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(legacy_handoff_date) IS NOT DISTINCT FROM NULL
      AND to_jsonb(listing_alias) IS NOT DISTINCT FROM NULL
      AND to_jsonb(neighborhood) IS NOT DISTINCT FROM NULL
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"2 Car Garage\nFree Parking on Premises"}$pid$::jsonb
      AND to_jsonb(pool_spa) IS NOT DISTINCT FROM $pid${"present":"Pool"}$pid$::jsonb
      AND to_jsonb(security) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(storm_shelter) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM NULL
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_ssid":"HFE 401","wifi_split_confirmed":false}$pid$::jsonb
      AND to_jsonb(warranty) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL
      AND to_jsonb(instant_book) IS NOT DISTINCT FROM $pid$false$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"FIRST vendor for all maintenance and repairs: Untitled . Contact them first on all work orders before scheduling any other vendor. Only use an alternate only if Ruben is unavailable or unresponsive.\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'access.emergency_key_access', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'access.emergency_key_access', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'access.garage_remote', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'access.garage_remote', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'access.key_storage', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'access.key_storage', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'access.yale_module', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'access.yale_module', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'amenities.access_notes', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'amenities.access_notes', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'amenities.list', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'amenities.list', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'facts.grill', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'facts.grill', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'facts.interior_paint', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'facts.interior_paint', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'facts.tv_locations', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'facts.tv_locations', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'facts.tv_specs', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'facts.tv_specs', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'facts.workstation', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'facts.workstation', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'fireplace.fuel_type', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'fireplace.fuel_type', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'fireplace.model', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'fireplace.model', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'fireplace.present', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'fireplace.present', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'grounds.mowing_cadence', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'grounds.mowing_cadence', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'grounds.mowing_days', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'hoa.notes + external_links', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'hoa.notes + external_links', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'hoa.present', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'hoa.present', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'hvac.filter_notes', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'hvac.filter_notes', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'hvac.filter_sizes', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'hvac.filter_sizes', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'legacy_handoff_date', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'legacy_handoff_date', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'listing_alias', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'listing_alias', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'neighborhood', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'neighborhood', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'parking.cluster_mailbox', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'parking.cluster_mailbox', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'parking.mailbox_location', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'parking.mailbox_location', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'parking.mailbox_number', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'parking.mailbox_number', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'pool_spa.control_panel_location', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'pool_spa.control_panel_location', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'pool_spa.heated', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'pool_spa.heated', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'pool_spa.heater', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'pool_spa.heater', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'pool_spa.season', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'pool_spa.season', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'pool_spa.service_schedule', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'pool_spa.service_schedule', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'security.alarm', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'security.alarm', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'security.battery_type', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'security.battery_type', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'security.devices', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'security.devices', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'security.monitoring_plan', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'security.monitoring_plan', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'sprinklers.brand', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'sprinklers.brand', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'sprinklers.controller_location', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'sprinklers.controller_location', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'sprinklers.set_for_season', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'sprinklers.set_for_season', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'sprinklers.status', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'sprinklers.status', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'storm_shelter.location_access', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'storm_shelter.location_access', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.breaker_panel_location', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.breaker_panel_location', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.co.installed', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.co.installed', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.co.location', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.co.location', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.fridge_filter', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.fridge_filter', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.fridge_filter_5yr', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.fridge_filter_5yr', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.batteries_changed_on', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.batteries_changed_on', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.battery_type', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.battery_type', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.brand', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.brand', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.expires_on', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.expires_on', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.expires_precision', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.expires_precision', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.expires_source_text', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.expires_source_text', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.notes', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.notes', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.power_type', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.power_type', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.supply_box_location', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.supply_box_location', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.supply_storage', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.supply_storage', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.water_shutoff_indoor', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.water_shutoff_indoor', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.water_shutoff_outdoor', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.water_shutoff_outdoor', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'tier', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'tier', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'utilities.router_location', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'utilities.router_location', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'warranty.builder_present', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'warranty.builder_present', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.cart_count', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.cart_count', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.cart_notes', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.cart_notes', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.holiday_notes', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.holiday_notes', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.recycling', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.recycling', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.recycling_days', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.recycling_days', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.trash_days', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.trash_days', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.valet', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.valet', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'year_built', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'year_built', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'access.lock_brand', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'access.lock_brand', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'instant_book', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'instant_book', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'operating_notes', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'operating_notes', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'utilities.wifi_ssid', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'utilities.wifi_ssid', 'notion_pid', '3574658d-5f4f-81d2-bed2-e345f40bca1a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 409 S. 85th St. (OwnerRez 453794): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'eef11540-5745-4b8f-8f1f-f02b02ea3417'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '409 S. 85th St.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('eef11540-5745-4b8f-8f1f-f02b02ea3417', 'waste.valet', 'notion_pid', '1e34658d-5f4f-811f-8af2-d25eff66af28', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 417 Dauphin Ave. (OwnerRez 480828): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '6ffccd48-698b-4c3b-bdac-420ba582bc2d'
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '417 Dauphin Ave.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('6ffccd48-698b-4c3b-bdac-420ba582bc2d', 'operating_notes', 'notion_pid', '3184658d-5f4f-809c-b4c1-dc8101719004', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 4308 NW 158th (30D Firm) (OwnerRez 440423): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"list":["Park","Basketball Court","Pool"],"access_notes":"Pool Access Code: [removed — credentials are not stored in Resolve] \n Pool rules and hours can be found on site on the pool building wall."}}$pid$::jsonb)).amenities,
      updated_at = now()
    WHERE id = 'ab12f1af-3e2e-4cfb-a73a-bb32dc412dc9'
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"list":["Park","Basketball Court","Pool"],"access_notes":"Pool Access Code: See Guest Access & Credentials \n Pool rules and hours can be found on site on the pool building wall."}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '4308 NW 158th (30D Firm)'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ab12f1af-3e2e-4cfb-a73a-bb32dc412dc9', 'amenities.access_notes', 'notion_pid', '1664658d-5f4f-800f-8485-ed3da65ab8f9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 4308 S 177th Pl E (OwnerRez 410574): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":false,"cart_count":3,"cart_notes":"3","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '517ccf34-a2de-4aca-9984-fc58c8a8d7bb'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":false,"cart_count":3,"cart_notes":"3","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '4308 S 177th Pl E'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('517ccf34-a2de-4aca-9984-fc58c8a8d7bb', 'waste.valet', 'notion_pid', '1664658d-5f4f-804b-bb2e-dcff157a971d', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 4317 NW 19th (OwnerRez 347786): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = 'e72e942a-f53f-4397-89fa-0383795fbc55'
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '4317 NW 19th'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e72e942a-f53f-4397-89fa-0383795fbc55', 'operating_notes', 'notion_pid', '1664658d-5f4f-80cd-95f9-c73909e19498', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 453 Blue Crow Lane (OwnerRez 418721): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Wall kitchen","installed":false},"smoke":{"brand":"First alert","notes":"None to mention","expires_on":"2029-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Lithium)","expires_precision":"year","expires_source_text":"2029","batteries_changed_on":"2026-09-22"},"fridge_filter":"Fppwfu01","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"Hallway","water_shutoff_indoor":"Unsure","water_shutoff_outdoor":"Right side curb","breaker_panel_location":"Garage"}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = '8c6b2765-57d4-4e05-9632-218ddf636258'
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Wall kitchen","installed":false},"smoke":{"brand":"First alert","notes":"None to mention","expires_on":"2029-12-31","power_type":"Battery Powered","battery_type":"9-Volt (Lithium)","expires_precision":"year","expires_source_text":"2029","batteries_changed_on":"2025-06-22"},"fridge_filter":"Fppwfu01","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"Hallway","water_shutoff_indoor":"Unsure","water_shutoff_outdoor":"Right side curb","breaker_panel_location":"Garage"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '453 Blue Crow Lane'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8c6b2765-57d4-4e05-9632-218ddf636258', 'systems.smoke.batteries_changed_on', 'notion_pid', '1664658d-5f4f-80eb-bdeb-eec4e67f1cac', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 4607 S. Lakewood Ave (OwnerRez 411249): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '5988af9f-e3b2-4ea3-973e-f8e7b8f86eea'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '4607 S. Lakewood Ave'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('5988af9f-e3b2-4ea3-973e-f8e7b8f86eea', 'waste.valet', 'notion_pid', '1664658d-5f4f-809e-811a-d7bf6319241b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 5020 S.168th E Ave (30D FIRM) (OwnerRez 378665): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":"Not Mentioned","cart_notes":"Not Mentioned","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday","valet":"No"}}$pid$::jsonb)).waste,
      hoa = (jsonb_populate_record(NULL::public.properties, $pid${"hoa":{"present":true,"notes + external_links":"https://trinitycreekhoa.com/contact-us/\nPh: 918-901-9311\nAddress: 9246 S Sheridan Rd, Suite 209, Tulsa, OK 74133 - call when you get there and they can bring down the pool card\n\nPortal to make payment for new pool card: https://resident.gozego.com/payments/summary\nLogin: [removed — credentials are not stored in Resolve]\nMatrix3161!"}}$pid$::jsonb)).hoa,
      updated_at = now()
    WHERE id = '53dd007c-4a89-4d96-9feb-e8467787a527'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":"Not Mentioned","cart_notes":"Not Mentioned","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Wednesday"}$pid$::jsonb
      AND to_jsonb(hoa) IS NOT DISTINCT FROM $pid${"present":true,"notes + external_links":"https://trinitycreekhoa.com/contact-us/\nPh: 918-901-9311\nAddress: 9246 S Sheridan Rd, Suite 209, Tulsa, OK 74133 - call when you get there and they can bring down the pool card\n\nPortal to make payment for new pool card: https://resident.gozego.com/payments/summary\nLogin: See Guest Access & Credentials\nMatrix3161!"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '5020 S.168th E Ave (30D FIRM)'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('53dd007c-4a89-4d96-9feb-e8467787a527', 'waste.valet', 'notion_pid', '1664658d-5f4f-8005-8d0c-ea1b9b94fa36', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('53dd007c-4a89-4d96-9feb-e8467787a527', 'hoa.notes + external_links', 'notion_pid', '1664658d-5f4f-8005-8d0c-ea1b9b94fa36', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 5034 N 35th St (OwnerRez 432974): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":1,"cart_notes":"1 Trash Cart Each","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'b3a2afd8-96d4-4699-a91e-9c21ea1f115b'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":1,"cart_notes":"1 Trash Cart Each","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '5034 N 35th St'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('b3a2afd8-96d4-4699-a91e-9c21ea1f115b', 'waste.valet', 'notion_pid', '1664658d-5f4f-80ff-8756-ed5d359dda48', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 504 S. 47th St (OwnerRez 452367): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '2e868dc3-3eec-4d4d-bc2c-5dccbda23987'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '504 S. 47th St'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2e868dc3-3eec-4d4d-bc2c-5dccbda23987', 'waste.valet', 'notion_pid', '1ce4658d-5f4f-80c8-93fe-c54e337043c6', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 5047 Skipping Stone Dr (OwnerRez 455967): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"EO Wednesday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '1bff641f-0107-4fe4-93fe-6ecf8735b38d'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Wednesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"EO Wednesday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '5047 Skipping Stone Dr'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('1bff641f-0107-4fe4-93fe-6ecf8735b38d', 'waste.valet', 'notion_pid', '1f94658d-5f4f-815d-88a8-ddd5067b1e18', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 509 Houndstooth Dr (30D Firm) (OwnerRez 441628): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"list":["Pool","Park","Playground"],"access_notes":"ARHA can fill out the pool access card form (attached in comments) then send it Christina for approval and next steps to receive the card.\nContact: Christina Villarreal\nCVillarreal@insightam.com\n (972) 993-6746"}}$pid$::jsonb)).amenities,
      updated_at = now()
    WHERE id = '652a1979-a6ec-43ed-b684-2bc1aa9548bf'
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"list":["Pool","Park","Playground"],"access_notes":"Not Mentioned"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '509 Houndstooth Dr (30D Firm)'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('652a1979-a6ec-43ed-b684-2bc1aa9548bf', 'amenities.access_notes', 'notion_pid', '1664658d-5f4f-803a-89ec-f0084e75f682', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 5217 NW 109th St. (30D Firm) (OwnerRez 480823): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '061cde8a-0565-4aeb-8e36-d558c317576b'
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '5217 NW 109th St. (30D Firm)'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('061cde8a-0565-4aeb-8e36-d558c317576b', 'operating_notes', 'notion_pid', '3184658d-5f4f-80ea-8f84-dbe3f80b34e9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 6017 S. 13th St (30D FIRM) (OwnerRez 450120): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Monday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'be144356-fec0-44ce-83fa-4dc052194c93'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":3,"cart_notes":"3","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Monday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6017 S. 13th St (30D FIRM)'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('be144356-fec0-44ce-83fa-4dc052194c93', 'waste.valet', 'notion_pid', '1af4658d-5f4f-8026-beb6-ddee9d66c3eb', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 624 Daniel Court (OwnerRez 498633): 13 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"yale_integration_live":false}}$pid$::jsonb)).access,
      compliance = (jsonb_populate_record(NULL::public.properties, $pid${"compliance":{"permit_status":{"text":"No permit required for Westfield, IN","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true},"rental_restrictions":{"text":"No STR rental restrictions","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}}}$pid$::jsonb)).compliance,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{"breezeway_url":"https://app.breezeway.io/property/1529710/profile","ownerrez_url":"https://app.ownerrez.com/properties/498633/info"}}$pid$::jsonb)).external_refs,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package,
      instant_book = (jsonb_populate_record(NULL::public.properties, $pid${"instant_book":false}$pid$::jsonb)).instant_book,
      market = (jsonb_populate_record(NULL::public.properties, $pid${"market":"Indy"}$pid$::jsonb)).market,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"Dovetail Court (624)"}$pid$::jsonb)).nickname,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"2 Car Garage\nFree Parking on Premises"}}$pid$::jsonb)).parking,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_split_confirmed":false}}$pid$::jsonb)).utilities,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2002}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(compliance) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL
      AND to_jsonb(instant_book) IS NOT DISTINCT FROM NULL
      AND to_jsonb(market) IS NOT DISTINCT FROM NULL
      AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM NULL
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '624 Daniel Court'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'access.yale_integration_live', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'compliance.permit_status', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'compliance.rental_restrictions', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'external_refs.breezeway_url', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'external_refs.ownerrez_url', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'furniture_package', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'instant_book', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'market', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'nickname', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'parking.summary', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'tier', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'utilities.wifi_split_confirmed', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'year_built', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 628 Joy Ct (OwnerRez 429148): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Kitchen","installed":true},"smoke":{"brand":"Kdde","notes":"None","expires_on":"2031-12-31","power_type":"Battery Powered","battery_type":"AA Battery","expires_precision":"year","expires_source_text":"2031","batteries_changed_on":"2026-09-07"},"fridge_filter":"Not Mentioned","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"N/a","water_shutoff_indoor":"Nothing to mention","water_shutoff_outdoor":"Next to fire hydrant","breaker_panel_location":"Outside"}}$pid$::jsonb)).systems,
      updated_at = now()
    WHERE id = '1652e0d6-8577-4cc1-82ee-fd477c929427'
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Kitchen","installed":true},"smoke":{"brand":"Kdde","notes":"None","expires_on":"2031-12-31","power_type":"Battery Powered","battery_type":"AA Battery","expires_precision":"year","expires_source_text":"2031","batteries_changed_on":"2025-10-29"},"fridge_filter":"Not Mentioned","supply_storage":"Closet","fridge_filter_5yr":false,"supply_box_location":"N/a","water_shutoff_indoor":"Nothing to mention","water_shutoff_outdoor":"Next to fire hydrant","breaker_panel_location":"Outside"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '628 Joy Ct'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('1652e0d6-8577-4cc1-82ee-fd477c929427', 'systems.smoke.batteries_changed_on', 'notion_pid', '1664658d-5f4f-801f-a2f4-d04889af2a78', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 6302 Meadow Path Way (OwnerRez 501851): 11 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"yale_integration_live":false}}$pid$::jsonb)).access,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{"notion_pid_url":"https://app.notion.com/4104658d5f4f812e9cb3d36092e2fbc5","breezeway_url":"https://app.breezeway.io/property/1563499/profile","ownerrez_url":"https://app.ownerrez.com/properties/501851/info"}}$pid$::jsonb)).external_refs,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package,
      instant_book = (jsonb_populate_record(NULL::public.properties, $pid${"instant_book":false}$pid$::jsonb)).instant_book,
      market = (jsonb_populate_record(NULL::public.properties, $pid${"market":"Indy"}$pid$::jsonb)).market,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"Meadow Path Hideaway (6302)"}$pid$::jsonb)).nickname,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"2 Car Garage \nFree Parking on Premises"}}$pid$::jsonb)).parking,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_split_confirmed":false}}$pid$::jsonb)).utilities,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2024}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${"notion_pid_url":"https://app.notion.com/4104658d5f4f812e9cb3d36092e2fbc5"}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL
      AND to_jsonb(instant_book) IS NOT DISTINCT FROM NULL
      AND to_jsonb(market) IS NOT DISTINCT FROM NULL
      AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM NULL
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6302 Meadow Path Way'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'access.yale_integration_live', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'external_refs.breezeway_url', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'external_refs.ownerrez_url', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'furniture_package', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'instant_book', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'market', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'nickname', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'parking.summary', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'tier', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'utilities.wifi_split_confirmed', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'year_built', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 64 Turtle Loop (OwnerRez 480831): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"NO PETS ALLOWED\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes,
      warranty = (jsonb_populate_record(NULL::public.properties, $pid${"warranty":{"builder_present":"Not sure","claim_process + external_links":"Builder Warranty is fluid. Contact Delilah \ndelilah@quintessamarketing.com\n for any questions\n\n240-463-3236 Kerney Homes - mike@kerneyhomes.com"}}$pid$::jsonb)).warranty,
      updated_at = now()
    WHERE id = 'aed01e56-0bbb-4720-b81c-996bffcb6c21'
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"NO PETS ALLOWED\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb
      AND to_jsonb(warranty) IS NOT DISTINCT FROM $pid${"builder_present":"Not sure","claim_process + external_links":"Builder Warranty is fluid. Contact Delilah delilah@quintessamarketing.com for any questions\n\n240-463-3236 Kerney Homes - mike@kerneyhomes.com"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '64 Turtle Loop'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('aed01e56-0bbb-4720-b81c-996bffcb6c21', 'operating_notes', 'notion_pid', '3184658d-5f4f-80d7-b304-e4412a7aed48', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('aed01e56-0bbb-4720-b81c-996bffcb6c21', 'warranty.claim_process + external_links', 'notion_pid', '3184658d-5f4f-80d7-b304-e4412a7aed48', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 6629 S 22nd Ct E (OwnerRez 429480): 3 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":1,"cart_notes":"1","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Monday","valet":"No"}}$pid$::jsonb)).waste,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"list":["Pool"],"access_notes":"There is a community pool (only available for guests 30+ days). A waiver is required to be completed per tenant in order to gain access. It is saved to the property’s one drive folder. It and the rules are also attached to this field as a comment. The owner has to complete the waiver."}}$pid$::jsonb)).amenities,
      updated_at = now()
    WHERE id = '656e8354-e4f6-43b2-9029-116fdef25e8a'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":1,"cart_notes":"1","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Monday"}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"list":["Not Mentioned"],"access_notes":"There is a community pool (only available for guests 30+ days). A waiver is required to be completed per tenant in order to gain access. It is saved to the property’s one drive folder. It and the rules are also attached to this field as a comment."}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6629 S 22nd Ct E'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('656e8354-e4f6-43b2-9029-116fdef25e8a', 'waste.valet', 'notion_pid', '1664658d-5f4f-800f-9797-ee9f8347a7db', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('656e8354-e4f6-43b2-9029-116fdef25e8a', 'amenities.access_notes', 'notion_pid', '1664658d-5f4f-800f-9797-ee9f8347a7db', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('656e8354-e4f6-43b2-9029-116fdef25e8a', 'amenities.list', 'notion_pid', '1664658d-5f4f-800f-9797-ee9f8347a7db', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 6847 Cardiff Dr (OwnerRez 459111): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"EO Monday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '3a248822-b22f-4c2c-ab8c-56ff4f9a06e0'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"EO Monday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6847 Cardiff Dr'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('3a248822-b22f-4c2c-ab8c-56ff4f9a06e0', 'waste.valet', 'notion_pid', '21c4658d-5f4f-81e0-9437-d0535daa7c74', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 7006 E 154th St S (OwnerRez 403353): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":1,"cart_notes":"1","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '806c6bbc-6723-426a-a5e7-ead187813d5f'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":1,"cart_notes":"1","trash_days":["Thursday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '7006 E 154th St S'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('806c6bbc-6723-426a-a5e7-ead187813d5f', 'waste.valet', 'notion_pid', '1664658d-5f4f-8056-bdcd-c21d0545fe32', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 730 E 38th St. N. (OwnerRez 481007): 6 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"grill":"No Grill","tv_specs":"65\" TCL ROKU TV in Living Room \n55” TCL ROKU TV in Primary Bedroom","workstation":"Yes","tv_locations":["Primary Bedroom","Living Room"],"interior_paint":"Garage\n1 exterior of 5 galon super paint  evening blue\n1 exterior 5 galon super paint tricorn-black\n2 galon interior emerald ligh gray\n2 galon interior snowbound"}}$pid$::jsonb)).facts,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"1- 14x24x1 \n1- 14x30x1","filter_sizes":["14x24x1","14x30x1"]}}$pid$::jsonb)).hvac,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"co":{"location":"Entryway","installed":true},"smoke":{"brand":"First Alert","notes":"N/A","expires_on":"2035-12-31","power_type":"Hardwired","battery_type":"9-Volt (Alkaline)","expires_precision":"year","expires_source_text":"2035","batteries_changed_on":"2026-05-22"},"fridge_filter":"Samsung Water Filter NSF","supply_storage":"Cabinet","fridge_filter_5yr":false,"supply_box_location":"Shelf","water_shutoff_indoor":"Water heater closet","water_shutoff_outdoor":"aside the mailbox","breaker_panel_location":"Garage"}}$pid$::jsonb)).systems,
      warranty = (jsonb_populate_record(NULL::public.properties, $pid${"warranty":{"builder_present":true,"builder_expires_on":"2027-04-24","furniture_expires_on":"2029-06-03","claim_process + external_links":"918-693-9019, Sean Thompson, email: \nsean.thompson127@yahoo.com\n RLS Dream Homes, rlsdreamhomes@gmail.com"}}$pid$::jsonb)).warranty,
      updated_at = now()
    WHERE id = '0c98e172-9027-4020-9c16-d5dfd1774b2c'
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${"grill":"No Grill","tv_specs":"65\" TCL TV in Living Room, 55” TV in Primary Bedroom","workstation":"Yes","tv_locations":["Primary Bedroom","Living Room"],"interior_paint":"1. Location & quantity - garage several\n2. Brand - sherwin Williams \n3. Color name & code - 7004 , JH70-30\n4. Sheen - flat\n5. Style/location of paint -"}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${"filter_notes":"14x24x1 - 1\n14x30x1 - 1","filter_sizes":["14x24x1","14x30x1"]}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${"co":{"location":"Entryway","installed":true},"smoke":{"brand":"First Alert","notes":"N/A","expires_on":"2035-12-31","power_type":"Hardwired","battery_type":"9-Volt (Alkaline)","expires_precision":"year","expires_source_text":"2035","batteries_changed_on":"2026-05-22"},"fridge_filter":"Samsung Water Filter","supply_storage":"Cabinet","fridge_filter_5yr":false,"supply_box_location":"Shelf","water_shutoff_indoor":"Water heater closet","water_shutoff_outdoor":"I do not see one on the outside of the house if there is it’s in the water meter box and it’s flooded","breaker_panel_location":"Garage"}$pid$::jsonb
      AND to_jsonb(warranty) IS NOT DISTINCT FROM $pid${"builder_present":true,"builder_expires_on":"2027-04-24","furniture_expires_on":"2029-06-03","claim_process + external_links":"918-693-9019, Sean Thompson, email: sean.thompson127@yahoo.com RLS Dream Homes, rlsdreamhomes@gmail.com"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '730 E 38th St. N.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0c98e172-9027-4020-9c16-d5dfd1774b2c', 'facts.interior_paint', 'notion_pid', '3374658d-5f4f-818b-a1c3-e172e6748505', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0c98e172-9027-4020-9c16-d5dfd1774b2c', 'facts.tv_specs', 'notion_pid', '3374658d-5f4f-818b-a1c3-e172e6748505', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0c98e172-9027-4020-9c16-d5dfd1774b2c', 'hvac.filter_notes', 'notion_pid', '3374658d-5f4f-818b-a1c3-e172e6748505', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0c98e172-9027-4020-9c16-d5dfd1774b2c', 'systems.fridge_filter', 'notion_pid', '3374658d-5f4f-818b-a1c3-e172e6748505', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0c98e172-9027-4020-9c16-d5dfd1774b2c', 'systems.water_shutoff_outdoor', 'notion_pid', '3374658d-5f4f-818b-a1c3-e172e6748505', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0c98e172-9027-4020-9c16-d5dfd1774b2c', 'warranty.claim_process + external_links', 'notion_pid', '3374658d-5f4f-818b-a1c3-e172e6748505', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 7317 NW 159th Ter. (30D FIRM) (OwnerRez 491601): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"list":["Pool","Playground","Basketball Court"],"access_notes":"Pool rules can be found in the guidebook custom fields, and also save to onedrive - here. The pool is open seasonally, estimated from Memorial Day weekend through Labor Day, open from 10am–10pm."}}$pid$::jsonb)).amenities,
      updated_at = now()
    WHERE id = 'ff7a1ed4-c055-47fe-ba79-4763d5a1bf01'
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"list":["Pool","Playground","Basketball Court"],"access_notes":"Pool rules can be found in the guidebook custom fields, and also save to onedrive - here. The pool is expected to be open seasonally during the summer time."}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '7317 NW 159th Ter. (30D FIRM)'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ff7a1ed4-c055-47fe-ba79-4763d5a1bf01', 'amenities.access_notes', 'notion_pid', '3ac4658d-5f4f-80a1-9d74-f5444c6802d8', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 7380 S 69th E Ave (OwnerRez 408959): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2 trash 1 recycling","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Monday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'd14ba1d6-ae17-4c4f-9d09-134e6f84d5d3'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2 trash 1 recycling","trash_days":["Monday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Monday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '7380 S 69th E Ave'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('d14ba1d6-ae17-4c4f-9d09-134e6f84d5d3', 'waste.valet', 'notion_pid', '1664658d-5f4f-803c-87f9-db69ee735a90', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 7422 S. Granite Ave. (OwnerRez 480830): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '4b0b54da-5608-4f92-8f1f-73328b83c73d'
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '7422 S. Granite Ave.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('4b0b54da-5608-4f92-8f1f-73328b83c73d', 'operating_notes', 'notion_pid', '3184658d-5f4f-808f-925a-e30ea33884c2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 758 N. Johnson Branch Rd. (OwnerRez 488148): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      instant_book = (jsonb_populate_record(NULL::public.properties, $pid${"instant_book":true}$pid$::jsonb)).instant_book,
      updated_at = now()
    WHERE id = 'fc1cb579-d655-4558-a85d-2164026606a7'
      AND to_jsonb(instant_book) IS NOT DISTINCT FROM $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '758 N. Johnson Branch Rd.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('fc1cb579-d655-4558-a85d-2164026606a7', 'instant_book', 'notion_pid', '3844658d-5f4f-8149-a099-df06a51e2417', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 815 E Fulton St. (OwnerRez 414805): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Tuesday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = 'ad110483-8a1a-4285-9f4f-d432f5d1dbda'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":true,"cart_count":2,"cart_notes":"2","trash_days":["Tuesday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Tuesday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '815 E Fulton St.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ad110483-8a1a-4285-9f4f-d432f5d1dbda', 'waste.valet', 'notion_pid', '1664658d-5f4f-8080-aeba-da60bdf0e883', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 8408 NW 162nd (30D FIRM) (OwnerRez 409752): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{"brand":"Hyrdo-Rain","status":"Property Has Sprinkler System and It's Off","set_for_season":{"as_of":"2026-08-30T04:11:00.000Z","value":true,"source":"notion_pid"},"controller_location":"Garage"}}$pid$::jsonb)).sprinklers,
      updated_at = now()
    WHERE id = 'cca8fac9-9179-4e29-aa1d-343ac036b95d'
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${"brand":"Hyrdo-Rain","status":"Property Has Sprinkler System and It's Off","set_for_season":{"as_of":"2026-08-30T04:11:00.000Z","value":true,"source":"notion_pid"},"controller_location":"Garahe"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8408 NW 162nd (30D FIRM)'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cca8fac9-9179-4e29-aa1d-343ac036b95d', 'sprinklers.controller_location', 'notion_pid', '1664658d-5f4f-801a-97ac-f2907cb749b7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 85 Lower Green Way (OwnerRez 480824): 4 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"list":["Pool","Basketball Court","Park","Walking Trail","Playground"],"access_notes":"Carlton Landing requires all vehicles to be registered through the link found  - \nhere \n. The passcode: [removed — credentials are not stored in Resolve] will use in the form is \n447732\n. Unregistered cars can be ticketed or towed, so please take care of this ahead of time.\n\nThe above information is included in the Breezeway Parking Guidelines."}}$pid$::jsonb)).amenities,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{"ownerrez_url":"https://app.ownerrez.com/properties/480824/info","breezeway_url":"https://app.breezeway.io/property/1295307/profile"}}$pid$::jsonb)).external_refs,
      hoa = (jsonb_populate_record(NULL::public.properties, $pid${"hoa":{"present":false,"notes + external_links":"Contact: You can reach Taylor at \ntaylor@carltonlanding.com\n or 918-707-6138 ext 101."}}$pid$::jsonb)).hoa,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"NO PETS ALLOWED\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes,
      updated_at = now()
    WHERE id = '82f30000-1b78-42a9-a965-5caf68c508c4'
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${"list":["Pool","Basketball Court","Park","Walking Trail","Playground"],"access_notes":"Carlton Landing requires all vehicles to be registered through the link found  - here .The passcode: See Guest Access & Credentials will use in the form is 447732. Unregistered cars can be ticketed or towed, so please take care of this ahead of time.\n\nThe above information is included in the Breezeway Parking Guidelines."}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${"ownerrez_url":"https://app.ownerrez.com/properties/480824/info","breezeway_url":"https://app.breezeway.io/property/1295302/profile"}$pid$::jsonb
      AND to_jsonb(hoa) IS NOT DISTINCT FROM $pid${"present":false,"notes + external_links":"Contact: You can reach Taylor at taylor@carltonlanding.com or 918-707-6138 ext 101."}$pid$::jsonb
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '85 Lower Green Way'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('82f30000-1b78-42a9-a965-5caf68c508c4', 'amenities.access_notes', 'notion_pid', '3184658d-5f4f-80fa-ad64-e8cf118433ba', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('82f30000-1b78-42a9-a965-5caf68c508c4', 'external_refs.breezeway_url', 'notion_pid', '3184658d-5f4f-80fa-ad64-e8cf118433ba', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('82f30000-1b78-42a9-a965-5caf68c508c4', 'hoa.notes + external_links', 'notion_pid', '3184658d-5f4f-80fa-ad64-e8cf118433ba', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('82f30000-1b78-42a9-a965-5caf68c508c4', 'operating_notes', 'notion_pid', '3184658d-5f4f-80fa-ad64-e8cf118433ba', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 852 Inland Dr. (OwnerRez 490410): 74 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"yale_integration_live":false,"emergency_key_access":"Yes","garage_remote":"Genie -LiftMaster Chamberlain Craftsman Universal Garage Door Opener Remote - https://www.amazon.com/dp/B08CNKBTYJ?ref_=ppx_hzod_title_dt_b_fed_asin_title_4_10&th=1","key_storage":["Front Door/Smartlock","Storage Closet","Storage Building","Garage Door"],"lock_brand":"Yale","yale_module":"Connected & Setup"}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"access_notes":"N/A","list":["None"]}}$pid$::jsonb)).amenities,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"grill":"No Grill","interior_paint":"N/A","tv_locations":["Living Room","Primary Bedroom"],"tv_specs":"852 Inland Dr Living room - 75,  852 INLAND DR - 55 Primary bedroom","workstation":"Yes"}}$pid$::jsonb)).facts,
      fireplace = (jsonb_populate_record(NULL::public.properties, $pid${"fireplace":{"fuel_type":"N/A","gas_switch":"N/A","gas_switch_location":"N/A","instructions":"N/A","model":"N/A","present":false}}$pid$::jsonb)).fireplace,
      grounds = (jsonb_populate_record(NULL::public.properties, $pid${"grounds":{"mowing_cadence":"ARHA Responsible","mowing_days":["Wednesday"]}}$pid$::jsonb)).grounds,
      hoa = (jsonb_populate_record(NULL::public.properties, $pid${"hoa":{"notes + external_links":"no holiday decor over 30 days; pets/vehicles/RVs in garage only; mailboxes/decks/fences/outbuildings need approval; maintain yards & exterior colors uniformly.","present":true}}$pid$::jsonb)).hoa,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"14×24×1","filter_sizes":["14x24x1"]}}$pid$::jsonb)).hvac,
      legacy_handoff_date = (jsonb_populate_record(NULL::public.properties, $pid${"legacy_handoff_date":"2026-10-06"}$pid$::jsonb)).legacy_handoff_date,
      listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":"3BR Home, Avon IN | Extended & Monthly Stays"}$pid$::jsonb)).listing_alias,
      neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":"Austin Lakes North"}$pid$::jsonb)).neighborhood,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Back Storage is locked not available for guest and nothing is inside that room, Key is in the garage trim lockbox.   Spare front door key is the storage closet"}$pid$::jsonb)).operating_notes,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"2 Car Garage\nFree Parking on Premises","cluster_mailbox":false,"mailbox_location":"N/A","mailbox_number":"N/A"}}$pid$::jsonb)).parking,
      pool_spa = (jsonb_populate_record(NULL::public.properties, $pid${"pool_spa":{"present":"None"}}$pid$::jsonb)).pool_spa,
      security = (jsonb_populate_record(NULL::public.properties, $pid${"security":{"alarm":"No","battery_type":["Hardwired - No Battery"],"devices":["Front Door","Garage"],"monitoring_expires_on":"2027-10-09","monitoring_plan":["Active"]}}$pid$::jsonb)).security,
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{"brand":"N/A","controller_location":"N/A","set_for_season":{"value":"N/A","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid"},"status":"Property Does Not Have Sprinkler System"}}$pid$::jsonb)).sprinklers,
      storm_shelter = (jsonb_populate_record(NULL::public.properties, $pid${"storm_shelter":{"location_access":"N/A"}}$pid$::jsonb)).storm_shelter,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"breaker_panel_location":"Garage","co":{"installed":true,"location":"Kitchen"},"fridge_filter":"Frigidaire PurePour PWF-1 refrigerator water filter — FPPWFU01","fridge_filter_5yr":false,"smoke":{"batteries_changed_on":"2026-09-25","battery_type":"9-Volt (Alkaline)","brand":"Siterwell","expires_on":"2035-09-30","expires_precision":"month","expires_source_text":"September 2035","notes":"N/A","power_type":"Hardwired"},"supply_box_location":"Top shelf in master closet","supply_storage":"Closet","water_shutoff_indoor":"Garage","water_shutoff_outdoor":"Close to the sidewalk"}}$pid$::jsonb)).systems,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_split_confirmed":false,"router_location":"Master bedroom","wifi_ssid":"ARHA"}}$pid$::jsonb)).utilities,
      warranty = (jsonb_populate_record(NULL::public.properties, $pid${"warranty":{"builder_present":false,"claim_process + external_links":"N/A","furniture_expires_on":"2029-10-06"}}$pid$::jsonb)).warranty,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"cart_count":3,"cart_notes":"3","holiday_notes":"service may be delayed by up to 7 days around the following holidays","recycling":true,"recycling_days":"every other Thursday","strict_rules":"Garbage/Trash containers are only permitted to be left outside for trash collection Containers cannot be permanently stored in front of or alongside a home Must be kept in an enclosed garage on non-trash collection days","trash_days":["Thursday"],"valet":"No"}}$pid$::jsonb)).waste,
      instant_book = (jsonb_populate_record(NULL::public.properties, $pid${"instant_book":true}$pid$::jsonb)).instant_book,
      updated_at = now()
    WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"yale_integration_live":false}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(fireplace) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(grounds) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(hoa) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(legacy_handoff_date) IS NOT DISTINCT FROM NULL
      AND to_jsonb(listing_alias) IS NOT DISTINCT FROM NULL
      AND to_jsonb(neighborhood) IS NOT DISTINCT FROM NULL
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"2 Car Garage\nFree Parking on Premises"}$pid$::jsonb
      AND to_jsonb(pool_spa) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(security) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(storm_shelter) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM NULL
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_split_confirmed":false}$pid$::jsonb
      AND to_jsonb(warranty) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(instant_book) IS NOT DISTINCT FROM $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'access.emergency_key_access', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'access.garage_remote', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'access.key_storage', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'access.lock_brand', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'access.yale_module', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'amenities.access_notes', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'amenities.list', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'facts.grill', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'facts.interior_paint', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'facts.tv_locations', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'facts.tv_specs', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'facts.workstation', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'fireplace.fuel_type', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'fireplace.gas_switch', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'fireplace.gas_switch_location', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'fireplace.instructions', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'fireplace.model', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'fireplace.present', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'grounds.mowing_cadence', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'grounds.mowing_days', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'hoa.notes + external_links', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'hoa.present', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'hvac.filter_notes', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'hvac.filter_sizes', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'legacy_handoff_date', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'listing_alias', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'neighborhood', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'operating_notes', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'parking.cluster_mailbox', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'parking.mailbox_location', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'parking.mailbox_number', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'pool_spa.present', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'security.alarm', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'security.battery_type', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'security.devices', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'security.monitoring_expires_on', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'security.monitoring_plan', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'sprinklers.brand', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'sprinklers.controller_location', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'sprinklers.set_for_season', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'sprinklers.status', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'storm_shelter.location_access', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.breaker_panel_location', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.co.installed', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.co.location', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.fridge_filter', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.fridge_filter_5yr', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.smoke.batteries_changed_on', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.smoke.battery_type', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.smoke.brand', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.smoke.expires_on', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.smoke.expires_precision', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.smoke.expires_source_text', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.smoke.notes', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.smoke.power_type', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.supply_box_location', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.supply_storage', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.water_shutoff_indoor', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.water_shutoff_outdoor', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'tier', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'utilities.router_location', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'utilities.wifi_ssid', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'warranty.builder_present', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'warranty.claim_process + external_links', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'warranty.furniture_expires_on', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'waste.cart_count', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'waste.cart_notes', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'waste.holiday_notes', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'waste.recycling', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'waste.recycling_days', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'waste.strict_rules', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'waste.trash_days', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'waste.valet', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'instant_book', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 8602 E. Galveston St. (OwnerRez 497214): 12 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"yale_integration_live":false}}$pid$::jsonb)).access,
      compliance = (jsonb_populate_record(NULL::public.properties, $pid${"compliance":{"permit_status":{"text":"Permit required in Broken Arrow. $600","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true},"rental_restrictions":{"text":"No STR rental restrictions","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}}}$pid$::jsonb)).compliance,
      external_refs = (jsonb_populate_record(NULL::public.properties, $pid${"external_refs":{"breezeway_url":"https://app.breezeway.io/property/1514896/profile","ownerrez_url":"https://app.ownerrez.com/properties/497214/info"}}$pid$::jsonb)).external_refs,
      furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package,
      instant_book = (jsonb_populate_record(NULL::public.properties, $pid${"instant_book":false}$pid$::jsonb)).instant_book,
      nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"Rosewood on Galveston (8602)"}$pid$::jsonb)).nickname,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"2 Car Garage\nFree Parking on Premises"}}$pid$::jsonb)).parking,
      tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_split_confirmed":false}}$pid$::jsonb)).utilities,
      year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2026}$pid$::jsonb)).year_built,
      updated_at = now()
    WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(compliance) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(external_refs) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL
      AND to_jsonb(instant_book) IS NOT DISTINCT FROM NULL
      AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(tier) IS NOT DISTINCT FROM NULL
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8602 E. Galveston St.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'access.yale_integration_live', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'compliance.permit_status', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'compliance.rental_restrictions', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'external_refs.breezeway_url', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'external_refs.ownerrez_url', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'furniture_package', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'instant_book', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'nickname', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'parking.summary', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'tier', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'utilities.wifi_split_confirmed', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'year_built', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 9211 Fitzgerald Dr. (OwnerRez 492500): 73 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      access = (jsonb_populate_record(NULL::public.properties, $pid${"access":{"yale_integration_live":false,"emergency_key_access":"Yes","garage_remote":"R27- GDR-27 MLT - https://www.amazon.com/dp/B08CNKBTYJ?ref=fed_asin_title&th=1","key_storage":["Front Door/Smartlock","Backdoor","Garage Door"],"lock_brand":"Yale","yale_module":"Connected & Setup"}}$pid$::jsonb)).access,
      amenities = (jsonb_populate_record(NULL::public.properties, $pid${"amenities":{"access_notes":"N/A","list":["Pond","Walking Trail"]}}$pid$::jsonb)).amenities,
      facts = (jsonb_populate_record(NULL::public.properties, $pid${"facts":{"grill":"No Grill","interior_paint":"1. Wall color - agreeable gray SW7029\n2. Sheen - matte\n\nNo additional paint left at the property.","tv_locations":["Living Room","Primary Bedroom"],"tv_specs":"Living room -  9211 Fitzgerald Dr - 65” Roku TV, Primary Bedroom -  9211 Fitzgerald Dr - 55” Roku TV, Bonus Room -  9211 Fitzgerald Dr - 55” Roku TV","workstation":"Yes"}}$pid$::jsonb)).facts,
      fireplace = (jsonb_populate_record(NULL::public.properties, $pid${"fireplace":{"fuel_type":"N/A","gas_switch":"N/A","gas_switch_location":"N/A","instructions":"N/A","model":"N/A","present":false}}$pid$::jsonb)).fireplace,
      grounds = (jsonb_populate_record(NULL::public.properties, $pid${"grounds":{"mowing_cadence":"ARHA Responsible","mowing_days":["Monday"]}}$pid$::jsonb)).grounds,
      hoa = (jsonb_populate_record(NULL::public.properties, $pid${"hoa":{"notes + external_links":"HOA Contact: Tried and True Management Morgan: Morgan@triedandtruemanagement.com Kim: Kim@triedandtruemanagement.com\n\nGet written HOA approval before any exterior change (no reply in 30 days means denied). No sheds, above-ground pools, chain-link or front-yard fences (6 ft max), no boats or RVs outside the garage, and nothing permanent in easements. Dues: $450 at transfer, plus annual dues up to +10%/yr with 8% late interest and liens. Home businesses can’t have customers, and fences, landscaping, and your own changes aren’t covered by the builder warranty.","present":true}}$pid$::jsonb)).hoa,
      hvac = (jsonb_populate_record(NULL::public.properties, $pid${"hvac":{"filter_notes":"1: 16×24×4","filter_sizes":["16x24x4"]}}$pid$::jsonb)).hvac,
      listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":"4BR | Sleeps 8, Study & Bonus Room"}$pid$::jsonb)).listing_alias,
      neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":"Fields of New Bethel"}$pid$::jsonb)).neighborhood,
      operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Intro meeting notes - 9211 Fitzgerald \n- Per the intro meeting notes, the designated plumber, HVAC contractor, and electrician must be used for at least 2 years.\n- Per the intro meeting notes, the builder will arrange meetings around 8 months and 10 months after closing.\n\nHVAC Contractor - Chris Chittum Enterprises LLC\nPlumber - R.T. Moore\nElectrical - ARCXIS\n\n**Owner does not want to see any diagnostic fees when possible."}$pid$::jsonb)).operating_notes,
      parking = (jsonb_populate_record(NULL::public.properties, $pid${"parking":{"summary":"2 Car Garage\nFree Parking on Premises","cluster_mailbox":false,"mailbox_location":"N/A","mailbox_number":"N/A"}}$pid$::jsonb)).parking,
      pool_spa = (jsonb_populate_record(NULL::public.properties, $pid${"pool_spa":{"present":"None"}}$pid$::jsonb)).pool_spa,
      security = (jsonb_populate_record(NULL::public.properties, $pid${"security":{"alarm":"No","battery_type":["Hardwired - No Battery"],"devices":["Front Door","Driveway"],"monitoring_expires_on":"2027-10-27","monitoring_plan":["Active"]}}$pid$::jsonb)).security,
      sprinklers = (jsonb_populate_record(NULL::public.properties, $pid${"sprinklers":{"brand":"N/A","controller_location":"N/A","set_for_season":{"value":"N/A","as_of":"2026-11-05T21:46:00.000Z","source":"notion_pid"},"status":"Property Does Not Have Sprinkler System"}}$pid$::jsonb)).sprinklers,
      storm_shelter = (jsonb_populate_record(NULL::public.properties, $pid${"storm_shelter":{"location_access":"N/A"}}$pid$::jsonb)).storm_shelter,
      systems = (jsonb_populate_record(NULL::public.properties, $pid${"systems":{"breaker_panel_location":"Garage","co":{"installed":true,"location":"Kitchen"},"fridge_filter":"Everydrop","fridge_filter_5yr":false,"smoke":{"batteries_changed_on":"2026-10-07","battery_type":"9-Volt (Lithium)","brand":"First alert","expires_on":"2036-12-31","expires_precision":"year","expires_source_text":"2036","notes":"N/A","power_type":"Hardwired"},"supply_box_location":"Master closet top shelf","supply_storage":"Closet","water_shutoff_indoor":"Closet under staircase","water_shutoff_outdoor":"Near the street"}}$pid$::jsonb)).systems,
      utilities = (jsonb_populate_record(NULL::public.properties, $pid${"utilities":{"wifi_split_confirmed":false,"router_location":"Living room","wifi_ssid":"ARHA"}}$pid$::jsonb)).utilities,
      warranty = (jsonb_populate_record(NULL::public.properties, $pid${"warranty":{"builder_expires_on":"2027-09-10","builder_present":true,"claim_process + external_links":"Dr. Horton- Christopher Bishop CSBishop@drhorton.com - 317-552-9067\n\n- The designated plumber, HVAC contractor, and electrician must be used for at least 2 years.\n\nWarranty request: https://www.drhorton.com/Warranty\n- The builder will arrange meetings around 8 months and 10 months after closing.\n- Fixtures: 1 year of coverage.\n- Mechanicals inside the walls: 2 years of coverage.\n- Roof: 4 years of coverage.\n- Foundation and load-bearing framing: 10 years of coverage.\n- RWC homeowner warranty exclusions: Section II, page 5.\n- RWC contact for matters beyond 2 years: 717-561-4480.","furniture_expires_on":"2029-10-27"}}$pid$::jsonb)).warranty,
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"cart_count":2,"cart_notes":"2","holiday_notes":"Saturday","recycling":true,"recycling_days":"Every Other Friday","strict_rules":"Keep trash in enclosed cans out of street and neighbor view, don’t let it pile up, and dumping anywhere in the subdivision costs at least $150 (pickup: City of Indianapolis, 317-917-7300).","trash_days":["Friday"],"valet":"No"}}$pid$::jsonb)).waste,
      instant_book = (jsonb_populate_record(NULL::public.properties, $pid${"instant_book":true}$pid$::jsonb)).instant_book,
      updated_at = now()
    WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc'
      AND to_jsonb(access) IS NOT DISTINCT FROM $pid${"yale_integration_live":false}$pid$::jsonb
      AND to_jsonb(amenities) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(facts) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(fireplace) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(grounds) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(hoa) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(hvac) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(listing_alias) IS NOT DISTINCT FROM NULL
      AND to_jsonb(neighborhood) IS NOT DISTINCT FROM NULL
      AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL
      AND to_jsonb(parking) IS NOT DISTINCT FROM $pid${"summary":"2 Car Garage\nFree Parking on Premises"}$pid$::jsonb
      AND to_jsonb(pool_spa) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(security) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(sprinklers) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(storm_shelter) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(systems) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(utilities) IS NOT DISTINCT FROM $pid${"wifi_split_confirmed":false}$pid$::jsonb
      AND to_jsonb(warranty) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${}$pid$::jsonb
      AND to_jsonb(instant_book) IS NOT DISTINCT FROM $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr.'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'access.emergency_key_access', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'access.garage_remote', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'access.key_storage', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'access.lock_brand', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'access.yale_module', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'amenities.access_notes', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'amenities.list', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'facts.grill', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'facts.interior_paint', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'facts.tv_locations', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'facts.tv_specs', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'facts.workstation', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'fireplace.fuel_type', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'fireplace.gas_switch', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'fireplace.gas_switch_location', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'fireplace.instructions', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'fireplace.model', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'fireplace.present', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'grounds.mowing_cadence', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'grounds.mowing_days', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'hoa.notes + external_links', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'hoa.present', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'hvac.filter_notes', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'hvac.filter_sizes', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'listing_alias', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'neighborhood', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'operating_notes', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'parking.cluster_mailbox', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'parking.mailbox_location', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'parking.mailbox_number', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'pool_spa.present', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'security.alarm', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'security.battery_type', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'security.devices', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'security.monitoring_expires_on', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'security.monitoring_plan', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'sprinklers.brand', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'sprinklers.controller_location', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'sprinklers.set_for_season', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'sprinklers.status', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'storm_shelter.location_access', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.breaker_panel_location', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.co.installed', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.co.location', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.fridge_filter', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.fridge_filter_5yr', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.smoke.batteries_changed_on', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.smoke.battery_type', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.smoke.brand', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.smoke.expires_on', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.smoke.expires_precision', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.smoke.expires_source_text', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.smoke.notes', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.smoke.power_type', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.supply_box_location', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.supply_storage', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.water_shutoff_indoor', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.water_shutoff_outdoor', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'utilities.router_location', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'utilities.wifi_ssid', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'warranty.builder_expires_on', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'warranty.builder_present', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'warranty.claim_process + external_links', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'warranty.furniture_expires_on', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'waste.cart_count', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'waste.cart_notes', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'waste.holiday_notes', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'waste.recycling', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'waste.recycling_days', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'waste.strict_rules', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'waste.trash_days', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'waste.valet', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'instant_book', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 9235 E 133rd St S (OwnerRez 439579): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET
      waste = (jsonb_populate_record(NULL::public.properties, $pid${"waste":{"recycling":false,"cart_count":2,"cart_notes":"2","trash_days":["Friday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday","valet":"No"}}$pid$::jsonb)).waste,
      updated_at = now()
    WHERE id = '792d6764-76e9-40e1-8bfc-e79b5dae44ee'
      AND to_jsonb(waste) IS NOT DISTINCT FROM $pid${"recycling":false,"cart_count":2,"cart_notes":"2","trash_days":["Friday"],"holiday_notes":"See attached photo for holiday pickup schedule","recycling_days":"Same as trash day Thursday"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9235 E 133rd St S'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('792d6764-76e9-40e1-8bfc-e79b5dae44ee', 'waste.valet', 'notion_pid', '16b4658d-5f4f-800b-ac5b-d57747df2836', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- New reference links (same kinds and flags as the Sep 1 importer).
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'fillout_form', 'Pool & hot tub technician form', 'https://arha.fillout.com/pool?id=4144658d5f4f80be8fd8f052375bd74b', NULL, true, false, true, 'notion_pid', 'Pool & Hot Tub Technician Form', '2026-11-12', 'Temporary external form — to be replaced by a Resolve workflow.')
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'system', 'OR Property Link', 'https://app.ownerrez.com/properties/502215/info', NULL, true, true, false, 'notion_pid', 'OR Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1565707/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'system', 'OR Property Link', 'https://app.ownerrez.com/properties/501998/info', NULL, true, true, false, 'notion_pid', 'OR Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1564238/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'system', 'OR Property Link', 'https://app.ownerrez.com/properties/501851/info', NULL, true, true, false, 'notion_pid', 'OR Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1563499/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'system', 'OR Property Link', 'https://app.ownerrez.com/properties/499899/info', NULL, true, true, false, 'notion_pid', 'OR Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1542591/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'system', 'OR Property Link', 'https://app.ownerrez.com/properties/498633/info', NULL, true, true, false, 'notion_pid', 'OR Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1529710/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'system', 'OR Property Link', 'https://app.ownerrez.com/properties/497213/info', NULL, true, true, false, 'notion_pid', 'OR Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1514895/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'system', 'OR Property Link', 'https://app.ownerrez.com/properties/497214/info', NULL, true, true, false, 'notion_pid', 'OR Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1514896/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'system', 'OR Property Link', 'https://app.ownerrez.com/properties/496703/info', NULL, true, true, false, 'notion_pid', 'OR Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1509882/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'system', 'OR Property Link', 'https://app.ownerrez.com/properties/494863/info', NULL, true, true, false, 'notion_pid', 'OR Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1494604/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'camera_portal', 'Camera portal', 'https://account.ring.com/account/dashboard?l=38ab7465-5308-4bc6-b18f-86c31d46b9c8', NULL, true, false, false, 'notion_pid', 'Security Camera Feed', '2026-11-12', 'Portal reference only — no credentials stored.')
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'legacy_onedrive', 'Furniture pick list (legacy OneDrive)', 'https://arealhomeaway-my.sharepoint.com/:f:/p/info/IgD4qXqglNXTQ7RM_sBVC-CRAZaMEv3I930Qy3fwIvZf6CI?e=s2DOXo', NULL, true, false, false, 'notion_pid', 'Furniture Pick List Link', '2026-11-12', 'Legacy OneDrive link — not a Resolve document. Pending SharePoint migration.')
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'reference', NULL, 'https://www.amazon.com/dp/B08CNKBTYJ?ref=fed_asin_title&th=1', 'reference', true, false, false, 'notion_pid', 'Garage Remote Brand & Model', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'camera_portal', 'Camera portal', 'https://account.ring.com/account/dashboard?l=0441de51-a23e-4406-ba4c-9f95ca6c8eaa', NULL, true, false, false, 'notion_pid', 'Security Camera Feed', '2026-11-12', 'Portal reference only — no credentials stored.')
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'legacy_onedrive', 'Furniture pick list (legacy OneDrive)', 'https://arealhomeaway-my.sharepoint.com/:x:/p/info/IQALtIApLQNnR4gXp9IrdIkOAVdHJqoRLaAXzRG9_DW4LtI?e=AIgFBr', NULL, true, false, false, 'notion_pid', 'Furniture Pick List Link', '2026-11-12', 'Legacy OneDrive link — not a Resolve document. Pending SharePoint migration.')
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'reference', NULL, 'https://www.amazon.com/dp/B08CNKBTYJ?ref=fed_asin_title&th=1', 'reference', true, false, false, 'notion_pid', 'Garage Remote Brand & Model', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'camera_portal', 'Camera portal', 'https://account.ring.com/account/dashboard?l=e3cc0088-0a8d-4c1d-b5f0-ab7ab39dc710', NULL, true, false, false, 'notion_pid', 'Security Camera Feed', '2026-11-12', 'Portal reference only — no credentials stored.')
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'builder', NULL, 'https://www.drhorton.com/Warranty', 'warranty', true, false, false, 'notion_pid', 'Builder Warranty Claim Info', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'legacy_onedrive', 'Furniture pick list (legacy OneDrive)', 'https://arealhomeaway-my.sharepoint.com/:x:/p/info/IQCLb1VbxTfhR5seFx_wVVyYAay_4sHqQqE49PAt_SYfzvI?e=2LBANe', NULL, true, false, false, 'notion_pid', 'Furniture Pick List Link', '2026-11-12', 'Legacy OneDrive link — not a Resolve document. Pending SharePoint migration.')
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'reference', NULL, 'https://www.amazon.com/dp/B0DH81245P?ref=fed_asin_title&th=1', 'reference', true, false, false, 'notion_pid', 'Garage Remote Brand & Model', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'camera_portal', 'Camera portal', 'https://account.ring.com/account/dashboard?l=48cc62ba-579f-48e8-9a3f-ec61247146a1', NULL, true, false, false, 'notion_pid', 'Security Camera Feed', '2026-11-12', 'Portal reference only — no credentials stored.')
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'legacy_onedrive', 'Furniture pick list (legacy OneDrive)', 'https://arealhomeaway-my.sharepoint.com/:x:/p/info/IQDpZulpB62MRLNgXXDly5fGAWNfkJ-jKmAdfzxS2JgdcfE?e=kcgyHi', NULL, true, false, false, 'notion_pid', 'Furniture Pick List Link', '2026-11-12', 'Legacy OneDrive link — not a Resolve document. Pending SharePoint migration.')
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'reference', NULL, 'https://www.amazon.com/dp/B08CNKBTYJ?ref_=ppx_hzod_title_dt_b_fed_asin_title_4_10&th=1', 'reference', true, false, false, 'notion_pid', 'Garage Remote Brand & Model', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'camera_portal', 'Camera portal', 'https://account.ring.com/account/dashboard?l=4017fdb0-9280-4981-81d5-6f65a058afd8', NULL, true, false, false, 'notion_pid', 'Security Camera Feed', '2026-11-12', 'Portal reference only — no credentials stored.')
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'legacy_onedrive', 'Furniture pick list (legacy OneDrive)', 'https://arealhomeaway-my.sharepoint.com/:x:/p/info/IQBcg59L-S1CRaLBAoH170T_AdmAwzN1Ae3r_-p1_7chtR4?e=4YPNBa', NULL, true, false, false, 'notion_pid', 'Furniture Pick List Link', '2026-11-12', 'Legacy OneDrive link — not a Resolve document. Pending SharePoint migration.')
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('82f30000-1b78-42a9-a965-5caf68c508c4', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1295307/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;

COMMIT;
