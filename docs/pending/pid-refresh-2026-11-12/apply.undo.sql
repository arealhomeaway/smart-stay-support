-- UNDO for PID refresh 2026-11-12 apply.sql. Restores every touched value, provenance row and inserted link.
-- Each restore checks the value is still the applied one; any difference aborts the whole file.
BEGIN;

-- 1012 Wasatch Ct
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'cc77a4df-0fa2-466d-bd6d-8c4217e84b03' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1012 Wasatch Ct / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cc77a4df-0fa2-466d-bd6d-8c4217e84b03' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 10121 E. 131st Pl. S.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '4eca9876-0251-4bdc-9cd6-3c22af34fe75' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '10121 E. 131st Pl. S. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '4eca9876-0251-4bdc-9cd6-3c22af34fe75' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1016 NW 191st St
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '14830c3b-9874-4f6b-9de7-4cd891180ba4' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1016 NW 191st St / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '14830c3b-9874-4f6b-9de7-4cd891180ba4' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 10302 S. 230th East Ave
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '93223fe9-7ef9-49a6-868d-bb3d62e298b0' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '10302 S. 230th East Ave / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '93223fe9-7ef9-49a6-868d-bb3d62e298b0' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '93223fe9-7ef9-49a6-868d-bb3d62e298b0' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '10302 S. 230th East Ave / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '93223fe9-7ef9-49a6-868d-bb3d62e298b0' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 10320 Lightning Creek Dr. (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '39a26e33-37b5-4009-a157-a24b13aca00c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '10320 Lightning Creek Dr. (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '39a26e33-37b5-4009-a157-a24b13aca00c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"ROKU Pin: See Guest Access & Credentials"$pid$::jsonb, true), updated_at = now() WHERE id = '39a26e33-37b5-4009-a157-a24b13aca00c' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"ROKU Pin: [removed — credentials are not stored in Resolve]"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '10320 Lightning Creek Dr. (30D FIRM) / facts.tv_specs'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-8061-a449-ced48929fc34', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '39a26e33-37b5-4009-a157-a24b13aca00c' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"summary"}', $pid$"3 Car Garage"$pid$::jsonb, true), updated_at = now() WHERE id = '39a26e33-37b5-4009-a157-a24b13aca00c' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$"3 Car Garage. Per the HOA cars can only be parked in the garage and driveway. Max of 3 cars in driveway. NO street parking."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '10320 Lightning Creek Dr. (30D FIRM) / parking.summary'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-8061-a449-ced48929fc34', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '39a26e33-37b5-4009-a157-a24b13aca00c' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';

-- 1039 Swinton Way
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '97318d4f-137e-4647-b8e6-957836ffaa08' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1039 Swinton Way / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '97318d4f-137e-4647-b8e6-957836ffaa08' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 105 Summit Bnd
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'cb686c69-2305-46ee-8d57-06a6181e4255' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '105 Summit Bnd / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cb686c69-2305-46ee-8d57-06a6181e4255' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 10549 SE 23rd St
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'e51e6c1f-2a21-4b2b-a495-54b9160649e2' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '10549 SE 23rd St / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e51e6c1f-2a21-4b2b-a495-54b9160649e2' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1056 Wildwood Drive
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '9a82f157-3e48-47f4-ad58-ceca4b38fd02' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1056 Wildwood Drive / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9a82f157-3e48-47f4-ad58-ceca4b38fd02' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1068 Berrywood Dr.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '8f14ad4c-0264-4114-af90-848989e03521' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1068 Berrywood Dr. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8f14ad4c-0264-4114-af90-848989e03521' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 10845 Sara Ct
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'e6e698a1-3c38-49e4-a877-3bf00894bf21' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '10845 Sara Ct / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e6e698a1-3c38-49e4-a877-3bf00894bf21' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 11109 SW 34th Terrace
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'c7d75c26-103e-40c0-9e0f-79d8f1fd6c94' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11109 SW 34th Terrace / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'c7d75c26-103e-40c0-9e0f-79d8f1fd6c94' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 11249 Pegasus Dr.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"emergency_key_access"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(access #> '{"emergency_key_access"}', 'null'::jsonb) = $pid$"Yes"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / access.emergency_key_access'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'access.emergency_key_access' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"garage_remote"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(access #> '{"garage_remote"}', 'null'::jsonb) = $pid$"Genie https://www.amazon.com/dp/B0DH81245P?ref=fed_asin_title&th=1"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / access.garage_remote'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'access.garage_remote' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"key_storage"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(access #> '{"key_storage"}', 'null'::jsonb) = $pid$["Garage Door","Front Door/Smartlock","Front Door - Storm Door"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / access.key_storage'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'access.key_storage' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"lock_brand"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(access #> '{"lock_brand"}', 'null'::jsonb) = $pid$"Yale"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / access.lock_brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'access.lock_brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_module"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$"Connected & Setup"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / access.yale_module'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = amenities #- '{"access_notes"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"No key necessary"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / amenities.access_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = amenities #- '{"list"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(amenities #> '{"list"}', 'null'::jsonb) = $pid$["Basketball Court","Pond"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / amenities.list'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'amenities.list' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"grill"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(facts #> '{"grill"}', 'null'::jsonb) = $pid$"No Grill"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / facts.grill'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'facts.grill' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"interior_paint"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(facts #> '{"interior_paint"}', 'null'::jsonb) = $pid$"Yes (Top shelf in the garage)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / facts.interior_paint'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'facts.interior_paint' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"tv_locations"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(facts #> '{"tv_locations"}', 'null'::jsonb) = $pid$["Living Room","Primary Bedroom"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / facts.tv_locations'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'facts.tv_locations' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"tv_specs"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"65\" Roku in Living Room, logged into Roku / 55\" Roku in Primary Bedroom, logged into Roku (Roku is also the TV brand)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / facts.tv_specs'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"workstation"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(facts #> '{"workstation"}', 'null'::jsonb) = $pid$"Yes"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / facts.workstation'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'facts.workstation' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"fuel_type"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(fireplace #> '{"fuel_type"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / fireplace.fuel_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'fireplace.fuel_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"gas_switch"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(fireplace #> '{"gas_switch"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / fireplace.gas_switch'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'fireplace.gas_switch' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"gas_switch_location"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(fireplace #> '{"gas_switch_location"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / fireplace.gas_switch_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'fireplace.gas_switch_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"instructions"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(fireplace #> '{"instructions"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / fireplace.instructions'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'fireplace.instructions' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"model"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(fireplace #> '{"model"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / fireplace.model'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'fireplace.model' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"present"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(fireplace #> '{"present"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / fireplace.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'fireplace.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET grounds = grounds #- '{"mowing_cadence"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(grounds #> '{"mowing_cadence"}', 'null'::jsonb) = $pid$"ARHA Responsible"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / grounds.mowing_cadence'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'grounds.mowing_cadence' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET grounds = grounds #- '{"mowing_days"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(grounds #> '{"mowing_days"}', 'null'::jsonb) = $pid$["Tuesday"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / grounds.mowing_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'grounds.mowing_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hoa = hoa #- '{"notes + external_links"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(hoa #> '{"notes + external_links"}', 'null'::jsonb) = $pid$"Waterman Farms HOA: no RVs/commercial vehicles parked on the street, garage must remain usable for parking, no above-ground pools."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / hoa.notes + external_links'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'hoa.notes + external_links' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hoa = hoa #- '{"present"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(hoa #> '{"present"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / hoa.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'hoa.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = hvac #- '{"filter_notes"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"14x24x1\nThis air filter is not a paper filter, the filter is metal and must be rinsed and dried fully when cleaning.\nRinse the metal air filter every 90 days (more often with pets or heavy dust); no need to replace it unless damaged."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / hvac.filter_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = hvac #- '{"filter_sizes"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(hvac #> '{"filter_sizes"}', 'null'::jsonb) = $pid$["14x24x1"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / hvac.filter_sizes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'hvac.filter_sizes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET legacy_handoff_date = (jsonb_populate_record(NULL::public.properties, $pid${"legacy_handoff_date":null}$pid$::jsonb)).legacy_handoff_date, updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND to_jsonb(legacy_handoff_date) IS NOT DISTINCT FROM $pid$"2026-10-02"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / legacy_handoff_date'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'legacy_handoff_date' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":null}$pid$::jsonb)).listing_alias, updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND to_jsonb(listing_alias) IS NOT DISTINCT FROM $pid$"3BR Home, Noblesville | Extended & Monthly Stays"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / listing_alias'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'listing_alias' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":null}$pid$::jsonb)).neighborhood, updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND to_jsonb(neighborhood) IS NOT DISTINCT FROM $pid$"Waterman Farms"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / neighborhood'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'neighborhood' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"This air filter is not a paper filter, the filter is metal and must be rinsed and dried fully when cleaning.\n\nWater spicket in the backyard was repaired, however it could leak in the future over time."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / operating_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"cluster_mailbox"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(parking #> '{"cluster_mailbox"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / parking.cluster_mailbox'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'parking.cluster_mailbox' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"mailbox_location"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(parking #> '{"mailbox_location"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / parking.mailbox_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'parking.mailbox_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"mailbox_number"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(parking #> '{"mailbox_number"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / parking.mailbox_number'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'parking.mailbox_number' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = pool_spa #- '{"present"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(pool_spa #> '{"present"}', 'null'::jsonb) = $pid$"None"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / pool_spa.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'pool_spa.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"alarm"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(security #> '{"alarm"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / security.alarm'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'security.alarm' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"battery_type"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(security #> '{"battery_type"}', 'null'::jsonb) = $pid$["Hardwired - No Battery"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / security.battery_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'security.battery_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"devices"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(security #> '{"devices"}', 'null'::jsonb) = $pid$["Driveway","Front Door"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / security.devices'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'security.devices' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"monitoring_expires_on"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(security #> '{"monitoring_expires_on"}', 'null'::jsonb) = $pid$"2027-10-08"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / security.monitoring_expires_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'security.monitoring_expires_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"monitoring_plan"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(security #> '{"monitoring_plan"}', 'null'::jsonb) = $pid$["Active"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / security.monitoring_plan'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'security.monitoring_plan' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"brand"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(sprinklers #> '{"brand"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / sprinklers.brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'sprinklers.brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"controller_location"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(sprinklers #> '{"controller_location"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / sprinklers.controller_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'sprinklers.controller_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"set_for_season"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(sprinklers #> '{"set_for_season"}', 'null'::jsonb) = $pid${"value":"N/A","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / sprinklers.set_for_season'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'sprinklers.set_for_season' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"status"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(sprinklers #> '{"status"}', 'null'::jsonb) = $pid$"Property Does Not Have Sprinkler System"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / sprinklers.status'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'sprinklers.status' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET storm_shelter = storm_shelter #- '{"location_access"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(storm_shelter #> '{"location_access"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / storm_shelter.location_access'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'storm_shelter.location_access' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"breaker_panel_location"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"breaker_panel_location"}', 'null'::jsonb) = $pid$"Garage"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / systems.breaker_panel_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.breaker_panel_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"co","installed"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"co","installed"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / systems.co.installed'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.co.installed' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"co","location"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"co","location"}', 'null'::jsonb) = $pid$"Kitchen"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / systems.co.location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.co.location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"fridge_filter"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$"EveryDrop Filter 1 (EDR1RXD1)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / systems.fridge_filter'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"fridge_filter_5yr"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"fridge_filter_5yr"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / systems.fridge_filter_5yr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.fridge_filter_5yr' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","batteries_changed_on"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2026-09-21"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / systems.smoke.batteries_changed_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","battery_type"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"smoke","battery_type"}', 'null'::jsonb) = $pid$"9-Volt (Lithium)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / systems.smoke.battery_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.smoke.battery_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","brand"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"smoke","brand"}', 'null'::jsonb) = $pid$"First Alert (7 units)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / systems.smoke.brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.smoke.brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_on"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"smoke","expires_on"}', 'null'::jsonb) = $pid$"2036-12-31"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / systems.smoke.expires_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.smoke.expires_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_precision"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"smoke","expires_precision"}', 'null'::jsonb) = $pid$"year"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / systems.smoke.expires_precision'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.smoke.expires_precision' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_source_text"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"smoke","expires_source_text"}', 'null'::jsonb) = $pid$"2036"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / systems.smoke.expires_source_text'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.smoke.expires_source_text' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","notes"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"smoke","notes"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / systems.smoke.notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.smoke.notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","power_type"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"smoke","power_type"}', 'null'::jsonb) = $pid$"Hardwired"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / systems.smoke.power_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.smoke.power_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"supply_box_location"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"supply_box_location"}', 'null'::jsonb) = $pid$"Top shelf of master closet"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / systems.supply_box_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.supply_box_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"supply_storage"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"supply_storage"}', 'null'::jsonb) = $pid$"Closet"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / systems.supply_storage'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.supply_storage' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"water_shutoff_indoor"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"water_shutoff_indoor"}', 'null'::jsonb) = $pid$"Laundry room"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / systems.water_shutoff_indoor'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.water_shutoff_indoor' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"water_shutoff_outdoor"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"water_shutoff_outdoor"}', 'null'::jsonb) = $pid$"Front yard"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / systems.water_shutoff_outdoor'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'systems.water_shutoff_outdoor' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier, updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / tier'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"router_location"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(utilities #> '{"router_location"}', 'null'::jsonb) = $pid$"In the living room"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / utilities.router_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'utilities.router_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"wifi_ssid"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(utilities #> '{"wifi_ssid"}', 'null'::jsonb) = $pid$"ARHA"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / utilities.wifi_ssid'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'utilities.wifi_ssid' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET warranty = warranty #- '{"builder_present"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(warranty #> '{"builder_present"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / warranty.builder_present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'warranty.builder_present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET warranty = warranty #- '{"claim_process + external_links"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(warranty #> '{"claim_process + external_links"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / warranty.claim_process + external_links'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'warranty.claim_process + external_links' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET warranty = warranty #- '{"furniture_expires_on"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(warranty #> '{"furniture_expires_on"}', 'null'::jsonb) = $pid$"2029-10-02"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / warranty.furniture_expires_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'warranty.furniture_expires_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"cart_count"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(waste #> '{"cart_count"}', 'null'::jsonb) = $pid$2$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / waste.cart_count'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'waste.cart_count' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"cart_notes"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(waste #> '{"cart_notes"}', 'null'::jsonb) = $pid$"2"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / waste.cart_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'waste.cart_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"holiday_notes"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(waste #> '{"holiday_notes"}', 'null'::jsonb) = $pid$"Service is delayed one day on: New Year's Day • Memorial Day • July 4th • Labor Day • Thanksgiving Day • Christmas Day"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / waste.holiday_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'waste.holiday_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"recycling"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(waste #> '{"recycling"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / waste.recycling'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'waste.recycling' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"recycling_days"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(waste #> '{"recycling_days"}', 'null'::jsonb) = $pid$"Every other Monday"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / waste.recycling_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'waste.recycling_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"strict_rules"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(waste #> '{"strict_rules"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / waste.strict_rules'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'waste.strict_rules' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"trash_days"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(waste #> '{"trash_days"}', 'null'::jsonb) = $pid$["Monday"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / waste.trash_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'waste.trash_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11249 Pegasus Dr. / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';
UPDATE public.properties SET systems = systems #- '{"co"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND systems #> '{"co"}' = '{}'::jsonb;
UPDATE public.properties SET systems = systems #- '{"smoke"}', updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND systems #> '{"smoke"}' = '{}'::jsonb;

-- 11508 E 94th Pl N
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '53aed118-974e-4f01-8c7d-ca901677b6d7' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11508 E 94th Pl N / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '53aed118-974e-4f01-8c7d-ca901677b6d7' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '53aed118-974e-4f01-8c7d-ca901677b6d7' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11508 E 94th Pl N / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '53aed118-974e-4f01-8c7d-ca901677b6d7' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 11514 S. Locust Ave
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '75bc895c-4401-4080-9df7-748efe8f04f1' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11514 S. Locust Ave / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '75bc895c-4401-4080-9df7-748efe8f04f1' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '75bc895c-4401-4080-9df7-748efe8f04f1' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11514 S. Locust Ave / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '75bc895c-4401-4080-9df7-748efe8f04f1' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"The owner has a membership with \nAmerican Home Pros\n for annual tune ups (HVAC). For general maintenance you can try them, but from past experience, their pricing is high."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '75bc895c-4401-4080-9df7-748efe8f04f1' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"The owner has a membership with \nAmerican Home Pros for annual tune ups (HVAC). For general maintenance you can try them, but from past experience, their pricing is high. \nUpdate: We have free service calls from them until July 2027 please make sure they are the first point of contact for any HVAC related issues."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11514 S. Locust Ave / operating_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80eb-8851-d5c58fdd8485', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '75bc895c-4401-4080-9df7-748efe8f04f1' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 1152 Western Yarrow Ave
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1152 Western Yarrow Ave / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = hvac #- '{"filter_sizes"}', updated_at = now() WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND coalesce(hvac #> '{"filter_sizes"}', 'null'::jsonb) = $pid$["20x25x4"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1152 Western Yarrow Ave / hvac.filter_sizes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND field_key = 'hvac.filter_sizes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"brand"}', updated_at = now() WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND coalesce(sprinklers #> '{"brand"}', 'null'::jsonb) = $pid$"Rain bird"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1152 Western Yarrow Ave / sprinklers.brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND field_key = 'sprinklers.brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"controller_location"}', updated_at = now() WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND coalesce(sprinklers #> '{"controller_location"}', 'null'::jsonb) = $pid$"Garage"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1152 Western Yarrow Ave / sprinklers.controller_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND field_key = 'sprinklers.controller_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"set_for_season"}', updated_at = now() WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND coalesce(sprinklers #> '{"set_for_season"}', 'null'::jsonb) = $pid${"value":"N/A","as_of":"2026-11-03T22:21:00.000Z","source":"notion_pid"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1152 Western Yarrow Ave / sprinklers.set_for_season'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND field_key = 'sprinklers.set_for_season' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"Not Mentioned"$pid$::jsonb, true), updated_at = now() WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"20x25x4"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1152 Western Yarrow Ave / hvac.filter_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"status"}', $pid$"Property Does Not Have Sprinkler System"$pid$::jsonb, true), updated_at = now() WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND coalesce(sprinklers #> '{"status"}', 'null'::jsonb) = $pid$"Property Has Sprinkler System and It's On"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1152 Western Yarrow Ave / sprinklers.status'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND field_key = 'sprinklers.status' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2026-02-02"$pid$::jsonb, true), updated_at = now() WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2026-09-16"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1152 Western Yarrow Ave / systems.smoke.batteries_changed_on'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';

-- 1169 Blue Sky Lane
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '1be61e2e-6ca3-41f4-93de-2fe22f440267' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1169 Blue Sky Lane / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1be61e2e-6ca3-41f4-93de-2fe22f440267' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2025-10-29"$pid$::jsonb, true), updated_at = now() WHERE id = '1be61e2e-6ca3-41f4-93de-2fe22f440267' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2026-09-17"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1169 Blue Sky Lane / systems.smoke.batteries_changed_on'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-8065-b0e0-f007b0cb0a2e', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '1be61e2e-6ca3-41f4-93de-2fe22f440267' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';

-- 11720 NW 136th Ter
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '5e230772-bbb1-4558-86c9-46e6ad024d3d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11720 NW 136th Ter / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '5e230772-bbb1-4558-86c9-46e6ad024d3d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 11736 SW 15th Terr (30D Firm)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '70d06d5c-d358-4452-ac9a-1fa22b68ce20' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '11736 SW 15th Terr (30D Firm) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '70d06d5c-d358-4452-ac9a-1fa22b68ce20' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1215 N Elder Ave
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '7a65ee79-900e-414d-a496-bb2077d6046c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1215 N Elder Ave / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '7a65ee79-900e-414d-a496-bb2077d6046c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '7a65ee79-900e-414d-a496-bb2077d6046c' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1215 N Elder Ave / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '7a65ee79-900e-414d-a496-bb2077d6046c' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 13117 NE 9th St
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'bd5becd5-c66c-4691-8b41-1a62eac826e0' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '13117 NE 9th St / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bd5becd5-c66c-4691-8b41-1a62eac826e0' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 13317 Brampton Way
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '5dd44c1d-65f8-465e-b29e-fa8f8ba3e617' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '13317 Brampton Way / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '5dd44c1d-65f8-465e-b29e-fa8f8ba3e617' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 13325 E 43rd Pl S
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'c92c13e5-27d8-4f4e-b0e8-59638169a140' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '13325 E 43rd Pl S / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'c92c13e5-27d8-4f4e-b0e8-59638169a140' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = 'c92c13e5-27d8-4f4e-b0e8-59638169a140' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '13325 E 43rd Pl S / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'c92c13e5-27d8-4f4e-b0e8-59638169a140' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 136 Magnolia Estates St
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'e7f578f0-4000-4a80-b6d0-70bf2bc45122' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '136 Magnolia Estates St / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e7f578f0-4000-4a80-b6d0-70bf2bc45122' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2025-08-13"$pid$::jsonb, true), updated_at = now() WHERE id = 'e7f578f0-4000-4a80-b6d0-70bf2bc45122' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2026-09-04"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '136 Magnolia Estates St / systems.smoke.batteries_changed_on'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-8008-bbe8-f5c98ca070dd', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'e7f578f0-4000-4a80-b6d0-70bf2bc45122' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';

-- 1399 Foxtail Ln.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"emergency_key_access"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(access #> '{"emergency_key_access"}', 'null'::jsonb) = $pid$"Yes"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / access.emergency_key_access'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'access.emergency_key_access' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"garage_remote"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(access #> '{"garage_remote"}', 'null'::jsonb) = $pid$"LiftMaster"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / access.garage_remote'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'access.garage_remote' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"key_storage"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(access #> '{"key_storage"}', 'null'::jsonb) = $pid$["Mailbox","Front Door/Smartlock","Backdoor","Storage Closet","Back Door - Storm Door"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / access.key_storage'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'access.key_storage' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"lock_brand"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(access #> '{"lock_brand"}', 'null'::jsonb) = $pid$"Yale"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / access.lock_brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'access.lock_brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_integration_live"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / access.yale_integration_live'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_module"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$"Connected & Setup"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / access.yale_module'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = amenities #- '{"access_notes"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"The CC&Rs do not list specific amenities, access instructions, or fees. The neighborhood ponds are for drainage and views only; swimming, ice skating, and boating are not permitted."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / amenities.access_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = amenities #- '{"list"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(amenities #> '{"list"}', 'null'::jsonb) = $pid$["Pond"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / amenities.list'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'amenities.list' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET compliance = compliance #- '{"permit_status"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(compliance #> '{"permit_status"}', 'null'::jsonb) = $pid${"text":"No permit required for Greenwood, IN","as_of":"2026-11-05T17:51:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / compliance.permit_status'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'compliance.permit_status' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET compliance = compliance #- '{"rental_restrictions"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(compliance #> '{"rental_restrictions"}', 'null'::jsonb) = $pid${"text":"No STR rental restrictions","as_of":"2026-11-05T17:51:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / compliance.rental_restrictions'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'compliance.rental_restrictions' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = external_refs #- '{"breezeway_url"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$"https://app.breezeway.io/property/1494604/profile"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / external_refs.breezeway_url'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"grill"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(facts #> '{"grill"}', 'null'::jsonb) = $pid$"No Grill"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / facts.grill'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'facts.grill' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"interior_paint"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(facts #> '{"interior_paint"}', 'null'::jsonb) = $pid$"Unknown. No extra paint left"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / facts.interior_paint'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'facts.interior_paint' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"tv_locations"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(facts #> '{"tv_locations"}', 'null'::jsonb) = $pid$["Living Room","Primary Bedroom"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / facts.tv_locations'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'facts.tv_locations' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"tv_specs"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"55\" Roku QLED TV in Primary Bedroom, logged into Roku. 65\" Roku QLED TV in Living Room, logged into Roku."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / facts.tv_specs'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"workstation"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(facts #> '{"workstation"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / facts.workstation'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'facts.workstation' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"fuel_type"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(fireplace #> '{"fuel_type"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / fireplace.fuel_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'fireplace.fuel_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"gas_switch"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(fireplace #> '{"gas_switch"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / fireplace.gas_switch'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'fireplace.gas_switch' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"gas_switch_location"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(fireplace #> '{"gas_switch_location"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / fireplace.gas_switch_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'fireplace.gas_switch_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"instructions"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(fireplace #> '{"instructions"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / fireplace.instructions'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'fireplace.instructions' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"model"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(fireplace #> '{"model"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / fireplace.model'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'fireplace.model' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"present"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(fireplace #> '{"present"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / fireplace.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'fireplace.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / furniture_package'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET grounds = grounds #- '{"mowing_cadence"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(grounds #> '{"mowing_cadence"}', 'null'::jsonb) = $pid$"ARHA Responsible"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / grounds.mowing_cadence'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'grounds.mowing_cadence' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET grounds = grounds #- '{"mowing_days"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(grounds #> '{"mowing_days"}', 'null'::jsonb) = $pid$["Monday"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / grounds.mowing_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'grounds.mowing_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hoa = hoa #- '{"notes + external_links"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(hoa #> '{"notes + external_links"}', 'null'::jsonb) = $pid$"The HOA for Lone Pine Farms is administered by Ardsley Management, which can be reached at (317) 253-1401 or via email at indianapolisinfo@drhorton.com."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / hoa.notes + external_links'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'hoa.notes + external_links' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hoa = hoa #- '{"present"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(hoa #> '{"present"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / hoa.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'hoa.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = hvac #- '{"filter_notes"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"1 -16×25×4"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / hvac.filter_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = hvac #- '{"filter_sizes"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(hvac #> '{"filter_sizes"}', 'null'::jsonb) = $pid$["16x25x4"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / hvac.filter_sizes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'hvac.filter_sizes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":null}$pid$::jsonb)).listing_alias, updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND to_jsonb(listing_alias) IS NOT DISTINCT FROM $pid$"Cozy 4BR Home | Greenwood | Pet Friendly"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / listing_alias'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'listing_alias' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET market = (jsonb_populate_record(NULL::public.properties, $pid${"market":null}$pid$::jsonb)).market, updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND to_jsonb(market) IS NOT DISTINCT FROM $pid$"Indy"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / market'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'market' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":null}$pid$::jsonb)).neighborhood, updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND to_jsonb(neighborhood) IS NOT DISTINCT FROM $pid$"Lone Pine Farms"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / neighborhood'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'neighborhood' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname, updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"Foxtail Hollow (1399)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / nickname'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / operating_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"cluster_mailbox"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(parking #> '{"cluster_mailbox"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / parking.cluster_mailbox'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'parking.cluster_mailbox' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"mailbox_location"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(parking #> '{"mailbox_location"}', 'null'::jsonb) = $pid$"The cluster mailbox #1399 is at the corner of Foxtail Ln and Sumatran Ln, a short walk east of the house. Key is located inside the lock box on the garage trim."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / parking.mailbox_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'parking.mailbox_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"mailbox_number"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(parking #> '{"mailbox_number"}', 'null'::jsonb) = $pid$"1399"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / parking.mailbox_number'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'parking.mailbox_number' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"summary"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$"2 Car Garage\nFree Parking on Premises"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / parking.summary'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = pool_spa #- '{"present"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(pool_spa #> '{"present"}', 'null'::jsonb) = $pid$"None"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / pool_spa.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'pool_spa.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"alarm"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(security #> '{"alarm"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / security.alarm'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'security.alarm' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"battery_type"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(security #> '{"battery_type"}', 'null'::jsonb) = $pid$["Hardwired - No Battery"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / security.battery_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'security.battery_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"devices"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(security #> '{"devices"}', 'null'::jsonb) = $pid$["Front Door","Driveway"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / security.devices'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'security.devices' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"monitoring_expires_on"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(security #> '{"monitoring_expires_on"}', 'null'::jsonb) = $pid$"2027-11-15"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / security.monitoring_expires_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'security.monitoring_expires_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"monitoring_plan"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(security #> '{"monitoring_plan"}', 'null'::jsonb) = $pid$["Active"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / security.monitoring_plan'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'security.monitoring_plan' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"brand"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(sprinklers #> '{"brand"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / sprinklers.brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'sprinklers.brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"controller_location"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(sprinklers #> '{"controller_location"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / sprinklers.controller_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'sprinklers.controller_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"set_for_season"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(sprinklers #> '{"set_for_season"}', 'null'::jsonb) = $pid${"value":"N/A","as_of":"2026-11-05T17:51:00.000Z","source":"notion_pid"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / sprinklers.set_for_season'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'sprinklers.set_for_season' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"status"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(sprinklers #> '{"status"}', 'null'::jsonb) = $pid$"Property Does Not Have Sprinkler System"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / sprinklers.status'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'sprinklers.status' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET storm_shelter = storm_shelter #- '{"location_access"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(storm_shelter #> '{"location_access"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / storm_shelter.location_access'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'storm_shelter.location_access' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"breaker_panel_location"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"breaker_panel_location"}', 'null'::jsonb) = $pid$"Garage"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / systems.breaker_panel_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.breaker_panel_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"co","installed"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"co","installed"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / systems.co.installed'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.co.installed' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"co","location"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"co","location"}', 'null'::jsonb) = $pid$"Kitchen"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / systems.co.location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.co.location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"fridge_filter"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$"EDR1RXD1 (Everydrop Filter 1 / Whirlpool W10295370A compatible)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / systems.fridge_filter'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"fridge_filter_5yr"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"fridge_filter_5yr"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / systems.fridge_filter_5yr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.fridge_filter_5yr' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","batteries_changed_on"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2026-10-22"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / systems.smoke.batteries_changed_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","battery_type"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"smoke","battery_type"}', 'null'::jsonb) = $pid$"9-Volt (Lithium)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / systems.smoke.battery_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.smoke.battery_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","brand"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"smoke","brand"}', 'null'::jsonb) = $pid$"First alert"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / systems.smoke.brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.smoke.brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_on"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"smoke","expires_on"}', 'null'::jsonb) = $pid$"2034-12-31"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / systems.smoke.expires_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.smoke.expires_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_precision"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"smoke","expires_precision"}', 'null'::jsonb) = $pid$"year"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / systems.smoke.expires_precision'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.smoke.expires_precision' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_source_text"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"smoke","expires_source_text"}', 'null'::jsonb) = $pid$"2034"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / systems.smoke.expires_source_text'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.smoke.expires_source_text' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","notes"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"smoke","notes"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / systems.smoke.notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.smoke.notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","power_type"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"smoke","power_type"}', 'null'::jsonb) = $pid$"Hardwired"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / systems.smoke.power_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.smoke.power_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"supply_box_location"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"supply_box_location"}', 'null'::jsonb) = $pid$"Top shelf of Master closet"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / systems.supply_box_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.supply_box_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"supply_storage"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"supply_storage"}', 'null'::jsonb) = $pid$"Closet"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / systems.supply_storage'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.supply_storage' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"water_shutoff_indoor"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"water_shutoff_indoor"}', 'null'::jsonb) = $pid$"Closet with furnace"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / systems.water_shutoff_indoor'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.water_shutoff_indoor' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"water_shutoff_outdoor"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"water_shutoff_outdoor"}', 'null'::jsonb) = $pid$"Near sidewalk"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / systems.water_shutoff_outdoor'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'systems.water_shutoff_outdoor' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier, updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / tier'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"router_location"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(utilities #> '{"router_location"}', 'null'::jsonb) = $pid$"Living room"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / utilities.router_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'utilities.router_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"wifi_split_confirmed"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / utilities.wifi_split_confirmed'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"wifi_ssid"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(utilities #> '{"wifi_ssid"}', 'null'::jsonb) = $pid$"ARHA"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / utilities.wifi_ssid'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'utilities.wifi_ssid' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET warranty = warranty #- '{"builder_present"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(warranty #> '{"builder_present"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / warranty.builder_present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'warranty.builder_present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET warranty = warranty #- '{"claim_process + external_links"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(warranty #> '{"claim_process + external_links"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / warranty.claim_process + external_links'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'warranty.claim_process + external_links' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET warranty = warranty #- '{"furniture_expires_on"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(warranty #> '{"furniture_expires_on"}', 'null'::jsonb) = $pid$"2029-11-04"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / warranty.furniture_expires_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'warranty.furniture_expires_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"cart_count"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(waste #> '{"cart_count"}', 'null'::jsonb) = $pid$2$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / waste.cart_count'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'waste.cart_count' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"cart_notes"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(waste #> '{"cart_notes"}', 'null'::jsonb) = $pid$"2 trash cans and 1 recycling"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / waste.cart_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'waste.cart_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"holiday_notes"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(waste #> '{"holiday_notes"}', 'null'::jsonb) = $pid$"If one of the following holidays falls on a Monday through Thursday, trash pickup will be delayed by one day one day: New Year's Day • Memorial Day • July 4th • Labor Day • Thanksgiving Day • Christmas Day"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / waste.holiday_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'waste.holiday_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"recycling"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(waste #> '{"recycling"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / waste.recycling'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'waste.recycling' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"recycling_days"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(waste #> '{"recycling_days"}', 'null'::jsonb) = $pid$"Every other Thursday."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / waste.recycling_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'waste.recycling_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"strict_rules"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(waste #> '{"strict_rules"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / waste.strict_rules'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'waste.strict_rules' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"trash_days"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(waste #> '{"trash_days"}', 'null'::jsonb) = $pid$["Thursday"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / waste.trash_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'waste.trash_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built, updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2024$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1399 Foxtail Ln. / year_built'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';
UPDATE public.properties SET systems = systems #- '{"co"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND systems #> '{"co"}' = '{}'::jsonb;
UPDATE public.properties SET systems = systems #- '{"smoke"}', updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND systems #> '{"smoke"}' = '{}'::jsonb;

-- 14553 Serrano Ridge Rd
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'dafa6257-99d1-4a71-9e18-b02394c6807d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '14553 Serrano Ridge Rd / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'dafa6257-99d1-4a71-9e18-b02394c6807d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"garage_remote"}', $pid$"LiftMaster 38OUT"$pid$::jsonb, true), updated_at = now() WHERE id = 'dafa6257-99d1-4a71-9e18-b02394c6807d' AND coalesce(access #> '{"garage_remote"}', 'null'::jsonb) = $pid$"LiftMaster 380 UT"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '14553 Serrano Ridge Rd / access.garage_remote'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80a5-88d4-ec54ad9b0530', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'dafa6257-99d1-4a71-9e18-b02394c6807d' AND field_key = 'access.garage_remote' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2025-10-16"$pid$::jsonb, true), updated_at = now() WHERE id = 'dafa6257-99d1-4a71-9e18-b02394c6807d' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2026-09-08"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '14553 Serrano Ridge Rd / systems.smoke.batteries_changed_on'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80a5-88d4-ec54ad9b0530', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'dafa6257-99d1-4a71-9e18-b02394c6807d' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';

-- 1464 Buckland Ct.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_integration_live"}', updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1464 Buckland Ct. / access.yale_integration_live'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1464 Buckland Ct. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET compliance = compliance #- '{"permit_status"}', updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND coalesce(compliance #> '{"permit_status"}', 'null'::jsonb) = $pid${"text":"No permit required for Avon, IN","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1464 Buckland Ct. / compliance.permit_status'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'compliance.permit_status' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET compliance = compliance #- '{"rental_restrictions"}', updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND coalesce(compliance #> '{"rental_restrictions"}', 'null'::jsonb) = $pid${"text":"No STR rental restrictions","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1464 Buckland Ct. / compliance.rental_restrictions'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'compliance.rental_restrictions' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = external_refs #- '{"breezeway_url"}', updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$"https://app.breezeway.io/property/1509882/profile"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1464 Buckland Ct. / external_refs.breezeway_url'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1464 Buckland Ct. / furniture_package'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET market = (jsonb_populate_record(NULL::public.properties, $pid${"market":null}$pid$::jsonb)).market, updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND to_jsonb(market) IS NOT DISTINCT FROM $pid$"Indy"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1464 Buckland Ct. / market'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'market' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname, updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"The Buckland Blue (1464)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1464 Buckland Ct. / nickname'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"summary"}', updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$"2 Car Garage\nFree Parking on Premises"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1464 Buckland Ct. / parking.summary'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier, updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1464 Buckland Ct. / tier'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"wifi_split_confirmed"}', updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1464 Buckland Ct. / utilities.wifi_split_confirmed'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built, updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2021$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1464 Buckland Ct. / year_built'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';

-- 15226 High Timber Ln
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '4cf72297-dd39-4c26-b7ad-006a38923d1b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '15226 High Timber Ln / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '4cf72297-dd39-4c26-b7ad-006a38923d1b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 15701 E 75th Pl N
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'eeb11e56-921e-4f30-95ef-f044b21b85c2' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '15701 E 75th Pl N / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'eeb11e56-921e-4f30-95ef-f044b21b85c2' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = 'eeb11e56-921e-4f30-95ef-f044b21b85c2' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '15701 E 75th Pl N / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'eeb11e56-921e-4f30-95ef-f044b21b85c2' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_module"}', $pid$"Not Connected"$pid$::jsonb, true), updated_at = now() WHERE id = 'eeb11e56-921e-4f30-95ef-f044b21b85c2' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$"Connected & Setup"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '15701 E 75th Pl N / access.yale_module'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80ad-b194-d8d87cdbda74', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'eeb11e56-921e-4f30-95ef-f044b21b85c2' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';

-- 15905 Sky Run Dr.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '10ba8ab8-a497-4a28-b5b7-7d5b01b78782' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '15905 Sky Run Dr. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '10ba8ab8-a497-4a28-b5b7-7d5b01b78782' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1600 E Quantico St
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'cf867f48-f4df-4710-9e49-10bb17b41ed4' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1600 E Quantico St / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cf867f48-f4df-4710-9e49-10bb17b41ed4' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = 'cf867f48-f4df-4710-9e49-10bb17b41ed4' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1600 E Quantico St / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cf867f48-f4df-4710-9e49-10bb17b41ed4' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"Smart TV ROKU Pin: See Guest Access & Credentials"$pid$::jsonb, true), updated_at = now() WHERE id = 'cf867f48-f4df-4710-9e49-10bb17b41ed4' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"Smart TV ROKU Pin: [removed — credentials are not stored in Resolve]"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1600 E Quantico St / facts.tv_specs'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80f9-988d-d0d7a4f962ac', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'cf867f48-f4df-4710-9e49-10bb17b41ed4' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';

-- 16216 Whistle Creek (30D Firm)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '7e4f8893-7b8d-482c-9906-455fa8cd6367' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '16216 Whistle Creek (30D Firm) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '7e4f8893-7b8d-482c-9906-455fa8cd6367' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1636 NE 32nd St.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '8f21dd67-0732-413a-9fa3-67ec2e59e7bf' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1636 NE 32nd St. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8f21dd67-0732-413a-9fa3-67ec2e59e7bf' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1640 Glade Meadows Dr
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '62a2d14c-0081-425f-943c-1b2de5bddf70' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1640 Glade Meadows Dr / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '62a2d14c-0081-425f-943c-1b2de5bddf70' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 16401 Villa Valeria Way (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'a28336e4-ebd6-4af4-8786-f5d7c8eab058' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '16401 Villa Valeria Way (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a28336e4-ebd6-4af4-8786-f5d7c8eab058' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1700 NW 179th Ter (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '047e01ba-eb27-42a3-be1b-eab929f8b970' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1700 NW 179th Ter (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '047e01ba-eb27-42a3-be1b-eab929f8b970' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1700 Whispering Creek Dr
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '96e08138-1c9e-4297-8da8-a6ae1a2f52d7' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1700 Whispering Creek Dr / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '96e08138-1c9e-4297-8da8-a6ae1a2f52d7' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '96e08138-1c9e-4297-8da8-a6ae1a2f52d7' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1700 Whispering Creek Dr / operating_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '96e08138-1c9e-4297-8da8-a6ae1a2f52d7' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"ROKU Pin: See Guest Access & Credentials\nROKU Email: \ncdunham1119@gmail.com"$pid$::jsonb, true), updated_at = now() WHERE id = '96e08138-1c9e-4297-8da8-a6ae1a2f52d7' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"ROKU Pin: [removed — credentials are not stored in Resolve]\nROKU Email: \ncdunham1119@gmail.com"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1700 Whispering Creek Dr / facts.tv_specs'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80df-84c1-de33f73dc3ee', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '96e08138-1c9e-4297-8da8-a6ae1a2f52d7' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';

-- 1701 Park Lane Dr.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '549229b6-9f29-4c3d-a74b-3746500d56f4' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1701 Park Lane Dr. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '549229b6-9f29-4c3d-a74b-3746500d56f4' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1722 Westchester Dr
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'c2dfe50d-2428-4cfe-b6d7-ca54578a17d1' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1722 Westchester Dr / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'c2dfe50d-2428-4cfe-b6d7-ca54578a17d1' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'c2dfe50d-2428-4cfe-b6d7-ca54578a17d1' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1722 Westchester Dr / operating_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80a7-bae8-f6d0a003b669', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'c2dfe50d-2428-4cfe-b6d7-ca54578a17d1' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 17404 Zinc Dr.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '7f279df3-ca27-49ba-bac8-2393b1fc427c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '17404 Zinc Dr. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '7f279df3-ca27-49ba-bac8-2393b1fc427c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 18000 Barracho Dr (30D)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'c0e2b66a-4394-4aa4-b6c5-a9ed4ec6d317' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '18000 Barracho Dr (30D) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'c0e2b66a-4394-4aa4-b6c5-a9ed4ec6d317' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 18104 Calle Way (12M)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'e267cab0-6d67-4295-a12a-43a1be6f4f47' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '18104 Calle Way (12M) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e267cab0-6d67-4295-a12a-43a1be6f4f47' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 18200 Bodegon Rd. (12M)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '8554f577-3b7d-4819-8b6d-d5cfbaede637' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '18200 Bodegon Rd. (12M) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8554f577-3b7d-4819-8b6d-d5cfbaede637' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 18205 Allora Dr. (12M)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '5ff5ee5c-1d5b-4cad-a178-6ed53220614c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '18205 Allora Dr. (12M) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '5ff5ee5c-1d5b-4cad-a178-6ed53220614c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 19013 Meadows Crossing (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '307e57dc-3f45-4ad2-98d3-358769feccb9' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '19013 Meadows Crossing (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '307e57dc-3f45-4ad2-98d3-358769feccb9' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 19021 Meadows Crossing (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '7b04bb27-ed86-4e5d-a406-d1265ca67ca3' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '19021 Meadows Crossing (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '7b04bb27-ed86-4e5d-a406-d1265ca67ca3' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 1908 E Urbana St
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'ed21dc09-34d2-4c7b-9d1b-2d5eb561a4a7' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1908 E Urbana St / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ed21dc09-34d2-4c7b-9d1b-2d5eb561a4a7' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = 'ed21dc09-34d2-4c7b-9d1b-2d5eb561a4a7' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '1908 E Urbana St / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ed21dc09-34d2-4c7b-9d1b-2d5eb561a4a7' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 19104 Meadows Crossings
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '1d949a24-c216-4e3c-9290-c08997fe688d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '19104 Meadows Crossings / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1d949a24-c216-4e3c-9290-c08997fe688d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '1d949a24-c216-4e3c-9290-c08997fe688d' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '19104 Meadows Crossings / operating_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1d949a24-c216-4e3c-9290-c08997fe688d' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 19117 Meadows Crossing (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'ce75f670-ff56-4c14-8159-5072b6d31bc7' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '19117 Meadows Crossing (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ce75f670-ff56-4c14-8159-5072b6d31bc7' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'ce75f670-ff56-4c14-8159-5072b6d31bc7' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '19117 Meadows Crossing (30D FIRM) / operating_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ce75f670-ff56-4c14-8159-5072b6d31bc7' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 19120 Meadows Crossing
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '4b4fdb62-fc3e-4a83-ba0a-391fac682f1d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '19120 Meadows Crossing / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '4b4fdb62-fc3e-4a83-ba0a-391fac682f1d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '4b4fdb62-fc3e-4a83-ba0a-391fac682f1d' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '19120 Meadows Crossing / operating_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '4b4fdb62-fc3e-4a83-ba0a-391fac682f1d' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 2004 Cedar Ridge Rd.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'de4a6e71-6fd8-4c4a-8d58-b935c4173e1f' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2004 Cedar Ridge Rd. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'de4a6e71-6fd8-4c4a-8d58-b935c4173e1f' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'de4a6e71-6fd8-4c4a-8d58-b935c4173e1f' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2004 Cedar Ridge Rd. / operating_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-8091-8112-fad5a8380da7', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'de4a6e71-6fd8-4c4a-8d58-b935c4173e1f' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 2008 Ladera Ln
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'faf5d78e-7f51-479c-9296-1c314fad3c6a' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2008 Ladera Ln / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'faf5d78e-7f51-479c-9296-1c314fad3c6a' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2012 W Black Powder Way
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'c78fb035-de41-40a6-b4bd-1a4384e28e2e' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2012 W Black Powder Way / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'c78fb035-de41-40a6-b4bd-1a4384e28e2e' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2014 E 52nd St
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '8e4dec0f-78d4-4dcb-86e5-e0ea2dd5584f' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2014 E 52nd St / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8e4dec0f-78d4-4dcb-86e5-e0ea2dd5584f' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '8e4dec0f-78d4-4dcb-86e5-e0ea2dd5584f' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2014 E 52nd St / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8e4dec0f-78d4-4dcb-86e5-e0ea2dd5584f' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 2016 NW 172nd St
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'f3e7d069-bd48-4c6f-94f2-153159dc6b6c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2016 NW 172nd St / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'f3e7d069-bd48-4c6f-94f2-153159dc6b6c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2017 W. Flintlock Way
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '604f62a1-ee82-4b97-afae-0ad9c8afabbc' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2017 W. Flintlock Way / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '604f62a1-ee82-4b97-afae-0ad9c8afabbc' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 207 High Point Way
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'ed684fea-2b58-4264-8b43-ca5e1dd8f3cf' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '207 High Point Way / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ed684fea-2b58-4264-8b43-ca5e1dd8f3cf' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2100 Liberty Way Dr.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'e5c41afe-3bb6-418b-92ea-2cbf9b565c95' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2100 Liberty Way Dr. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e5c41afe-3bb6-418b-92ea-2cbf9b565c95' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 220 SW 167th St. (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '08ed7d90-7ac4-4089-9939-537222300c66' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '220 SW 167th St. (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '08ed7d90-7ac4-4089-9939-537222300c66' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2208 E. Toledo St.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '532ad15b-6f1d-428c-8eba-f1b49c887dc6' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2208 E. Toledo St. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '532ad15b-6f1d-428c-8eba-f1b49c887dc6' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2259 Summer Shore Dr
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '27e6f3a9-32e8-471f-932d-eb52891f4526' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2259 Summer Shore Dr / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '27e6f3a9-32e8-471f-932d-eb52891f4526' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2321 NW 158th (30D)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '03d37544-36aa-485f-ba40-900c58451836' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2321 NW 158th (30D) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '03d37544-36aa-485f-ba40-900c58451836' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2332 Los Angeles Ave
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'c11cb85a-380f-416e-98d1-15add30737e7' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2332 Los Angeles Ave / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'c11cb85a-380f-416e-98d1-15add30737e7' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 236 N. Starnes St. (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '3e33a82f-0ad2-4659-9d47-a59f72c01a7b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '236 N. Starnes St. (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '3e33a82f-0ad2-4659-9d47-a59f72c01a7b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"key_storage"}', $pid$["N/A"]$pid$::jsonb, true), updated_at = now() WHERE id = '3e33a82f-0ad2-4659-9d47-a59f72c01a7b' AND coalesce(access #> '{"key_storage"}', 'null'::jsonb) = $pid$["N/A","Front Door/Smartlock","Backdoor"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '236 N. Starnes St. (30D FIRM) / access.key_storage'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-8084-bdf2-d4679493ddbb', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '3e33a82f-0ad2-4659-9d47-a59f72c01a7b' AND field_key = 'access.key_storage' AND note = 'PID refresh 2026-11-12';

-- 2414 W. Kingsport Ct. S
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '6cb09c34-f77a-4795-bb16-1e3a3fe87f4c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2414 W. Kingsport Ct. S / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '6cb09c34-f77a-4795-bb16-1e3a3fe87f4c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 250 Springfield Xing
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_integration_live"}', updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '250 Springfield Xing / access.yale_integration_live'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '250 Springfield Xing / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET compliance = compliance #- '{"permit_status"}', updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND coalesce(compliance #> '{"permit_status"}', 'null'::jsonb) = $pid${"text":"No permit required for Greenfield, IN","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '250 Springfield Xing / compliance.permit_status'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'compliance.permit_status' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET compliance = compliance #- '{"rental_restrictions"}', updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND coalesce(compliance #> '{"rental_restrictions"}', 'null'::jsonb) = $pid${"text":"No STR rental restrictions","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '250 Springfield Xing / compliance.rental_restrictions'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'compliance.rental_restrictions' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = external_refs #- '{"breezeway_url"}', updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$"https://app.breezeway.io/property/1514895/profile"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '250 Springfield Xing / external_refs.breezeway_url'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '250 Springfield Xing / furniture_package'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET market = (jsonb_populate_record(NULL::public.properties, $pid${"market":null}$pid$::jsonb)).market, updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND to_jsonb(market) IS NOT DISTINCT FROM $pid$"Indy"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '250 Springfield Xing / market'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'market' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname, updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"Springfield Sanctuary (250)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '250 Springfield Xing / nickname'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"summary"}', updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$"3 Car Garage\nFree Parking on Premises"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '250 Springfield Xing / parking.summary'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier, updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '250 Springfield Xing / tier'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"wifi_split_confirmed"}', updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '250 Springfield Xing / utilities.wifi_split_confirmed'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built, updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2026$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '250 Springfield Xing / year_built'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';

-- 2522 S Irvington Ave
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'b5ca6769-c083-4091-b185-d887ff8c7323' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2522 S Irvington Ave / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'b5ca6769-c083-4091-b185-d887ff8c7323' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = 'b5ca6769-c083-4091-b185-d887ff8c7323' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2522 S Irvington Ave / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'b5ca6769-c083-4091-b185-d887ff8c7323' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 2525 Fallview Dr.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'e9706c22-70c6-4b78-8115-11895877b69b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2525 Fallview Dr. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e9706c22-70c6-4b78-8115-11895877b69b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2527 NE 15th St
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '632db464-d193-4671-96cd-1b899a8f2a1a' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2527 NE 15th St / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '632db464-d193-4671-96cd-1b899a8f2a1a' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_ssid"}', $pid$"Arealhomeaway"$pid$::jsonb, true), updated_at = now() WHERE id = '632db464-d193-4671-96cd-1b899a8f2a1a' AND coalesce(utilities #> '{"wifi_ssid"}', 'null'::jsonb) = $pid$"ARHA"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2527 NE 15th St / utilities.wifi_ssid'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1d74658d-5f4f-80b4-8012-e5d6e9e7ca53', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '632db464-d193-4671-96cd-1b899a8f2a1a' AND field_key = 'utilities.wifi_ssid' AND note = 'PID refresh 2026-11-12';

-- 2536 NW 116th (12M)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"emergency_key_access"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(access #> '{"emergency_key_access"}', 'null'::jsonb) = $pid$"Yes"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / access.emergency_key_access'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'access.emergency_key_access' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"garage_remote"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(access #> '{"garage_remote"}', 'null'::jsonb) = $pid$"Unknown"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / access.garage_remote'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'access.garage_remote' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_module"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$"Not Applicable (Not Yale)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / access.yale_module'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"grill"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(facts #> '{"grill"}', 'null'::jsonb) = $pid$"No Grill"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / facts.grill'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'facts.grill' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"interior_paint"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(facts #> '{"interior_paint"}', 'null'::jsonb) = $pid$"Unsure"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / facts.interior_paint'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'facts.interior_paint' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"present"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(fireplace #> '{"present"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / fireplace.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'fireplace.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = hvac #- '{"filter_sizes"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(hvac #> '{"filter_sizes"}', 'null'::jsonb) = $pid$["16x30x1","14x20x1"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / hvac.filter_sizes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'hvac.filter_sizes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":null}$pid$::jsonb)).neighborhood, updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND to_jsonb(neighborhood) IS NOT DISTINCT FROM $pid$"Unsure"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / neighborhood'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'neighborhood' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"status"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(sprinklers #> '{"status"}', 'null'::jsonb) = $pid$"Property Does Not Have Sprinkler System"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / sprinklers.status'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'sprinklers.status' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"breaker_panel_location"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"breaker_panel_location"}', 'null'::jsonb) = $pid$"Garage"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / systems.breaker_panel_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.breaker_panel_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"co","installed"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"co","installed"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / systems.co.installed'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.co.installed' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"co","location"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"co","location"}', 'null'::jsonb) = $pid$"Kitchen"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / systems.co.location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.co.location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"fridge_filter_5yr"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"fridge_filter_5yr"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / systems.fridge_filter_5yr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.fridge_filter_5yr' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","batteries_changed_on"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2026-09-22"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / systems.smoke.batteries_changed_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","battery_type"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"smoke","battery_type"}', 'null'::jsonb) = $pid$"9-Volt (Alkaline)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / systems.smoke.battery_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.smoke.battery_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","brand"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"smoke","brand"}', 'null'::jsonb) = $pid$"First Alert"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / systems.smoke.brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.smoke.brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_on"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"smoke","expires_on"}', 'null'::jsonb) = $pid$"2030-12-31"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / systems.smoke.expires_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.smoke.expires_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_precision"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"smoke","expires_precision"}', 'null'::jsonb) = $pid$"year"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / systems.smoke.expires_precision'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.smoke.expires_precision' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_source_text"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"smoke","expires_source_text"}', 'null'::jsonb) = $pid$"2030"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / systems.smoke.expires_source_text'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.smoke.expires_source_text' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","notes"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"smoke","notes"}', 'null'::jsonb) = $pid$"None"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / systems.smoke.notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.smoke.notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","power_type"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"smoke","power_type"}', 'null'::jsonb) = $pid$"Battery Powered"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / systems.smoke.power_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.smoke.power_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"supply_box_location"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"supply_box_location"}', 'null'::jsonb) = $pid$"Na"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / systems.supply_box_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.supply_box_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"supply_storage"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"supply_storage"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / systems.supply_storage'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.supply_storage' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"water_shutoff_outdoor"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"water_shutoff_outdoor"}', 'null'::jsonb) = $pid$"At curb"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / systems.water_shutoff_outdoor'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.water_shutoff_outdoor' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"workstation"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(facts #> '{"workstation"}', 'null'::jsonb) = $pid$"Not Mentioned"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / facts.workstation'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80cd-b8f1-e1ede5224c97', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'facts.workstation' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"Not Mentioned"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"16x30x1 and 14x20x1"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / hvac.filter_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80cd-b8f1-e1ede5224c97', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"summary"}', $pid$"On Property Garage (No more Information)"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$"On Property Garage (\nNo more Information\n)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / parking.summary'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80cd-b8f1-e1ede5224c97', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter"}', $pid$"Not Mentioned"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$"HAF-CIN"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2536 NW 116th (12M) / systems.fridge_filter'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80cd-b8f1-e1ede5224c97', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';
UPDATE public.properties SET systems = systems #- '{"co"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND systems #> '{"co"}' = '{}'::jsonb;
UPDATE public.properties SET systems = systems #- '{"smoke"}', updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND systems #> '{"smoke"}' = '{}'::jsonb;

-- 2601 W 65th St S
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_integration_live"}', updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2601 W 65th St S / access.yale_integration_live'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2601 W 65th St S / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = external_refs #- '{"breezeway_url"}', updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$"https://app.breezeway.io/property/1564238/profile"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2601 W 65th St S / external_refs.breezeway_url'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2601 W 65th St S / furniture_package'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET market = (jsonb_populate_record(NULL::public.properties, $pid${"market":null}$pid$::jsonb)).market, updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND to_jsonb(market) IS NOT DISTINCT FROM $pid$"Tulsa"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2601 W 65th St S / market'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'market' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname, updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"Hillside Hollow (2601)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2601 W 65th St S / nickname'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"summary"}', updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$"2 Car Garage\nFree Parking on Premises"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2601 W 65th St S / parking.summary'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier, updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2601 W 65th St S / tier'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"wifi_split_confirmed"}', updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2601 W 65th St S / utilities.wifi_split_confirmed'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built, updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2026$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2601 W 65th St S / year_built'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';

-- 2608 SE 38th St
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '4ba15ebf-075e-4233-96ab-235dacedd069' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2608 SE 38th St / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '4ba15ebf-075e-4233-96ab-235dacedd069' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2617 W Madison St.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '47a804ef-0d9e-4a81-8eb9-6c2b261e1313' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2617 W Madison St. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '47a804ef-0d9e-4a81-8eb9-6c2b261e1313' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '47a804ef-0d9e-4a81-8eb9-6c2b261e1313' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2617 W Madison St. / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '47a804ef-0d9e-4a81-8eb9-6c2b261e1313' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 2701 Berkshire Way
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'ffb07311-c1d2-47f2-8759-8d66b9c4efbf' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2701 Berkshire Way / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ffb07311-c1d2-47f2-8759-8d66b9c4efbf' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 2817 Hazel Hollow
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '956cc7c9-1193-409c-a2ab-9bd2fc312646' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2817 Hazel Hollow / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '956cc7c9-1193-409c-a2ab-9bd2fc312646' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"There are two returns inside the house. However, those are not getting used. There is a big 5 inch filter in the attic that the owner only wants changed.\nDo not install these filters in the house:\n  • 20x30x1 - 1 \n  • 14x14x1 - 1"$pid$::jsonb, true), updated_at = now() WHERE id = '956cc7c9-1193-409c-a2ab-9bd2fc312646' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"There are two returns inside the house. However, those are not getting used. There is a big 5 inch filter in the attic that the owner only wants changed.\nDo not install filters in the house."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2817 Hazel Hollow / hvac.filter_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '2e84658d-5f4f-81ac-8dab-c2270877a1ab', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '956cc7c9-1193-409c-a2ab-9bd2fc312646' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';

-- 2901 E. 75th St.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'e0178350-7c7b-43e4-b11d-0bd8c15cee9e' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2901 E. 75th St. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e0178350-7c7b-43e4-b11d-0bd8c15cee9e' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact.nown"}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'e0178350-7c7b-43e4-b11d-0bd8c15cee9e' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2901 E. 75th St. / operating_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80ed-8a8b-fb074766880d', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'e0178350-7c7b-43e4-b11d-0bd8c15cee9e' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 2913 NW 188th St (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'b9f146b2-8320-4808-ae37-425500031a70' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '2913 NW 188th St (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'b9f146b2-8320-4808-ae37-425500031a70' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 3000 Meriweather Rd (30D)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '0c03c4c8-d142-4d56-b73d-22806e0bd511' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3000 Meriweather Rd (30D) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '0c03c4c8-d142-4d56-b73d-22806e0bd511' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 3000 W Charlotte St
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '08fe042b-2dad-4487-b515-a38ab3ad07d8' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3000 W Charlotte St / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '08fe042b-2dad-4487-b515-a38ab3ad07d8' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '08fe042b-2dad-4487-b515-a38ab3ad07d8' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3000 W Charlotte St / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '08fe042b-2dad-4487-b515-a38ab3ad07d8' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 3012 Piper St
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '4e2f9e8b-dd08-4381-9cab-c3664a4bdad8' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3012 Piper St / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '4e2f9e8b-dd08-4381-9cab-c3664a4bdad8' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"1: 14x30x1"$pid$::jsonb, true), updated_at = now() WHERE id = '4e2f9e8b-dd08-4381-9cab-c3664a4bdad8' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"1: 14x30x1 & 91-005\n\nThere is a 16x25x4 filter inside the unit in the attic. this needs to be changed every 6 months. (it was changed on Sep 2026 by Silver Creek)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3012 Piper St / hvac.filter_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1c24658d-5f4f-804f-8acc-ddc2000707a8', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '4e2f9e8b-dd08-4381-9cab-c3664a4bdad8' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_sizes"}', $pid$["14x30x1"]$pid$::jsonb, true), updated_at = now() WHERE id = '4e2f9e8b-dd08-4381-9cab-c3664a4bdad8' AND coalesce(hvac #> '{"filter_sizes"}', 'null'::jsonb) = $pid$["14x30x1","16x25x4"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3012 Piper St / hvac.filter_sizes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1c24658d-5f4f-804f-8acc-ddc2000707a8', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '4e2f9e8b-dd08-4381-9cab-c3664a4bdad8' AND field_key = 'hvac.filter_sizes' AND note = 'PID refresh 2026-11-12';

-- 3029 NW 181st
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'd1bfd0f9-789c-40c2-b1cf-2ecd97239dc9' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3029 NW 181st / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'd1bfd0f9-789c-40c2-b1cf-2ecd97239dc9' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'd1bfd0f9-789c-40c2-b1cf-2ecd97239dc9' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3029 NW 181st / operating_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'd1bfd0f9-789c-40c2-b1cf-2ecd97239dc9' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 3040 NW 183rd St. (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '6b32409d-98f4-4491-9069-0c3823599755' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3040 NW 183rd St. (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '6b32409d-98f4-4491-9069-0c3823599755' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter"}', $pid$"GF-841"$pid$::jsonb, true), updated_at = now() WHERE id = '6b32409d-98f4-4491-9069-0c3823599755' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$"GF-841 ( HAF-QIN/EXP)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3040 NW 183rd St. (30D FIRM) / systems.fridge_filter'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80ae-8217-e3a02b42882c', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '6b32409d-98f4-4491-9069-0c3823599755' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';

-- 305 W 7th St.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '5e1e71c9-939b-4d06-89a9-f92087160994' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '305 W 7th St. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '5e1e71c9-939b-4d06-89a9-f92087160994' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"Living Room - 305 W 7th ST - 65"$pid$::jsonb, true), updated_at = now() WHERE id = '5e1e71c9-939b-4d06-89a9-f92087160994' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"Living Room - 305 W 7th ST - 65\nPrimary bedroom- 65"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '305 W 7th St. / facts.tv_specs'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3264658d-5f4f-813a-90b9-c65a8f95eabd', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '5e1e71c9-939b-4d06-89a9-f92087160994' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"14x14x1 - 2 locations \n20x25x1"$pid$::jsonb, true), updated_at = now() WHERE id = '5e1e71c9-939b-4d06-89a9-f92087160994' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"14x14x1 - 2 locations  dining and primary bedroom \n20x25x1 hallway"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '305 W 7th St. / hvac.filter_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3264658d-5f4f-813a-90b9-c65a8f95eabd', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '5e1e71c9-939b-4d06-89a9-f92087160994' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter"}', $pid$"Frigidaire"$pid$::jsonb, true), updated_at = now() WHERE id = '5e1e71c9-939b-4d06-89a9-f92087160994' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$"Frigidaire FPPWFU01"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '305 W 7th St. / systems.fridge_filter'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3264658d-5f4f-813a-90b9-c65a8f95eabd', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '5e1e71c9-939b-4d06-89a9-f92087160994' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';

-- 309 Prince John Dr
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '6cf841a3-8b95-4919-80d1-d9701ba5ffc7' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '309 Prince John Dr / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '6cf841a3-8b95-4919-80d1-d9701ba5ffc7' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2025-12-03"$pid$::jsonb, true), updated_at = now() WHERE id = '6cf841a3-8b95-4919-80d1-d9701ba5ffc7' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2026-10-15"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '309 Prince John Dr / systems.smoke.batteries_changed_on'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80bd-ae79-f1967c95d15a', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '6cf841a3-8b95-4919-80d1-d9701ba5ffc7' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';

-- 3117 Scissortail Way (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'f8fd08cd-4043-4bb6-83f4-30a726437f08' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3117 Scissortail Way (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'f8fd08cd-4043-4bb6-83f4-30a726437f08' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET compliance = compliance #- '{"rental_restrictions"}', updated_at = now() WHERE id = 'f8fd08cd-4043-4bb6-83f4-30a726437f08' AND coalesce(compliance #> '{"rental_restrictions"}', 'null'::jsonb) = $pid${"text":"No STR rental restrictions","as_of":"2026-11-11T18:51:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3117 Scissortail Way (30D FIRM) / compliance.rental_restrictions'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'f8fd08cd-4043-4bb6-83f4-30a726437f08' AND field_key = 'compliance.rental_restrictions' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET storm_shelter = jsonb_set(CASE WHEN jsonb_typeof(storm_shelter) = 'object' THEN storm_shelter ELSE '{}'::jsonb END, '{"location_access"}', $pid$"Garage -use provided pin to depress button to slide door open depress button to slide door open"$pid$::jsonb, true), updated_at = now() WHERE id = 'f8fd08cd-4043-4bb6-83f4-30a726437f08' AND coalesce(storm_shelter #> '{"location_access"}', 'null'::jsonb) = $pid$"Garage - use provided pin: [removed — credentials are not stored in Resolve] depress button to slide door open"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3117 Scissortail Way (30D FIRM) / storm_shelter.location_access'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-806a-847d-d3f6046ef2a0', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'f8fd08cd-4043-4bb6-83f4-30a726437f08' AND field_key = 'storm_shelter.location_access' AND note = 'PID refresh 2026-11-12';

-- 31445 Moore Rd.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'de9bbef4-e04a-4b8b-b7da-bf1a54862831' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '31445 Moore Rd. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'de9bbef4-e04a-4b8b-b7da-bf1a54862831' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 3200 Birmingham Dr
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '3f2b0d24-9317-49ed-aa05-1cd16ce82673' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3200 Birmingham Dr / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '3f2b0d24-9317-49ed-aa05-1cd16ce82673' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 3201 Belmont Circle
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'bd9b524c-a688-4455-9458-ecb744ec47e9' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3201 Belmont Circle / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bd9b524c-a688-4455-9458-ecb744ec47e9' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 33 Center Lane S
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '33 Center Lane S / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"lock_brand"}', $pid$"Yale at side door, Schlage at front door"$pid$::jsonb, true), updated_at = now() WHERE id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND coalesce(access #> '{"lock_brand"}', 'null'::jsonb) = $pid$"Schlage at side door."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '33 Center Lane S / access.lock_brand'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80a6-8a27-f6d45b671a7f', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND field_key = 'access.lock_brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_module"}', $pid$"Not Connected"$pid$::jsonb, true), updated_at = now() WHERE id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$"Not Applicable (Not Yale)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '33 Center Lane S / access.yale_module'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80a6-8a27-f6d45b671a7f', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"Carlton Landing requires all vehicles to be registered through the link found  - here .The passcode: See Guest Access & Credentials will use in the form is 250570. Unregistered cars can be ticketed or towed, so please take care of this ahead of time.\n\nThe above information is included in the Breezeway Parking Guidelines."$pid$::jsonb, true), updated_at = now() WHERE id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"Carlton Landing requires all vehicles to be registered through the link found  - \nhere \n. The passcode: [removed — credentials are not stored in Resolve] will use in the form is \n250570\n. Unregistered cars can be ticketed or towed, so please take care of this ahead of time.\n\nThe above information is included in the Breezeway Parking Guidelines."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '33 Center Lane S / amenities.access_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80a6-8a27-f6d45b671a7f', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"NO PETS ALLOWED\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '33 Center Lane S / operating_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80a6-8a27-f6d45b671a7f', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 3316 NW 176th
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '301a0990-5c55-4d71-acd1-0d64f6e6b162' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3316 NW 176th / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '301a0990-5c55-4d71-acd1-0d64f6e6b162' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '301a0990-5c55-4d71-acd1-0d64f6e6b162' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3316 NW 176th / operating_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '301a0990-5c55-4d71-acd1-0d64f6e6b162' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 3333 Welling Rd
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '56cf44ac-918b-4bc6-bdc2-83a5d9e83bf6' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3333 Welling Rd / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '56cf44ac-918b-4bc6-bdc2-83a5d9e83bf6' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 3361 E 153rd St S
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_integration_live"}', updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3361 E 153rd St S / access.yale_integration_live'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3361 E 153rd St S / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = external_refs #- '{"breezeway_url"}', updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$"https://app.breezeway.io/property/1565707/profile"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3361 E 153rd St S / external_refs.breezeway_url'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3361 E 153rd St S / furniture_package'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET market = (jsonb_populate_record(NULL::public.properties, $pid${"market":null}$pid$::jsonb)).market, updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND to_jsonb(market) IS NOT DISTINCT FROM $pid$"Tulsa"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3361 E 153rd St S / market'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'market' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname, updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"The Bixby Bloom (3361)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3361 E 153rd St S / nickname'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"summary"}', updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$"2 Car Garage\nFree Parking on Premises"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3361 E 153rd St S / parking.summary'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier, updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3361 E 153rd St S / tier'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"wifi_split_confirmed"}', updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3361 E 153rd St S / utilities.wifi_split_confirmed'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built, updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2026$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3361 E 153rd St S / year_built'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';

-- 3400 N Fern Avenue
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_integration_live"}', updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3400 N Fern Avenue / access.yale_integration_live'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3400 N Fern Avenue / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET compliance = compliance #- '{"rental_restrictions"}', updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND coalesce(compliance #> '{"rental_restrictions"}', 'null'::jsonb) = $pid${"text":"No STR rental restrictions","as_of":"2026-11-06T21:06:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3400 N Fern Avenue / compliance.rental_restrictions'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'compliance.rental_restrictions' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = external_refs #- '{"breezeway_url"}', updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$"https://app.breezeway.io/property/1542591/profile"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3400 N Fern Avenue / external_refs.breezeway_url'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3400 N Fern Avenue / furniture_package'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET market = (jsonb_populate_record(NULL::public.properties, $pid${"market":null}$pid$::jsonb)).market, updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND to_jsonb(market) IS NOT DISTINCT FROM $pid$"Tulsa"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3400 N Fern Avenue / market'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'market' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname, updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"Fernstone House (3400)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3400 N Fern Avenue / nickname'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"summary"}', updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$"2 Car Garage\nFree Parking on Premises"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3400 N Fern Avenue / parking.summary'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier, updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3400 N Fern Avenue / tier'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"wifi_split_confirmed"}', updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3400 N Fern Avenue / utilities.wifi_split_confirmed'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built, updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2026$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3400 N Fern Avenue / year_built'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';

-- 3405 NW 159th Ter
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'ae9220a0-758b-4f06-9895-ad84fbf6b700' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3405 NW 159th Ter / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ae9220a0-758b-4f06-9895-ad84fbf6b700' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 341 Thistlewood Dr
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'ddd71d00-acda-4feb-91cd-e0d86f38ddb4' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '341 Thistlewood Dr / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ddd71d00-acda-4feb-91cd-e0d86f38ddb4' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = 'ddd71d00-acda-4feb-91cd-e0d86f38ddb4' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '341 Thistlewood Dr / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ddd71d00-acda-4feb-91cd-e0d86f38ddb4' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 3613 Upland Ridge Dr.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'fe424d6a-c98d-4cea-a626-33b088667d9d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3613 Upland Ridge Dr. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'fe424d6a-c98d-4cea-a626-33b088667d9d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 3712 N 39th St.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '6cafc523-773b-4933-8d3d-9fbfa978e304' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3712 N 39th St. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '6cafc523-773b-4933-8d3d-9fbfa978e304' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '6cafc523-773b-4933-8d3d-9fbfa978e304' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3712 N 39th St. / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '6cafc523-773b-4933-8d3d-9fbfa978e304' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 3715 W 109th St S
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'f3d27f76-bc0a-48c5-acd6-a7a82001671a' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3715 W 109th St S / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'f3d27f76-bc0a-48c5-acd6-a7a82001671a' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"Netflix guest profile code: See Guest Access & Credentials\nHiSense Smart TV's (living room & downstairs game room, no Roku details). \nLogin information: held by the owner — not stored in Resolve the netflix account *Please do not share with guests* email: marc@compasspoints.net Password: held by the owner — not stored in Resolve"$pid$::jsonb, true), updated_at = now() WHERE id = 'f3d27f76-bc0a-48c5-acd6-a7a82001671a' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"Netflix guest profile code: [removed — credentials are not stored in Resolve]\nHiSense Smart TV's (living room & downstairs game room, no Roku details). \nLogin information: [removed — credentials are not stored in Resolve] the netflix account *Please do not share with guests* email: marc@compasspoints.net Password: [removed — credentials are not stored in Resolve]"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3715 W 109th St S / facts.tv_specs'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '22d4658d-5f4f-81f4-ba7a-c217f0e98163', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'f3d27f76-bc0a-48c5-acd6-a7a82001671a' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';

-- 3915 W 104th St. S.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"emergency_key_access"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(access #> '{"emergency_key_access"}', 'null'::jsonb) = $pid$"Yes"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / access.emergency_key_access'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'access.emergency_key_access' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"garage_remote"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(access #> '{"garage_remote"}', 'null'::jsonb) = $pid$"Chamberlain - https://www.amazon.com/dp/B08CNKBTYJ?ref=fed_asin_title&th=1"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / access.garage_remote'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'access.garage_remote' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"key_storage"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(access #> '{"key_storage"}', 'null'::jsonb) = $pid$["Front Door/Smartlock","Backdoor","Garage Door"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / access.key_storage'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'access.key_storage' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"lock_brand"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(access #> '{"lock_brand"}', 'null'::jsonb) = $pid$"Yale"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / access.lock_brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'access.lock_brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_module"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$"Connected & Setup"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / access.yale_module'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = amenities #- '{"access_notes"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / amenities.access_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = amenities #- '{"list"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(amenities #> '{"list"}', 'null'::jsonb) = $pid$["Pool","Pond","Walking Trail"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / amenities.list'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'amenities.list' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"grill"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(facts #> '{"grill"}', 'null'::jsonb) = $pid$"No Grill"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / facts.grill'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'facts.grill' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"interior_paint"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(facts #> '{"interior_paint"}', 'null'::jsonb) = $pid$"1. Location & quantity -laundry room 11 cans of exterior paint  2- 5 gallons of interior wall\nPaint. Sherwin Williams \n2. Brand - sherwin williams \n3. Color name & code -NA \n4. Sheen - satin \n5. Style/location of paint - exterior"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / facts.interior_paint'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'facts.interior_paint' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"tv_locations"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(facts #> '{"tv_locations"}', 'null'::jsonb) = $pid$["Living Room","Primary Bedroom"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / facts.tv_locations'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'facts.tv_locations' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"tv_specs"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"Living room - 3915 W 104th St - 65, Primary bedroom - 3915 W 104th St - 55"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / facts.tv_specs'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"workstation"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(facts #> '{"workstation"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / facts.workstation'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'facts.workstation' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"fuel_type"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(fireplace #> '{"fuel_type"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / fireplace.fuel_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'fireplace.fuel_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"gas_switch"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(fireplace #> '{"gas_switch"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / fireplace.gas_switch'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'fireplace.gas_switch' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"gas_switch_location"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(fireplace #> '{"gas_switch_location"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / fireplace.gas_switch_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'fireplace.gas_switch_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"instructions"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(fireplace #> '{"instructions"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / fireplace.instructions'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'fireplace.instructions' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"model"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(fireplace #> '{"model"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / fireplace.model'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'fireplace.model' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"present"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(fireplace #> '{"present"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / fireplace.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'fireplace.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET grounds = grounds #- '{"mowing_cadence"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(grounds #> '{"mowing_cadence"}', 'null'::jsonb) = $pid$"ARHA Responsible"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / grounds.mowing_cadence'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'grounds.mowing_cadence' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET grounds = grounds #- '{"mowing_days"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(grounds #> '{"mowing_days"}', 'null'::jsonb) = $pid$["Tuesday"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / grounds.mowing_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'grounds.mowing_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hoa = hoa #- '{"notes + external_links"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(hoa #> '{"notes + external_links"}', 'null'::jsonb) = $pid$"HOA Contact: Green Country HOA Email: greencountryhoa@gmail.com\n\nHOA approval for exterior changes, keep RVs/boats/trailers in the garage, wood privacy fences only (6 ft, not past front line), no clotheslines, and keep the yard maintained."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / hoa.notes + external_links'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'hoa.notes + external_links' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hoa = hoa #- '{"present"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(hoa #> '{"present"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / hoa.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'hoa.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = hvac #- '{"filter_notes"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"14-30-1"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / hvac.filter_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":null}$pid$::jsonb)).listing_alias, updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND to_jsonb(listing_alias) IS NOT DISTINCT FROM $pid$"Maple Manor | Jenks Family Retreat"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / listing_alias'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'listing_alias' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":null}$pid$::jsonb)).neighborhood, updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND to_jsonb(neighborhood) IS NOT DISTINCT FROM $pid$"Southern Reserve"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / neighborhood'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'neighborhood' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"**Owner does not want to see any diagnostic fees when possible. Owner’s referred handyman vendor - Eleven Eleven lab\n\nHOA needs to be contact on the summer for access to the community pool. No information was given upon request in onboarding.\n\nA cost segregation study will need to be scheduled. The company is planning to call Kati Hand for this. An owner requirement for the active owner program for tax purposes."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / operating_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"cluster_mailbox"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(parking #> '{"cluster_mailbox"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / parking.cluster_mailbox'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'parking.cluster_mailbox' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"mailbox_location"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(parking #> '{"mailbox_location"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / parking.mailbox_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'parking.mailbox_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"mailbox_number"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(parking #> '{"mailbox_number"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / parking.mailbox_number'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'parking.mailbox_number' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = pool_spa #- '{"present"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(pool_spa #> '{"present"}', 'null'::jsonb) = $pid$"None"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / pool_spa.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'pool_spa.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"alarm"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(security #> '{"alarm"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / security.alarm'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'security.alarm' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"battery_type"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(security #> '{"battery_type"}', 'null'::jsonb) = $pid$["Hardwired - No Battery"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / security.battery_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'security.battery_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"devices"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(security #> '{"devices"}', 'null'::jsonb) = $pid$["Front Door","Garage"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / security.devices'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'security.devices' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"monitoring_expires_on"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(security #> '{"monitoring_expires_on"}', 'null'::jsonb) = $pid$"2027-11-08"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / security.monitoring_expires_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'security.monitoring_expires_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"monitoring_plan"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(security #> '{"monitoring_plan"}', 'null'::jsonb) = $pid$["Active"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / security.monitoring_plan'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'security.monitoring_plan' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"brand"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(sprinklers #> '{"brand"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / sprinklers.brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'sprinklers.brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"controller_location"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(sprinklers #> '{"controller_location"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / sprinklers.controller_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'sprinklers.controller_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"set_for_season"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(sprinklers #> '{"set_for_season"}', 'null'::jsonb) = $pid${"value":"N/A","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / sprinklers.set_for_season'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'sprinklers.set_for_season' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"status"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(sprinklers #> '{"status"}', 'null'::jsonb) = $pid$"Property Does Not Have Sprinkler System"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / sprinklers.status'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'sprinklers.status' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET storm_shelter = storm_shelter #- '{"location_access"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(storm_shelter #> '{"location_access"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / storm_shelter.location_access'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'storm_shelter.location_access' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"breaker_panel_location"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"breaker_panel_location"}', 'null'::jsonb) = $pid$"Garage"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / systems.breaker_panel_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.breaker_panel_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"co","installed"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"co","installed"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / systems.co.installed'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.co.installed' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"co","location"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"co","location"}', 'null'::jsonb) = $pid$"Dining room"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / systems.co.location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.co.location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"fridge_filter"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$"Samsung HAF-QIN/EXP DA97-17376B"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / systems.fridge_filter'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"fridge_filter_5yr"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"fridge_filter_5yr"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / systems.fridge_filter_5yr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.fridge_filter_5yr' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","batteries_changed_on"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2026-10-04"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / systems.smoke.batteries_changed_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","battery_type"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"smoke","battery_type"}', 'null'::jsonb) = $pid$"9-Volt (Alkaline)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / systems.smoke.battery_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.smoke.battery_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","brand"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"smoke","brand"}', 'null'::jsonb) = $pid$"siterlink"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / systems.smoke.brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.smoke.brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","notes"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"smoke","notes"}', 'null'::jsonb) = $pid$"7 brand new smoke detectors were ordered on October 16, 2026 and those were installed,  However, after reviewing the photos the handyman sent upon completing the work, we noticed that the manufacturing date is 2020. According to the handyman, they should have approximately four years of useful life remaining."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / systems.smoke.notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.smoke.notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","power_type"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"smoke","power_type"}', 'null'::jsonb) = $pid$"Hardwired"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / systems.smoke.power_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.smoke.power_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"supply_box_location"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"supply_box_location"}', 'null'::jsonb) = $pid$"Located in the top shelf of primary bedroom closet"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / systems.supply_box_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.supply_box_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"supply_storage"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"supply_storage"}', 'null'::jsonb) = $pid$"Closet"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / systems.supply_storage'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.supply_storage' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"water_shutoff_indoor"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"water_shutoff_indoor"}', 'null'::jsonb) = $pid$"N/Ain water heater closet"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / systems.water_shutoff_indoor'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.water_shutoff_indoor' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"water_shutoff_outdoor"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"water_shutoff_outdoor"}', 'null'::jsonb) = $pid$"Water heater closet in garage"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / systems.water_shutoff_outdoor'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'systems.water_shutoff_outdoor' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"router_location"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(utilities #> '{"router_location"}', 'null'::jsonb) = $pid$"Living room"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / utilities.router_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'utilities.router_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"wifi_ssid"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(utilities #> '{"wifi_ssid"}', 'null'::jsonb) = $pid$"ARHA"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / utilities.wifi_ssid'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'utilities.wifi_ssid' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET warranty = warranty #- '{"builder_present"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(warranty #> '{"builder_present"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / warranty.builder_present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'warranty.builder_present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET warranty = warranty #- '{"claim_process + external_links"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(warranty #> '{"claim_process + external_links"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / warranty.claim_process + external_links'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'warranty.claim_process + external_links' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET warranty = warranty #- '{"furniture_expires_on"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(warranty #> '{"furniture_expires_on"}', 'null'::jsonb) = $pid$"2029-10-28"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / warranty.furniture_expires_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'warranty.furniture_expires_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"cart_count"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(waste #> '{"cart_count"}', 'null'::jsonb) = $pid$2$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / waste.cart_count'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'waste.cart_count' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"cart_notes"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(waste #> '{"cart_notes"}', 'null'::jsonb) = $pid$"2"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / waste.cart_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'waste.cart_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"holiday_notes"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(waste #> '{"holiday_notes"}', 'null'::jsonb) = $pid$"Thursday"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / waste.holiday_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'waste.holiday_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"recycling"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(waste #> '{"recycling"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / waste.recycling'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'waste.recycling' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"recycling_days"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(waste #> '{"recycling_days"}', 'null'::jsonb) = $pid$"Wednesday"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / waste.recycling_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'waste.recycling_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"strict_rules"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(waste #> '{"strict_rules"}', 'null'::jsonb) = $pid$"Trash cans out of street view, out ≤12 hrs before pickup and in ≤12 hrs after"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / waste.strict_rules'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'waste.strict_rules' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"trash_days"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(waste #> '{"trash_days"}', 'null'::jsonb) = $pid$["Wednesday"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / waste.trash_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'waste.trash_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '3915 W 104th St. S. / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9de75678-9e34-4219-a186-ed0da15f0092' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';
UPDATE public.properties SET systems = systems #- '{"co"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND systems #> '{"co"}' = '{}'::jsonb;
UPDATE public.properties SET systems = systems #- '{"smoke"}', updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND systems #> '{"smoke"}' = '{}'::jsonb;

-- 4003 Bendale Rd
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '4e542210-74fc-4a9e-b63f-ce2df5030f96' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4003 Bendale Rd / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '4e542210-74fc-4a9e-b63f-ce2df5030f96' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 401 E. 10th St.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"emergency_key_access"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(access #> '{"emergency_key_access"}', 'null'::jsonb) = $pid$"Yes"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / access.emergency_key_access'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'access.emergency_key_access' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"garage_remote"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(access #> '{"garage_remote"}', 'null'::jsonb) = $pid$"Genie & Chamberlain"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / access.garage_remote'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'access.garage_remote' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"key_storage"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(access #> '{"key_storage"}', 'null'::jsonb) = $pid$["Backdoor","Front Door/Smartlock","Garage Door"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / access.key_storage'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'access.key_storage' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_module"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$"Connected & Setup"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / access.yale_module'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = amenities #- '{"access_notes"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / amenities.access_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = amenities #- '{"list"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(amenities #> '{"list"}', 'null'::jsonb) = $pid$["None"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / amenities.list'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'amenities.list' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"grill"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(facts #> '{"grill"}', 'null'::jsonb) = $pid$"No Grill"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / facts.grill'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'facts.grill' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"interior_paint"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(facts #> '{"interior_paint"}', 'null'::jsonb) = $pid$"There are some gallons of paint at the house, but no specific colors listed."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / facts.interior_paint'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'facts.interior_paint' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"tv_locations"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(facts #> '{"tv_locations"}', 'null'::jsonb) = $pid$["Living Room","Bonus Room","Primary Bedroom"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / facts.tv_locations'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'facts.tv_locations' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"tv_specs"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"Bonus Room - 401 E 10th St - 50″ Insignia, 4K UHD — model NS-50F301NA24\nLiving Room - 401 E 10th St - 55″ Insignia, 4K UHD — model NS-55F301NA22\nPrimary bedroom - 401 E 10th St -  43″ TCL, 1080p Full HD — model 43S310R"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / facts.tv_specs'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"workstation"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(facts #> '{"workstation"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / facts.workstation'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'facts.workstation' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"fuel_type"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(fireplace #> '{"fuel_type"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / fireplace.fuel_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'fireplace.fuel_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"model"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(fireplace #> '{"model"}', 'null'::jsonb) = $pid$"Unknown. Not currently accessible for guests until we confirm operating instructions."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / fireplace.model'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'fireplace.model' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"present"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(fireplace #> '{"present"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / fireplace.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'fireplace.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET grounds = grounds #- '{"mowing_cadence"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(grounds #> '{"mowing_cadence"}', 'null'::jsonb) = $pid$"Owner Responsible"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / grounds.mowing_cadence'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'grounds.mowing_cadence' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET grounds = grounds #- '{"mowing_days"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(grounds #> '{"mowing_days"}', 'null'::jsonb) = $pid$["Wednesday"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / grounds.mowing_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'grounds.mowing_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hoa = hoa #- '{"notes + external_links"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(hoa #> '{"notes + external_links"}', 'null'::jsonb) = $pid$"No HOA"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / hoa.notes + external_links'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'hoa.notes + external_links' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hoa = hoa #- '{"present"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(hoa #> '{"present"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / hoa.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'hoa.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = hvac #- '{"filter_notes"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"14x24x1 x2"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / hvac.filter_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = hvac #- '{"filter_sizes"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(hvac #> '{"filter_sizes"}', 'null'::jsonb) = $pid$["14x24x1"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / hvac.filter_sizes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'hvac.filter_sizes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET legacy_handoff_date = (jsonb_populate_record(NULL::public.properties, $pid${"legacy_handoff_date":null}$pid$::jsonb)).legacy_handoff_date, updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND to_jsonb(legacy_handoff_date) IS NOT DISTINCT FROM $pid$"2026-10-29"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / legacy_handoff_date'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'legacy_handoff_date' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":null}$pid$::jsonb)).listing_alias, updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND to_jsonb(listing_alias) IS NOT DISTINCT FROM $pid$"Spacious Edmond Home | Pool & Game Room"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / listing_alias'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'listing_alias' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":null}$pid$::jsonb)).neighborhood, updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND to_jsonb(neighborhood) IS NOT DISTINCT FROM $pid$"This home is not located within a specific neighborhood. The home is located closest to the cross streets of E 9th St & S Rankin St in Edmond"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / neighborhood'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'neighborhood' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"cluster_mailbox"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(parking #> '{"cluster_mailbox"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / parking.cluster_mailbox'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'parking.cluster_mailbox' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"mailbox_location"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(parking #> '{"mailbox_location"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / parking.mailbox_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'parking.mailbox_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"mailbox_number"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(parking #> '{"mailbox_number"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / parking.mailbox_number'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'parking.mailbox_number' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = pool_spa #- '{"control_panel_location"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(pool_spa #> '{"control_panel_location"}', 'null'::jsonb) = $pid$"N/A - No hot tub"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / pool_spa.control_panel_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'pool_spa.control_panel_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = pool_spa #- '{"heated"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(pool_spa #> '{"heated"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / pool_spa.heated'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'pool_spa.heated' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = pool_spa #- '{"heater"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(pool_spa #> '{"heater"}', 'null'::jsonb) = $pid$"N/A - No pool heater"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / pool_spa.heater'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'pool_spa.heater' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = pool_spa #- '{"season"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(pool_spa #> '{"season"}', 'null'::jsonb) = $pid$"Pool will be opened around may and closed in October"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / pool_spa.season'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'pool_spa.season' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = pool_spa #- '{"service_schedule"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(pool_spa #> '{"service_schedule"}', 'null'::jsonb) = $pid$"Pool serviced every Friday no swimming for 2 hours"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / pool_spa.service_schedule'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'pool_spa.service_schedule' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"alarm"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(security #> '{"alarm"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / security.alarm'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'security.alarm' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"battery_type"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(security #> '{"battery_type"}', 'null'::jsonb) = $pid$["None"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / security.battery_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'security.battery_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"devices"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(security #> '{"devices"}', 'null'::jsonb) = $pid$["None","Backyard"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / security.devices'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'security.devices' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"monitoring_plan"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(security #> '{"monitoring_plan"}', 'null'::jsonb) = $pid$["None"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / security.monitoring_plan'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'security.monitoring_plan' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"brand"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(sprinklers #> '{"brand"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / sprinklers.brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'sprinklers.brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"controller_location"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(sprinklers #> '{"controller_location"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / sprinklers.controller_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'sprinklers.controller_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"set_for_season"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(sprinklers #> '{"set_for_season"}', 'null'::jsonb) = $pid${"value":"N/A","as_of":"2026-11-11T03:25:00.000Z","source":"notion_pid"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / sprinklers.set_for_season'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'sprinklers.set_for_season' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"status"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(sprinklers #> '{"status"}', 'null'::jsonb) = $pid$"Property Does Not Have Sprinkler System"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / sprinklers.status'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'sprinklers.status' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET storm_shelter = storm_shelter #- '{"location_access"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(storm_shelter #> '{"location_access"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / storm_shelter.location_access'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'storm_shelter.location_access' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"breaker_panel_location"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"breaker_panel_location"}', 'null'::jsonb) = $pid$"Laundry room"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / systems.breaker_panel_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.breaker_panel_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"co","installed"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"co","installed"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / systems.co.installed'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.co.installed' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"co","location"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"co","location"}', 'null'::jsonb) = $pid$"Kitchen"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / systems.co.location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.co.location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"fridge_filter"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$"HAF/CIN"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / systems.fridge_filter'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"fridge_filter_5yr"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"fridge_filter_5yr"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / systems.fridge_filter_5yr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.fridge_filter_5yr' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","batteries_changed_on"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2022-01-01"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / systems.smoke.batteries_changed_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","battery_type"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"smoke","battery_type"}', 'null'::jsonb) = $pid$"10-Year Sealed Lithium"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / systems.smoke.battery_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.smoke.battery_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","brand"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"smoke","brand"}', 'null'::jsonb) = $pid$"First Alert"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / systems.smoke.brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.smoke.brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_on"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"smoke","expires_on"}', 'null'::jsonb) = $pid$"2032-12-31"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / systems.smoke.expires_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.smoke.expires_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_precision"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"smoke","expires_precision"}', 'null'::jsonb) = $pid$"year"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / systems.smoke.expires_precision'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.smoke.expires_precision' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_source_text"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"smoke","expires_source_text"}', 'null'::jsonb) = $pid$"2032"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / systems.smoke.expires_source_text'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.smoke.expires_source_text' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","notes"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"smoke","notes"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / systems.smoke.notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.smoke.notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","power_type"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"smoke","power_type"}', 'null'::jsonb) = $pid$"Battery Powered"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / systems.smoke.power_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.smoke.power_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"supply_box_location"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"supply_box_location"}', 'null'::jsonb) = $pid$"None"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / systems.supply_box_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.supply_box_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"supply_storage"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"supply_storage"}', 'null'::jsonb) = $pid$"Closet"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / systems.supply_storage'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.supply_storage' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"water_shutoff_indoor"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"water_shutoff_indoor"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / systems.water_shutoff_indoor'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.water_shutoff_indoor' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"water_shutoff_outdoor"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"water_shutoff_outdoor"}', 'null'::jsonb) = $pid$"In the middle of the driveway"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / systems.water_shutoff_outdoor'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'systems.water_shutoff_outdoor' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier, updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / tier'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"router_location"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(utilities #> '{"router_location"}', 'null'::jsonb) = $pid$"Living room"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / utilities.router_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'utilities.router_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET warranty = warranty #- '{"builder_present"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(warranty #> '{"builder_present"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / warranty.builder_present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'warranty.builder_present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"cart_count"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(waste #> '{"cart_count"}', 'null'::jsonb) = $pid$2$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / waste.cart_count'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'waste.cart_count' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"cart_notes"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(waste #> '{"cart_notes"}', 'null'::jsonb) = $pid$"2"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / waste.cart_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'waste.cart_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"holiday_notes"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(waste #> '{"holiday_notes"}', 'null'::jsonb) = $pid$"If pickup falls on a holiday, it’ll be done the next day (Wednesday)."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / waste.holiday_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'waste.holiday_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"recycling"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(waste #> '{"recycling"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / waste.recycling'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'waste.recycling' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"recycling_days"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(waste #> '{"recycling_days"}', 'null'::jsonb) = $pid$"Every other Tuesday"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / waste.recycling_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'waste.recycling_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"trash_days"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(waste #> '{"trash_days"}', 'null'::jsonb) = $pid$["Tuesday"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / waste.trash_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'waste.trash_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"Yes"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built, updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$1968$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / year_built'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"lock_brand"}', $pid$"Schlage"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(access #> '{"lock_brand"}', 'null'::jsonb) = $pid$"Yale"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / access.lock_brand'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3574658d-5f4f-81d2-bed2-e345f40bca1a', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'access.lock_brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"FIRST vendor for all maintenance and repairs: Untitled . Contact them first on all work orders before scheduling any other vendor. Only use an alternate only if Ruben is unavailable or unresponsive.\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact.\n\nNot needed at hand off (Mingees to handle later):\n  • Confirm instructions for operating the fireplace in the basement \n• Full siding repair (multiple places)\n• Haul away fence panels in backyard\n• Backyard landscaping and cleanup\n• Remove stumps and trim all trees/bushes\n• Purchase/install new dining room rug\n• Garage door seal\n• Water damage on garage wall (find and repair the leak source)\n• Door or curtain for pantry\n• Gutters"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / operating_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3574658d-5f4f-81d2-bed2-e345f40bca1a', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_ssid"}', $pid$"HFE 401"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(utilities #> '{"wifi_ssid"}', 'null'::jsonb) = $pid$"ARHA 2.4, ARHA 5"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '401 E. 10th St. / utilities.wifi_ssid'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3574658d-5f4f-81d2-bed2-e345f40bca1a', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '09e74a21-8489-4ef1-b0fb-295800859029' AND field_key = 'utilities.wifi_ssid' AND note = 'PID refresh 2026-11-12';
UPDATE public.properties SET systems = systems #- '{"co"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND systems #> '{"co"}' = '{}'::jsonb;
UPDATE public.properties SET systems = systems #- '{"smoke"}', updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND systems #> '{"smoke"}' = '{}'::jsonb;

-- 409 S. 85th St.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'eef11540-5745-4b8f-8f1f-f02b02ea3417' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '409 S. 85th St. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'eef11540-5745-4b8f-8f1f-f02b02ea3417' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = 'eef11540-5745-4b8f-8f1f-f02b02ea3417' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '409 S. 85th St. / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'eef11540-5745-4b8f-8f1f-f02b02ea3417' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 417 Dauphin Ave.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '6ffccd48-698b-4c3b-bdac-420ba582bc2d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '417 Dauphin Ave. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '6ffccd48-698b-4c3b-bdac-420ba582bc2d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '6ffccd48-698b-4c3b-bdac-420ba582bc2d' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '417 Dauphin Ave. / operating_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-809c-b4c1-dc8101719004', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '6ffccd48-698b-4c3b-bdac-420ba582bc2d' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 428 Drowsy Water Trl (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '1a251d51-208a-439d-9b0e-f7e2887ae50b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '428 Drowsy Water Trl (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1a251d51-208a-439d-9b0e-f7e2887ae50b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 4308 NW 158th (30D Firm)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'ab12f1af-3e2e-4cfb-a73a-bb32dc412dc9' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4308 NW 158th (30D Firm) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ab12f1af-3e2e-4cfb-a73a-bb32dc412dc9' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"Pool Access Code: See Guest Access & Credentials \n Pool rules and hours can be found on site on the pool building wall."$pid$::jsonb, true), updated_at = now() WHERE id = 'ab12f1af-3e2e-4cfb-a73a-bb32dc412dc9' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"Pool Access Code: [removed — credentials are not stored in Resolve] \n Pool rules and hours can be found on site on the pool building wall."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4308 NW 158th (30D Firm) / amenities.access_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-800f-8485-ed3da65ab8f9', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'ab12f1af-3e2e-4cfb-a73a-bb32dc412dc9' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';

-- 4308 S 177th Pl E
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '517ccf34-a2de-4aca-9984-fc58c8a8d7bb' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4308 S 177th Pl E / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '517ccf34-a2de-4aca-9984-fc58c8a8d7bb' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '517ccf34-a2de-4aca-9984-fc58c8a8d7bb' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4308 S 177th Pl E / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '517ccf34-a2de-4aca-9984-fc58c8a8d7bb' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 4317 NW 19th
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'e72e942a-f53f-4397-89fa-0383795fbc55' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4317 NW 19th / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e72e942a-f53f-4397-89fa-0383795fbc55' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'e72e942a-f53f-4397-89fa-0383795fbc55' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4317 NW 19th / operating_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e72e942a-f53f-4397-89fa-0383795fbc55' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 441 Belmont
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '53eaf44b-5021-48eb-babb-9cfdca9fb52b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '441 Belmont / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '53eaf44b-5021-48eb-babb-9cfdca9fb52b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 4513 Black Mesa Ln
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '72cd8885-be51-4f6b-8fe9-2aab4173d34c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4513 Black Mesa Ln / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '72cd8885-be51-4f6b-8fe9-2aab4173d34c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 453 Blue Crow Lane
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '8c6b2765-57d4-4e05-9632-218ddf636258' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '453 Blue Crow Lane / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8c6b2765-57d4-4e05-9632-218ddf636258' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2025-06-22"$pid$::jsonb, true), updated_at = now() WHERE id = '8c6b2765-57d4-4e05-9632-218ddf636258' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2026-09-22"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '453 Blue Crow Lane / systems.smoke.batteries_changed_on'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-80eb-bdeb-eec4e67f1cac', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '8c6b2765-57d4-4e05-9632-218ddf636258' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';

-- 4607 S. Lakewood Ave
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '5988af9f-e3b2-4ea3-973e-f8e7b8f86eea' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4607 S. Lakewood Ave / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '5988af9f-e3b2-4ea3-973e-f8e7b8f86eea' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '5988af9f-e3b2-4ea3-973e-f8e7b8f86eea' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4607 S. Lakewood Ave / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '5988af9f-e3b2-4ea3-973e-f8e7b8f86eea' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 4607 W. Union St.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '4c0686e1-cead-4595-8dcc-633451238ad9' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4607 W. Union St. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '4c0686e1-cead-4595-8dcc-633451238ad9' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 4718 E Shadowbrook Dr
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '3eb869c8-205a-456f-86b8-d6a41f251e50' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4718 E Shadowbrook Dr / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '3eb869c8-205a-456f-86b8-d6a41f251e50' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 4816 Hazy Hollow Ln
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'af09b54d-b334-4bee-a911-2af50a902a2b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '4816 Hazy Hollow Ln / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'af09b54d-b334-4bee-a911-2af50a902a2b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 5020 S.168th E Ave (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '53dd007c-4a89-4d96-9feb-e8467787a527' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5020 S.168th E Ave (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '53dd007c-4a89-4d96-9feb-e8467787a527' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '53dd007c-4a89-4d96-9feb-e8467787a527' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5020 S.168th E Ave (30D FIRM) / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '53dd007c-4a89-4d96-9feb-e8467787a527' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 5034 N 35th St
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'b3a2afd8-96d4-4699-a91e-9c21ea1f115b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5034 N 35th St / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'b3a2afd8-96d4-4699-a91e-9c21ea1f115b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = 'b3a2afd8-96d4-4699-a91e-9c21ea1f115b' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5034 N 35th St / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'b3a2afd8-96d4-4699-a91e-9c21ea1f115b' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 504 S. 47th St
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '2e868dc3-3eec-4d4d-bc2c-5dccbda23987' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '504 S. 47th St / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '2e868dc3-3eec-4d4d-bc2c-5dccbda23987' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '2e868dc3-3eec-4d4d-bc2c-5dccbda23987' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '504 S. 47th St / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '2e868dc3-3eec-4d4d-bc2c-5dccbda23987' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 5047 Skipping Stone Dr
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '1bff641f-0107-4fe4-93fe-6ecf8735b38d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5047 Skipping Stone Dr / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1bff641f-0107-4fe4-93fe-6ecf8735b38d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '1bff641f-0107-4fe4-93fe-6ecf8735b38d' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5047 Skipping Stone Dr / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1bff641f-0107-4fe4-93fe-6ecf8735b38d' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 508 NW 183rd St
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '1ac5de62-3a33-464d-8c9c-dbd132d15bab' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '508 NW 183rd St / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1ac5de62-3a33-464d-8c9c-dbd132d15bab' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 509 Houndstooth Dr (30D Firm)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '652a1979-a6ec-43ed-b684-2bc1aa9548bf' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '509 Houndstooth Dr (30D Firm) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '652a1979-a6ec-43ed-b684-2bc1aa9548bf' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"Not Mentioned"$pid$::jsonb, true), updated_at = now() WHERE id = '652a1979-a6ec-43ed-b684-2bc1aa9548bf' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"ARHA can fill out the pool access card form (attached in comments) then send it Christina for approval and next steps to receive the card.\nContact: Christina Villarreal\nCVillarreal@insightam.com\n (972) 993-6746"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '509 Houndstooth Dr (30D Firm) / amenities.access_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-803a-89ec-f0084e75f682', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '652a1979-a6ec-43ed-b684-2bc1aa9548bf' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';

-- 5217 NW 109th St. (30D Firm)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '061cde8a-0565-4aeb-8e36-d558c317576b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5217 NW 109th St. (30D Firm) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '061cde8a-0565-4aeb-8e36-d558c317576b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '061cde8a-0565-4aeb-8e36-d558c317576b' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5217 NW 109th St. (30D Firm) / operating_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80ea-8f84-dbe3f80b34e9', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '061cde8a-0565-4aeb-8e36-d558c317576b' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 525 23rd Ave
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '6aef16ba-91c0-416c-8b60-8ed7a140de4b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '525 23rd Ave / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '6aef16ba-91c0-416c-8b60-8ed7a140de4b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 5253 Tracey Jo Rd
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '908cc8ce-268b-402c-a2aa-8c7aefb67975' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5253 Tracey Jo Rd / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '908cc8ce-268b-402c-a2aa-8c7aefb67975' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 5512 Hidden Trail Ln.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'd4eab150-8c1c-4804-8ac4-a15e697b6c82' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5512 Hidden Trail Ln. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'd4eab150-8c1c-4804-8ac4-a15e697b6c82' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 5671 Teak Ln.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'dc7e0b00-9bde-4bfd-a94b-bd164801ba6b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5671 Teak Ln. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'dc7e0b00-9bde-4bfd-a94b-bd164801ba6b' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 5923 Hollyhock Lane
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '970d75a6-bf28-4439-b138-46f6749cc0dd' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '5923 Hollyhock Lane / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '970d75a6-bf28-4439-b138-46f6749cc0dd' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 6017 S. 13th St (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'be144356-fec0-44ce-83fa-4dc052194c93' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6017 S. 13th St (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'be144356-fec0-44ce-83fa-4dc052194c93' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = 'be144356-fec0-44ce-83fa-4dc052194c93' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6017 S. 13th St (30D FIRM) / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'be144356-fec0-44ce-83fa-4dc052194c93' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 624 Daniel Court
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_integration_live"}', updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '624 Daniel Court / access.yale_integration_live'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '624 Daniel Court / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET compliance = compliance #- '{"permit_status"}', updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND coalesce(compliance #> '{"permit_status"}', 'null'::jsonb) = $pid${"text":"No permit required for Westfield, IN","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '624 Daniel Court / compliance.permit_status'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'compliance.permit_status' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET compliance = compliance #- '{"rental_restrictions"}', updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND coalesce(compliance #> '{"rental_restrictions"}', 'null'::jsonb) = $pid${"text":"No STR rental restrictions","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '624 Daniel Court / compliance.rental_restrictions'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'compliance.rental_restrictions' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = external_refs #- '{"breezeway_url"}', updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$"https://app.breezeway.io/property/1529710/profile"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '624 Daniel Court / external_refs.breezeway_url'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '624 Daniel Court / furniture_package'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET market = (jsonb_populate_record(NULL::public.properties, $pid${"market":null}$pid$::jsonb)).market, updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND to_jsonb(market) IS NOT DISTINCT FROM $pid$"Indy"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '624 Daniel Court / market'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'market' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname, updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"Dovetail Court (624)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '624 Daniel Court / nickname'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"summary"}', updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$"2 Car Garage\nFree Parking on Premises"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '624 Daniel Court / parking.summary'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier, updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '624 Daniel Court / tier'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"wifi_split_confirmed"}', updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '624 Daniel Court / utilities.wifi_split_confirmed'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built, updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2002$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '624 Daniel Court / year_built'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';

-- 628 Joy Ct
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '1652e0d6-8577-4cc1-82ee-fd477c929427' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '628 Joy Ct / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1652e0d6-8577-4cc1-82ee-fd477c929427' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2025-10-29"$pid$::jsonb, true), updated_at = now() WHERE id = '1652e0d6-8577-4cc1-82ee-fd477c929427' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2026-09-07"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '628 Joy Ct / systems.smoke.batteries_changed_on'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-801f-a2f4-d04889af2a78', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '1652e0d6-8577-4cc1-82ee-fd477c929427' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';

-- 6302 Meadow Path Way
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_integration_live"}', updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6302 Meadow Path Way / access.yale_integration_live'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6302 Meadow Path Way / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = external_refs #- '{"breezeway_url"}', updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$"https://app.breezeway.io/property/1563499/profile"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6302 Meadow Path Way / external_refs.breezeway_url'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6302 Meadow Path Way / furniture_package'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET market = (jsonb_populate_record(NULL::public.properties, $pid${"market":null}$pid$::jsonb)).market, updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND to_jsonb(market) IS NOT DISTINCT FROM $pid$"Indy"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6302 Meadow Path Way / market'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'market' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname, updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"Meadow Path Hideaway (6302)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6302 Meadow Path Way / nickname'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"summary"}', updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$"2 Car Garage \nFree Parking on Premises"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6302 Meadow Path Way / parking.summary'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier, updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6302 Meadow Path Way / tier'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"wifi_split_confirmed"}', updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6302 Meadow Path Way / utilities.wifi_split_confirmed'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built, updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2024$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6302 Meadow Path Way / year_built'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';

-- 6312 Red Cliff Dr
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '677bb1df-ce30-447c-a129-4ad3488c51bc' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6312 Red Cliff Dr / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '677bb1df-ce30-447c-a129-4ad3488c51bc' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 64 Turtle Loop
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'aed01e56-0bbb-4720-b81c-996bffcb6c21' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '64 Turtle Loop / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'aed01e56-0bbb-4720-b81c-996bffcb6c21' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"NO PETS ALLOWED\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'aed01e56-0bbb-4720-b81c-996bffcb6c21' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"NO PETS ALLOWED\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '64 Turtle Loop / operating_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80d7-b304-e4412a7aed48', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'aed01e56-0bbb-4720-b81c-996bffcb6c21' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 6629 S 22nd Ct E
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '656e8354-e4f6-43b2-9029-116fdef25e8a' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6629 S 22nd Ct E / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '656e8354-e4f6-43b2-9029-116fdef25e8a' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '656e8354-e4f6-43b2-9029-116fdef25e8a' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6629 S 22nd Ct E / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '656e8354-e4f6-43b2-9029-116fdef25e8a' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"There is a community pool (only available for guests 30+ days). A waiver is required to be completed per tenant in order to gain access. It is saved to the property’s one drive folder. It and the rules are also attached to this field as a comment."$pid$::jsonb, true), updated_at = now() WHERE id = '656e8354-e4f6-43b2-9029-116fdef25e8a' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"There is a community pool (only available for guests 30+ days). A waiver is required to be completed per tenant in order to gain access. It is saved to the property’s one drive folder. It and the rules are also attached to this field as a comment. The owner has to complete the waiver."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6629 S 22nd Ct E / amenities.access_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-800f-9797-ee9f8347a7db', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '656e8354-e4f6-43b2-9029-116fdef25e8a' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"list"}', $pid$["Not Mentioned"]$pid$::jsonb, true), updated_at = now() WHERE id = '656e8354-e4f6-43b2-9029-116fdef25e8a' AND coalesce(amenities #> '{"list"}', 'null'::jsonb) = $pid$["Pool"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6629 S 22nd Ct E / amenities.list'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-800f-9797-ee9f8347a7db', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '656e8354-e4f6-43b2-9029-116fdef25e8a' AND field_key = 'amenities.list' AND note = 'PID refresh 2026-11-12';

-- 6847 Cardiff Dr
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '3a248822-b22f-4c2c-ab8c-56ff4f9a06e0' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6847 Cardiff Dr / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '3a248822-b22f-4c2c-ab8c-56ff4f9a06e0' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '3a248822-b22f-4c2c-ab8c-56ff4f9a06e0' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '6847 Cardiff Dr / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '3a248822-b22f-4c2c-ab8c-56ff4f9a06e0' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 7006 E 154th St S
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '806c6bbc-6723-426a-a5e7-ead187813d5f' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '7006 E 154th St S / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '806c6bbc-6723-426a-a5e7-ead187813d5f' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '806c6bbc-6723-426a-a5e7-ead187813d5f' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '7006 E 154th St S / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '806c6bbc-6723-426a-a5e7-ead187813d5f' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 7071 Richardson Ct
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '91aac2de-0b98-444a-81a8-2de074e0d265' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '7071 Richardson Ct / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '91aac2de-0b98-444a-81a8-2de074e0d265' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 721 Dusty Trail
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'c9777558-269b-4c12-b0ac-7a53cc960ebb' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '721 Dusty Trail / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'c9777558-269b-4c12-b0ac-7a53cc960ebb' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 721 Vaquero St.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '3b0a17c2-8cda-43a7-ae82-8103feaf4811' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '721 Vaquero St. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '3b0a17c2-8cda-43a7-ae82-8103feaf4811' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 724 Abilene Way
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '326291cd-a35d-4055-9f87-e7ad1d34eec2' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '724 Abilene Way / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '326291cd-a35d-4055-9f87-e7ad1d34eec2' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 730 E 38th St. N.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '730 E 38th St. N. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"65\" TCL TV in Living Room, 55” TV in Primary Bedroom"$pid$::jsonb, true), updated_at = now() WHERE id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"65\" TCL ROKU TV in Living Room \n55” TCL ROKU TV in Primary Bedroom"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '730 E 38th St. N. / facts.tv_specs'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3374658d-5f4f-818b-a1c3-e172e6748505', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"14x24x1 - 1\n14x30x1 - 1"$pid$::jsonb, true), updated_at = now() WHERE id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"1- 14x24x1 \n1- 14x30x1"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '730 E 38th St. N. / hvac.filter_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3374658d-5f4f-818b-a1c3-e172e6748505', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter"}', $pid$"Samsung Water Filter"$pid$::jsonb, true), updated_at = now() WHERE id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$"Samsung Water Filter NSF"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '730 E 38th St. N. / systems.fridge_filter'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3374658d-5f4f-818b-a1c3-e172e6748505', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"water_shutoff_outdoor"}', $pid$"I do not see one on the outside of the house if there is it’s in the water meter box and it’s flooded"$pid$::jsonb, true), updated_at = now() WHERE id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND coalesce(systems #> '{"water_shutoff_outdoor"}', 'null'::jsonb) = $pid$"aside the mailbox"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '730 E 38th St. N. / systems.water_shutoff_outdoor'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3374658d-5f4f-818b-a1c3-e172e6748505', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND field_key = 'systems.water_shutoff_outdoor' AND note = 'PID refresh 2026-11-12';

-- 7317 NW 159th Ter. (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'ff7a1ed4-c055-47fe-ba79-4763d5a1bf01' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '7317 NW 159th Ter. (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ff7a1ed4-c055-47fe-ba79-4763d5a1bf01' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"Pool rules can be found in the guidebook custom fields, and also save to onedrive - here. The pool is expected to be open seasonally during the summer time."$pid$::jsonb, true), updated_at = now() WHERE id = 'ff7a1ed4-c055-47fe-ba79-4763d5a1bf01' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"Pool rules can be found in the guidebook custom fields, and also save to onedrive - here. The pool is open seasonally, estimated from Memorial Day weekend through Labor Day, open from 10am–10pm."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '7317 NW 159th Ter. (30D FIRM) / amenities.access_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3ac4658d-5f4f-80a1-9d74-f5444c6802d8', as_of = '2026-08-30T04:09:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'ff7a1ed4-c055-47fe-ba79-4763d5a1bf01' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';

-- 7351 Red Rock Rd
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'eedf6963-8cf0-45fc-b67e-2d910c79e6c4' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '7351 Red Rock Rd / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'eedf6963-8cf0-45fc-b67e-2d910c79e6c4' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 7380 S 69th E Ave
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'd14ba1d6-ae17-4c4f-9d09-134e6f84d5d3' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '7380 S 69th E Ave / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'd14ba1d6-ae17-4c4f-9d09-134e6f84d5d3' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = 'd14ba1d6-ae17-4c4f-9d09-134e6f84d5d3' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '7380 S 69th E Ave / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'd14ba1d6-ae17-4c4f-9d09-134e6f84d5d3' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 7422 S. Granite Ave.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '4b0b54da-5608-4f92-8f1f-73328b83c73d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '7422 S. Granite Ave. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '4b0b54da-5608-4f92-8f1f-73328b83c73d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '4b0b54da-5608-4f92-8f1f-73328b83c73d' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '7422 S. Granite Ave. / operating_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-808f-925a-e30ea33884c2', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '4b0b54da-5608-4f92-8f1f-73328b83c73d' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 758 N. Johnson Branch Rd.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'fc1cb579-d655-4558-a85d-2164026606a7' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '758 N. Johnson Branch Rd. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'fc1cb579-d655-4558-a85d-2164026606a7' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 815 E Fulton St.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'ad110483-8a1a-4285-9f4f-d432f5d1dbda' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '815 E Fulton St. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ad110483-8a1a-4285-9f4f-d432f5d1dbda' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = 'ad110483-8a1a-4285-9f4f-d432f5d1dbda' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '815 E Fulton St. / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'ad110483-8a1a-4285-9f4f-d432f5d1dbda' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';

-- 816 Lakeview Dr
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'fd6a681a-df09-4aef-a417-c47339b28fa6' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '816 Lakeview Dr / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'fd6a681a-df09-4aef-a417-c47339b28fa6' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 817 Halley Dr.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '1ffa9bde-a0cb-44c5-be33-bcad961e0c56' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '817 Halley Dr. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1ffa9bde-a0cb-44c5-be33-bcad961e0c56' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 8217 NW 151st St. (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '00e1a3f9-be07-4ba7-9455-b81ad0938014' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8217 NW 151st St. (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '00e1a3f9-be07-4ba7-9455-b81ad0938014' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 8316 NW 142nd
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'f9638a06-f514-43a7-aafc-833ac34a817c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8316 NW 142nd / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'f9638a06-f514-43a7-aafc-833ac34a817c' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 8332 Welder Pl.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'bfbca778-19f4-4c1f-a0dd-b08986f22f51' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8332 Welder Pl. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bfbca778-19f4-4c1f-a0dd-b08986f22f51' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 8408 NW 162nd (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'cca8fac9-9179-4e29-aa1d-343ac036b95d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8408 NW 162nd (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'cca8fac9-9179-4e29-aa1d-343ac036b95d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"controller_location"}', $pid$"Garahe"$pid$::jsonb, true), updated_at = now() WHERE id = 'cca8fac9-9179-4e29-aa1d-343ac036b95d' AND coalesce(sprinklers #> '{"controller_location"}', 'null'::jsonb) = $pid$"Garage"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8408 NW 162nd (30D FIRM) / sprinklers.controller_location'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '1664658d-5f4f-801a-97ac-f2907cb749b7', as_of = '2026-08-30T04:11:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = 'cca8fac9-9179-4e29-aa1d-343ac036b95d' AND field_key = 'sprinklers.controller_location' AND note = 'PID refresh 2026-11-12';

-- 845 Alexandria
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'e479337c-fb9c-4513-bcee-e96f24f300ee' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '845 Alexandria / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'e479337c-fb9c-4513-bcee-e96f24f300ee' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 85 Lower Green Way
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '82f30000-1b78-42a9-a965-5caf68c508c4' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '85 Lower Green Way / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '82f30000-1b78-42a9-a965-5caf68c508c4' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"Carlton Landing requires all vehicles to be registered through the link found  - here .The passcode: See Guest Access & Credentials will use in the form is 447732. Unregistered cars can be ticketed or towed, so please take care of this ahead of time.\n\nThe above information is included in the Breezeway Parking Guidelines."$pid$::jsonb, true), updated_at = now() WHERE id = '82f30000-1b78-42a9-a965-5caf68c508c4' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"Carlton Landing requires all vehicles to be registered through the link found  - \nhere \n. The passcode: [removed — credentials are not stored in Resolve] will use in the form is \n447732\n. Unregistered cars can be ticketed or towed, so please take care of this ahead of time.\n\nThe above information is included in the Breezeway Parking Guidelines."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '85 Lower Green Way / amenities.access_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80fa-ad64-e8cf118433ba', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '82f30000-1b78-42a9-a965-5caf68c508c4' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = jsonb_set(CASE WHEN jsonb_typeof(external_refs) = 'object' THEN external_refs ELSE '{}'::jsonb END, '{"breezeway_url"}', $pid$"https://app.breezeway.io/property/1295302/profile"$pid$::jsonb, true), updated_at = now() WHERE id = '82f30000-1b78-42a9-a965-5caf68c508c4' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$"https://app.breezeway.io/property/1295307/profile"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '85 Lower Green Way / external_refs.breezeway_url'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80fa-ad64-e8cf118433ba', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '82f30000-1b78-42a9-a965-5caf68c508c4' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '82f30000-1b78-42a9-a965-5caf68c508c4' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"NO PETS ALLOWED\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '85 Lower Green Way / operating_notes'; END IF;
END $do$;
UPDATE public.property_field_provenance SET value_source = 'notion_pid', source_record_id = '3184658d-5f4f-80fa-ad64-e8cf118433ba', as_of = '2026-08-30T04:10:00+00:00', note = NULL, updated_at = now()
  WHERE property_id = '82f30000-1b78-42a9-a965-5caf68c508c4' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';

-- 852 Inland Dr.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"emergency_key_access"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(access #> '{"emergency_key_access"}', 'null'::jsonb) = $pid$"Yes"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / access.emergency_key_access'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'access.emergency_key_access' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"garage_remote"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(access #> '{"garage_remote"}', 'null'::jsonb) = $pid$"Genie -LiftMaster Chamberlain Craftsman Universal Garage Door Opener Remote - https://www.amazon.com/dp/B08CNKBTYJ?ref_=ppx_hzod_title_dt_b_fed_asin_title_4_10&th=1"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / access.garage_remote'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'access.garage_remote' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"key_storage"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(access #> '{"key_storage"}', 'null'::jsonb) = $pid$["Front Door/Smartlock","Storage Closet","Storage Building","Garage Door"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / access.key_storage'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'access.key_storage' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"lock_brand"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(access #> '{"lock_brand"}', 'null'::jsonb) = $pid$"Yale"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / access.lock_brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'access.lock_brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_module"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$"Connected & Setup"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / access.yale_module'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = amenities #- '{"access_notes"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / amenities.access_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = amenities #- '{"list"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(amenities #> '{"list"}', 'null'::jsonb) = $pid$["None"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / amenities.list'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'amenities.list' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"grill"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(facts #> '{"grill"}', 'null'::jsonb) = $pid$"No Grill"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / facts.grill'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'facts.grill' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"interior_paint"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(facts #> '{"interior_paint"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / facts.interior_paint'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'facts.interior_paint' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"tv_locations"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(facts #> '{"tv_locations"}', 'null'::jsonb) = $pid$["Living Room","Primary Bedroom"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / facts.tv_locations'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'facts.tv_locations' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"tv_specs"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"852 Inland Dr Living room - 75,  852 INLAND DR - 55 Primary bedroom"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / facts.tv_specs'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"workstation"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(facts #> '{"workstation"}', 'null'::jsonb) = $pid$"Yes"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / facts.workstation'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'facts.workstation' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"fuel_type"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(fireplace #> '{"fuel_type"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / fireplace.fuel_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'fireplace.fuel_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"gas_switch"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(fireplace #> '{"gas_switch"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / fireplace.gas_switch'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'fireplace.gas_switch' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"gas_switch_location"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(fireplace #> '{"gas_switch_location"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / fireplace.gas_switch_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'fireplace.gas_switch_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"instructions"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(fireplace #> '{"instructions"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / fireplace.instructions'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'fireplace.instructions' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"model"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(fireplace #> '{"model"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / fireplace.model'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'fireplace.model' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"present"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(fireplace #> '{"present"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / fireplace.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'fireplace.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET grounds = grounds #- '{"mowing_cadence"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(grounds #> '{"mowing_cadence"}', 'null'::jsonb) = $pid$"ARHA Responsible"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / grounds.mowing_cadence'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'grounds.mowing_cadence' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET grounds = grounds #- '{"mowing_days"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(grounds #> '{"mowing_days"}', 'null'::jsonb) = $pid$["Wednesday"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / grounds.mowing_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'grounds.mowing_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hoa = hoa #- '{"notes + external_links"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(hoa #> '{"notes + external_links"}', 'null'::jsonb) = $pid$"no holiday decor over 30 days; pets/vehicles/RVs in garage only; mailboxes/decks/fences/outbuildings need approval; maintain yards & exterior colors uniformly."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / hoa.notes + external_links'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'hoa.notes + external_links' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hoa = hoa #- '{"present"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(hoa #> '{"present"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / hoa.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'hoa.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = hvac #- '{"filter_notes"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"14×24×1"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / hvac.filter_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = hvac #- '{"filter_sizes"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(hvac #> '{"filter_sizes"}', 'null'::jsonb) = $pid$["14x24x1"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / hvac.filter_sizes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'hvac.filter_sizes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET legacy_handoff_date = (jsonb_populate_record(NULL::public.properties, $pid${"legacy_handoff_date":null}$pid$::jsonb)).legacy_handoff_date, updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND to_jsonb(legacy_handoff_date) IS NOT DISTINCT FROM $pid$"2026-10-06"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / legacy_handoff_date'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'legacy_handoff_date' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":null}$pid$::jsonb)).listing_alias, updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND to_jsonb(listing_alias) IS NOT DISTINCT FROM $pid$"3BR Home, Avon IN | Extended & Monthly Stays"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / listing_alias'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'listing_alias' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":null}$pid$::jsonb)).neighborhood, updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND to_jsonb(neighborhood) IS NOT DISTINCT FROM $pid$"Austin Lakes North"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / neighborhood'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'neighborhood' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Back Storage is locked not available for guest and nothing is inside that room, Key is in the garage trim lockbox.   Spare front door key is the storage closet"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / operating_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"cluster_mailbox"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(parking #> '{"cluster_mailbox"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / parking.cluster_mailbox'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'parking.cluster_mailbox' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"mailbox_location"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(parking #> '{"mailbox_location"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / parking.mailbox_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'parking.mailbox_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"mailbox_number"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(parking #> '{"mailbox_number"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / parking.mailbox_number'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'parking.mailbox_number' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = pool_spa #- '{"present"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(pool_spa #> '{"present"}', 'null'::jsonb) = $pid$"None"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / pool_spa.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'pool_spa.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"alarm"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(security #> '{"alarm"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / security.alarm'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'security.alarm' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"battery_type"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(security #> '{"battery_type"}', 'null'::jsonb) = $pid$["Hardwired - No Battery"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / security.battery_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'security.battery_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"devices"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(security #> '{"devices"}', 'null'::jsonb) = $pid$["Front Door","Garage"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / security.devices'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'security.devices' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"monitoring_expires_on"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(security #> '{"monitoring_expires_on"}', 'null'::jsonb) = $pid$"2027-10-09"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / security.monitoring_expires_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'security.monitoring_expires_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"monitoring_plan"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(security #> '{"monitoring_plan"}', 'null'::jsonb) = $pid$["Active"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / security.monitoring_plan'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'security.monitoring_plan' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"brand"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(sprinklers #> '{"brand"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / sprinklers.brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'sprinklers.brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"controller_location"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(sprinklers #> '{"controller_location"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / sprinklers.controller_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'sprinklers.controller_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"set_for_season"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(sprinklers #> '{"set_for_season"}', 'null'::jsonb) = $pid${"value":"N/A","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / sprinklers.set_for_season'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'sprinklers.set_for_season' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"status"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(sprinklers #> '{"status"}', 'null'::jsonb) = $pid$"Property Does Not Have Sprinkler System"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / sprinklers.status'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'sprinklers.status' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET storm_shelter = storm_shelter #- '{"location_access"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(storm_shelter #> '{"location_access"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / storm_shelter.location_access'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'storm_shelter.location_access' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"breaker_panel_location"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"breaker_panel_location"}', 'null'::jsonb) = $pid$"Garage"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / systems.breaker_panel_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.breaker_panel_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"co","installed"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"co","installed"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / systems.co.installed'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.co.installed' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"co","location"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"co","location"}', 'null'::jsonb) = $pid$"Kitchen"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / systems.co.location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.co.location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"fridge_filter"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$"Frigidaire PurePour PWF-1 refrigerator water filter — FPPWFU01"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / systems.fridge_filter'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"fridge_filter_5yr"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"fridge_filter_5yr"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / systems.fridge_filter_5yr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.fridge_filter_5yr' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","batteries_changed_on"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2026-09-25"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / systems.smoke.batteries_changed_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","battery_type"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"smoke","battery_type"}', 'null'::jsonb) = $pid$"9-Volt (Alkaline)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / systems.smoke.battery_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.smoke.battery_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","brand"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"smoke","brand"}', 'null'::jsonb) = $pid$"Siterwell"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / systems.smoke.brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.smoke.brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_on"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"smoke","expires_on"}', 'null'::jsonb) = $pid$"2035-09-30"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / systems.smoke.expires_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.smoke.expires_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_precision"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"smoke","expires_precision"}', 'null'::jsonb) = $pid$"month"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / systems.smoke.expires_precision'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.smoke.expires_precision' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_source_text"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"smoke","expires_source_text"}', 'null'::jsonb) = $pid$"September 2035"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / systems.smoke.expires_source_text'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.smoke.expires_source_text' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","notes"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"smoke","notes"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / systems.smoke.notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.smoke.notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","power_type"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"smoke","power_type"}', 'null'::jsonb) = $pid$"Hardwired"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / systems.smoke.power_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.smoke.power_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"supply_box_location"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"supply_box_location"}', 'null'::jsonb) = $pid$"Top shelf in master closet"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / systems.supply_box_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.supply_box_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"supply_storage"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"supply_storage"}', 'null'::jsonb) = $pid$"Closet"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / systems.supply_storage'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.supply_storage' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"water_shutoff_indoor"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"water_shutoff_indoor"}', 'null'::jsonb) = $pid$"Garage"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / systems.water_shutoff_indoor'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.water_shutoff_indoor' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"water_shutoff_outdoor"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"water_shutoff_outdoor"}', 'null'::jsonb) = $pid$"Close to the sidewalk"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / systems.water_shutoff_outdoor'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'systems.water_shutoff_outdoor' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier, updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / tier'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"router_location"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(utilities #> '{"router_location"}', 'null'::jsonb) = $pid$"Master bedroom"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / utilities.router_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'utilities.router_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"wifi_ssid"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(utilities #> '{"wifi_ssid"}', 'null'::jsonb) = $pid$"ARHA"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / utilities.wifi_ssid'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'utilities.wifi_ssid' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET warranty = warranty #- '{"builder_present"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(warranty #> '{"builder_present"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / warranty.builder_present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'warranty.builder_present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET warranty = warranty #- '{"claim_process + external_links"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(warranty #> '{"claim_process + external_links"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / warranty.claim_process + external_links'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'warranty.claim_process + external_links' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET warranty = warranty #- '{"furniture_expires_on"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(warranty #> '{"furniture_expires_on"}', 'null'::jsonb) = $pid$"2029-10-06"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / warranty.furniture_expires_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'warranty.furniture_expires_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"cart_count"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(waste #> '{"cart_count"}', 'null'::jsonb) = $pid$3$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / waste.cart_count'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'waste.cart_count' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"cart_notes"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(waste #> '{"cart_notes"}', 'null'::jsonb) = $pid$"3"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / waste.cart_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'waste.cart_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"holiday_notes"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(waste #> '{"holiday_notes"}', 'null'::jsonb) = $pid$"service may be delayed by up to 7 days around the following holidays"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / waste.holiday_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'waste.holiday_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"recycling"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(waste #> '{"recycling"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / waste.recycling'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'waste.recycling' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"recycling_days"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(waste #> '{"recycling_days"}', 'null'::jsonb) = $pid$"every other Thursday"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / waste.recycling_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'waste.recycling_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"strict_rules"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(waste #> '{"strict_rules"}', 'null'::jsonb) = $pid$"Garbage/Trash containers are only permitted to be left outside for trash collection Containers cannot be permanently stored in front of or alongside a home Must be kept in an enclosed garage on non-trash collection days"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / waste.strict_rules'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'waste.strict_rules' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"trash_days"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(waste #> '{"trash_days"}', 'null'::jsonb) = $pid$["Thursday"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / waste.trash_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'waste.trash_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '852 Inland Dr. / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';
UPDATE public.properties SET systems = systems #- '{"co"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND systems #> '{"co"}' = '{}'::jsonb;
UPDATE public.properties SET systems = systems #- '{"smoke"}', updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND systems #> '{"smoke"}' = '{}'::jsonb;

-- 8602 E. Galveston St.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_integration_live"}', updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8602 E. Galveston St. / access.yale_integration_live'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'access.yale_integration_live' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8602 E. Galveston St. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET compliance = compliance #- '{"rental_restrictions"}', updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND coalesce(compliance #> '{"rental_restrictions"}', 'null'::jsonb) = $pid${"text":"No STR rental restrictions","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8602 E. Galveston St. / compliance.rental_restrictions'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'compliance.rental_restrictions' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = external_refs #- '{"breezeway_url"}', updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$"https://app.breezeway.io/property/1514896/profile"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8602 E. Galveston St. / external_refs.breezeway_url'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'external_refs.breezeway_url' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":null}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM $pid$"Signature (Gold)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8602 E. Galveston St. / furniture_package'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'furniture_package' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":null}$pid$::jsonb)).nickname, updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND to_jsonb(nickname) IS NOT DISTINCT FROM $pid$"Rosewood on Galveston (8602)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8602 E. Galveston St. / nickname'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'nickname' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"summary"}', updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$"2 Car Garage\nFree Parking on Premises"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8602 E. Galveston St. / parking.summary'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'parking.summary' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":null}$pid$::jsonb)).tier, updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND to_jsonb(tier) IS NOT DISTINCT FROM $pid$"B"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8602 E. Galveston St. / tier'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'tier' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"wifi_split_confirmed"}', updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8602 E. Galveston St. / utilities.wifi_split_confirmed'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'utilities.wifi_split_confirmed' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":null}$pid$::jsonb)).year_built, updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND to_jsonb(year_built) IS NOT DISTINCT FROM $pid$2026$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8602 E. Galveston St. / year_built'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND field_key = 'year_built' AND note = 'PID refresh 2026-11-12';

-- 8708 Scirocco Circle
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '1e60c99a-e779-4d77-be8d-c8452f991a2d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8708 Scirocco Circle / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '1e60c99a-e779-4d77-be8d-c8452f991a2d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 8910 N 73rd Pl E
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'fd0972a5-3501-4d1f-a33b-53cfaa184ec4' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '8910 N 73rd Pl E / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'fd0972a5-3501-4d1f-a33b-53cfaa184ec4' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 9008 Scarlet Blvd (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '3f2435d5-406c-47f1-b943-4e34d4f839c1' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9008 Scarlet Blvd (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '3f2435d5-406c-47f1-b943-4e34d4f839c1' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 904 NE 34th Ter
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '7c33e4d9-2a9c-4924-bec0-67f337d3849d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '904 NE 34th Ter / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '7c33e4d9-2a9c-4924-bec0-67f337d3849d' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 9100 NW 123rd (30D Firm)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'c46466fa-9e9d-4b75-a4ed-715c75be06bf' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9100 NW 123rd (30D Firm) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'c46466fa-9e9d-4b75-a4ed-715c75be06bf' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 9120 Yassir Blvd (30D FIRM)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = 'bf746f13-5146-4c9a-ac6c-f42206ca2257' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9120 Yassir Blvd (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = 'bf746f13-5146-4c9a-ac6c-f42206ca2257' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 9211 Fitzgerald Dr.
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"emergency_key_access"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(access #> '{"emergency_key_access"}', 'null'::jsonb) = $pid$"Yes"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / access.emergency_key_access'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'access.emergency_key_access' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"garage_remote"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(access #> '{"garage_remote"}', 'null'::jsonb) = $pid$"R27- GDR-27 MLT - https://www.amazon.com/dp/B08CNKBTYJ?ref=fed_asin_title&th=1"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / access.garage_remote'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'access.garage_remote' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"key_storage"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(access #> '{"key_storage"}', 'null'::jsonb) = $pid$["Front Door/Smartlock","Backdoor","Garage Door"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / access.key_storage'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'access.key_storage' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"lock_brand"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(access #> '{"lock_brand"}', 'null'::jsonb) = $pid$"Yale"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / access.lock_brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'access.lock_brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_module"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$"Connected & Setup"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / access.yale_module'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'access.yale_module' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = amenities #- '{"access_notes"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / amenities.access_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'amenities.access_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET amenities = amenities #- '{"list"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(amenities #> '{"list"}', 'null'::jsonb) = $pid$["Pond","Walking Trail"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / amenities.list'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'amenities.list' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"grill"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(facts #> '{"grill"}', 'null'::jsonb) = $pid$"No Grill"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / facts.grill'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'facts.grill' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"interior_paint"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(facts #> '{"interior_paint"}', 'null'::jsonb) = $pid$"1. Wall color - agreeable gray SW7029\n2. Sheen - matte\n\nNo additional paint left at the property."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / facts.interior_paint'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'facts.interior_paint' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"tv_locations"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(facts #> '{"tv_locations"}', 'null'::jsonb) = $pid$["Living Room","Primary Bedroom"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / facts.tv_locations'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'facts.tv_locations' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"tv_specs"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"Living room -  9211 Fitzgerald Dr - 65” Roku TV, Primary Bedroom -  9211 Fitzgerald Dr - 55” Roku TV, Bonus Room -  9211 Fitzgerald Dr - 55” Roku TV"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / facts.tv_specs'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'facts.tv_specs' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET facts = facts #- '{"workstation"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(facts #> '{"workstation"}', 'null'::jsonb) = $pid$"Yes"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / facts.workstation'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'facts.workstation' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"fuel_type"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(fireplace #> '{"fuel_type"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / fireplace.fuel_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'fireplace.fuel_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"gas_switch"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(fireplace #> '{"gas_switch"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / fireplace.gas_switch'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'fireplace.gas_switch' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"gas_switch_location"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(fireplace #> '{"gas_switch_location"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / fireplace.gas_switch_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'fireplace.gas_switch_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"instructions"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(fireplace #> '{"instructions"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / fireplace.instructions'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'fireplace.instructions' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"model"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(fireplace #> '{"model"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / fireplace.model'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'fireplace.model' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = fireplace #- '{"present"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(fireplace #> '{"present"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / fireplace.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'fireplace.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET grounds = grounds #- '{"mowing_cadence"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(grounds #> '{"mowing_cadence"}', 'null'::jsonb) = $pid$"ARHA Responsible"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / grounds.mowing_cadence'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'grounds.mowing_cadence' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET grounds = grounds #- '{"mowing_days"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(grounds #> '{"mowing_days"}', 'null'::jsonb) = $pid$["Monday"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / grounds.mowing_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'grounds.mowing_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hoa = hoa #- '{"present"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(hoa #> '{"present"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / hoa.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'hoa.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = hvac #- '{"filter_notes"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"1: 16×24×4"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / hvac.filter_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'hvac.filter_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET hvac = hvac #- '{"filter_sizes"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(hvac #> '{"filter_sizes"}', 'null'::jsonb) = $pid$["16x24x4"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / hvac.filter_sizes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'hvac.filter_sizes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":null}$pid$::jsonb)).listing_alias, updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND to_jsonb(listing_alias) IS NOT DISTINCT FROM $pid$"4BR | Sleeps 8, Study & Bonus Room"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / listing_alias'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'listing_alias' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":null}$pid$::jsonb)).neighborhood, updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND to_jsonb(neighborhood) IS NOT DISTINCT FROM $pid$"Fields of New Bethel"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / neighborhood'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'neighborhood' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":null}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"Intro meeting notes - 9211 Fitzgerald \n- Per the intro meeting notes, the designated plumber, HVAC contractor, and electrician must be used for at least 2 years.\n- Per the intro meeting notes, the builder will arrange meetings around 8 months and 10 months after closing.\n\nHVAC Contractor - Chris Chittum Enterprises LLC\nPlumber - R.T. Moore\nElectrical - ARCXIS\n\n**Owner does not want to see any diagnostic fees when possible."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / operating_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'operating_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"cluster_mailbox"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(parking #> '{"cluster_mailbox"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / parking.cluster_mailbox'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'parking.cluster_mailbox' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"mailbox_location"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(parking #> '{"mailbox_location"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / parking.mailbox_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'parking.mailbox_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET parking = parking #- '{"mailbox_number"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(parking #> '{"mailbox_number"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / parking.mailbox_number'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'parking.mailbox_number' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = pool_spa #- '{"present"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(pool_spa #> '{"present"}', 'null'::jsonb) = $pid$"None"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / pool_spa.present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'pool_spa.present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"alarm"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(security #> '{"alarm"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / security.alarm'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'security.alarm' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"battery_type"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(security #> '{"battery_type"}', 'null'::jsonb) = $pid$["Hardwired - No Battery"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / security.battery_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'security.battery_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"devices"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(security #> '{"devices"}', 'null'::jsonb) = $pid$["Front Door","Driveway"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / security.devices'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'security.devices' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"monitoring_expires_on"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(security #> '{"monitoring_expires_on"}', 'null'::jsonb) = $pid$"2027-10-27"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / security.monitoring_expires_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'security.monitoring_expires_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET security = security #- '{"monitoring_plan"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(security #> '{"monitoring_plan"}', 'null'::jsonb) = $pid$["Active"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / security.monitoring_plan'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'security.monitoring_plan' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"brand"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(sprinklers #> '{"brand"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / sprinklers.brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'sprinklers.brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"controller_location"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(sprinklers #> '{"controller_location"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / sprinklers.controller_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'sprinklers.controller_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"set_for_season"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(sprinklers #> '{"set_for_season"}', 'null'::jsonb) = $pid${"value":"N/A","as_of":"2026-11-05T21:46:00.000Z","source":"notion_pid"}$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / sprinklers.set_for_season'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'sprinklers.set_for_season' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = sprinklers #- '{"status"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(sprinklers #> '{"status"}', 'null'::jsonb) = $pid$"Property Does Not Have Sprinkler System"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / sprinklers.status'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'sprinklers.status' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET storm_shelter = storm_shelter #- '{"location_access"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(storm_shelter #> '{"location_access"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / storm_shelter.location_access'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'storm_shelter.location_access' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"breaker_panel_location"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"breaker_panel_location"}', 'null'::jsonb) = $pid$"Garage"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / systems.breaker_panel_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.breaker_panel_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"co","installed"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"co","installed"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / systems.co.installed'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.co.installed' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"co","location"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"co","location"}', 'null'::jsonb) = $pid$"Kitchen"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / systems.co.location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.co.location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"fridge_filter"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$"Everydrop"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / systems.fridge_filter'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.fridge_filter' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"fridge_filter_5yr"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"fridge_filter_5yr"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / systems.fridge_filter_5yr'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.fridge_filter_5yr' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","batteries_changed_on"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2026-10-07"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / systems.smoke.batteries_changed_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.smoke.batteries_changed_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","battery_type"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"smoke","battery_type"}', 'null'::jsonb) = $pid$"9-Volt (Lithium)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / systems.smoke.battery_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.smoke.battery_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","brand"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"smoke","brand"}', 'null'::jsonb) = $pid$"First alert"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / systems.smoke.brand'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.smoke.brand' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_on"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"smoke","expires_on"}', 'null'::jsonb) = $pid$"2036-12-31"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / systems.smoke.expires_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.smoke.expires_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_precision"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"smoke","expires_precision"}', 'null'::jsonb) = $pid$"year"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / systems.smoke.expires_precision'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.smoke.expires_precision' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","expires_source_text"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"smoke","expires_source_text"}', 'null'::jsonb) = $pid$"2036"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / systems.smoke.expires_source_text'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.smoke.expires_source_text' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","notes"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"smoke","notes"}', 'null'::jsonb) = $pid$"N/A"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / systems.smoke.notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.smoke.notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"smoke","power_type"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"smoke","power_type"}', 'null'::jsonb) = $pid$"Hardwired"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / systems.smoke.power_type'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.smoke.power_type' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"supply_box_location"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"supply_box_location"}', 'null'::jsonb) = $pid$"Master closet top shelf"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / systems.supply_box_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.supply_box_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"supply_storage"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"supply_storage"}', 'null'::jsonb) = $pid$"Closet"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / systems.supply_storage'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.supply_storage' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"water_shutoff_indoor"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"water_shutoff_indoor"}', 'null'::jsonb) = $pid$"Closet under staircase"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / systems.water_shutoff_indoor'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.water_shutoff_indoor' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET systems = systems #- '{"water_shutoff_outdoor"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"water_shutoff_outdoor"}', 'null'::jsonb) = $pid$"Near the street"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / systems.water_shutoff_outdoor'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'systems.water_shutoff_outdoor' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"router_location"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(utilities #> '{"router_location"}', 'null'::jsonb) = $pid$"Living room"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / utilities.router_location'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'utilities.router_location' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET utilities = utilities #- '{"wifi_ssid"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(utilities #> '{"wifi_ssid"}', 'null'::jsonb) = $pid$"ARHA"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / utilities.wifi_ssid'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'utilities.wifi_ssid' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET warranty = warranty #- '{"builder_expires_on"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(warranty #> '{"builder_expires_on"}', 'null'::jsonb) = $pid$"2027-09-10"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / warranty.builder_expires_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'warranty.builder_expires_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET warranty = warranty #- '{"builder_present"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(warranty #> '{"builder_present"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / warranty.builder_present'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'warranty.builder_present' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET warranty = warranty #- '{"claim_process + external_links"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(warranty #> '{"claim_process + external_links"}', 'null'::jsonb) = $pid$"Dr. Horton- Christopher Bishop CSBishop@drhorton.com - 317-552-9067\n\n- The designated plumber, HVAC contractor, and electrician must be used for at least 2 years.\n\nWarranty request: https://www.drhorton.com/Warranty\n- The builder will arrange meetings around 8 months and 10 months after closing.\n- Fixtures: 1 year of coverage.\n- Mechanicals inside the walls: 2 years of coverage.\n- Roof: 4 years of coverage.\n- Foundation and load-bearing framing: 10 years of coverage.\n- RWC homeowner warranty exclusions: Section II, page 5.\n- RWC contact for matters beyond 2 years: 717-561-4480."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / warranty.claim_process + external_links'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'warranty.claim_process + external_links' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET warranty = warranty #- '{"furniture_expires_on"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(warranty #> '{"furniture_expires_on"}', 'null'::jsonb) = $pid$"2029-10-27"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / warranty.furniture_expires_on'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'warranty.furniture_expires_on' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"cart_count"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(waste #> '{"cart_count"}', 'null'::jsonb) = $pid$2$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / waste.cart_count'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'waste.cart_count' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"cart_notes"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(waste #> '{"cart_notes"}', 'null'::jsonb) = $pid$"2"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / waste.cart_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'waste.cart_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"holiday_notes"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(waste #> '{"holiday_notes"}', 'null'::jsonb) = $pid$"Saturday"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / waste.holiday_notes'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'waste.holiday_notes' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"recycling"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(waste #> '{"recycling"}', 'null'::jsonb) = $pid$true$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / waste.recycling'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'waste.recycling' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"recycling_days"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(waste #> '{"recycling_days"}', 'null'::jsonb) = $pid$"Every Other Friday"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / waste.recycling_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'waste.recycling_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"strict_rules"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(waste #> '{"strict_rules"}', 'null'::jsonb) = $pid$"Keep trash in enclosed cans out of street and neighbor view, don’t let it pile up, and dumping anywhere in the subdivision costs at least $150 (pickup: City of Indianapolis, 317-917-7300)."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / waste.strict_rules'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'waste.strict_rules' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"trash_days"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(waste #> '{"trash_days"}', 'null'::jsonb) = $pid$["Friday"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / waste.trash_days'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'waste.trash_days' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9211 Fitzgerald Dr. / waste.valet'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND field_key = 'waste.valet' AND note = 'PID refresh 2026-11-12';
UPDATE public.properties SET systems = systems #- '{"co"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND systems #> '{"co"}' = '{}'::jsonb;
UPDATE public.properties SET systems = systems #- '{"smoke"}', updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND systems #> '{"smoke"}' = '{}'::jsonb;

-- 9213 Anaum Ln (30D Firm)
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '9eb43a4f-5557-4041-8066-f53b42d0ffb2' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9213 Anaum Ln (30D Firm) / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '9eb43a4f-5557-4041-8066-f53b42d0ffb2' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';

-- 9235 E 133rd St S
DO $do$ BEGIN
  UPDATE public.properties SET access = access #- '{"yale_needs_calibration"}', updated_at = now() WHERE id = '792d6764-76e9-40e1-8bfc-e79b5dae44ee' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$false$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9235 E 133rd St S / access.yale_needs_calibration'; END IF;
END $do$;
DELETE FROM public.property_field_provenance WHERE property_id = '792d6764-76e9-40e1-8bfc-e79b5dae44ee' AND field_key = 'access.yale_needs_calibration' AND note = 'PID refresh 2026-11-12';
DO $do$ BEGIN
  UPDATE public.properties SET waste = waste #- '{"valet"}', updated_at = now() WHERE id = '792d6764-76e9-40e1-8bfc-e79b5dae44ee' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the refresh: %', '9235 E 133rd St S / waste.valet'; END IF;
END $do$;
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
