-- PID refresh 2026-11-12: DRY RUN OUTPUT. NOT RUN. Apply only with approval.
-- Makes exactly the proposed fills and updates in changes.csv, with provenance rows (value_source notion_pid, as_of today).
-- Each value is written only if Resolve still holds the value seen in the dry run; any difference aborts the whole file.
BEGIN;

-- 1012 Wasatch Ct (OwnerRez 425447): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'cc77a4df-0fa2-466d-bd6d-8c4217e84b03' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1012 Wasatch Ct / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cc77a4df-0fa2-466d-bd6d-8c4217e84b03', 'access.yale_needs_calibration', 'notion_pid', '6e9ad3e2-c213-427a-8ff4-7d0e7693b7dc', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 10121 E. 131st Pl. S. (OwnerRez 484588): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '4eca9876-0251-4bdc-9cd6-3c22af34fe75' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '10121 E. 131st Pl. S. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('4eca9876-0251-4bdc-9cd6-3c22af34fe75', 'access.yale_needs_calibration', 'notion_pid', '35d4658d-5f4f-8126-b4bd-f35e2dc77079', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1016 NW 191st St (OwnerRez 461754): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '14830c3b-9874-4f6b-9de7-4cd891180ba4' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1016 NW 191st St / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('14830c3b-9874-4f6b-9de7-4cd891180ba4', 'access.yale_needs_calibration', 'notion_pid', '23f4658d-5f4f-81be-bb92-dfba33cdbab5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 10302 S. 230th East Ave (OwnerRez 446094): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '93223fe9-7ef9-49a6-868d-bb3d62e298b0' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '10302 S. 230th East Ave / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('93223fe9-7ef9-49a6-868d-bb3d62e298b0', 'access.yale_needs_calibration', 'notion_pid', '18c4658d-5f4f-80b5-8a08-dce3402682b5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '93223fe9-7ef9-49a6-868d-bb3d62e298b0' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '10302 S. 230th East Ave / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('93223fe9-7ef9-49a6-868d-bb3d62e298b0', 'waste.valet', 'notion_pid', '18c4658d-5f4f-80b5-8a08-dce3402682b5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 10320 Lightning Creek Dr. (30D FIRM) (OwnerRez 401685): 3 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '39a26e33-37b5-4009-a157-a24b13aca00c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '10320 Lightning Creek Dr. (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('39a26e33-37b5-4009-a157-a24b13aca00c', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8061-a449-ced48929fc34', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"ROKU Pin: [removed — credentials are not stored in Resolve]"$pid$::jsonb, true), updated_at = now() WHERE id = '39a26e33-37b5-4009-a157-a24b13aca00c' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"ROKU Pin: See Guest Access & Credentials"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '10320 Lightning Creek Dr. (30D FIRM) / facts.tv_specs'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('39a26e33-37b5-4009-a157-a24b13aca00c', 'facts.tv_specs', 'notion_pid', '1664658d-5f4f-8061-a449-ced48929fc34', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"summary"}', $pid$"3 Car Garage. Per the HOA cars can only be parked in the garage and driveway. Max of 3 cars in driveway. NO street parking."$pid$::jsonb, true), updated_at = now() WHERE id = '39a26e33-37b5-4009-a157-a24b13aca00c' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$"3 Car Garage"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '10320 Lightning Creek Dr. (30D FIRM) / parking.summary'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('39a26e33-37b5-4009-a157-a24b13aca00c', 'parking.summary', 'notion_pid', '1664658d-5f4f-8061-a449-ced48929fc34', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1039 Swinton Way (OwnerRez 475429): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '97318d4f-137e-4647-b8e6-957836ffaa08' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1039 Swinton Way / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('97318d4f-137e-4647-b8e6-957836ffaa08', 'access.yale_needs_calibration', 'notion_pid', '2f54658d-5f4f-81e0-9113-ec6fae476863', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 105 Summit Bnd (OwnerRez 413421): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'cb686c69-2305-46ee-8d57-06a6181e4255' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '105 Summit Bnd / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cb686c69-2305-46ee-8d57-06a6181e4255', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-808f-99e3-fb8275ca263b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 10549 SE 23rd St (OwnerRez 425324): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'e51e6c1f-2a21-4b2b-a495-54b9160649e2' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '10549 SE 23rd St / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e51e6c1f-2a21-4b2b-a495-54b9160649e2', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80c0-96b0-d0c73b08c336', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1056 Wildwood Drive (OwnerRez 424809): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '9a82f157-3e48-47f4-ad58-ceca4b38fd02' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1056 Wildwood Drive / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9a82f157-3e48-47f4-ad58-ceca4b38fd02', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80ae-93af-e0d47f70fbd0', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1068 Berrywood Dr. (OwnerRez 477909): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '8f14ad4c-0264-4114-af90-848989e03521' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1068 Berrywood Dr. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8f14ad4c-0264-4114-af90-848989e03521', 'access.yale_needs_calibration', 'notion_pid', '3114658d-5f4f-81e2-be9a-f969072ba413', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 10845 Sara Ct (OwnerRez 427066): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'e6e698a1-3c38-49e4-a877-3bf00894bf21' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '10845 Sara Ct / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e6e698a1-3c38-49e4-a877-3bf00894bf21', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8021-89e1-e98a5152282b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 11109 SW 34th Terrace (OwnerRez 390700): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'c7d75c26-103e-40c0-9e0f-79d8f1fd6c94' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11109 SW 34th Terrace / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('c7d75c26-103e-40c0-9e0f-79d8f1fd6c94', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8031-a537-f88a07248ec2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 11249 Pegasus Dr. (OwnerRez 492044): 74 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"emergency_key_access"}', $pid$"Yes"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(access #> '{"emergency_key_access"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / access.emergency_key_access'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'access.emergency_key_access', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"garage_remote"}', $pid$"Genie https://www.amazon.com/dp/B0DH81245P?ref=fed_asin_title&th=1"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(access #> '{"garage_remote"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / access.garage_remote'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'access.garage_remote', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"key_storage"}', $pid$["Garage Door","Front Door/Smartlock","Front Door - Storm Door"]$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(access #> '{"key_storage"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / access.key_storage'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'access.key_storage', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"lock_brand"}', $pid$"Yale"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(access #> '{"lock_brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / access.lock_brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'access.lock_brand', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_module"}', $pid$"Connected & Setup"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / access.yale_module'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'access.yale_module', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'access.yale_needs_calibration', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"No key necessary"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / amenities.access_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'amenities.access_notes', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"list"}', $pid$["Basketball Court","Pond"]$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(amenities #> '{"list"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / amenities.list'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'amenities.list', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"grill"}', $pid$"No Grill"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(facts #> '{"grill"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / facts.grill'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'facts.grill', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"interior_paint"}', $pid$"Yes (Top shelf in the garage)"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(facts #> '{"interior_paint"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / facts.interior_paint'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'facts.interior_paint', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_locations"}', $pid$["Living Room","Primary Bedroom"]$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(facts #> '{"tv_locations"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / facts.tv_locations'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'facts.tv_locations', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"65\" Roku in Living Room, logged into Roku / 55\" Roku in Primary Bedroom, logged into Roku (Roku is also the TV brand)"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / facts.tv_specs'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'facts.tv_specs', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"workstation"}', $pid$"Yes"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(facts #> '{"workstation"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / facts.workstation'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'facts.workstation', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"fuel_type"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(fireplace #> '{"fuel_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / fireplace.fuel_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'fireplace.fuel_type', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"gas_switch"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(fireplace #> '{"gas_switch"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / fireplace.gas_switch'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'fireplace.gas_switch', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"gas_switch_location"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(fireplace #> '{"gas_switch_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / fireplace.gas_switch_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'fireplace.gas_switch_location', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"instructions"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(fireplace #> '{"instructions"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / fireplace.instructions'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'fireplace.instructions', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"model"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(fireplace #> '{"model"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / fireplace.model'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'fireplace.model', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"present"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(fireplace #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / fireplace.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'fireplace.present', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET grounds = jsonb_set(CASE WHEN jsonb_typeof(grounds) = 'object' THEN grounds ELSE '{}'::jsonb END, '{"mowing_cadence"}', $pid$"ARHA Responsible"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(grounds #> '{"mowing_cadence"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / grounds.mowing_cadence'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'grounds.mowing_cadence', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET grounds = jsonb_set(CASE WHEN jsonb_typeof(grounds) = 'object' THEN grounds ELSE '{}'::jsonb END, '{"mowing_days"}', $pid$["Tuesday"]$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(grounds #> '{"mowing_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / grounds.mowing_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'grounds.mowing_days', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hoa = jsonb_set(CASE WHEN jsonb_typeof(hoa) = 'object' THEN hoa ELSE '{}'::jsonb END, '{"notes + external_links"}', $pid$"Waterman Farms HOA: no RVs/commercial vehicles parked on the street, garage must remain usable for parking, no above-ground pools."$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(hoa #> '{"notes + external_links"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / hoa.notes + external_links'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'hoa.notes + external_links', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hoa = jsonb_set(CASE WHEN jsonb_typeof(hoa) = 'object' THEN hoa ELSE '{}'::jsonb END, '{"present"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(hoa #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / hoa.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'hoa.present', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"14x24x1\nThis air filter is not a paper filter, the filter is metal and must be rinsed and dried fully when cleaning.\nRinse the metal air filter every 90 days (more often with pets or heavy dust); no need to replace it unless damaged."$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / hvac.filter_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'hvac.filter_notes', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_sizes"}', $pid$["14x24x1"]$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(hvac #> '{"filter_sizes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / hvac.filter_sizes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'hvac.filter_sizes', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET legacy_handoff_date = (jsonb_populate_record(NULL::public.properties, $pid${"legacy_handoff_date":"2026-10-02"}$pid$::jsonb)).legacy_handoff_date, updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND to_jsonb(legacy_handoff_date) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / legacy_handoff_date'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'legacy_handoff_date', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":"3BR Home, Noblesville | Extended & Monthly Stays"}$pid$::jsonb)).listing_alias, updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND to_jsonb(listing_alias) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / listing_alias'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'listing_alias', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":"Waterman Farms"}$pid$::jsonb)).neighborhood, updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND to_jsonb(neighborhood) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / neighborhood'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'neighborhood', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"This air filter is not a paper filter, the filter is metal and must be rinsed and dried fully when cleaning.\n\nWater spicket in the backyard was repaired, however it could leak in the future over time."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'operating_notes', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"cluster_mailbox"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(parking #> '{"cluster_mailbox"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / parking.cluster_mailbox'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'parking.cluster_mailbox', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"mailbox_location"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(parking #> '{"mailbox_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / parking.mailbox_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'parking.mailbox_location', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"mailbox_number"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(parking #> '{"mailbox_number"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / parking.mailbox_number'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'parking.mailbox_number', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = jsonb_set(CASE WHEN jsonb_typeof(pool_spa) = 'object' THEN pool_spa ELSE '{}'::jsonb END, '{"present"}', $pid$"None"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(pool_spa #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / pool_spa.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'pool_spa.present', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"alarm"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(security #> '{"alarm"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / security.alarm'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'security.alarm', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"battery_type"}', $pid$["Hardwired - No Battery"]$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(security #> '{"battery_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / security.battery_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'security.battery_type', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"devices"}', $pid$["Driveway","Front Door"]$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(security #> '{"devices"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / security.devices'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'security.devices', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"monitoring_expires_on"}', $pid$"2027-10-08"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(security #> '{"monitoring_expires_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / security.monitoring_expires_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'security.monitoring_expires_on', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"monitoring_plan"}', $pid$["Active"]$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(security #> '{"monitoring_plan"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / security.monitoring_plan'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'security.monitoring_plan', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"brand"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(sprinklers #> '{"brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / sprinklers.brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'sprinklers.brand', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"controller_location"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(sprinklers #> '{"controller_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / sprinklers.controller_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'sprinklers.controller_location', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"set_for_season"}', $pid${"value":"N/A","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid"}$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(sprinklers #> '{"set_for_season"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / sprinklers.set_for_season'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'sprinklers.set_for_season', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"status"}', $pid$"Property Does Not Have Sprinkler System"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(sprinklers #> '{"status"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / sprinklers.status'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'sprinklers.status', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET storm_shelter = jsonb_set(CASE WHEN jsonb_typeof(storm_shelter) = 'object' THEN storm_shelter ELSE '{}'::jsonb END, '{"location_access"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(storm_shelter #> '{"location_access"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / storm_shelter.location_access'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'storm_shelter.location_access', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"breaker_panel_location"}', $pid$"Garage"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"breaker_panel_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / systems.breaker_panel_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.breaker_panel_location', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"co"}', CASE WHEN jsonb_typeof(systems #> '{"co"}') = 'object' THEN systems #> '{"co"}' ELSE '{}'::jsonb END, true), '{"co","installed"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"co","installed"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / systems.co.installed'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.co.installed', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"co"}', CASE WHEN jsonb_typeof(systems #> '{"co"}') = 'object' THEN systems #> '{"co"}' ELSE '{}'::jsonb END, true), '{"co","location"}', $pid$"Kitchen"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"co","location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / systems.co.location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.co.location', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter"}', $pid$"EveryDrop Filter 1 (EDR1RXD1)"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / systems.fridge_filter'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.fridge_filter', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter_5yr"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"fridge_filter_5yr"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / systems.fridge_filter_5yr'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.fridge_filter_5yr', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2026-09-21"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / systems.smoke.batteries_changed_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.smoke.batteries_changed_on', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","battery_type"}', $pid$"9-Volt (Lithium)"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"smoke","battery_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / systems.smoke.battery_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.smoke.battery_type', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","brand"}', $pid$"First Alert (7 units)"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"smoke","brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / systems.smoke.brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.smoke.brand', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_on"}', $pid$"2036-12-31"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"smoke","expires_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / systems.smoke.expires_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.smoke.expires_on', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_precision"}', $pid$"year"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"smoke","expires_precision"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / systems.smoke.expires_precision'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.smoke.expires_precision', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_source_text"}', $pid$"2036"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"smoke","expires_source_text"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / systems.smoke.expires_source_text'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.smoke.expires_source_text', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","notes"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"smoke","notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / systems.smoke.notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.smoke.notes', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","power_type"}', $pid$"Hardwired"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"smoke","power_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / systems.smoke.power_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.smoke.power_type', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"supply_box_location"}', $pid$"Top shelf of master closet"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"supply_box_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / systems.supply_box_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.supply_box_location', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"supply_storage"}', $pid$"Closet"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"supply_storage"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / systems.supply_storage'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.supply_storage', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"water_shutoff_indoor"}', $pid$"Laundry room"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"water_shutoff_indoor"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / systems.water_shutoff_indoor'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.water_shutoff_indoor', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"water_shutoff_outdoor"}', $pid$"Front yard"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(systems #> '{"water_shutoff_outdoor"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / systems.water_shutoff_outdoor'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'systems.water_shutoff_outdoor', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier, updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND to_jsonb(tier) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / tier'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'tier', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"router_location"}', $pid$"In the living room"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(utilities #> '{"router_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / utilities.router_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'utilities.router_location', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_ssid"}', $pid$"ARHA"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(utilities #> '{"wifi_ssid"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / utilities.wifi_ssid'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'utilities.wifi_ssid', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET warranty = jsonb_set(CASE WHEN jsonb_typeof(warranty) = 'object' THEN warranty ELSE '{}'::jsonb END, '{"builder_present"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(warranty #> '{"builder_present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / warranty.builder_present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'warranty.builder_present', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET warranty = jsonb_set(CASE WHEN jsonb_typeof(warranty) = 'object' THEN warranty ELSE '{}'::jsonb END, '{"claim_process + external_links"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(warranty #> '{"claim_process + external_links"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / warranty.claim_process + external_links'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'warranty.claim_process + external_links', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET warranty = jsonb_set(CASE WHEN jsonb_typeof(warranty) = 'object' THEN warranty ELSE '{}'::jsonb END, '{"furniture_expires_on"}', $pid$"2029-10-02"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(warranty #> '{"furniture_expires_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / warranty.furniture_expires_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'warranty.furniture_expires_on', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"cart_count"}', $pid$2$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(waste #> '{"cart_count"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / waste.cart_count'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'waste.cart_count', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"cart_notes"}', $pid$"2"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(waste #> '{"cart_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / waste.cart_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'waste.cart_notes', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"holiday_notes"}', $pid$"Service is delayed one day on: New Year's Day • Memorial Day • July 4th • Labor Day • Thanksgiving Day • Christmas Day"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(waste #> '{"holiday_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / waste.holiday_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'waste.holiday_notes', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"recycling"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(waste #> '{"recycling"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / waste.recycling'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'waste.recycling', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"recycling_days"}', $pid$"Every other Monday"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(waste #> '{"recycling_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / waste.recycling_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'waste.recycling_days', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"strict_rules"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(waste #> '{"strict_rules"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / waste.strict_rules'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'waste.strict_rules', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"trash_days"}', $pid$["Monday"]$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(waste #> '{"trash_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / waste.trash_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'waste.trash_days', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = 'ee4213af-ad43-4d22-b58b-105eb2b60977' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11249 Pegasus Dr. / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ee4213af-ad43-4d22-b58b-105eb2b60977', 'waste.valet', 'notion_pid', '3b54658d-5f4f-81c7-babe-d1010504b613', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 11508 E 94th Pl N (OwnerRez 454815): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '53aed118-974e-4f01-8c7d-ca901677b6d7' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11508 E 94th Pl N / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('53aed118-974e-4f01-8c7d-ca901677b6d7', 'access.yale_needs_calibration', 'notion_pid', '1eb4658d-5f4f-81fa-a697-cb68e30a9fef', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '53aed118-974e-4f01-8c7d-ca901677b6d7' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11508 E 94th Pl N / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('53aed118-974e-4f01-8c7d-ca901677b6d7', 'waste.valet', 'notion_pid', '1eb4658d-5f4f-81fa-a697-cb68e30a9fef', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 11514 S. Locust Ave (OwnerRez 425054): 3 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '75bc895c-4401-4080-9df7-748efe8f04f1' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11514 S. Locust Ave / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('75bc895c-4401-4080-9df7-748efe8f04f1', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80eb-8851-d5c58fdd8485', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '75bc895c-4401-4080-9df7-748efe8f04f1' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11514 S. Locust Ave / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('75bc895c-4401-4080-9df7-748efe8f04f1', 'waste.valet', 'notion_pid', '1664658d-5f4f-80eb-8851-d5c58fdd8485', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"The owner has a membership with \nAmerican Home Pros for annual tune ups (HVAC). For general maintenance you can try them, but from past experience, their pricing is high. \nUpdate: We have free service calls from them until July 2027 please make sure they are the first point of contact for any HVAC related issues."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '75bc895c-4401-4080-9df7-748efe8f04f1' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"The owner has a membership with \nAmerican Home Pros\n for annual tune ups (HVAC). For general maintenance you can try them, but from past experience, their pricing is high."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11514 S. Locust Ave / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('75bc895c-4401-4080-9df7-748efe8f04f1', 'operating_notes', 'notion_pid', '1664658d-5f4f-80eb-8851-d5c58fdd8485', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1152 Western Yarrow Ave (OwnerRez 419166): 8 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1152 Western Yarrow Ave / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a24773ac-4762-499f-8349-d4a1703a0af8', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_sizes"}', $pid$["20x25x4"]$pid$::jsonb, true), updated_at = now() WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND coalesce(hvac #> '{"filter_sizes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1152 Western Yarrow Ave / hvac.filter_sizes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a24773ac-4762-499f-8349-d4a1703a0af8', 'hvac.filter_sizes', 'notion_pid', '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"brand"}', $pid$"Rain bird"$pid$::jsonb, true), updated_at = now() WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND coalesce(sprinklers #> '{"brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1152 Western Yarrow Ave / sprinklers.brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a24773ac-4762-499f-8349-d4a1703a0af8', 'sprinklers.brand', 'notion_pid', '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"controller_location"}', $pid$"Garage"$pid$::jsonb, true), updated_at = now() WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND coalesce(sprinklers #> '{"controller_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1152 Western Yarrow Ave / sprinklers.controller_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a24773ac-4762-499f-8349-d4a1703a0af8', 'sprinklers.controller_location', 'notion_pid', '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"set_for_season"}', $pid${"value":"N/A","as_of":"2026-11-03T22:21:00.000Z","source":"notion_pid"}$pid$::jsonb, true), updated_at = now() WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND coalesce(sprinklers #> '{"set_for_season"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1152 Western Yarrow Ave / sprinklers.set_for_season'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a24773ac-4762-499f-8349-d4a1703a0af8', 'sprinklers.set_for_season', 'notion_pid', '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"20x25x4"$pid$::jsonb, true), updated_at = now() WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"Not Mentioned"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1152 Western Yarrow Ave / hvac.filter_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a24773ac-4762-499f-8349-d4a1703a0af8', 'hvac.filter_notes', 'notion_pid', '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"status"}', $pid$"Property Has Sprinkler System and It's On"$pid$::jsonb, true), updated_at = now() WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND coalesce(sprinklers #> '{"status"}', 'null'::jsonb) = $pid$"Property Does Not Have Sprinkler System"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1152 Western Yarrow Ave / sprinklers.status'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a24773ac-4762-499f-8349-d4a1703a0af8', 'sprinklers.status', 'notion_pid', '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2026-09-16"$pid$::jsonb, true), updated_at = now() WHERE id = 'a24773ac-4762-499f-8349-d4a1703a0af8' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2026-02-02"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1152 Western Yarrow Ave / systems.smoke.batteries_changed_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a24773ac-4762-499f-8349-d4a1703a0af8', 'systems.smoke.batteries_changed_on', 'notion_pid', '1664658d-5f4f-80ba-ac5e-d781b6b6d1c4', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1169 Blue Sky Lane (OwnerRez 418726): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '1be61e2e-6ca3-41f4-93de-2fe22f440267' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1169 Blue Sky Lane / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('1be61e2e-6ca3-41f4-93de-2fe22f440267', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8065-b0e0-f007b0cb0a2e', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2026-09-17"$pid$::jsonb, true), updated_at = now() WHERE id = '1be61e2e-6ca3-41f4-93de-2fe22f440267' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2025-10-29"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1169 Blue Sky Lane / systems.smoke.batteries_changed_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('1be61e2e-6ca3-41f4-93de-2fe22f440267', 'systems.smoke.batteries_changed_on', 'notion_pid', '1664658d-5f4f-8065-b0e0-f007b0cb0a2e', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 11720 NW 136th Ter (OwnerRez 405661): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '5e230772-bbb1-4558-86c9-46e6ad024d3d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11720 NW 136th Ter / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('5e230772-bbb1-4558-86c9-46e6ad024d3d', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-800c-9cc0-cec2660b0c20', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 11736 SW 15th Terr (30D Firm) (OwnerRez 443819): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '70d06d5c-d358-4452-ac9a-1fa22b68ce20' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '11736 SW 15th Terr (30D Firm) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('70d06d5c-d358-4452-ac9a-1fa22b68ce20', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-806f-a9f6-fcb8aa8698f4', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1215 N Elder Ave (OwnerRez 409727): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '7a65ee79-900e-414d-a496-bb2077d6046c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1215 N Elder Ave / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('7a65ee79-900e-414d-a496-bb2077d6046c', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8027-9f1c-dae1dbd47770', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '7a65ee79-900e-414d-a496-bb2077d6046c' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1215 N Elder Ave / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('7a65ee79-900e-414d-a496-bb2077d6046c', 'waste.valet', 'notion_pid', '1664658d-5f4f-8027-9f1c-dae1dbd47770', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 13117 NE 9th St (OwnerRez 427725): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'bd5becd5-c66c-4691-8b41-1a62eac826e0' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '13117 NE 9th St / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bd5becd5-c66c-4691-8b41-1a62eac826e0', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8010-b31e-d9bf0bdf834c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 13317 Brampton Way (OwnerRez 437182): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '5dd44c1d-65f8-465e-b29e-fa8f8ba3e617' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '13317 Brampton Way / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('5dd44c1d-65f8-465e-b29e-fa8f8ba3e617', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-802e-83b4-f53ae83fd63a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 13325 E 43rd Pl S (OwnerRez 428972): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'c92c13e5-27d8-4f4e-b0e8-59638169a140' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '13325 E 43rd Pl S / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('c92c13e5-27d8-4f4e-b0e8-59638169a140', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80c1-996a-f7b3cad4084f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = 'c92c13e5-27d8-4f4e-b0e8-59638169a140' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '13325 E 43rd Pl S / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('c92c13e5-27d8-4f4e-b0e8-59638169a140', 'waste.valet', 'notion_pid', '1664658d-5f4f-80c1-996a-f7b3cad4084f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 136 Magnolia Estates St (OwnerRez 433281): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'e7f578f0-4000-4a80-b6d0-70bf2bc45122' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '136 Magnolia Estates St / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e7f578f0-4000-4a80-b6d0-70bf2bc45122', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8008-bbe8-f5c98ca070dd', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2026-09-04"$pid$::jsonb, true), updated_at = now() WHERE id = 'e7f578f0-4000-4a80-b6d0-70bf2bc45122' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2025-08-13"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '136 Magnolia Estates St / systems.smoke.batteries_changed_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e7f578f0-4000-4a80-b6d0-70bf2bc45122', 'systems.smoke.batteries_changed_on', 'notion_pid', '1664658d-5f4f-8008-bbe8-f5c98ca070dd', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1399 Foxtail Ln. (OwnerRez 494863): 83 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"emergency_key_access"}', $pid$"Yes"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(access #> '{"emergency_key_access"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / access.emergency_key_access'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'access.emergency_key_access', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"garage_remote"}', $pid$"LiftMaster"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(access #> '{"garage_remote"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / access.garage_remote'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'access.garage_remote', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"key_storage"}', $pid$["Mailbox","Front Door/Smartlock","Backdoor","Storage Closet","Back Door - Storm Door"]$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(access #> '{"key_storage"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / access.key_storage'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'access.key_storage', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"lock_brand"}', $pid$"Yale"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(access #> '{"lock_brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / access.lock_brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'access.lock_brand', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_integration_live"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / access.yale_integration_live'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'access.yale_integration_live', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_module"}', $pid$"Connected & Setup"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / access.yale_module'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'access.yale_module', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'access.yale_needs_calibration', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"The CC&Rs do not list specific amenities, access instructions, or fees. The neighborhood ponds are for drainage and views only; swimming, ice skating, and boating are not permitted."$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / amenities.access_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'amenities.access_notes', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"list"}', $pid$["Pond"]$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(amenities #> '{"list"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / amenities.list'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'amenities.list', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET compliance = jsonb_set(CASE WHEN jsonb_typeof(compliance) = 'object' THEN compliance ELSE '{}'::jsonb END, '{"permit_status"}', $pid${"text":"No permit required for Greenwood, IN","as_of":"2026-11-05T17:51:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(compliance #> '{"permit_status"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / compliance.permit_status'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'compliance.permit_status', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET compliance = jsonb_set(CASE WHEN jsonb_typeof(compliance) = 'object' THEN compliance ELSE '{}'::jsonb END, '{"rental_restrictions"}', $pid${"text":"No STR rental restrictions","as_of":"2026-11-05T17:51:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(compliance #> '{"rental_restrictions"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / compliance.rental_restrictions'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'compliance.rental_restrictions', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = jsonb_set(CASE WHEN jsonb_typeof(external_refs) = 'object' THEN external_refs ELSE '{}'::jsonb END, '{"breezeway_url"}', $pid$"https://app.breezeway.io/property/1494604/profile"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / external_refs.breezeway_url'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'external_refs.breezeway_url', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"grill"}', $pid$"No Grill"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(facts #> '{"grill"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / facts.grill'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'facts.grill', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"interior_paint"}', $pid$"Unknown. No extra paint left"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(facts #> '{"interior_paint"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / facts.interior_paint'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'facts.interior_paint', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_locations"}', $pid$["Living Room","Primary Bedroom"]$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(facts #> '{"tv_locations"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / facts.tv_locations'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'facts.tv_locations', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"55\" Roku QLED TV in Primary Bedroom, logged into Roku. 65\" Roku QLED TV in Living Room, logged into Roku."$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / facts.tv_specs'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'facts.tv_specs', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"workstation"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(facts #> '{"workstation"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / facts.workstation'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'facts.workstation', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"fuel_type"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(fireplace #> '{"fuel_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / fireplace.fuel_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'fireplace.fuel_type', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"gas_switch"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(fireplace #> '{"gas_switch"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / fireplace.gas_switch'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'fireplace.gas_switch', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"gas_switch_location"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(fireplace #> '{"gas_switch_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / fireplace.gas_switch_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'fireplace.gas_switch_location', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"instructions"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(fireplace #> '{"instructions"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / fireplace.instructions'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'fireplace.instructions', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"model"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(fireplace #> '{"model"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / fireplace.model'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'fireplace.model', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"present"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(fireplace #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / fireplace.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'fireplace.present', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / furniture_package'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'furniture_package', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET grounds = jsonb_set(CASE WHEN jsonb_typeof(grounds) = 'object' THEN grounds ELSE '{}'::jsonb END, '{"mowing_cadence"}', $pid$"ARHA Responsible"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(grounds #> '{"mowing_cadence"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / grounds.mowing_cadence'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'grounds.mowing_cadence', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET grounds = jsonb_set(CASE WHEN jsonb_typeof(grounds) = 'object' THEN grounds ELSE '{}'::jsonb END, '{"mowing_days"}', $pid$["Monday"]$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(grounds #> '{"mowing_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / grounds.mowing_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'grounds.mowing_days', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hoa = jsonb_set(CASE WHEN jsonb_typeof(hoa) = 'object' THEN hoa ELSE '{}'::jsonb END, '{"notes + external_links"}', $pid$"The HOA for Lone Pine Farms is administered by Ardsley Management, which can be reached at (317) 253-1401 or via email at indianapolisinfo@drhorton.com."$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(hoa #> '{"notes + external_links"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / hoa.notes + external_links'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'hoa.notes + external_links', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hoa = jsonb_set(CASE WHEN jsonb_typeof(hoa) = 'object' THEN hoa ELSE '{}'::jsonb END, '{"present"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(hoa #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / hoa.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'hoa.present', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"1 -16×25×4"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / hvac.filter_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'hvac.filter_notes', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_sizes"}', $pid$["16x25x4"]$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(hvac #> '{"filter_sizes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / hvac.filter_sizes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'hvac.filter_sizes', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":"Cozy 4BR Home | Greenwood | Pet Friendly"}$pid$::jsonb)).listing_alias, updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND to_jsonb(listing_alias) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / listing_alias'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'listing_alias', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET market = (jsonb_populate_record(NULL::public.properties, $pid${"market":"Indy"}$pid$::jsonb)).market, updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND to_jsonb(market) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / market'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'market', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":"Lone Pine Farms"}$pid$::jsonb)).neighborhood, updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND to_jsonb(neighborhood) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / neighborhood'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'neighborhood', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"Foxtail Hollow (1399)"}$pid$::jsonb)).nickname, updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / nickname'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'nickname', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"No"}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'operating_notes', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"cluster_mailbox"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(parking #> '{"cluster_mailbox"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / parking.cluster_mailbox'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'parking.cluster_mailbox', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"mailbox_location"}', $pid$"The cluster mailbox #1399 is at the corner of Foxtail Ln and Sumatran Ln, a short walk east of the house. Key is located inside the lock box on the garage trim."$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(parking #> '{"mailbox_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / parking.mailbox_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'parking.mailbox_location', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"mailbox_number"}', $pid$"1399"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(parking #> '{"mailbox_number"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / parking.mailbox_number'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'parking.mailbox_number', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"summary"}', $pid$"2 Car Garage\nFree Parking on Premises"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / parking.summary'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'parking.summary', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = jsonb_set(CASE WHEN jsonb_typeof(pool_spa) = 'object' THEN pool_spa ELSE '{}'::jsonb END, '{"present"}', $pid$"None"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(pool_spa #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / pool_spa.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'pool_spa.present', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"alarm"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(security #> '{"alarm"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / security.alarm'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'security.alarm', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"battery_type"}', $pid$["Hardwired - No Battery"]$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(security #> '{"battery_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / security.battery_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'security.battery_type', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"devices"}', $pid$["Front Door","Driveway"]$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(security #> '{"devices"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / security.devices'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'security.devices', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"monitoring_expires_on"}', $pid$"2027-11-15"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(security #> '{"monitoring_expires_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / security.monitoring_expires_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'security.monitoring_expires_on', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"monitoring_plan"}', $pid$["Active"]$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(security #> '{"monitoring_plan"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / security.monitoring_plan'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'security.monitoring_plan', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"brand"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(sprinklers #> '{"brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / sprinklers.brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'sprinklers.brand', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"controller_location"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(sprinklers #> '{"controller_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / sprinklers.controller_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'sprinklers.controller_location', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"set_for_season"}', $pid${"value":"N/A","as_of":"2026-11-05T17:51:00.000Z","source":"notion_pid"}$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(sprinklers #> '{"set_for_season"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / sprinklers.set_for_season'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'sprinklers.set_for_season', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"status"}', $pid$"Property Does Not Have Sprinkler System"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(sprinklers #> '{"status"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / sprinklers.status'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'sprinklers.status', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET storm_shelter = jsonb_set(CASE WHEN jsonb_typeof(storm_shelter) = 'object' THEN storm_shelter ELSE '{}'::jsonb END, '{"location_access"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(storm_shelter #> '{"location_access"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / storm_shelter.location_access'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'storm_shelter.location_access', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"breaker_panel_location"}', $pid$"Garage"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"breaker_panel_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / systems.breaker_panel_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.breaker_panel_location', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"co"}', CASE WHEN jsonb_typeof(systems #> '{"co"}') = 'object' THEN systems #> '{"co"}' ELSE '{}'::jsonb END, true), '{"co","installed"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"co","installed"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / systems.co.installed'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.co.installed', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"co"}', CASE WHEN jsonb_typeof(systems #> '{"co"}') = 'object' THEN systems #> '{"co"}' ELSE '{}'::jsonb END, true), '{"co","location"}', $pid$"Kitchen"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"co","location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / systems.co.location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.co.location', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter"}', $pid$"EDR1RXD1 (Everydrop Filter 1 / Whirlpool W10295370A compatible)"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / systems.fridge_filter'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.fridge_filter', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter_5yr"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"fridge_filter_5yr"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / systems.fridge_filter_5yr'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.fridge_filter_5yr', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2026-10-22"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / systems.smoke.batteries_changed_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.smoke.batteries_changed_on', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","battery_type"}', $pid$"9-Volt (Lithium)"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"smoke","battery_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / systems.smoke.battery_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.smoke.battery_type', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","brand"}', $pid$"First alert"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"smoke","brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / systems.smoke.brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.smoke.brand', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_on"}', $pid$"2034-12-31"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"smoke","expires_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / systems.smoke.expires_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.smoke.expires_on', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_precision"}', $pid$"year"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"smoke","expires_precision"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / systems.smoke.expires_precision'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.smoke.expires_precision', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_source_text"}', $pid$"2034"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"smoke","expires_source_text"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / systems.smoke.expires_source_text'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.smoke.expires_source_text', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","notes"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"smoke","notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / systems.smoke.notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.smoke.notes', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","power_type"}', $pid$"Hardwired"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"smoke","power_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / systems.smoke.power_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.smoke.power_type', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"supply_box_location"}', $pid$"Top shelf of Master closet"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"supply_box_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / systems.supply_box_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.supply_box_location', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"supply_storage"}', $pid$"Closet"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"supply_storage"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / systems.supply_storage'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.supply_storage', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"water_shutoff_indoor"}', $pid$"Closet with furnace"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"water_shutoff_indoor"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / systems.water_shutoff_indoor'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.water_shutoff_indoor', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"water_shutoff_outdoor"}', $pid$"Near sidewalk"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(systems #> '{"water_shutoff_outdoor"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / systems.water_shutoff_outdoor'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'systems.water_shutoff_outdoor', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier, updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND to_jsonb(tier) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / tier'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'tier', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"router_location"}', $pid$"Living room"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(utilities #> '{"router_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / utilities.router_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'utilities.router_location', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_split_confirmed"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / utilities.wifi_split_confirmed'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'utilities.wifi_split_confirmed', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_ssid"}', $pid$"ARHA"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(utilities #> '{"wifi_ssid"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / utilities.wifi_ssid'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'utilities.wifi_ssid', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET warranty = jsonb_set(CASE WHEN jsonb_typeof(warranty) = 'object' THEN warranty ELSE '{}'::jsonb END, '{"builder_present"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(warranty #> '{"builder_present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / warranty.builder_present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'warranty.builder_present', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET warranty = jsonb_set(CASE WHEN jsonb_typeof(warranty) = 'object' THEN warranty ELSE '{}'::jsonb END, '{"claim_process + external_links"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(warranty #> '{"claim_process + external_links"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / warranty.claim_process + external_links'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'warranty.claim_process + external_links', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET warranty = jsonb_set(CASE WHEN jsonb_typeof(warranty) = 'object' THEN warranty ELSE '{}'::jsonb END, '{"furniture_expires_on"}', $pid$"2029-11-04"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(warranty #> '{"furniture_expires_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / warranty.furniture_expires_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'warranty.furniture_expires_on', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"cart_count"}', $pid$2$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(waste #> '{"cart_count"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / waste.cart_count'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'waste.cart_count', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"cart_notes"}', $pid$"2 trash cans and 1 recycling"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(waste #> '{"cart_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / waste.cart_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'waste.cart_notes', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"holiday_notes"}', $pid$"If one of the following holidays falls on a Monday through Thursday, trash pickup will be delayed by one day one day: New Year's Day • Memorial Day • July 4th • Labor Day • Thanksgiving Day • Christmas Day"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(waste #> '{"holiday_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / waste.holiday_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'waste.holiday_notes', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"recycling"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(waste #> '{"recycling"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / waste.recycling'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'waste.recycling', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"recycling_days"}', $pid$"Every other Thursday."$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(waste #> '{"recycling_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / waste.recycling_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'waste.recycling_days', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"strict_rules"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(waste #> '{"strict_rules"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / waste.strict_rules'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'waste.strict_rules', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"trash_days"}', $pid$["Thursday"]$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(waste #> '{"trash_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / waste.trash_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'waste.trash_days', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'waste.valet', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2024}$pid$::jsonb)).year_built, updated_at = now() WHERE id = 'bacd3693-5a52-4ec0-a560-1281aadac37e' AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1399 Foxtail Ln. / year_built'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bacd3693-5a52-4ec0-a560-1281aadac37e', 'year_built', 'notion_pid', '3cd4658d-5f4f-81df-84f6-c86be890ede9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 14553 Serrano Ridge Rd (OwnerRez 423193): 3 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'dafa6257-99d1-4a71-9e18-b02394c6807d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '14553 Serrano Ridge Rd / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('dafa6257-99d1-4a71-9e18-b02394c6807d', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80a5-88d4-ec54ad9b0530', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"garage_remote"}', $pid$"LiftMaster 380 UT"$pid$::jsonb, true), updated_at = now() WHERE id = 'dafa6257-99d1-4a71-9e18-b02394c6807d' AND coalesce(access #> '{"garage_remote"}', 'null'::jsonb) = $pid$"LiftMaster 38OUT"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '14553 Serrano Ridge Rd / access.garage_remote'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('dafa6257-99d1-4a71-9e18-b02394c6807d', 'access.garage_remote', 'notion_pid', '1664658d-5f4f-80a5-88d4-ec54ad9b0530', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2026-09-08"$pid$::jsonb, true), updated_at = now() WHERE id = 'dafa6257-99d1-4a71-9e18-b02394c6807d' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2025-10-16"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '14553 Serrano Ridge Rd / systems.smoke.batteries_changed_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('dafa6257-99d1-4a71-9e18-b02394c6807d', 'systems.smoke.batteries_changed_on', 'notion_pid', '1664658d-5f4f-80a5-88d4-ec54ad9b0530', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1464 Buckland Ct. (OwnerRez 496703): 12 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_integration_live"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1464 Buckland Ct. / access.yale_integration_live'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'access.yale_integration_live', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1464 Buckland Ct. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'access.yale_needs_calibration', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET compliance = jsonb_set(CASE WHEN jsonb_typeof(compliance) = 'object' THEN compliance ELSE '{}'::jsonb END, '{"permit_status"}', $pid${"text":"No permit required for Avon, IN","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb, true), updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND coalesce(compliance #> '{"permit_status"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1464 Buckland Ct. / compliance.permit_status'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'compliance.permit_status', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET compliance = jsonb_set(CASE WHEN jsonb_typeof(compliance) = 'object' THEN compliance ELSE '{}'::jsonb END, '{"rental_restrictions"}', $pid${"text":"No STR rental restrictions","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb, true), updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND coalesce(compliance #> '{"rental_restrictions"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1464 Buckland Ct. / compliance.rental_restrictions'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'compliance.rental_restrictions', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = jsonb_set(CASE WHEN jsonb_typeof(external_refs) = 'object' THEN external_refs ELSE '{}'::jsonb END, '{"breezeway_url"}', $pid$"https://app.breezeway.io/property/1509882/profile"$pid$::jsonb, true), updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1464 Buckland Ct. / external_refs.breezeway_url'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'external_refs.breezeway_url', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1464 Buckland Ct. / furniture_package'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'furniture_package', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET market = (jsonb_populate_record(NULL::public.properties, $pid${"market":"Indy"}$pid$::jsonb)).market, updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND to_jsonb(market) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1464 Buckland Ct. / market'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'market', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"The Buckland Blue (1464)"}$pid$::jsonb)).nickname, updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1464 Buckland Ct. / nickname'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'nickname', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"summary"}', $pid$"2 Car Garage\nFree Parking on Premises"$pid$::jsonb, true), updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1464 Buckland Ct. / parking.summary'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'parking.summary', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier, updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND to_jsonb(tier) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1464 Buckland Ct. / tier'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'tier', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_split_confirmed"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1464 Buckland Ct. / utilities.wifi_split_confirmed'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'utilities.wifi_split_confirmed', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2021}$pid$::jsonb)).year_built, updated_at = now() WHERE id = '61d75516-d1ea-43b4-a8f9-f2476393c516' AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1464 Buckland Ct. / year_built'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'year_built', 'notion_pid', '3de4658d-5f4f-8176-be3a-d04c90c313a7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 15226 High Timber Ln (OwnerRez 463600): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '4cf72297-dd39-4c26-b7ad-006a38923d1b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '15226 High Timber Ln / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('4cf72297-dd39-4c26-b7ad-006a38923d1b', 'access.yale_needs_calibration', 'notion_pid', '2544658d-5f4f-8180-baab-f761378a104a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 15701 E 75th Pl N (OwnerRez 418086): 3 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'eeb11e56-921e-4f30-95ef-f044b21b85c2' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '15701 E 75th Pl N / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('eeb11e56-921e-4f30-95ef-f044b21b85c2', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80ad-b194-d8d87cdbda74', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = 'eeb11e56-921e-4f30-95ef-f044b21b85c2' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '15701 E 75th Pl N / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('eeb11e56-921e-4f30-95ef-f044b21b85c2', 'waste.valet', 'notion_pid', '1664658d-5f4f-80ad-b194-d8d87cdbda74', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_module"}', $pid$"Connected & Setup"$pid$::jsonb, true), updated_at = now() WHERE id = 'eeb11e56-921e-4f30-95ef-f044b21b85c2' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$"Not Connected"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '15701 E 75th Pl N / access.yale_module'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('eeb11e56-921e-4f30-95ef-f044b21b85c2', 'access.yale_module', 'notion_pid', '1664658d-5f4f-80ad-b194-d8d87cdbda74', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 15905 Sky Run Dr. (OwnerRez 342579): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '10ba8ab8-a497-4a28-b5b7-7d5b01b78782' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '15905 Sky Run Dr. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('10ba8ab8-a497-4a28-b5b7-7d5b01b78782', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8034-b764-fba973c5fbd6', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1600 E Quantico St (OwnerRez 407261): 3 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = 'cf867f48-f4df-4710-9e49-10bb17b41ed4' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1600 E Quantico St / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cf867f48-f4df-4710-9e49-10bb17b41ed4', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80f9-988d-d0d7a4f962ac', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = 'cf867f48-f4df-4710-9e49-10bb17b41ed4' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1600 E Quantico St / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cf867f48-f4df-4710-9e49-10bb17b41ed4', 'waste.valet', 'notion_pid', '1664658d-5f4f-80f9-988d-d0d7a4f962ac', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"Smart TV ROKU Pin: [removed — credentials are not stored in Resolve]"$pid$::jsonb, true), updated_at = now() WHERE id = 'cf867f48-f4df-4710-9e49-10bb17b41ed4' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"Smart TV ROKU Pin: See Guest Access & Credentials"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1600 E Quantico St / facts.tv_specs'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cf867f48-f4df-4710-9e49-10bb17b41ed4', 'facts.tv_specs', 'notion_pid', '1664658d-5f4f-80f9-988d-d0d7a4f962ac', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 16216 Whistle Creek (30D Firm) (OwnerRez 398530): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '7e4f8893-7b8d-482c-9906-455fa8cd6367' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '16216 Whistle Creek (30D Firm) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('7e4f8893-7b8d-482c-9906-455fa8cd6367', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80b4-9d5b-e0c516a01679', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1636 NE 32nd St. (OwnerRez 405885): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '8f21dd67-0732-413a-9fa3-67ec2e59e7bf' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1636 NE 32nd St. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8f21dd67-0732-413a-9fa3-67ec2e59e7bf', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80c2-b6e1-f0e8b29f13b2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1640 Glade Meadows Dr (OwnerRez 432973): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '62a2d14c-0081-425f-943c-1b2de5bddf70' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1640 Glade Meadows Dr / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('62a2d14c-0081-425f-943c-1b2de5bddf70', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8098-9f60-d96914149212', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 16401 Villa Valeria Way (30D FIRM) (OwnerRez 443111): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'a28336e4-ebd6-4af4-8786-f5d7c8eab058' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '16401 Villa Valeria Way (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a28336e4-ebd6-4af4-8786-f5d7c8eab058', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-806a-85f9-e73bd50971f8', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1700 NW 179th Ter (30D FIRM) (OwnerRez 349772): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '047e01ba-eb27-42a3-be1b-eab929f8b970' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1700 NW 179th Ter (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('047e01ba-eb27-42a3-be1b-eab929f8b970', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80a4-9b13-fd712c880266', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1700 Whispering Creek Dr (OwnerRez 348274): 3 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '96e08138-1c9e-4297-8da8-a6ae1a2f52d7' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1700 Whispering Creek Dr / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('96e08138-1c9e-4297-8da8-a6ae1a2f52d7', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80df-84c1-de33f73dc3ee', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '96e08138-1c9e-4297-8da8-a6ae1a2f52d7' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1700 Whispering Creek Dr / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('96e08138-1c9e-4297-8da8-a6ae1a2f52d7', 'operating_notes', 'notion_pid', '1664658d-5f4f-80df-84c1-de33f73dc3ee', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"ROKU Pin: [removed — credentials are not stored in Resolve]\nROKU Email: \ncdunham1119@gmail.com"$pid$::jsonb, true), updated_at = now() WHERE id = '96e08138-1c9e-4297-8da8-a6ae1a2f52d7' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"ROKU Pin: See Guest Access & Credentials\nROKU Email: \ncdunham1119@gmail.com"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1700 Whispering Creek Dr / facts.tv_specs'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('96e08138-1c9e-4297-8da8-a6ae1a2f52d7', 'facts.tv_specs', 'notion_pid', '1664658d-5f4f-80df-84c1-de33f73dc3ee', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1701 Park Lane Dr. (OwnerRez 349771): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '549229b6-9f29-4c3d-a74b-3746500d56f4' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1701 Park Lane Dr. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('549229b6-9f29-4c3d-a74b-3746500d56f4', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8071-a135-dda211d15f06', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1722 Westchester Dr (OwnerRez 480829): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'c2dfe50d-2428-4cfe-b6d7-ca54578a17d1' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1722 Westchester Dr / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('c2dfe50d-2428-4cfe-b6d7-ca54578a17d1', 'access.yale_needs_calibration', 'notion_pid', '3184658d-5f4f-80a7-bae8-f6d0a003b669', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'c2dfe50d-2428-4cfe-b6d7-ca54578a17d1' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1722 Westchester Dr / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('c2dfe50d-2428-4cfe-b6d7-ca54578a17d1', 'operating_notes', 'notion_pid', '3184658d-5f4f-80a7-bae8-f6d0a003b669', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 17404 Zinc Dr. (OwnerRez 347787): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '7f279df3-ca27-49ba-bac8-2393b1fc427c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '17404 Zinc Dr. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('7f279df3-ca27-49ba-bac8-2393b1fc427c', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-806a-a87f-e55c333e71ad', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 18000 Barracho Dr (30D) (OwnerRez 349766): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'c0e2b66a-4394-4aa4-b6c5-a9ed4ec6d317' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '18000 Barracho Dr (30D) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('c0e2b66a-4394-4aa4-b6c5-a9ed4ec6d317', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-807b-bedc-ecce285596ab', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 18104 Calle Way (12M) (OwnerRez 393830): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'e267cab0-6d67-4295-a12a-43a1be6f4f47' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '18104 Calle Way (12M) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e267cab0-6d67-4295-a12a-43a1be6f4f47', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80ca-8233-ee76f0f197ba', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 18200 Bodegon Rd. (12M) (OwnerRez 349767): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '8554f577-3b7d-4819-8b6d-d5cfbaede637' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '18200 Bodegon Rd. (12M) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8554f577-3b7d-4819-8b6d-d5cfbaede637', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-806c-a83a-eeb25cfc0e0c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 18205 Allora Dr. (12M) (OwnerRez 349774): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '5ff5ee5c-1d5b-4cad-a178-6ed53220614c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '18205 Allora Dr. (12M) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('5ff5ee5c-1d5b-4cad-a178-6ed53220614c', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80a6-b79f-c54d0e07cbd1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 19013 Meadows Crossing (30D FIRM) (OwnerRez 349773): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '307e57dc-3f45-4ad2-98d3-358769feccb9' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '19013 Meadows Crossing (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('307e57dc-3f45-4ad2-98d3-358769feccb9', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80fc-9d89-d98edbdd0870', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 19021 Meadows Crossing (30D FIRM) (OwnerRez 348272): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '7b04bb27-ed86-4e5d-a406-d1265ca67ca3' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '19021 Meadows Crossing (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('7b04bb27-ed86-4e5d-a406-d1265ca67ca3', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8079-b795-fc1db1956be2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 1908 E Urbana St (OwnerRez 460239): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'ed21dc09-34d2-4c7b-9d1b-2d5eb561a4a7' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1908 E Urbana St / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ed21dc09-34d2-4c7b-9d1b-2d5eb561a4a7', 'access.yale_needs_calibration', 'notion_pid', '22b4658d-5f4f-811b-8ff1-f97bb9697ba5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = 'ed21dc09-34d2-4c7b-9d1b-2d5eb561a4a7' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '1908 E Urbana St / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ed21dc09-34d2-4c7b-9d1b-2d5eb561a4a7', 'waste.valet', 'notion_pid', '22b4658d-5f4f-811b-8ff1-f97bb9697ba5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 19104 Meadows Crossings (OwnerRez 340884): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '1d949a24-c216-4e3c-9290-c08997fe688d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '19104 Meadows Crossings / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('1d949a24-c216-4e3c-9290-c08997fe688d', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8041-89f0-f9a03af55afa', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '1d949a24-c216-4e3c-9290-c08997fe688d' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '19104 Meadows Crossings / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('1d949a24-c216-4e3c-9290-c08997fe688d', 'operating_notes', 'notion_pid', '1664658d-5f4f-8041-89f0-f9a03af55afa', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 19117 Meadows Crossing (30D FIRM) (OwnerRez 348614): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'ce75f670-ff56-4c14-8159-5072b6d31bc7' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '19117 Meadows Crossing (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ce75f670-ff56-4c14-8159-5072b6d31bc7', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-803d-94ec-fbc71706bc20', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'ce75f670-ff56-4c14-8159-5072b6d31bc7' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '19117 Meadows Crossing (30D FIRM) / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ce75f670-ff56-4c14-8159-5072b6d31bc7', 'operating_notes', 'notion_pid', '1664658d-5f4f-803d-94ec-fbc71706bc20', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 19120 Meadows Crossing (OwnerRez 347789): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '4b4fdb62-fc3e-4a83-ba0a-391fac682f1d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '19120 Meadows Crossing / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('4b4fdb62-fc3e-4a83-ba0a-391fac682f1d', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-808e-b16e-e84c1ce41ed9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '4b4fdb62-fc3e-4a83-ba0a-391fac682f1d' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '19120 Meadows Crossing / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('4b4fdb62-fc3e-4a83-ba0a-391fac682f1d', 'operating_notes', 'notion_pid', '1664658d-5f4f-808e-b16e-e84c1ce41ed9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2004 Cedar Ridge Rd. (OwnerRez 480827): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'de4a6e71-6fd8-4c4a-8d58-b935c4173e1f' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2004 Cedar Ridge Rd. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('de4a6e71-6fd8-4c4a-8d58-b935c4173e1f', 'access.yale_needs_calibration', 'notion_pid', '3184658d-5f4f-8091-8112-fad5a8380da7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'de4a6e71-6fd8-4c4a-8d58-b935c4173e1f' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2004 Cedar Ridge Rd. / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('de4a6e71-6fd8-4c4a-8d58-b935c4173e1f', 'operating_notes', 'notion_pid', '3184658d-5f4f-8091-8112-fad5a8380da7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2008 Ladera Ln (OwnerRez 460413): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'faf5d78e-7f51-479c-9296-1c314fad3c6a' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2008 Ladera Ln / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('faf5d78e-7f51-479c-9296-1c314fad3c6a', 'access.yale_needs_calibration', 'notion_pid', '22d4658d-5f4f-81bb-ac2d-c584f788125b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2012 W Black Powder Way (OwnerRez 397054): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'c78fb035-de41-40a6-b4bd-1a4384e28e2e' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2012 W Black Powder Way / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('c78fb035-de41-40a6-b4bd-1a4384e28e2e', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8095-9183-e4b39374b8db', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2014 E 52nd St (OwnerRez 409665): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '8e4dec0f-78d4-4dcb-86e5-e0ea2dd5584f' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2014 E 52nd St / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8e4dec0f-78d4-4dcb-86e5-e0ea2dd5584f', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80e9-9065-f53cb89d7ef0', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '8e4dec0f-78d4-4dcb-86e5-e0ea2dd5584f' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2014 E 52nd St / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8e4dec0f-78d4-4dcb-86e5-e0ea2dd5584f', 'waste.valet', 'notion_pid', '1664658d-5f4f-80e9-9065-f53cb89d7ef0', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2016 NW 172nd St (OwnerRez 461756): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'f3e7d069-bd48-4c6f-94f2-153159dc6b6c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2016 NW 172nd St / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('f3e7d069-bd48-4c6f-94f2-153159dc6b6c', 'access.yale_needs_calibration', 'notion_pid', '23f4658d-5f4f-814f-9768-fb10cbb40bf0', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2017 W. Flintlock Way (OwnerRez 446400): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '604f62a1-ee82-4b97-afae-0ad9c8afabbc' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2017 W. Flintlock Way / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('604f62a1-ee82-4b97-afae-0ad9c8afabbc', 'access.yale_needs_calibration', 'notion_pid', '18c4658d-5f4f-8082-8b0e-c81a2d7390b7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 207 High Point Way (OwnerRez 440621): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'ed684fea-2b58-4264-8b43-ca5e1dd8f3cf' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '207 High Point Way / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ed684fea-2b58-4264-8b43-ca5e1dd8f3cf', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-801b-ad3d-ea5c3bdd2322', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2100 Liberty Way Dr. (OwnerRez 487357): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'e5c41afe-3bb6-418b-92ea-2cbf9b565c95' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2100 Liberty Way Dr. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e5c41afe-3bb6-418b-92ea-2cbf9b565c95', 'access.yale_needs_calibration', 'notion_pid', '37c4658d-5f4f-81c3-92d3-fb702f9d5b13', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 220 SW 167th St. (30D FIRM) (OwnerRez 430528): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '08ed7d90-7ac4-4089-9939-537222300c66' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '220 SW 167th St. (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('08ed7d90-7ac4-4089-9939-537222300c66', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80de-a335-d8a050be35d8', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2208 E. Toledo St. (OwnerRez 483306): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '532ad15b-6f1d-428c-8eba-f1b49c887dc6' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2208 E. Toledo St. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('532ad15b-6f1d-428c-8eba-f1b49c887dc6', 'access.yale_needs_calibration', 'notion_pid', '34f4658d-5f4f-8150-82c2-d9f0f1d7ffc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2259 Summer Shore Dr (OwnerRez 484127): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '27e6f3a9-32e8-471f-932d-eb52891f4526' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2259 Summer Shore Dr / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('27e6f3a9-32e8-471f-932d-eb52891f4526', 'access.yale_needs_calibration', 'notion_pid', '3584658d-5f4f-8187-98b9-d7cfb7a9f442', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2321 NW 158th (30D) (OwnerRez 375242): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '03d37544-36aa-485f-ba40-900c58451836' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2321 NW 158th (30D) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('03d37544-36aa-485f-ba40-900c58451836', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8048-9de7-c38bdba8b099', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2332 Los Angeles Ave (OwnerRez 429765): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = 'c11cb85a-380f-416e-98d1-15add30737e7' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2332 Los Angeles Ave / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('c11cb85a-380f-416e-98d1-15add30737e7', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80b1-962b-d2113a545baa', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 236 N. Starnes St. (30D FIRM) (OwnerRez 483140): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '3e33a82f-0ad2-4659-9d47-a59f72c01a7b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '236 N. Starnes St. (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('3e33a82f-0ad2-4659-9d47-a59f72c01a7b', 'access.yale_needs_calibration', 'notion_pid', '3184658d-5f4f-8084-bdf2-d4679493ddbb', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"key_storage"}', $pid$["N/A","Front Door/Smartlock","Backdoor"]$pid$::jsonb, true), updated_at = now() WHERE id = '3e33a82f-0ad2-4659-9d47-a59f72c01a7b' AND coalesce(access #> '{"key_storage"}', 'null'::jsonb) = $pid$["N/A"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '236 N. Starnes St. (30D FIRM) / access.key_storage'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('3e33a82f-0ad2-4659-9d47-a59f72c01a7b', 'access.key_storage', 'notion_pid', '3184658d-5f4f-8084-bdf2-d4679493ddbb', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2414 W. Kingsport Ct. S (OwnerRez 467225): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '6cb09c34-f77a-4795-bb16-1e3a3fe87f4c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2414 W. Kingsport Ct. S / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('6cb09c34-f77a-4795-bb16-1e3a3fe87f4c', 'access.yale_needs_calibration', 'notion_pid', '28b4658d-5f4f-8075-a7c1-e435d1e9ac0a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 250 Springfield Xing (OwnerRez 497213): 12 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_integration_live"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '250 Springfield Xing / access.yale_integration_live'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'access.yale_integration_live', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '250 Springfield Xing / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'access.yale_needs_calibration', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET compliance = jsonb_set(CASE WHEN jsonb_typeof(compliance) = 'object' THEN compliance ELSE '{}'::jsonb END, '{"permit_status"}', $pid${"text":"No permit required for Greenfield, IN","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb, true), updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND coalesce(compliance #> '{"permit_status"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '250 Springfield Xing / compliance.permit_status'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'compliance.permit_status', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET compliance = jsonb_set(CASE WHEN jsonb_typeof(compliance) = 'object' THEN compliance ELSE '{}'::jsonb END, '{"rental_restrictions"}', $pid${"text":"No STR rental restrictions","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb, true), updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND coalesce(compliance #> '{"rental_restrictions"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '250 Springfield Xing / compliance.rental_restrictions'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'compliance.rental_restrictions', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = jsonb_set(CASE WHEN jsonb_typeof(external_refs) = 'object' THEN external_refs ELSE '{}'::jsonb END, '{"breezeway_url"}', $pid$"https://app.breezeway.io/property/1514895/profile"$pid$::jsonb, true), updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '250 Springfield Xing / external_refs.breezeway_url'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'external_refs.breezeway_url', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '250 Springfield Xing / furniture_package'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'furniture_package', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET market = (jsonb_populate_record(NULL::public.properties, $pid${"market":"Indy"}$pid$::jsonb)).market, updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND to_jsonb(market) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '250 Springfield Xing / market'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'market', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"Springfield Sanctuary (250)"}$pid$::jsonb)).nickname, updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '250 Springfield Xing / nickname'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'nickname', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"summary"}', $pid$"3 Car Garage\nFree Parking on Premises"$pid$::jsonb, true), updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '250 Springfield Xing / parking.summary'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'parking.summary', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier, updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND to_jsonb(tier) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '250 Springfield Xing / tier'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'tier', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_split_confirmed"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '250 Springfield Xing / utilities.wifi_split_confirmed'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'utilities.wifi_split_confirmed', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2026}$pid$::jsonb)).year_built, updated_at = now() WHERE id = 'ada9100f-26ec-4277-9fe5-9d05792aff70' AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '250 Springfield Xing / year_built'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'year_built', 'notion_pid', '3e44658d-5f4f-81ea-90d9-fae89cf6579c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2522 S Irvington Ave (OwnerRez 410055): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'b5ca6769-c083-4091-b185-d887ff8c7323' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2522 S Irvington Ave / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('b5ca6769-c083-4091-b185-d887ff8c7323', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80a4-9dcb-e87b971a650f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = 'b5ca6769-c083-4091-b185-d887ff8c7323' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2522 S Irvington Ave / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('b5ca6769-c083-4091-b185-d887ff8c7323', 'waste.valet', 'notion_pid', '1664658d-5f4f-80a4-9dcb-e87b971a650f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2525 Fallview Dr. (OwnerRez 367954): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = 'e9706c22-70c6-4b78-8115-11895877b69b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2525 Fallview Dr. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e9706c22-70c6-4b78-8115-11895877b69b', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-802e-8977-f19aa933d245', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2527 NE 15th St (OwnerRez 453185): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '632db464-d193-4671-96cd-1b899a8f2a1a' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2527 NE 15th St / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('632db464-d193-4671-96cd-1b899a8f2a1a', 'access.yale_needs_calibration', 'notion_pid', '1d74658d-5f4f-80b4-8012-e5d6e9e7ca53', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_ssid"}', $pid$"ARHA"$pid$::jsonb, true), updated_at = now() WHERE id = '632db464-d193-4671-96cd-1b899a8f2a1a' AND coalesce(utilities #> '{"wifi_ssid"}', 'null'::jsonb) = $pid$"Arealhomeaway"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2527 NE 15th St / utilities.wifi_ssid'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('632db464-d193-4671-96cd-1b899a8f2a1a', 'utilities.wifi_ssid', 'notion_pid', '1d74658d-5f4f-80b4-8012-e5d6e9e7ca53', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2536 NW 116th (12M) (OwnerRez 349768): 29 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"emergency_key_access"}', $pid$"Yes"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(access #> '{"emergency_key_access"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / access.emergency_key_access'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'access.emergency_key_access', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"garage_remote"}', $pid$"Unknown"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(access #> '{"garage_remote"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / access.garage_remote'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'access.garage_remote', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_module"}', $pid$"Not Applicable (Not Yale)"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / access.yale_module'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'access.yale_module', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"grill"}', $pid$"No Grill"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(facts #> '{"grill"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / facts.grill'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'facts.grill', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"interior_paint"}', $pid$"Unsure"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(facts #> '{"interior_paint"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / facts.interior_paint'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'facts.interior_paint', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"present"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(fireplace #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / fireplace.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'fireplace.present', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_sizes"}', $pid$["16x30x1","14x20x1"]$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(hvac #> '{"filter_sizes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / hvac.filter_sizes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'hvac.filter_sizes', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":"Unsure"}$pid$::jsonb)).neighborhood, updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND to_jsonb(neighborhood) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / neighborhood'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'neighborhood', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"status"}', $pid$"Property Does Not Have Sprinkler System"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(sprinklers #> '{"status"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / sprinklers.status'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'sprinklers.status', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"breaker_panel_location"}', $pid$"Garage"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"breaker_panel_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / systems.breaker_panel_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.breaker_panel_location', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"co"}', CASE WHEN jsonb_typeof(systems #> '{"co"}') = 'object' THEN systems #> '{"co"}' ELSE '{}'::jsonb END, true), '{"co","installed"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"co","installed"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / systems.co.installed'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.co.installed', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"co"}', CASE WHEN jsonb_typeof(systems #> '{"co"}') = 'object' THEN systems #> '{"co"}' ELSE '{}'::jsonb END, true), '{"co","location"}', $pid$"Kitchen"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"co","location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / systems.co.location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.co.location', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter_5yr"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"fridge_filter_5yr"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / systems.fridge_filter_5yr'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.fridge_filter_5yr', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2026-09-22"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / systems.smoke.batteries_changed_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.smoke.batteries_changed_on', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","battery_type"}', $pid$"9-Volt (Alkaline)"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"smoke","battery_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / systems.smoke.battery_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.smoke.battery_type', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","brand"}', $pid$"First Alert"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"smoke","brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / systems.smoke.brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.smoke.brand', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_on"}', $pid$"2030-12-31"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"smoke","expires_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / systems.smoke.expires_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.smoke.expires_on', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_precision"}', $pid$"year"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"smoke","expires_precision"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / systems.smoke.expires_precision'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.smoke.expires_precision', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_source_text"}', $pid$"2030"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"smoke","expires_source_text"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / systems.smoke.expires_source_text'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.smoke.expires_source_text', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","notes"}', $pid$"None"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"smoke","notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / systems.smoke.notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.smoke.notes', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","power_type"}', $pid$"Battery Powered"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"smoke","power_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / systems.smoke.power_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.smoke.power_type', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"supply_box_location"}', $pid$"Na"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"supply_box_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / systems.supply_box_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.supply_box_location', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"supply_storage"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"supply_storage"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / systems.supply_storage'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.supply_storage', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"water_shutoff_outdoor"}', $pid$"At curb"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"water_shutoff_outdoor"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / systems.water_shutoff_outdoor'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.water_shutoff_outdoor', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"workstation"}', $pid$"Not Mentioned"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(facts #> '{"workstation"}', 'null'::jsonb) = $pid$"No"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / facts.workstation'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'facts.workstation', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"16x30x1 and 14x20x1"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"Not Mentioned"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / hvac.filter_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'hvac.filter_notes', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"summary"}', $pid$"On Property Garage (\nNo more Information\n)"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$"On Property Garage (No more Information)"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / parking.summary'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'parking.summary', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter"}', $pid$"HAF-CIN"$pid$::jsonb, true), updated_at = now() WHERE id = 'a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$"Not Mentioned"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2536 NW 116th (12M) / systems.fridge_filter'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('a3aaffe1-2ffc-41d4-bf9f-f58cdd8ddcf2', 'systems.fridge_filter', 'notion_pid', '1664658d-5f4f-80cd-b8f1-e1ede5224c97', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2601 W 65th St S (OwnerRez 501998): 10 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_integration_live"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2601 W 65th St S / access.yale_integration_live'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'access.yale_integration_live', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2601 W 65th St S / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'access.yale_needs_calibration', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = jsonb_set(CASE WHEN jsonb_typeof(external_refs) = 'object' THEN external_refs ELSE '{}'::jsonb END, '{"breezeway_url"}', $pid$"https://app.breezeway.io/property/1564238/profile"$pid$::jsonb, true), updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2601 W 65th St S / external_refs.breezeway_url'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'external_refs.breezeway_url', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2601 W 65th St S / furniture_package'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'furniture_package', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET market = (jsonb_populate_record(NULL::public.properties, $pid${"market":"Tulsa"}$pid$::jsonb)).market, updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND to_jsonb(market) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2601 W 65th St S / market'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'market', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"Hillside Hollow (2601)"}$pid$::jsonb)).nickname, updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2601 W 65th St S / nickname'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'nickname', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"summary"}', $pid$"2 Car Garage\nFree Parking on Premises"$pid$::jsonb, true), updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2601 W 65th St S / parking.summary'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'parking.summary', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier, updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND to_jsonb(tier) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2601 W 65th St S / tier'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'tier', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_split_confirmed"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2601 W 65th St S / utilities.wifi_split_confirmed'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'utilities.wifi_split_confirmed', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2026}$pid$::jsonb)).year_built, updated_at = now() WHERE id = '0b993bf6-d685-4d93-bd2b-6f803708314a' AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2601 W 65th St S / year_built'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'year_built', 'notion_pid', '4134658d-5f4f-813e-b405-e425343a2cd2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2608 SE 38th St (OwnerRez 432985): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '4ba15ebf-075e-4233-96ab-235dacedd069' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2608 SE 38th St / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('4ba15ebf-075e-4233-96ab-235dacedd069', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8052-bf77-e61ad310f50b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2617 W Madison St. (OwnerRez 406964): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '47a804ef-0d9e-4a81-8eb9-6c2b261e1313' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2617 W Madison St. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('47a804ef-0d9e-4a81-8eb9-6c2b261e1313', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80f2-89f8-d8b081d5bdc2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '47a804ef-0d9e-4a81-8eb9-6c2b261e1313' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2617 W Madison St. / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('47a804ef-0d9e-4a81-8eb9-6c2b261e1313', 'waste.valet', 'notion_pid', '1664658d-5f4f-80f2-89f8-d8b081d5bdc2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2701 Berkshire Way (OwnerRez 380978): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'ffb07311-c1d2-47f2-8759-8d66b9c4efbf' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2701 Berkshire Way / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ffb07311-c1d2-47f2-8759-8d66b9c4efbf', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8089-ab3c-e3a3359a5ece', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2817 Hazel Hollow (OwnerRez 474143): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '956cc7c9-1193-409c-a2ab-9bd2fc312646' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2817 Hazel Hollow / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('956cc7c9-1193-409c-a2ab-9bd2fc312646', 'access.yale_needs_calibration', 'notion_pid', '2e84658d-5f4f-81ac-8dab-c2270877a1ab', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"There are two returns inside the house. However, those are not getting used. There is a big 5 inch filter in the attic that the owner only wants changed.\nDo not install filters in the house."$pid$::jsonb, true), updated_at = now() WHERE id = '956cc7c9-1193-409c-a2ab-9bd2fc312646' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"There are two returns inside the house. However, those are not getting used. There is a big 5 inch filter in the attic that the owner only wants changed.\nDo not install these filters in the house:\n  • 20x30x1 - 1 \n  • 14x14x1 - 1"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2817 Hazel Hollow / hvac.filter_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('956cc7c9-1193-409c-a2ab-9bd2fc312646', 'hvac.filter_notes', 'notion_pid', '2e84658d-5f4f-81ac-8dab-c2270877a1ab', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2901 E. 75th St. (OwnerRez 480826): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'e0178350-7c7b-43e4-b11d-0bd8c15cee9e' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2901 E. 75th St. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0178350-7c7b-43e4-b11d-0bd8c15cee9e', 'access.yale_needs_calibration', 'notion_pid', '3184658d-5f4f-80ed-8a8b-fb074766880d', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'e0178350-7c7b-43e4-b11d-0bd8c15cee9e' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact.nown"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2901 E. 75th St. / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0178350-7c7b-43e4-b11d-0bd8c15cee9e', 'operating_notes', 'notion_pid', '3184658d-5f4f-80ed-8a8b-fb074766880d', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 2913 NW 188th St (30D FIRM) (OwnerRez 343538): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'b9f146b2-8320-4808-ae37-425500031a70' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '2913 NW 188th St (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('b9f146b2-8320-4808-ae37-425500031a70', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-801d-b7d5-c6d272030324', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3000 Meriweather Rd (30D) (OwnerRez 351100): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '0c03c4c8-d142-4d56-b73d-22806e0bd511' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3000 Meriweather Rd (30D) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0c03c4c8-d142-4d56-b73d-22806e0bd511', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80fe-8445-ccf04ba87fcf', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3000 W Charlotte St (OwnerRez 411823): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '08fe042b-2dad-4487-b515-a38ab3ad07d8' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3000 W Charlotte St / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('08fe042b-2dad-4487-b515-a38ab3ad07d8', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80de-a1e9-e38d00273370', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '08fe042b-2dad-4487-b515-a38ab3ad07d8' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3000 W Charlotte St / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('08fe042b-2dad-4487-b515-a38ab3ad07d8', 'waste.valet', 'notion_pid', '1664658d-5f4f-80de-a1e9-e38d00273370', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3012 Piper St (OwnerRez 451638): 3 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '4e2f9e8b-dd08-4381-9cab-c3664a4bdad8' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3012 Piper St / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('4e2f9e8b-dd08-4381-9cab-c3664a4bdad8', 'access.yale_needs_calibration', 'notion_pid', '1c24658d-5f4f-804f-8acc-ddc2000707a8', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"1: 14x30x1 & 91-005\n\nThere is a 16x25x4 filter inside the unit in the attic. this needs to be changed every 6 months. (it was changed on Sep 2026 by Silver Creek)"$pid$::jsonb, true), updated_at = now() WHERE id = '4e2f9e8b-dd08-4381-9cab-c3664a4bdad8' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"1: 14x30x1"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3012 Piper St / hvac.filter_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('4e2f9e8b-dd08-4381-9cab-c3664a4bdad8', 'hvac.filter_notes', 'notion_pid', '1c24658d-5f4f-804f-8acc-ddc2000707a8', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_sizes"}', $pid$["14x30x1","16x25x4"]$pid$::jsonb, true), updated_at = now() WHERE id = '4e2f9e8b-dd08-4381-9cab-c3664a4bdad8' AND coalesce(hvac #> '{"filter_sizes"}', 'null'::jsonb) = $pid$["14x30x1"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3012 Piper St / hvac.filter_sizes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('4e2f9e8b-dd08-4381-9cab-c3664a4bdad8', 'hvac.filter_sizes', 'notion_pid', '1c24658d-5f4f-804f-8acc-ddc2000707a8', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3029 NW 181st (OwnerRez 347550): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'd1bfd0f9-789c-40c2-b1cf-2ecd97239dc9' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3029 NW 181st / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('d1bfd0f9-789c-40c2-b1cf-2ecd97239dc9', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8086-8eb5-dc9df55a74b5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'd1bfd0f9-789c-40c2-b1cf-2ecd97239dc9' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3029 NW 181st / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('d1bfd0f9-789c-40c2-b1cf-2ecd97239dc9', 'operating_notes', 'notion_pid', '1664658d-5f4f-8086-8eb5-dc9df55a74b5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3040 NW 183rd St. (30D FIRM) (OwnerRez 388604): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '6b32409d-98f4-4491-9069-0c3823599755' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3040 NW 183rd St. (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('6b32409d-98f4-4491-9069-0c3823599755', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80ae-8217-e3a02b42882c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter"}', $pid$"GF-841 ( HAF-QIN/EXP)"$pid$::jsonb, true), updated_at = now() WHERE id = '6b32409d-98f4-4491-9069-0c3823599755' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$"GF-841"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3040 NW 183rd St. (30D FIRM) / systems.fridge_filter'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('6b32409d-98f4-4491-9069-0c3823599755', 'systems.fridge_filter', 'notion_pid', '1664658d-5f4f-80ae-8217-e3a02b42882c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 305 W 7th St. (OwnerRez 479698): 4 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '5e1e71c9-939b-4d06-89a9-f92087160994' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '305 W 7th St. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('5e1e71c9-939b-4d06-89a9-f92087160994', 'access.yale_needs_calibration', 'notion_pid', '3264658d-5f4f-813a-90b9-c65a8f95eabd', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"Living Room - 305 W 7th ST - 65\nPrimary bedroom- 65"$pid$::jsonb, true), updated_at = now() WHERE id = '5e1e71c9-939b-4d06-89a9-f92087160994' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"Living Room - 305 W 7th ST - 65"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '305 W 7th St. / facts.tv_specs'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('5e1e71c9-939b-4d06-89a9-f92087160994', 'facts.tv_specs', 'notion_pid', '3264658d-5f4f-813a-90b9-c65a8f95eabd', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"14x14x1 - 2 locations  dining and primary bedroom \n20x25x1 hallway"$pid$::jsonb, true), updated_at = now() WHERE id = '5e1e71c9-939b-4d06-89a9-f92087160994' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"14x14x1 - 2 locations \n20x25x1"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '305 W 7th St. / hvac.filter_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('5e1e71c9-939b-4d06-89a9-f92087160994', 'hvac.filter_notes', 'notion_pid', '3264658d-5f4f-813a-90b9-c65a8f95eabd', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter"}', $pid$"Frigidaire FPPWFU01"$pid$::jsonb, true), updated_at = now() WHERE id = '5e1e71c9-939b-4d06-89a9-f92087160994' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$"Frigidaire"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '305 W 7th St. / systems.fridge_filter'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('5e1e71c9-939b-4d06-89a9-f92087160994', 'systems.fridge_filter', 'notion_pid', '3264658d-5f4f-813a-90b9-c65a8f95eabd', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 309 Prince John Dr (OwnerRez 440620): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '6cf841a3-8b95-4919-80d1-d9701ba5ffc7' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '309 Prince John Dr / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('6cf841a3-8b95-4919-80d1-d9701ba5ffc7', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80bd-ae79-f1967c95d15a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2026-10-15"$pid$::jsonb, true), updated_at = now() WHERE id = '6cf841a3-8b95-4919-80d1-d9701ba5ffc7' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2025-12-03"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '309 Prince John Dr / systems.smoke.batteries_changed_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('6cf841a3-8b95-4919-80d1-d9701ba5ffc7', 'systems.smoke.batteries_changed_on', 'notion_pid', '1664658d-5f4f-80bd-ae79-f1967c95d15a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3117 Scissortail Way (30D FIRM) (OwnerRez 440216): 3 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'f8fd08cd-4043-4bb6-83f4-30a726437f08' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3117 Scissortail Way (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('f8fd08cd-4043-4bb6-83f4-30a726437f08', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-806a-847d-d3f6046ef2a0', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET compliance = jsonb_set(CASE WHEN jsonb_typeof(compliance) = 'object' THEN compliance ELSE '{}'::jsonb END, '{"rental_restrictions"}', $pid${"text":"No STR rental restrictions","as_of":"2026-11-11T18:51:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb, true), updated_at = now() WHERE id = 'f8fd08cd-4043-4bb6-83f4-30a726437f08' AND coalesce(compliance #> '{"rental_restrictions"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3117 Scissortail Way (30D FIRM) / compliance.rental_restrictions'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('f8fd08cd-4043-4bb6-83f4-30a726437f08', 'compliance.rental_restrictions', 'notion_pid', '1664658d-5f4f-806a-847d-d3f6046ef2a0', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET storm_shelter = jsonb_set(CASE WHEN jsonb_typeof(storm_shelter) = 'object' THEN storm_shelter ELSE '{}'::jsonb END, '{"location_access"}', $pid$"Garage - use provided pin: [removed — credentials are not stored in Resolve] depress button to slide door open"$pid$::jsonb, true), updated_at = now() WHERE id = 'f8fd08cd-4043-4bb6-83f4-30a726437f08' AND coalesce(storm_shelter #> '{"location_access"}', 'null'::jsonb) = $pid$"Garage -use provided pin to depress button to slide door open depress button to slide door open"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3117 Scissortail Way (30D FIRM) / storm_shelter.location_access'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('f8fd08cd-4043-4bb6-83f4-30a726437f08', 'storm_shelter.location_access', 'notion_pid', '1664658d-5f4f-806a-847d-d3f6046ef2a0', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 31445 Moore Rd. (OwnerRez 487894): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'de9bbef4-e04a-4b8b-b7da-bf1a54862831' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '31445 Moore Rd. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('de9bbef4-e04a-4b8b-b7da-bf1a54862831', 'access.yale_needs_calibration', 'notion_pid', '3794658d-5f4f-8184-86ea-f40666b58221', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3200 Birmingham Dr (OwnerRez 419860): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '3f2b0d24-9317-49ed-aa05-1cd16ce82673' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3200 Birmingham Dr / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('3f2b0d24-9317-49ed-aa05-1cd16ce82673', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8051-ad82-c5a9c995c5e0', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3201 Belmont Circle (OwnerRez 479957): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'bd9b524c-a688-4455-9458-ecb744ec47e9' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3201 Belmont Circle / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bd9b524c-a688-4455-9458-ecb744ec47e9', 'access.yale_needs_calibration', 'notion_pid', '3224658d-5f4f-80c7-a598-dd8d8587f2a8', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 33 Center Lane S (OwnerRez 480825): 5 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '33 Center Lane S / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('03258673-f2bd-49c6-9e14-537c6439bc5d', 'access.yale_needs_calibration', 'notion_pid', '3184658d-5f4f-80a6-8a27-f6d45b671a7f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"lock_brand"}', $pid$"Schlage at side door."$pid$::jsonb, true), updated_at = now() WHERE id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND coalesce(access #> '{"lock_brand"}', 'null'::jsonb) = $pid$"Yale at side door, Schlage at front door"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '33 Center Lane S / access.lock_brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('03258673-f2bd-49c6-9e14-537c6439bc5d', 'access.lock_brand', 'notion_pid', '3184658d-5f4f-80a6-8a27-f6d45b671a7f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_module"}', $pid$"Not Applicable (Not Yale)"$pid$::jsonb, true), updated_at = now() WHERE id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$"Not Connected"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '33 Center Lane S / access.yale_module'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('03258673-f2bd-49c6-9e14-537c6439bc5d', 'access.yale_module', 'notion_pid', '3184658d-5f4f-80a6-8a27-f6d45b671a7f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"Carlton Landing requires all vehicles to be registered through the link found  - \nhere \n. The passcode: [removed — credentials are not stored in Resolve] will use in the form is \n250570\n. Unregistered cars can be ticketed or towed, so please take care of this ahead of time.\n\nThe above information is included in the Breezeway Parking Guidelines."$pid$::jsonb, true), updated_at = now() WHERE id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"Carlton Landing requires all vehicles to be registered through the link found  - here .The passcode: See Guest Access & Credentials will use in the form is 250570. Unregistered cars can be ticketed or towed, so please take care of this ahead of time.\n\nThe above information is included in the Breezeway Parking Guidelines."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '33 Center Lane S / amenities.access_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('03258673-f2bd-49c6-9e14-537c6439bc5d', 'amenities.access_notes', 'notion_pid', '3184658d-5f4f-80a6-8a27-f6d45b671a7f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"NO PETS ALLOWED\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '03258673-f2bd-49c6-9e14-537c6439bc5d' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '33 Center Lane S / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('03258673-f2bd-49c6-9e14-537c6439bc5d', 'operating_notes', 'notion_pid', '3184658d-5f4f-80a6-8a27-f6d45b671a7f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3316 NW 176th (OwnerRez 350572): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '301a0990-5c55-4d71-acd1-0d64f6e6b162' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3316 NW 176th / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('301a0990-5c55-4d71-acd1-0d64f6e6b162', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-801b-a66d-cb8f41ee47de', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '301a0990-5c55-4d71-acd1-0d64f6e6b162' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3316 NW 176th / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('301a0990-5c55-4d71-acd1-0d64f6e6b162', 'operating_notes', 'notion_pid', '1664658d-5f4f-801b-a66d-cb8f41ee47de', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3333 Welling Rd (OwnerRez 437940): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '56cf44ac-918b-4bc6-bdc2-83a5d9e83bf6' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3333 Welling Rd / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('56cf44ac-918b-4bc6-bdc2-83a5d9e83bf6', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80ef-a395-c33fe22d5f7e', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3361 E 153rd St S (OwnerRez 502215): 10 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_integration_live"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3361 E 153rd St S / access.yale_integration_live'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'access.yale_integration_live', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3361 E 153rd St S / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'access.yale_needs_calibration', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = jsonb_set(CASE WHEN jsonb_typeof(external_refs) = 'object' THEN external_refs ELSE '{}'::jsonb END, '{"breezeway_url"}', $pid$"https://app.breezeway.io/property/1565707/profile"$pid$::jsonb, true), updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3361 E 153rd St S / external_refs.breezeway_url'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'external_refs.breezeway_url', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3361 E 153rd St S / furniture_package'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'furniture_package', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET market = (jsonb_populate_record(NULL::public.properties, $pid${"market":"Tulsa"}$pid$::jsonb)).market, updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND to_jsonb(market) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3361 E 153rd St S / market'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'market', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"The Bixby Bloom (3361)"}$pid$::jsonb)).nickname, updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3361 E 153rd St S / nickname'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'nickname', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"summary"}', $pid$"2 Car Garage\nFree Parking on Premises"$pid$::jsonb, true), updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3361 E 153rd St S / parking.summary'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'parking.summary', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier, updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND to_jsonb(tier) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3361 E 153rd St S / tier'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'tier', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_split_confirmed"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3361 E 153rd St S / utilities.wifi_split_confirmed'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'utilities.wifi_split_confirmed', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2026}$pid$::jsonb)).year_built, updated_at = now() WHERE id = 'cef6cc5e-9c71-4110-9261-6165c75d1adc' AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3361 E 153rd St S / year_built'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'year_built', 'notion_pid', '4144658d-5f4f-817e-8d6e-f73a23669876', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3400 N Fern Avenue (OwnerRez 499899): 11 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_integration_live"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3400 N Fern Avenue / access.yale_integration_live'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'access.yale_integration_live', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3400 N Fern Avenue / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'access.yale_needs_calibration', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET compliance = jsonb_set(CASE WHEN jsonb_typeof(compliance) = 'object' THEN compliance ELSE '{}'::jsonb END, '{"rental_restrictions"}', $pid${"text":"No STR rental restrictions","as_of":"2026-11-06T21:06:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb, true), updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND coalesce(compliance #> '{"rental_restrictions"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3400 N Fern Avenue / compliance.rental_restrictions'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'compliance.rental_restrictions', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = jsonb_set(CASE WHEN jsonb_typeof(external_refs) = 'object' THEN external_refs ELSE '{}'::jsonb END, '{"breezeway_url"}', $pid$"https://app.breezeway.io/property/1542591/profile"$pid$::jsonb, true), updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3400 N Fern Avenue / external_refs.breezeway_url'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'external_refs.breezeway_url', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3400 N Fern Avenue / furniture_package'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'furniture_package', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET market = (jsonb_populate_record(NULL::public.properties, $pid${"market":"Tulsa"}$pid$::jsonb)).market, updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND to_jsonb(market) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3400 N Fern Avenue / market'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'market', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"Fernstone House (3400)"}$pid$::jsonb)).nickname, updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3400 N Fern Avenue / nickname'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'nickname', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"summary"}', $pid$"2 Car Garage\nFree Parking on Premises"$pid$::jsonb, true), updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3400 N Fern Avenue / parking.summary'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'parking.summary', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier, updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND to_jsonb(tier) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3400 N Fern Avenue / tier'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'tier', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_split_confirmed"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3400 N Fern Avenue / utilities.wifi_split_confirmed'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'utilities.wifi_split_confirmed', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2026}$pid$::jsonb)).year_built, updated_at = now() WHERE id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d' AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3400 N Fern Avenue / year_built'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'year_built', 'notion_pid', '4014658d-5f4f-8182-9509-ea66dacba30f', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3405 NW 159th Ter (OwnerRez 434333): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'ae9220a0-758b-4f06-9895-ad84fbf6b700' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3405 NW 159th Ter / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ae9220a0-758b-4f06-9895-ad84fbf6b700', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-806a-b0b3-d0f7fb106326', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 341 Thistlewood Dr (OwnerRez 462238): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = 'ddd71d00-acda-4feb-91cd-e0d86f38ddb4' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '341 Thistlewood Dr / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ddd71d00-acda-4feb-91cd-e0d86f38ddb4', 'access.yale_needs_calibration', 'notion_pid', '2464658d-5f4f-8164-a9a8-eef1718f6588', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = 'ddd71d00-acda-4feb-91cd-e0d86f38ddb4' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '341 Thistlewood Dr / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ddd71d00-acda-4feb-91cd-e0d86f38ddb4', 'waste.valet', 'notion_pid', '2464658d-5f4f-8164-a9a8-eef1718f6588', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3613 Upland Ridge Dr. (OwnerRez 401684): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'fe424d6a-c98d-4cea-a626-33b088667d9d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3613 Upland Ridge Dr. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('fe424d6a-c98d-4cea-a626-33b088667d9d', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-805b-8805-f1142d97e86a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3712 N 39th St. (OwnerRez 418090): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '6cafc523-773b-4933-8d3d-9fbfa978e304' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3712 N 39th St. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('6cafc523-773b-4933-8d3d-9fbfa978e304', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80d9-948b-f82d93a6e95c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '6cafc523-773b-4933-8d3d-9fbfa978e304' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3712 N 39th St. / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('6cafc523-773b-4933-8d3d-9fbfa978e304', 'waste.valet', 'notion_pid', '1664658d-5f4f-80d9-948b-f82d93a6e95c', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3715 W 109th St S (OwnerRez 460190): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'f3d27f76-bc0a-48c5-acd6-a7a82001671a' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3715 W 109th St S / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('f3d27f76-bc0a-48c5-acd6-a7a82001671a', 'access.yale_needs_calibration', 'notion_pid', '22d4658d-5f4f-81f4-ba7a-c217f0e98163', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"Netflix guest profile code: [removed — credentials are not stored in Resolve]\nHiSense Smart TV's (living room & downstairs game room, no Roku details). \nLogin information: [removed — credentials are not stored in Resolve] the netflix account *Please do not share with guests* email: marc@compasspoints.net Password: [removed — credentials are not stored in Resolve]"$pid$::jsonb, true), updated_at = now() WHERE id = 'f3d27f76-bc0a-48c5-acd6-a7a82001671a' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"Netflix guest profile code: See Guest Access & Credentials\nHiSense Smart TV's (living room & downstairs game room, no Roku details). \nLogin information: held by the owner — not stored in Resolve the netflix account *Please do not share with guests* email: marc@compasspoints.net Password: held by the owner — not stored in Resolve"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3715 W 109th St S / facts.tv_specs'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('f3d27f76-bc0a-48c5-acd6-a7a82001671a', 'facts.tv_specs', 'notion_pid', '22d4658d-5f4f-81f4-ba7a-c217f0e98163', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 3915 W 104th St. S. (OwnerRez 492465): 68 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"emergency_key_access"}', $pid$"Yes"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(access #> '{"emergency_key_access"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / access.emergency_key_access'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'access.emergency_key_access', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"garage_remote"}', $pid$"Chamberlain - https://www.amazon.com/dp/B08CNKBTYJ?ref=fed_asin_title&th=1"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(access #> '{"garage_remote"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / access.garage_remote'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'access.garage_remote', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"key_storage"}', $pid$["Front Door/Smartlock","Backdoor","Garage Door"]$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(access #> '{"key_storage"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / access.key_storage'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'access.key_storage', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"lock_brand"}', $pid$"Yale"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(access #> '{"lock_brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / access.lock_brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'access.lock_brand', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_module"}', $pid$"Connected & Setup"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / access.yale_module'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'access.yale_module', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'access.yale_needs_calibration', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / amenities.access_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'amenities.access_notes', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"list"}', $pid$["Pool","Pond","Walking Trail"]$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(amenities #> '{"list"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / amenities.list'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'amenities.list', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"grill"}', $pid$"No Grill"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(facts #> '{"grill"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / facts.grill'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'facts.grill', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"interior_paint"}', $pid$"1. Location & quantity -laundry room 11 cans of exterior paint  2- 5 gallons of interior wall\nPaint. Sherwin Williams \n2. Brand - sherwin williams \n3. Color name & code -NA \n4. Sheen - satin \n5. Style/location of paint - exterior"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(facts #> '{"interior_paint"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / facts.interior_paint'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'facts.interior_paint', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_locations"}', $pid$["Living Room","Primary Bedroom"]$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(facts #> '{"tv_locations"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / facts.tv_locations'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'facts.tv_locations', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"Living room - 3915 W 104th St - 65, Primary bedroom - 3915 W 104th St - 55"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / facts.tv_specs'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'facts.tv_specs', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"workstation"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(facts #> '{"workstation"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / facts.workstation'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'facts.workstation', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"fuel_type"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(fireplace #> '{"fuel_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / fireplace.fuel_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'fireplace.fuel_type', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"gas_switch"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(fireplace #> '{"gas_switch"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / fireplace.gas_switch'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'fireplace.gas_switch', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"gas_switch_location"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(fireplace #> '{"gas_switch_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / fireplace.gas_switch_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'fireplace.gas_switch_location', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"instructions"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(fireplace #> '{"instructions"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / fireplace.instructions'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'fireplace.instructions', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"model"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(fireplace #> '{"model"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / fireplace.model'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'fireplace.model', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"present"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(fireplace #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / fireplace.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'fireplace.present', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET grounds = jsonb_set(CASE WHEN jsonb_typeof(grounds) = 'object' THEN grounds ELSE '{}'::jsonb END, '{"mowing_cadence"}', $pid$"ARHA Responsible"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(grounds #> '{"mowing_cadence"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / grounds.mowing_cadence'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'grounds.mowing_cadence', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET grounds = jsonb_set(CASE WHEN jsonb_typeof(grounds) = 'object' THEN grounds ELSE '{}'::jsonb END, '{"mowing_days"}', $pid$["Tuesday"]$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(grounds #> '{"mowing_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / grounds.mowing_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'grounds.mowing_days', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hoa = jsonb_set(CASE WHEN jsonb_typeof(hoa) = 'object' THEN hoa ELSE '{}'::jsonb END, '{"notes + external_links"}', $pid$"HOA Contact: Green Country HOA Email: greencountryhoa@gmail.com\n\nHOA approval for exterior changes, keep RVs/boats/trailers in the garage, wood privacy fences only (6 ft, not past front line), no clotheslines, and keep the yard maintained."$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(hoa #> '{"notes + external_links"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / hoa.notes + external_links'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'hoa.notes + external_links', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hoa = jsonb_set(CASE WHEN jsonb_typeof(hoa) = 'object' THEN hoa ELSE '{}'::jsonb END, '{"present"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(hoa #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / hoa.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'hoa.present', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"14-30-1"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / hvac.filter_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'hvac.filter_notes', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":"Maple Manor | Jenks Family Retreat"}$pid$::jsonb)).listing_alias, updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND to_jsonb(listing_alias) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / listing_alias'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'listing_alias', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":"Southern Reserve"}$pid$::jsonb)).neighborhood, updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND to_jsonb(neighborhood) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / neighborhood'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'neighborhood', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"**Owner does not want to see any diagnostic fees when possible. Owner’s referred handyman vendor - Eleven Eleven lab\n\nHOA needs to be contact on the summer for access to the community pool. No information was given upon request in onboarding.\n\nA cost segregation study will need to be scheduled. The company is planning to call Kati Hand for this. An owner requirement for the active owner program for tax purposes."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'operating_notes', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"cluster_mailbox"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(parking #> '{"cluster_mailbox"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / parking.cluster_mailbox'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'parking.cluster_mailbox', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"mailbox_location"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(parking #> '{"mailbox_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / parking.mailbox_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'parking.mailbox_location', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"mailbox_number"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(parking #> '{"mailbox_number"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / parking.mailbox_number'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'parking.mailbox_number', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = jsonb_set(CASE WHEN jsonb_typeof(pool_spa) = 'object' THEN pool_spa ELSE '{}'::jsonb END, '{"present"}', $pid$"None"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(pool_spa #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / pool_spa.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'pool_spa.present', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"alarm"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(security #> '{"alarm"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / security.alarm'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'security.alarm', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"battery_type"}', $pid$["Hardwired - No Battery"]$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(security #> '{"battery_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / security.battery_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'security.battery_type', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"devices"}', $pid$["Front Door","Garage"]$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(security #> '{"devices"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / security.devices'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'security.devices', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"monitoring_expires_on"}', $pid$"2027-11-08"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(security #> '{"monitoring_expires_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / security.monitoring_expires_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'security.monitoring_expires_on', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"monitoring_plan"}', $pid$["Active"]$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(security #> '{"monitoring_plan"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / security.monitoring_plan'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'security.monitoring_plan', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"brand"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(sprinklers #> '{"brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / sprinklers.brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'sprinklers.brand', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"controller_location"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(sprinklers #> '{"controller_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / sprinklers.controller_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'sprinklers.controller_location', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"set_for_season"}', $pid${"value":"N/A","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid"}$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(sprinklers #> '{"set_for_season"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / sprinklers.set_for_season'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'sprinklers.set_for_season', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"status"}', $pid$"Property Does Not Have Sprinkler System"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(sprinklers #> '{"status"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / sprinklers.status'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'sprinklers.status', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET storm_shelter = jsonb_set(CASE WHEN jsonb_typeof(storm_shelter) = 'object' THEN storm_shelter ELSE '{}'::jsonb END, '{"location_access"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(storm_shelter #> '{"location_access"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / storm_shelter.location_access'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'storm_shelter.location_access', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"breaker_panel_location"}', $pid$"Garage"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"breaker_panel_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / systems.breaker_panel_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.breaker_panel_location', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"co"}', CASE WHEN jsonb_typeof(systems #> '{"co"}') = 'object' THEN systems #> '{"co"}' ELSE '{}'::jsonb END, true), '{"co","installed"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"co","installed"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / systems.co.installed'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.co.installed', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"co"}', CASE WHEN jsonb_typeof(systems #> '{"co"}') = 'object' THEN systems #> '{"co"}' ELSE '{}'::jsonb END, true), '{"co","location"}', $pid$"Dining room"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"co","location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / systems.co.location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.co.location', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter"}', $pid$"Samsung HAF-QIN/EXP DA97-17376B"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / systems.fridge_filter'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.fridge_filter', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter_5yr"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"fridge_filter_5yr"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / systems.fridge_filter_5yr'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.fridge_filter_5yr', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2026-10-04"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / systems.smoke.batteries_changed_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.smoke.batteries_changed_on', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","battery_type"}', $pid$"9-Volt (Alkaline)"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"smoke","battery_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / systems.smoke.battery_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.smoke.battery_type', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","brand"}', $pid$"siterlink"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"smoke","brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / systems.smoke.brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.smoke.brand', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","notes"}', $pid$"7 brand new smoke detectors were ordered on October 16, 2026 and those were installed,  However, after reviewing the photos the handyman sent upon completing the work, we noticed that the manufacturing date is 2020. According to the handyman, they should have approximately four years of useful life remaining."$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"smoke","notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / systems.smoke.notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.smoke.notes', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","power_type"}', $pid$"Hardwired"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"smoke","power_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / systems.smoke.power_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.smoke.power_type', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"supply_box_location"}', $pid$"Located in the top shelf of primary bedroom closet"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"supply_box_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / systems.supply_box_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.supply_box_location', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"supply_storage"}', $pid$"Closet"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"supply_storage"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / systems.supply_storage'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.supply_storage', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"water_shutoff_indoor"}', $pid$"N/Ain water heater closet"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"water_shutoff_indoor"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / systems.water_shutoff_indoor'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.water_shutoff_indoor', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"water_shutoff_outdoor"}', $pid$"Water heater closet in garage"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(systems #> '{"water_shutoff_outdoor"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / systems.water_shutoff_outdoor'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'systems.water_shutoff_outdoor', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"router_location"}', $pid$"Living room"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(utilities #> '{"router_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / utilities.router_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'utilities.router_location', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_ssid"}', $pid$"ARHA"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(utilities #> '{"wifi_ssid"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / utilities.wifi_ssid'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'utilities.wifi_ssid', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET warranty = jsonb_set(CASE WHEN jsonb_typeof(warranty) = 'object' THEN warranty ELSE '{}'::jsonb END, '{"builder_present"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(warranty #> '{"builder_present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / warranty.builder_present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'warranty.builder_present', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET warranty = jsonb_set(CASE WHEN jsonb_typeof(warranty) = 'object' THEN warranty ELSE '{}'::jsonb END, '{"claim_process + external_links"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(warranty #> '{"claim_process + external_links"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / warranty.claim_process + external_links'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'warranty.claim_process + external_links', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET warranty = jsonb_set(CASE WHEN jsonb_typeof(warranty) = 'object' THEN warranty ELSE '{}'::jsonb END, '{"furniture_expires_on"}', $pid$"2029-10-28"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(warranty #> '{"furniture_expires_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / warranty.furniture_expires_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'warranty.furniture_expires_on', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"cart_count"}', $pid$2$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(waste #> '{"cart_count"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / waste.cart_count'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'waste.cart_count', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"cart_notes"}', $pid$"2"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(waste #> '{"cart_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / waste.cart_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'waste.cart_notes', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"holiday_notes"}', $pid$"Thursday"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(waste #> '{"holiday_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / waste.holiday_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'waste.holiday_notes', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"recycling"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(waste #> '{"recycling"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / waste.recycling'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'waste.recycling', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"recycling_days"}', $pid$"Wednesday"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(waste #> '{"recycling_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / waste.recycling_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'waste.recycling_days', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"strict_rules"}', $pid$"Trash cans out of street view, out ≤12 hrs before pickup and in ≤12 hrs after"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(waste #> '{"strict_rules"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / waste.strict_rules'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'waste.strict_rules', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"trash_days"}', $pid$["Wednesday"]$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(waste #> '{"trash_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / waste.trash_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'waste.trash_days', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '3915 W 104th St. S. / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9de75678-9e34-4219-a186-ed0da15f0092', 'waste.valet', 'notion_pid', '3b94658d-5f4f-811b-bdd7-fcf9a8a1e743', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 4003 Bendale Rd (OwnerRez 458889): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '4e542210-74fc-4a9e-b63f-ce2df5030f96' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '4003 Bendale Rd / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('4e542210-74fc-4a9e-b63f-ce2df5030f96', 'access.yale_needs_calibration', 'notion_pid', '2184658d-5f4f-81a8-b9b5-f7fec8655846', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 401 E. 10th St. (OwnerRez 484034): 72 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"emergency_key_access"}', $pid$"Yes"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(access #> '{"emergency_key_access"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / access.emergency_key_access'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'access.emergency_key_access', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"garage_remote"}', $pid$"Genie & Chamberlain"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(access #> '{"garage_remote"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / access.garage_remote'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'access.garage_remote', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"key_storage"}', $pid$["Backdoor","Front Door/Smartlock","Garage Door"]$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(access #> '{"key_storage"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / access.key_storage'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'access.key_storage', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_module"}', $pid$"Connected & Setup"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / access.yale_module'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'access.yale_module', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'access.yale_needs_calibration', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / amenities.access_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'amenities.access_notes', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"list"}', $pid$["None"]$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(amenities #> '{"list"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / amenities.list'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'amenities.list', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"grill"}', $pid$"No Grill"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(facts #> '{"grill"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / facts.grill'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'facts.grill', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"interior_paint"}', $pid$"There are some gallons of paint at the house, but no specific colors listed."$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(facts #> '{"interior_paint"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / facts.interior_paint'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'facts.interior_paint', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_locations"}', $pid$["Living Room","Bonus Room","Primary Bedroom"]$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(facts #> '{"tv_locations"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / facts.tv_locations'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'facts.tv_locations', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"Bonus Room - 401 E 10th St - 50″ Insignia, 4K UHD — model NS-50F301NA24\nLiving Room - 401 E 10th St - 55″ Insignia, 4K UHD — model NS-55F301NA22\nPrimary bedroom - 401 E 10th St -  43″ TCL, 1080p Full HD — model 43S310R"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / facts.tv_specs'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'facts.tv_specs', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"workstation"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(facts #> '{"workstation"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / facts.workstation'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'facts.workstation', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"fuel_type"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(fireplace #> '{"fuel_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / fireplace.fuel_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'fireplace.fuel_type', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"model"}', $pid$"Unknown. Not currently accessible for guests until we confirm operating instructions."$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(fireplace #> '{"model"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / fireplace.model'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'fireplace.model', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"present"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(fireplace #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / fireplace.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'fireplace.present', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET grounds = jsonb_set(CASE WHEN jsonb_typeof(grounds) = 'object' THEN grounds ELSE '{}'::jsonb END, '{"mowing_cadence"}', $pid$"Owner Responsible"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(grounds #> '{"mowing_cadence"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / grounds.mowing_cadence'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'grounds.mowing_cadence', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET grounds = jsonb_set(CASE WHEN jsonb_typeof(grounds) = 'object' THEN grounds ELSE '{}'::jsonb END, '{"mowing_days"}', $pid$["Wednesday"]$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(grounds #> '{"mowing_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / grounds.mowing_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'grounds.mowing_days', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hoa = jsonb_set(CASE WHEN jsonb_typeof(hoa) = 'object' THEN hoa ELSE '{}'::jsonb END, '{"notes + external_links"}', $pid$"No HOA"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(hoa #> '{"notes + external_links"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / hoa.notes + external_links'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'hoa.notes + external_links', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hoa = jsonb_set(CASE WHEN jsonb_typeof(hoa) = 'object' THEN hoa ELSE '{}'::jsonb END, '{"present"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(hoa #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / hoa.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'hoa.present', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"14x24x1 x2"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / hvac.filter_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'hvac.filter_notes', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_sizes"}', $pid$["14x24x1"]$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(hvac #> '{"filter_sizes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / hvac.filter_sizes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'hvac.filter_sizes', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET legacy_handoff_date = (jsonb_populate_record(NULL::public.properties, $pid${"legacy_handoff_date":"2026-10-29"}$pid$::jsonb)).legacy_handoff_date, updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND to_jsonb(legacy_handoff_date) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / legacy_handoff_date'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'legacy_handoff_date', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":"Spacious Edmond Home | Pool & Game Room"}$pid$::jsonb)).listing_alias, updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND to_jsonb(listing_alias) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / listing_alias'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'listing_alias', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":"This home is not located within a specific neighborhood. The home is located closest to the cross streets of E 9th St & S Rankin St in Edmond"}$pid$::jsonb)).neighborhood, updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND to_jsonb(neighborhood) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / neighborhood'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'neighborhood', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"cluster_mailbox"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(parking #> '{"cluster_mailbox"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / parking.cluster_mailbox'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'parking.cluster_mailbox', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"mailbox_location"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(parking #> '{"mailbox_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / parking.mailbox_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'parking.mailbox_location', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"mailbox_number"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(parking #> '{"mailbox_number"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / parking.mailbox_number'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'parking.mailbox_number', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = jsonb_set(CASE WHEN jsonb_typeof(pool_spa) = 'object' THEN pool_spa ELSE '{}'::jsonb END, '{"control_panel_location"}', $pid$"N/A - No hot tub"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(pool_spa #> '{"control_panel_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / pool_spa.control_panel_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'pool_spa.control_panel_location', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = jsonb_set(CASE WHEN jsonb_typeof(pool_spa) = 'object' THEN pool_spa ELSE '{}'::jsonb END, '{"heated"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(pool_spa #> '{"heated"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / pool_spa.heated'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'pool_spa.heated', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = jsonb_set(CASE WHEN jsonb_typeof(pool_spa) = 'object' THEN pool_spa ELSE '{}'::jsonb END, '{"heater"}', $pid$"N/A - No pool heater"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(pool_spa #> '{"heater"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / pool_spa.heater'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'pool_spa.heater', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = jsonb_set(CASE WHEN jsonb_typeof(pool_spa) = 'object' THEN pool_spa ELSE '{}'::jsonb END, '{"season"}', $pid$"Pool will be opened around may and closed in October"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(pool_spa #> '{"season"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / pool_spa.season'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'pool_spa.season', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = jsonb_set(CASE WHEN jsonb_typeof(pool_spa) = 'object' THEN pool_spa ELSE '{}'::jsonb END, '{"service_schedule"}', $pid$"Pool serviced every Friday no swimming for 2 hours"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(pool_spa #> '{"service_schedule"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / pool_spa.service_schedule'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'pool_spa.service_schedule', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"alarm"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(security #> '{"alarm"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / security.alarm'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'security.alarm', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"battery_type"}', $pid$["None"]$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(security #> '{"battery_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / security.battery_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'security.battery_type', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"devices"}', $pid$["None","Backyard"]$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(security #> '{"devices"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / security.devices'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'security.devices', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"monitoring_plan"}', $pid$["None"]$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(security #> '{"monitoring_plan"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / security.monitoring_plan'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'security.monitoring_plan', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"brand"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(sprinklers #> '{"brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / sprinklers.brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'sprinklers.brand', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"controller_location"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(sprinklers #> '{"controller_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / sprinklers.controller_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'sprinklers.controller_location', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"set_for_season"}', $pid${"value":"N/A","as_of":"2026-11-11T03:25:00.000Z","source":"notion_pid"}$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(sprinklers #> '{"set_for_season"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / sprinklers.set_for_season'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'sprinklers.set_for_season', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"status"}', $pid$"Property Does Not Have Sprinkler System"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(sprinklers #> '{"status"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / sprinklers.status'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'sprinklers.status', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET storm_shelter = jsonb_set(CASE WHEN jsonb_typeof(storm_shelter) = 'object' THEN storm_shelter ELSE '{}'::jsonb END, '{"location_access"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(storm_shelter #> '{"location_access"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / storm_shelter.location_access'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'storm_shelter.location_access', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"breaker_panel_location"}', $pid$"Laundry room"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"breaker_panel_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / systems.breaker_panel_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.breaker_panel_location', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"co"}', CASE WHEN jsonb_typeof(systems #> '{"co"}') = 'object' THEN systems #> '{"co"}' ELSE '{}'::jsonb END, true), '{"co","installed"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"co","installed"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / systems.co.installed'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.co.installed', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"co"}', CASE WHEN jsonb_typeof(systems #> '{"co"}') = 'object' THEN systems #> '{"co"}' ELSE '{}'::jsonb END, true), '{"co","location"}', $pid$"Kitchen"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"co","location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / systems.co.location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.co.location', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter"}', $pid$"HAF/CIN"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / systems.fridge_filter'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.fridge_filter', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter_5yr"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"fridge_filter_5yr"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / systems.fridge_filter_5yr'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.fridge_filter_5yr', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2022-01-01"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / systems.smoke.batteries_changed_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.batteries_changed_on', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","battery_type"}', $pid$"10-Year Sealed Lithium"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"smoke","battery_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / systems.smoke.battery_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.battery_type', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","brand"}', $pid$"First Alert"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"smoke","brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / systems.smoke.brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.brand', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_on"}', $pid$"2032-12-31"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"smoke","expires_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / systems.smoke.expires_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.expires_on', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_precision"}', $pid$"year"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"smoke","expires_precision"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / systems.smoke.expires_precision'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.expires_precision', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_source_text"}', $pid$"2032"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"smoke","expires_source_text"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / systems.smoke.expires_source_text'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.expires_source_text', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","notes"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"smoke","notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / systems.smoke.notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.notes', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","power_type"}', $pid$"Battery Powered"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"smoke","power_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / systems.smoke.power_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.smoke.power_type', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"supply_box_location"}', $pid$"None"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"supply_box_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / systems.supply_box_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.supply_box_location', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"supply_storage"}', $pid$"Closet"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"supply_storage"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / systems.supply_storage'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.supply_storage', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"water_shutoff_indoor"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"water_shutoff_indoor"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / systems.water_shutoff_indoor'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.water_shutoff_indoor', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"water_shutoff_outdoor"}', $pid$"In the middle of the driveway"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(systems #> '{"water_shutoff_outdoor"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / systems.water_shutoff_outdoor'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'systems.water_shutoff_outdoor', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier, updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND to_jsonb(tier) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / tier'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'tier', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"router_location"}', $pid$"Living room"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(utilities #> '{"router_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / utilities.router_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'utilities.router_location', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET warranty = jsonb_set(CASE WHEN jsonb_typeof(warranty) = 'object' THEN warranty ELSE '{}'::jsonb END, '{"builder_present"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(warranty #> '{"builder_present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / warranty.builder_present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'warranty.builder_present', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"cart_count"}', $pid$2$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(waste #> '{"cart_count"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / waste.cart_count'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.cart_count', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"cart_notes"}', $pid$"2"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(waste #> '{"cart_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / waste.cart_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.cart_notes', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"holiday_notes"}', $pid$"If pickup falls on a holiday, it’ll be done the next day (Wednesday)."$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(waste #> '{"holiday_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / waste.holiday_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.holiday_notes', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"recycling"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(waste #> '{"recycling"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / waste.recycling'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.recycling', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"recycling_days"}', $pid$"Every other Tuesday"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(waste #> '{"recycling_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / waste.recycling_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.recycling_days', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"trash_days"}', $pid$["Tuesday"]$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(waste #> '{"trash_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / waste.trash_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.trash_days', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"Yes"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'waste.valet', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":1968}$pid$::jsonb)).year_built, updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / year_built'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'year_built', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"lock_brand"}', $pid$"Yale"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(access #> '{"lock_brand"}', 'null'::jsonb) = $pid$"Schlage"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / access.lock_brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'access.lock_brand', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact.\n\nNot needed at hand off (Mingees to handle later):\n  • Confirm instructions for operating the fireplace in the basement \n• Full siding repair (multiple places)\n• Haul away fence panels in backyard\n• Backyard landscaping and cleanup\n• Remove stumps and trim all trees/bushes\n• Purchase/install new dining room rug\n• Garage door seal\n• Water damage on garage wall (find and repair the leak source)\n• Door or curtain for pantry\n• Gutters"}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"FIRST vendor for all maintenance and repairs: Untitled . Contact them first on all work orders before scheduling any other vendor. Only use an alternate only if Ruben is unavailable or unresponsive.\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'operating_notes', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_ssid"}', $pid$"ARHA 2.4, ARHA 5"$pid$::jsonb, true), updated_at = now() WHERE id = '09e74a21-8489-4ef1-b0fb-295800859029' AND coalesce(utilities #> '{"wifi_ssid"}', 'null'::jsonb) = $pid$"HFE 401"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '401 E. 10th St. / utilities.wifi_ssid'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('09e74a21-8489-4ef1-b0fb-295800859029', 'utilities.wifi_ssid', 'notion_pid', '4144658d-5f4f-80be-8fd8-f052375bd74b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 409 S. 85th St. (OwnerRez 453794): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'eef11540-5745-4b8f-8f1f-f02b02ea3417' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '409 S. 85th St. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('eef11540-5745-4b8f-8f1f-f02b02ea3417', 'access.yale_needs_calibration', 'notion_pid', '1e34658d-5f4f-811f-8af2-d25eff66af28', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = 'eef11540-5745-4b8f-8f1f-f02b02ea3417' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '409 S. 85th St. / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('eef11540-5745-4b8f-8f1f-f02b02ea3417', 'waste.valet', 'notion_pid', '1e34658d-5f4f-811f-8af2-d25eff66af28', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 417 Dauphin Ave. (OwnerRez 480828): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '6ffccd48-698b-4c3b-bdac-420ba582bc2d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '417 Dauphin Ave. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('6ffccd48-698b-4c3b-bdac-420ba582bc2d', 'access.yale_needs_calibration', 'notion_pid', '3184658d-5f4f-809c-b4c1-dc8101719004', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '6ffccd48-698b-4c3b-bdac-420ba582bc2d' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '417 Dauphin Ave. / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('6ffccd48-698b-4c3b-bdac-420ba582bc2d', 'operating_notes', 'notion_pid', '3184658d-5f4f-809c-b4c1-dc8101719004', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 428 Drowsy Water Trl (30D FIRM) (OwnerRez 437201): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '1a251d51-208a-439d-9b0e-f7e2887ae50b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '428 Drowsy Water Trl (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('1a251d51-208a-439d-9b0e-f7e2887ae50b', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80b8-a50d-eb8208ef4d34', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 4308 NW 158th (30D Firm) (OwnerRez 440423): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = 'ab12f1af-3e2e-4cfb-a73a-bb32dc412dc9' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '4308 NW 158th (30D Firm) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ab12f1af-3e2e-4cfb-a73a-bb32dc412dc9', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-800f-8485-ed3da65ab8f9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"Pool Access Code: [removed — credentials are not stored in Resolve] \n Pool rules and hours can be found on site on the pool building wall."$pid$::jsonb, true), updated_at = now() WHERE id = 'ab12f1af-3e2e-4cfb-a73a-bb32dc412dc9' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"Pool Access Code: See Guest Access & Credentials \n Pool rules and hours can be found on site on the pool building wall."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '4308 NW 158th (30D Firm) / amenities.access_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ab12f1af-3e2e-4cfb-a73a-bb32dc412dc9', 'amenities.access_notes', 'notion_pid', '1664658d-5f4f-800f-8485-ed3da65ab8f9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 4308 S 177th Pl E (OwnerRez 410574): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '517ccf34-a2de-4aca-9984-fc58c8a8d7bb' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '4308 S 177th Pl E / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('517ccf34-a2de-4aca-9984-fc58c8a8d7bb', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-804b-bb2e-dcff157a971d', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '517ccf34-a2de-4aca-9984-fc58c8a8d7bb' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '4308 S 177th Pl E / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('517ccf34-a2de-4aca-9984-fc58c8a8d7bb', 'waste.valet', 'notion_pid', '1664658d-5f4f-804b-bb2e-dcff157a971d', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 4317 NW 19th (OwnerRez 347786): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'e72e942a-f53f-4397-89fa-0383795fbc55' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '4317 NW 19th / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e72e942a-f53f-4397-89fa-0383795fbc55', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80cd-95f9-c73909e19498', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Casey sometimes prefers to handle minor maintenance repairs himself. Always reach out to him first before scheduling a handyman."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'e72e942a-f53f-4397-89fa-0383795fbc55' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '4317 NW 19th / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e72e942a-f53f-4397-89fa-0383795fbc55', 'operating_notes', 'notion_pid', '1664658d-5f4f-80cd-95f9-c73909e19498', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 441 Belmont (OwnerRez 385839): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '53eaf44b-5021-48eb-babb-9cfdca9fb52b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '441 Belmont / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('53eaf44b-5021-48eb-babb-9cfdca9fb52b', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8098-96c0-c9a12f9535dd', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 4513 Black Mesa Ln (OwnerRez 415412): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '72cd8885-be51-4f6b-8fe9-2aab4173d34c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '4513 Black Mesa Ln / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('72cd8885-be51-4f6b-8fe9-2aab4173d34c', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-807f-b169-ff4512d8ccd7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 453 Blue Crow Lane (OwnerRez 418721): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '8c6b2765-57d4-4e05-9632-218ddf636258' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '453 Blue Crow Lane / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8c6b2765-57d4-4e05-9632-218ddf636258', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80eb-bdeb-eec4e67f1cac', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2026-09-22"$pid$::jsonb, true), updated_at = now() WHERE id = '8c6b2765-57d4-4e05-9632-218ddf636258' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2025-06-22"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '453 Blue Crow Lane / systems.smoke.batteries_changed_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8c6b2765-57d4-4e05-9632-218ddf636258', 'systems.smoke.batteries_changed_on', 'notion_pid', '1664658d-5f4f-80eb-bdeb-eec4e67f1cac', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 4607 S. Lakewood Ave (OwnerRez 411249): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '5988af9f-e3b2-4ea3-973e-f8e7b8f86eea' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '4607 S. Lakewood Ave / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('5988af9f-e3b2-4ea3-973e-f8e7b8f86eea', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-809e-811a-d7bf6319241b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '5988af9f-e3b2-4ea3-973e-f8e7b8f86eea' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '4607 S. Lakewood Ave / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('5988af9f-e3b2-4ea3-973e-f8e7b8f86eea', 'waste.valet', 'notion_pid', '1664658d-5f4f-809e-811a-d7bf6319241b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 4607 W. Union St. (OwnerRez 485207): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '4c0686e1-cead-4595-8dcc-633451238ad9' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '4607 W. Union St. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('4c0686e1-cead-4595-8dcc-633451238ad9', 'access.yale_needs_calibration', 'notion_pid', '3654658d-5f4f-8165-b1d6-f881a9138339', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 4718 E Shadowbrook Dr (OwnerRez 463601): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '3eb869c8-205a-456f-86b8-d6a41f251e50' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '4718 E Shadowbrook Dr / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('3eb869c8-205a-456f-86b8-d6a41f251e50', 'access.yale_needs_calibration', 'notion_pid', '2544658d-5f4f-81fe-b6d1-d27a2aacfd55', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 4816 Hazy Hollow Ln (OwnerRez 437509): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = 'af09b54d-b334-4bee-a911-2af50a902a2b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '4816 Hazy Hollow Ln / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('af09b54d-b334-4bee-a911-2af50a902a2b', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80ab-9775-d8533c0b55bf', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 5020 S.168th E Ave (30D FIRM) (OwnerRez 378665): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '53dd007c-4a89-4d96-9feb-e8467787a527' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '5020 S.168th E Ave (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('53dd007c-4a89-4d96-9feb-e8467787a527', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8005-8d0c-ea1b9b94fa36', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '53dd007c-4a89-4d96-9feb-e8467787a527' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '5020 S.168th E Ave (30D FIRM) / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('53dd007c-4a89-4d96-9feb-e8467787a527', 'waste.valet', 'notion_pid', '1664658d-5f4f-8005-8d0c-ea1b9b94fa36', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 5034 N 35th St (OwnerRez 432974): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'b3a2afd8-96d4-4699-a91e-9c21ea1f115b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '5034 N 35th St / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('b3a2afd8-96d4-4699-a91e-9c21ea1f115b', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80ff-8756-ed5d359dda48', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = 'b3a2afd8-96d4-4699-a91e-9c21ea1f115b' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '5034 N 35th St / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('b3a2afd8-96d4-4699-a91e-9c21ea1f115b', 'waste.valet', 'notion_pid', '1664658d-5f4f-80ff-8756-ed5d359dda48', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 504 S. 47th St (OwnerRez 452367): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '2e868dc3-3eec-4d4d-bc2c-5dccbda23987' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '504 S. 47th St / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2e868dc3-3eec-4d4d-bc2c-5dccbda23987', 'access.yale_needs_calibration', 'notion_pid', '1ce4658d-5f4f-80c8-93fe-c54e337043c6', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '2e868dc3-3eec-4d4d-bc2c-5dccbda23987' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '504 S. 47th St / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2e868dc3-3eec-4d4d-bc2c-5dccbda23987', 'waste.valet', 'notion_pid', '1ce4658d-5f4f-80c8-93fe-c54e337043c6', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 5047 Skipping Stone Dr (OwnerRez 455967): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '1bff641f-0107-4fe4-93fe-6ecf8735b38d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '5047 Skipping Stone Dr / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('1bff641f-0107-4fe4-93fe-6ecf8735b38d', 'access.yale_needs_calibration', 'notion_pid', '1f94658d-5f4f-815d-88a8-ddd5067b1e18', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '1bff641f-0107-4fe4-93fe-6ecf8735b38d' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '5047 Skipping Stone Dr / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('1bff641f-0107-4fe4-93fe-6ecf8735b38d', 'waste.valet', 'notion_pid', '1f94658d-5f4f-815d-88a8-ddd5067b1e18', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 508 NW 183rd St (OwnerRez 435796): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '1ac5de62-3a33-464d-8c9c-dbd132d15bab' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '508 NW 183rd St / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('1ac5de62-3a33-464d-8c9c-dbd132d15bab', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8023-a6f1-c48dc31bdb59', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 509 Houndstooth Dr (30D Firm) (OwnerRez 441628): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '652a1979-a6ec-43ed-b684-2bc1aa9548bf' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '509 Houndstooth Dr (30D Firm) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('652a1979-a6ec-43ed-b684-2bc1aa9548bf', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-803a-89ec-f0084e75f682', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"ARHA can fill out the pool access card form (attached in comments) then send it Christina for approval and next steps to receive the card.\nContact: Christina Villarreal\nCVillarreal@insightam.com\n (972) 993-6746"$pid$::jsonb, true), updated_at = now() WHERE id = '652a1979-a6ec-43ed-b684-2bc1aa9548bf' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"Not Mentioned"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '509 Houndstooth Dr (30D Firm) / amenities.access_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('652a1979-a6ec-43ed-b684-2bc1aa9548bf', 'amenities.access_notes', 'notion_pid', '1664658d-5f4f-803a-89ec-f0084e75f682', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 5217 NW 109th St. (30D Firm) (OwnerRez 480823): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '061cde8a-0565-4aeb-8e36-d558c317576b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '5217 NW 109th St. (30D Firm) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('061cde8a-0565-4aeb-8e36-d558c317576b', 'access.yale_needs_calibration', 'notion_pid', '3184658d-5f4f-80ea-8f84-dbe3f80b34e9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '061cde8a-0565-4aeb-8e36-d558c317576b' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '5217 NW 109th St. (30D Firm) / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('061cde8a-0565-4aeb-8e36-d558c317576b', 'operating_notes', 'notion_pid', '3184658d-5f4f-80ea-8f84-dbe3f80b34e9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 525 23rd Ave (OwnerRez 420585): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '6aef16ba-91c0-416c-8b60-8ed7a140de4b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '525 23rd Ave / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('6aef16ba-91c0-416c-8b60-8ed7a140de4b', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8063-812d-d47022a01cfe', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 5253 Tracey Jo Rd (OwnerRez 470695): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '908cc8ce-268b-402c-a2aa-8c7aefb67975' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '5253 Tracey Jo Rd / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('908cc8ce-268b-402c-a2aa-8c7aefb67975', 'access.yale_needs_calibration', 'notion_pid', '2bd4658d-5f4f-81f0-a254-f8d3b8f50b5b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 5512 Hidden Trail Ln. (OwnerRez 412758): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'd4eab150-8c1c-4804-8ac4-a15e697b6c82' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '5512 Hidden Trail Ln. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('d4eab150-8c1c-4804-8ac4-a15e697b6c82', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8083-99e8-c55f166645ad', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 5671 Teak Ln. (OwnerRez 488440): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'dc7e0b00-9bde-4bfd-a94b-bd164801ba6b' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '5671 Teak Ln. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('dc7e0b00-9bde-4bfd-a94b-bd164801ba6b', 'access.yale_needs_calibration', 'notion_pid', '3884658d-5f4f-81f5-9084-fdba641b69f8', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 5923 Hollyhock Lane (OwnerRez 487893): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '970d75a6-bf28-4439-b138-46f6749cc0dd' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '5923 Hollyhock Lane / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('970d75a6-bf28-4439-b138-46f6749cc0dd', 'access.yale_needs_calibration', 'notion_pid', '3794658d-5f4f-8134-98f0-c5e63eadcb65', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 6017 S. 13th St (30D FIRM) (OwnerRez 450120): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'be144356-fec0-44ce-83fa-4dc052194c93' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6017 S. 13th St (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('be144356-fec0-44ce-83fa-4dc052194c93', 'access.yale_needs_calibration', 'notion_pid', '1af4658d-5f4f-8026-beb6-ddee9d66c3eb', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = 'be144356-fec0-44ce-83fa-4dc052194c93' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6017 S. 13th St (30D FIRM) / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('be144356-fec0-44ce-83fa-4dc052194c93', 'waste.valet', 'notion_pid', '1af4658d-5f4f-8026-beb6-ddee9d66c3eb', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 624 Daniel Court (OwnerRez 498633): 12 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_integration_live"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '624 Daniel Court / access.yale_integration_live'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'access.yale_integration_live', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '624 Daniel Court / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'access.yale_needs_calibration', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET compliance = jsonb_set(CASE WHEN jsonb_typeof(compliance) = 'object' THEN compliance ELSE '{}'::jsonb END, '{"permit_status"}', $pid${"text":"No permit required for Westfield, IN","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb, true), updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND coalesce(compliance #> '{"permit_status"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '624 Daniel Court / compliance.permit_status'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'compliance.permit_status', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET compliance = jsonb_set(CASE WHEN jsonb_typeof(compliance) = 'object' THEN compliance ELSE '{}'::jsonb END, '{"rental_restrictions"}', $pid${"text":"No STR rental restrictions","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb, true), updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND coalesce(compliance #> '{"rental_restrictions"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '624 Daniel Court / compliance.rental_restrictions'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'compliance.rental_restrictions', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = jsonb_set(CASE WHEN jsonb_typeof(external_refs) = 'object' THEN external_refs ELSE '{}'::jsonb END, '{"breezeway_url"}', $pid$"https://app.breezeway.io/property/1529710/profile"$pid$::jsonb, true), updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '624 Daniel Court / external_refs.breezeway_url'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'external_refs.breezeway_url', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '624 Daniel Court / furniture_package'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'furniture_package', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET market = (jsonb_populate_record(NULL::public.properties, $pid${"market":"Indy"}$pid$::jsonb)).market, updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND to_jsonb(market) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '624 Daniel Court / market'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'market', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"Dovetail Court (624)"}$pid$::jsonb)).nickname, updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '624 Daniel Court / nickname'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'nickname', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"summary"}', $pid$"2 Car Garage\nFree Parking on Premises"$pid$::jsonb, true), updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '624 Daniel Court / parking.summary'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'parking.summary', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier, updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND to_jsonb(tier) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '624 Daniel Court / tier'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'tier', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_split_confirmed"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '624 Daniel Court / utilities.wifi_split_confirmed'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'utilities.wifi_split_confirmed', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2002}$pid$::jsonb)).year_built, updated_at = now() WHERE id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd' AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '624 Daniel Court / year_built'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'year_built', 'notion_pid', '3f34658d-5f4f-812b-a6bb-e7b07103b3b1', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 628 Joy Ct (OwnerRez 429148): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '1652e0d6-8577-4cc1-82ee-fd477c929427' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '628 Joy Ct / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('1652e0d6-8577-4cc1-82ee-fd477c929427', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-801f-a2f4-d04889af2a78', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2026-09-07"$pid$::jsonb, true), updated_at = now() WHERE id = '1652e0d6-8577-4cc1-82ee-fd477c929427' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$"2025-10-29"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '628 Joy Ct / systems.smoke.batteries_changed_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('1652e0d6-8577-4cc1-82ee-fd477c929427', 'systems.smoke.batteries_changed_on', 'notion_pid', '1664658d-5f4f-801f-a2f4-d04889af2a78', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 6302 Meadow Path Way (OwnerRez 501851): 10 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_integration_live"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6302 Meadow Path Way / access.yale_integration_live'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'access.yale_integration_live', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6302 Meadow Path Way / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'access.yale_needs_calibration', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = jsonb_set(CASE WHEN jsonb_typeof(external_refs) = 'object' THEN external_refs ELSE '{}'::jsonb END, '{"breezeway_url"}', $pid$"https://app.breezeway.io/property/1563499/profile"$pid$::jsonb, true), updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6302 Meadow Path Way / external_refs.breezeway_url'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'external_refs.breezeway_url', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6302 Meadow Path Way / furniture_package'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'furniture_package', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET market = (jsonb_populate_record(NULL::public.properties, $pid${"market":"Indy"}$pid$::jsonb)).market, updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND to_jsonb(market) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6302 Meadow Path Way / market'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'market', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"Meadow Path Hideaway (6302)"}$pid$::jsonb)).nickname, updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6302 Meadow Path Way / nickname'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'nickname', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"summary"}', $pid$"2 Car Garage \nFree Parking on Premises"$pid$::jsonb, true), updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6302 Meadow Path Way / parking.summary'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'parking.summary', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier, updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND to_jsonb(tier) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6302 Meadow Path Way / tier'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'tier', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_split_confirmed"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6302 Meadow Path Way / utilities.wifi_split_confirmed'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'utilities.wifi_split_confirmed', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2024}$pid$::jsonb)).year_built, updated_at = now() WHERE id = 'e4271978-babe-4126-b66a-b8c9dee73602' AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6302 Meadow Path Way / year_built'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'year_built', 'notion_pid', '4104658d-5f4f-812e-9cb3-d36092e2fbc5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 6312 Red Cliff Dr (OwnerRez 432975): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '677bb1df-ce30-447c-a129-4ad3488c51bc' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6312 Red Cliff Dr / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('677bb1df-ce30-447c-a129-4ad3488c51bc', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-806e-9e3a-c6c8d6d1ef89', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 64 Turtle Loop (OwnerRez 480831): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'aed01e56-0bbb-4720-b81c-996bffcb6c21' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '64 Turtle Loop / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('aed01e56-0bbb-4720-b81c-996bffcb6c21', 'access.yale_needs_calibration', 'notion_pid', '3184658d-5f4f-80d7-b304-e4412a7aed48', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"NO PETS ALLOWED\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = 'aed01e56-0bbb-4720-b81c-996bffcb6c21' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"NO PETS ALLOWED\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '64 Turtle Loop / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('aed01e56-0bbb-4720-b81c-996bffcb6c21', 'operating_notes', 'notion_pid', '3184658d-5f4f-80d7-b304-e4412a7aed48', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 6629 S 22nd Ct E (OwnerRez 429480): 4 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '656e8354-e4f6-43b2-9029-116fdef25e8a' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6629 S 22nd Ct E / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('656e8354-e4f6-43b2-9029-116fdef25e8a', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-800f-9797-ee9f8347a7db', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '656e8354-e4f6-43b2-9029-116fdef25e8a' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6629 S 22nd Ct E / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('656e8354-e4f6-43b2-9029-116fdef25e8a', 'waste.valet', 'notion_pid', '1664658d-5f4f-800f-9797-ee9f8347a7db', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"There is a community pool (only available for guests 30+ days). A waiver is required to be completed per tenant in order to gain access. It is saved to the property’s one drive folder. It and the rules are also attached to this field as a comment. The owner has to complete the waiver."$pid$::jsonb, true), updated_at = now() WHERE id = '656e8354-e4f6-43b2-9029-116fdef25e8a' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"There is a community pool (only available for guests 30+ days). A waiver is required to be completed per tenant in order to gain access. It is saved to the property’s one drive folder. It and the rules are also attached to this field as a comment."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6629 S 22nd Ct E / amenities.access_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('656e8354-e4f6-43b2-9029-116fdef25e8a', 'amenities.access_notes', 'notion_pid', '1664658d-5f4f-800f-9797-ee9f8347a7db', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"list"}', $pid$["Pool"]$pid$::jsonb, true), updated_at = now() WHERE id = '656e8354-e4f6-43b2-9029-116fdef25e8a' AND coalesce(amenities #> '{"list"}', 'null'::jsonb) = $pid$["Not Mentioned"]$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6629 S 22nd Ct E / amenities.list'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('656e8354-e4f6-43b2-9029-116fdef25e8a', 'amenities.list', 'notion_pid', '1664658d-5f4f-800f-9797-ee9f8347a7db', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 6847 Cardiff Dr (OwnerRez 459111): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '3a248822-b22f-4c2c-ab8c-56ff4f9a06e0' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6847 Cardiff Dr / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('3a248822-b22f-4c2c-ab8c-56ff4f9a06e0', 'access.yale_needs_calibration', 'notion_pid', '21c4658d-5f4f-81e0-9437-d0535daa7c74', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '3a248822-b22f-4c2c-ab8c-56ff4f9a06e0' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '6847 Cardiff Dr / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('3a248822-b22f-4c2c-ab8c-56ff4f9a06e0', 'waste.valet', 'notion_pid', '21c4658d-5f4f-81e0-9437-d0535daa7c74', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 7006 E 154th St S (OwnerRez 403353): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '806c6bbc-6723-426a-a5e7-ead187813d5f' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '7006 E 154th St S / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('806c6bbc-6723-426a-a5e7-ead187813d5f', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8056-bdcd-c21d0545fe32', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '806c6bbc-6723-426a-a5e7-ead187813d5f' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '7006 E 154th St S / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('806c6bbc-6723-426a-a5e7-ead187813d5f', 'waste.valet', 'notion_pid', '1664658d-5f4f-8056-bdcd-c21d0545fe32', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 7071 Richardson Ct (OwnerRez 463624): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '91aac2de-0b98-444a-81a8-2de074e0d265' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '7071 Richardson Ct / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('91aac2de-0b98-444a-81a8-2de074e0d265', 'access.yale_needs_calibration', 'notion_pid', '2544658d-5f4f-81c7-bf3f-eccbd29ea716', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 721 Dusty Trail (OwnerRez 376992): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'c9777558-269b-4c12-b0ac-7a53cc960ebb' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '721 Dusty Trail / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('c9777558-269b-4c12-b0ac-7a53cc960ebb', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8048-8d7b-d1fbdc2d3e6e', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 721 Vaquero St. (OwnerRez 419842): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '3b0a17c2-8cda-43a7-ae82-8103feaf4811' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '721 Vaquero St. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('3b0a17c2-8cda-43a7-ae82-8103feaf4811', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8051-adc4-dfb47d3da0b9', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 724 Abilene Way (OwnerRez 398358): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '326291cd-a35d-4055-9f87-e7ad1d34eec2' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '724 Abilene Way / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('326291cd-a35d-4055-9f87-e7ad1d34eec2', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80d5-89af-c39664273d70', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 730 E 38th St. N. (OwnerRez 481007): 5 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '730 E 38th St. N. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0c98e172-9027-4020-9c16-d5dfd1774b2c', 'access.yale_needs_calibration', 'notion_pid', '3374658d-5f4f-818b-a1c3-e172e6748505', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"65\" TCL ROKU TV in Living Room \n55” TCL ROKU TV in Primary Bedroom"$pid$::jsonb, true), updated_at = now() WHERE id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$"65\" TCL TV in Living Room, 55” TV in Primary Bedroom"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '730 E 38th St. N. / facts.tv_specs'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0c98e172-9027-4020-9c16-d5dfd1774b2c', 'facts.tv_specs', 'notion_pid', '3374658d-5f4f-818b-a1c3-e172e6748505', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"1- 14x24x1 \n1- 14x30x1"$pid$::jsonb, true), updated_at = now() WHERE id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$"14x24x1 - 1\n14x30x1 - 1"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '730 E 38th St. N. / hvac.filter_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0c98e172-9027-4020-9c16-d5dfd1774b2c', 'hvac.filter_notes', 'notion_pid', '3374658d-5f4f-818b-a1c3-e172e6748505', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter"}', $pid$"Samsung Water Filter NSF"$pid$::jsonb, true), updated_at = now() WHERE id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$"Samsung Water Filter"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '730 E 38th St. N. / systems.fridge_filter'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0c98e172-9027-4020-9c16-d5dfd1774b2c', 'systems.fridge_filter', 'notion_pid', '3374658d-5f4f-818b-a1c3-e172e6748505', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"water_shutoff_outdoor"}', $pid$"aside the mailbox"$pid$::jsonb, true), updated_at = now() WHERE id = '0c98e172-9027-4020-9c16-d5dfd1774b2c' AND coalesce(systems #> '{"water_shutoff_outdoor"}', 'null'::jsonb) = $pid$"I do not see one on the outside of the house if there is it’s in the water meter box and it’s flooded"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '730 E 38th St. N. / systems.water_shutoff_outdoor'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('0c98e172-9027-4020-9c16-d5dfd1774b2c', 'systems.water_shutoff_outdoor', 'notion_pid', '3374658d-5f4f-818b-a1c3-e172e6748505', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 7317 NW 159th Ter. (30D FIRM) (OwnerRez 491601): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'ff7a1ed4-c055-47fe-ba79-4763d5a1bf01' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '7317 NW 159th Ter. (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ff7a1ed4-c055-47fe-ba79-4763d5a1bf01', 'access.yale_needs_calibration', 'notion_pid', '3ac4658d-5f4f-80a1-9d74-f5444c6802d8', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"Pool rules can be found in the guidebook custom fields, and also save to onedrive - here. The pool is open seasonally, estimated from Memorial Day weekend through Labor Day, open from 10am–10pm."$pid$::jsonb, true), updated_at = now() WHERE id = 'ff7a1ed4-c055-47fe-ba79-4763d5a1bf01' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"Pool rules can be found in the guidebook custom fields, and also save to onedrive - here. The pool is expected to be open seasonally during the summer time."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '7317 NW 159th Ter. (30D FIRM) / amenities.access_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ff7a1ed4-c055-47fe-ba79-4763d5a1bf01', 'amenities.access_notes', 'notion_pid', '3ac4658d-5f4f-80a1-9d74-f5444c6802d8', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 7351 Red Rock Rd (OwnerRez 480764): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'eedf6963-8cf0-45fc-b67e-2d910c79e6c4' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '7351 Red Rock Rd / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('eedf6963-8cf0-45fc-b67e-2d910c79e6c4', 'access.yale_needs_calibration', 'notion_pid', '3344658d-5f4f-81ed-80b6-e144b5fb38a6', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 7380 S 69th E Ave (OwnerRez 408959): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'd14ba1d6-ae17-4c4f-9d09-134e6f84d5d3' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '7380 S 69th E Ave / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('d14ba1d6-ae17-4c4f-9d09-134e6f84d5d3', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-803c-87f9-db69ee735a90', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = 'd14ba1d6-ae17-4c4f-9d09-134e6f84d5d3' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '7380 S 69th E Ave / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('d14ba1d6-ae17-4c4f-9d09-134e6f84d5d3', 'waste.valet', 'notion_pid', '1664658d-5f4f-803c-87f9-db69ee735a90', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 7422 S. Granite Ave. (OwnerRez 480830): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '4b0b54da-5608-4f92-8f1f-73328b83c73d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '7422 S. Granite Ave. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('4b0b54da-5608-4f92-8f1f-73328b83c73d', 'access.yale_needs_calibration', 'notion_pid', '3184658d-5f4f-808f-925a-e30ea33884c2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"For REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '4b0b54da-5608-4f92-8f1f-73328b83c73d' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: \ndelilah@quintessamarketing.com\n. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '7422 S. Granite Ave. / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('4b0b54da-5608-4f92-8f1f-73328b83c73d', 'operating_notes', 'notion_pid', '3184658d-5f4f-808f-925a-e30ea33884c2', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 758 N. Johnson Branch Rd. (OwnerRez 488148): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'fc1cb579-d655-4558-a85d-2164026606a7' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '758 N. Johnson Branch Rd. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('fc1cb579-d655-4558-a85d-2164026606a7', 'access.yale_needs_calibration', 'notion_pid', '3844658d-5f4f-8149-a099-df06a51e2417', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 815 E Fulton St. (OwnerRez 414805): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'ad110483-8a1a-4285-9f4f-d432f5d1dbda' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '815 E Fulton St. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ad110483-8a1a-4285-9f4f-d432f5d1dbda', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8080-aeba-da60bdf0e883', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = 'ad110483-8a1a-4285-9f4f-d432f5d1dbda' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '815 E Fulton St. / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('ad110483-8a1a-4285-9f4f-d432f5d1dbda', 'waste.valet', 'notion_pid', '1664658d-5f4f-8080-aeba-da60bdf0e883', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 816 Lakeview Dr (OwnerRez 471329): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'fd6a681a-df09-4aef-a417-c47339b28fa6' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '816 Lakeview Dr / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('fd6a681a-df09-4aef-a417-c47339b28fa6', 'access.yale_needs_calibration', 'notion_pid', '2c44658d-5f4f-8116-a830-e856cbd7c68e', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 817 Halley Dr. (OwnerRez 419863): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '1ffa9bde-a0cb-44c5-be33-bcad961e0c56' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '817 Halley Dr. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('1ffa9bde-a0cb-44c5-be33-bcad961e0c56', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80be-ae59-d956dc27fed5', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 8217 NW 151st St. (30D FIRM) (OwnerRez 415301): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '00e1a3f9-be07-4ba7-9455-b81ad0938014' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8217 NW 151st St. (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('00e1a3f9-be07-4ba7-9455-b81ad0938014', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80fb-92a3-df7a838d5650', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 8316 NW 142nd (OwnerRez 416276): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = 'f9638a06-f514-43a7-aafc-833ac34a817c' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8316 NW 142nd / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('f9638a06-f514-43a7-aafc-833ac34a817c', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8011-b8b6-d4342108ee13', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 8332 Welder Pl. (OwnerRez 489357): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'bfbca778-19f4-4c1f-a0dd-b08986f22f51' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8332 Welder Pl. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bfbca778-19f4-4c1f-a0dd-b08986f22f51', 'access.yale_needs_calibration', 'notion_pid', '3954658d-5f4f-80a1-b326-f78ad246ab42', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 8408 NW 162nd (30D FIRM) (OwnerRez 409752): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'cca8fac9-9179-4e29-aa1d-343ac036b95d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8408 NW 162nd (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cca8fac9-9179-4e29-aa1d-343ac036b95d', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-801a-97ac-f2907cb749b7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"controller_location"}', $pid$"Garage"$pid$::jsonb, true), updated_at = now() WHERE id = 'cca8fac9-9179-4e29-aa1d-343ac036b95d' AND coalesce(sprinklers #> '{"controller_location"}', 'null'::jsonb) = $pid$"Garahe"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8408 NW 162nd (30D FIRM) / sprinklers.controller_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('cca8fac9-9179-4e29-aa1d-343ac036b95d', 'sprinklers.controller_location', 'notion_pid', '1664658d-5f4f-801a-97ac-f2907cb749b7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 845 Alexandria (OwnerRez 432406): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'e479337c-fb9c-4513-bcee-e96f24f300ee' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '845 Alexandria / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('e479337c-fb9c-4513-bcee-e96f24f300ee', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8060-a3d1-db72632728f4', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 85 Lower Green Way (OwnerRez 480824): 4 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '82f30000-1b78-42a9-a965-5caf68c508c4' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '85 Lower Green Way / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('82f30000-1b78-42a9-a965-5caf68c508c4', 'access.yale_needs_calibration', 'notion_pid', '3184658d-5f4f-80fa-ad64-e8cf118433ba', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"Carlton Landing requires all vehicles to be registered through the link found  - \nhere \n. The passcode: [removed — credentials are not stored in Resolve] will use in the form is \n447732\n. Unregistered cars can be ticketed or towed, so please take care of this ahead of time.\n\nThe above information is included in the Breezeway Parking Guidelines."$pid$::jsonb, true), updated_at = now() WHERE id = '82f30000-1b78-42a9-a965-5caf68c508c4' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$"Carlton Landing requires all vehicles to be registered through the link found  - here .The passcode: See Guest Access & Credentials will use in the form is 447732. Unregistered cars can be ticketed or towed, so please take care of this ahead of time.\n\nThe above information is included in the Breezeway Parking Guidelines."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '85 Lower Green Way / amenities.access_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('82f30000-1b78-42a9-a965-5caf68c508c4', 'amenities.access_notes', 'notion_pid', '3184658d-5f4f-80fa-ad64-e8cf118433ba', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = jsonb_set(CASE WHEN jsonb_typeof(external_refs) = 'object' THEN external_refs ELSE '{}'::jsonb END, '{"breezeway_url"}', $pid$"https://app.breezeway.io/property/1295307/profile"$pid$::jsonb, true), updated_at = now() WHERE id = '82f30000-1b78-42a9-a965-5caf68c508c4' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$"https://app.breezeway.io/property/1295302/profile"$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '85 Lower Green Way / external_refs.breezeway_url'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('82f30000-1b78-42a9-a965-5caf68c508c4', 'external_refs.breezeway_url', 'notion_pid', '3184658d-5f4f-80fa-ad64-e8cf118433ba', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"NO PETS ALLOWED\n\nFor REPAIR ISSUES AND APPROVAL - only reach out to Tereance: tereance.james@quintessamarketing.com and CC Delilah: \ndelilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Tereance & Delilah are our Operations contact."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '82f30000-1b78-42a9-a965-5caf68c508c4' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM $pid$"For REPAIR ISSUES AND APPROVAL - only reach out to Delilah: delilah@quintessamarketing.com. Do not reach out to Lauren or Leo. Delilah is Operations contact."$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '85 Lower Green Way / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('82f30000-1b78-42a9-a965-5caf68c508c4', 'operating_notes', 'notion_pid', '3184658d-5f4f-80fa-ad64-e8cf118433ba', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 852 Inland Dr. (OwnerRez 490410): 74 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"emergency_key_access"}', $pid$"Yes"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(access #> '{"emergency_key_access"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / access.emergency_key_access'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'access.emergency_key_access', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"garage_remote"}', $pid$"Genie -LiftMaster Chamberlain Craftsman Universal Garage Door Opener Remote - https://www.amazon.com/dp/B08CNKBTYJ?ref_=ppx_hzod_title_dt_b_fed_asin_title_4_10&th=1"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(access #> '{"garage_remote"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / access.garage_remote'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'access.garage_remote', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"key_storage"}', $pid$["Front Door/Smartlock","Storage Closet","Storage Building","Garage Door"]$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(access #> '{"key_storage"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / access.key_storage'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'access.key_storage', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"lock_brand"}', $pid$"Yale"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(access #> '{"lock_brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / access.lock_brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'access.lock_brand', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_module"}', $pid$"Connected & Setup"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / access.yale_module'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'access.yale_module', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'access.yale_needs_calibration', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / amenities.access_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'amenities.access_notes', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"list"}', $pid$["None"]$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(amenities #> '{"list"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / amenities.list'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'amenities.list', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"grill"}', $pid$"No Grill"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(facts #> '{"grill"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / facts.grill'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'facts.grill', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"interior_paint"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(facts #> '{"interior_paint"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / facts.interior_paint'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'facts.interior_paint', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_locations"}', $pid$["Living Room","Primary Bedroom"]$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(facts #> '{"tv_locations"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / facts.tv_locations'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'facts.tv_locations', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"852 Inland Dr Living room - 75,  852 INLAND DR - 55 Primary bedroom"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / facts.tv_specs'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'facts.tv_specs', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"workstation"}', $pid$"Yes"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(facts #> '{"workstation"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / facts.workstation'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'facts.workstation', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"fuel_type"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(fireplace #> '{"fuel_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / fireplace.fuel_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'fireplace.fuel_type', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"gas_switch"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(fireplace #> '{"gas_switch"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / fireplace.gas_switch'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'fireplace.gas_switch', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"gas_switch_location"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(fireplace #> '{"gas_switch_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / fireplace.gas_switch_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'fireplace.gas_switch_location', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"instructions"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(fireplace #> '{"instructions"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / fireplace.instructions'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'fireplace.instructions', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"model"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(fireplace #> '{"model"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / fireplace.model'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'fireplace.model', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"present"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(fireplace #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / fireplace.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'fireplace.present', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET grounds = jsonb_set(CASE WHEN jsonb_typeof(grounds) = 'object' THEN grounds ELSE '{}'::jsonb END, '{"mowing_cadence"}', $pid$"ARHA Responsible"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(grounds #> '{"mowing_cadence"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / grounds.mowing_cadence'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'grounds.mowing_cadence', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET grounds = jsonb_set(CASE WHEN jsonb_typeof(grounds) = 'object' THEN grounds ELSE '{}'::jsonb END, '{"mowing_days"}', $pid$["Wednesday"]$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(grounds #> '{"mowing_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / grounds.mowing_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'grounds.mowing_days', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hoa = jsonb_set(CASE WHEN jsonb_typeof(hoa) = 'object' THEN hoa ELSE '{}'::jsonb END, '{"notes + external_links"}', $pid$"no holiday decor over 30 days; pets/vehicles/RVs in garage only; mailboxes/decks/fences/outbuildings need approval; maintain yards & exterior colors uniformly."$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(hoa #> '{"notes + external_links"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / hoa.notes + external_links'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'hoa.notes + external_links', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hoa = jsonb_set(CASE WHEN jsonb_typeof(hoa) = 'object' THEN hoa ELSE '{}'::jsonb END, '{"present"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(hoa #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / hoa.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'hoa.present', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"14×24×1"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / hvac.filter_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'hvac.filter_notes', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_sizes"}', $pid$["14x24x1"]$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(hvac #> '{"filter_sizes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / hvac.filter_sizes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'hvac.filter_sizes', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET legacy_handoff_date = (jsonb_populate_record(NULL::public.properties, $pid${"legacy_handoff_date":"2026-10-06"}$pid$::jsonb)).legacy_handoff_date, updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND to_jsonb(legacy_handoff_date) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / legacy_handoff_date'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'legacy_handoff_date', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":"3BR Home, Avon IN | Extended & Monthly Stays"}$pid$::jsonb)).listing_alias, updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND to_jsonb(listing_alias) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / listing_alias'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'listing_alias', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":"Austin Lakes North"}$pid$::jsonb)).neighborhood, updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND to_jsonb(neighborhood) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / neighborhood'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'neighborhood', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Back Storage is locked not available for guest and nothing is inside that room, Key is in the garage trim lockbox.   Spare front door key is the storage closet"}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'operating_notes', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"cluster_mailbox"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(parking #> '{"cluster_mailbox"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / parking.cluster_mailbox'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'parking.cluster_mailbox', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"mailbox_location"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(parking #> '{"mailbox_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / parking.mailbox_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'parking.mailbox_location', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"mailbox_number"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(parking #> '{"mailbox_number"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / parking.mailbox_number'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'parking.mailbox_number', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = jsonb_set(CASE WHEN jsonb_typeof(pool_spa) = 'object' THEN pool_spa ELSE '{}'::jsonb END, '{"present"}', $pid$"None"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(pool_spa #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / pool_spa.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'pool_spa.present', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"alarm"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(security #> '{"alarm"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / security.alarm'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'security.alarm', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"battery_type"}', $pid$["Hardwired - No Battery"]$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(security #> '{"battery_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / security.battery_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'security.battery_type', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"devices"}', $pid$["Front Door","Garage"]$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(security #> '{"devices"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / security.devices'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'security.devices', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"monitoring_expires_on"}', $pid$"2027-10-09"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(security #> '{"monitoring_expires_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / security.monitoring_expires_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'security.monitoring_expires_on', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"monitoring_plan"}', $pid$["Active"]$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(security #> '{"monitoring_plan"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / security.monitoring_plan'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'security.monitoring_plan', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"brand"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(sprinklers #> '{"brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / sprinklers.brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'sprinklers.brand', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"controller_location"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(sprinklers #> '{"controller_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / sprinklers.controller_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'sprinklers.controller_location', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"set_for_season"}', $pid${"value":"N/A","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid"}$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(sprinklers #> '{"set_for_season"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / sprinklers.set_for_season'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'sprinklers.set_for_season', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"status"}', $pid$"Property Does Not Have Sprinkler System"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(sprinklers #> '{"status"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / sprinklers.status'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'sprinklers.status', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET storm_shelter = jsonb_set(CASE WHEN jsonb_typeof(storm_shelter) = 'object' THEN storm_shelter ELSE '{}'::jsonb END, '{"location_access"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(storm_shelter #> '{"location_access"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / storm_shelter.location_access'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'storm_shelter.location_access', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"breaker_panel_location"}', $pid$"Garage"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"breaker_panel_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / systems.breaker_panel_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.breaker_panel_location', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"co"}', CASE WHEN jsonb_typeof(systems #> '{"co"}') = 'object' THEN systems #> '{"co"}' ELSE '{}'::jsonb END, true), '{"co","installed"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"co","installed"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / systems.co.installed'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.co.installed', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"co"}', CASE WHEN jsonb_typeof(systems #> '{"co"}') = 'object' THEN systems #> '{"co"}' ELSE '{}'::jsonb END, true), '{"co","location"}', $pid$"Kitchen"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"co","location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / systems.co.location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.co.location', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter"}', $pid$"Frigidaire PurePour PWF-1 refrigerator water filter — FPPWFU01"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / systems.fridge_filter'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.fridge_filter', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter_5yr"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"fridge_filter_5yr"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / systems.fridge_filter_5yr'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.fridge_filter_5yr', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2026-09-25"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / systems.smoke.batteries_changed_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.smoke.batteries_changed_on', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","battery_type"}', $pid$"9-Volt (Alkaline)"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"smoke","battery_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / systems.smoke.battery_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.smoke.battery_type', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","brand"}', $pid$"Siterwell"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"smoke","brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / systems.smoke.brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.smoke.brand', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_on"}', $pid$"2035-09-30"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"smoke","expires_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / systems.smoke.expires_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.smoke.expires_on', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_precision"}', $pid$"month"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"smoke","expires_precision"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / systems.smoke.expires_precision'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.smoke.expires_precision', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_source_text"}', $pid$"September 2035"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"smoke","expires_source_text"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / systems.smoke.expires_source_text'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.smoke.expires_source_text', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","notes"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"smoke","notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / systems.smoke.notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.smoke.notes', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","power_type"}', $pid$"Hardwired"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"smoke","power_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / systems.smoke.power_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.smoke.power_type', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"supply_box_location"}', $pid$"Top shelf in master closet"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"supply_box_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / systems.supply_box_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.supply_box_location', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"supply_storage"}', $pid$"Closet"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"supply_storage"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / systems.supply_storage'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.supply_storage', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"water_shutoff_indoor"}', $pid$"Garage"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"water_shutoff_indoor"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / systems.water_shutoff_indoor'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.water_shutoff_indoor', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"water_shutoff_outdoor"}', $pid$"Close to the sidewalk"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(systems #> '{"water_shutoff_outdoor"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / systems.water_shutoff_outdoor'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'systems.water_shutoff_outdoor', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier, updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND to_jsonb(tier) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / tier'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'tier', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"router_location"}', $pid$"Master bedroom"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(utilities #> '{"router_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / utilities.router_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'utilities.router_location', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_ssid"}', $pid$"ARHA"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(utilities #> '{"wifi_ssid"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / utilities.wifi_ssid'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'utilities.wifi_ssid', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET warranty = jsonb_set(CASE WHEN jsonb_typeof(warranty) = 'object' THEN warranty ELSE '{}'::jsonb END, '{"builder_present"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(warranty #> '{"builder_present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / warranty.builder_present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'warranty.builder_present', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET warranty = jsonb_set(CASE WHEN jsonb_typeof(warranty) = 'object' THEN warranty ELSE '{}'::jsonb END, '{"claim_process + external_links"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(warranty #> '{"claim_process + external_links"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / warranty.claim_process + external_links'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'warranty.claim_process + external_links', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET warranty = jsonb_set(CASE WHEN jsonb_typeof(warranty) = 'object' THEN warranty ELSE '{}'::jsonb END, '{"furniture_expires_on"}', $pid$"2029-10-06"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(warranty #> '{"furniture_expires_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / warranty.furniture_expires_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'warranty.furniture_expires_on', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"cart_count"}', $pid$3$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(waste #> '{"cart_count"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / waste.cart_count'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'waste.cart_count', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"cart_notes"}', $pid$"3"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(waste #> '{"cart_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / waste.cart_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'waste.cart_notes', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"holiday_notes"}', $pid$"service may be delayed by up to 7 days around the following holidays"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(waste #> '{"holiday_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / waste.holiday_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'waste.holiday_notes', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"recycling"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(waste #> '{"recycling"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / waste.recycling'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'waste.recycling', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"recycling_days"}', $pid$"every other Thursday"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(waste #> '{"recycling_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / waste.recycling_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'waste.recycling_days', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"strict_rules"}', $pid$"Garbage/Trash containers are only permitted to be left outside for trash collection Containers cannot be permanently stored in front of or alongside a home Must be kept in an enclosed garage on non-trash collection days"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(waste #> '{"strict_rules"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / waste.strict_rules'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'waste.strict_rules', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"trash_days"}', $pid$["Thursday"]$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(waste #> '{"trash_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / waste.trash_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'waste.trash_days', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '9837359e-7233-44d7-aa4a-e0ee8f4d1001' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '852 Inland Dr. / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9837359e-7233-44d7-aa4a-e0ee8f4d1001', 'waste.valet', 'notion_pid', '3a04658d-5f4f-8160-b98e-fa3b9142ff9a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 8602 E. Galveston St. (OwnerRez 497214): 10 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_integration_live"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND coalesce(access #> '{"yale_integration_live"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8602 E. Galveston St. / access.yale_integration_live'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'access.yale_integration_live', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8602 E. Galveston St. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'access.yale_needs_calibration', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET compliance = jsonb_set(CASE WHEN jsonb_typeof(compliance) = 'object' THEN compliance ELSE '{}'::jsonb END, '{"rental_restrictions"}', $pid${"text":"No STR rental restrictions","as_of":"2026-11-03T22:19:00.000Z","source":"notion_pid","reference_only":true}$pid$::jsonb, true), updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND coalesce(compliance #> '{"rental_restrictions"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8602 E. Galveston St. / compliance.rental_restrictions'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'compliance.rental_restrictions', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET external_refs = jsonb_set(CASE WHEN jsonb_typeof(external_refs) = 'object' THEN external_refs ELSE '{}'::jsonb END, '{"breezeway_url"}', $pid$"https://app.breezeway.io/property/1514896/profile"$pid$::jsonb, true), updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND coalesce(external_refs #> '{"breezeway_url"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8602 E. Galveston St. / external_refs.breezeway_url'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'external_refs.breezeway_url', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET furniture_package = (jsonb_populate_record(NULL::public.properties, $pid${"furniture_package":"Signature (Gold)"}$pid$::jsonb)).furniture_package, updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND to_jsonb(furniture_package) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8602 E. Galveston St. / furniture_package'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'furniture_package', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET nickname = (jsonb_populate_record(NULL::public.properties, $pid${"nickname":"Rosewood on Galveston (8602)"}$pid$::jsonb)).nickname, updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND to_jsonb(nickname) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8602 E. Galveston St. / nickname'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'nickname', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"summary"}', $pid$"2 Car Garage\nFree Parking on Premises"$pid$::jsonb, true), updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND coalesce(parking #> '{"summary"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8602 E. Galveston St. / parking.summary'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'parking.summary', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET tier = (jsonb_populate_record(NULL::public.properties, $pid${"tier":"B"}$pid$::jsonb)).tier, updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND to_jsonb(tier) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8602 E. Galveston St. / tier'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'tier', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_split_confirmed"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND coalesce(utilities #> '{"wifi_split_confirmed"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8602 E. Galveston St. / utilities.wifi_split_confirmed'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'utilities.wifi_split_confirmed', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET year_built = (jsonb_populate_record(NULL::public.properties, $pid${"year_built":2026}$pid$::jsonb)).year_built, updated_at = now() WHERE id = '8decd427-35f5-43ca-afa2-ee916f98fb95' AND to_jsonb(year_built) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8602 E. Galveston St. / year_built'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'year_built', 'notion_pid', '3e44658d-5f4f-81d2-b672-c1648b662601', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 8708 Scirocco Circle (OwnerRez 468337): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '1e60c99a-e779-4d77-be8d-c8452f991a2d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8708 Scirocco Circle / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('1e60c99a-e779-4d77-be8d-c8452f991a2d', 'access.yale_needs_calibration', 'notion_pid', '29b4658d-5f4f-81f5-aa60-c39e420f408a', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 8910 N 73rd Pl E (OwnerRez 435218): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'fd0972a5-3501-4d1f-a33b-53cfaa184ec4' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '8910 N 73rd Pl E / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('fd0972a5-3501-4d1f-a33b-53cfaa184ec4', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8097-bdc9-ffa02eee6324', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 9008 Scarlet Blvd (30D FIRM) (OwnerRez 425257): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '3f2435d5-406c-47f1-b943-4e34d4f839c1' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9008 Scarlet Blvd (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('3f2435d5-406c-47f1-b943-4e34d4f839c1', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80dc-aa25-f39bb42e5621', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 904 NE 34th Ter (OwnerRez 401887): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '7c33e4d9-2a9c-4924-bec0-67f337d3849d' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '904 NE 34th Ter / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('7c33e4d9-2a9c-4924-bec0-67f337d3849d', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8083-b586-e3d46180c739', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 9100 NW 123rd (30D Firm) (OwnerRez 439580): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'c46466fa-9e9d-4b75-a4ed-715c75be06bf' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9100 NW 123rd (30D Firm) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('c46466fa-9e9d-4b75-a4ed-715c75be06bf', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80bb-aa73-f6bd406de871', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 9120 Yassir Blvd (30D FIRM) (OwnerRez 396058): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = 'bf746f13-5146-4c9a-ac6c-f42206ca2257' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9120 Yassir Blvd (30D FIRM) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('bf746f13-5146-4c9a-ac6c-f42206ca2257', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-8046-89b8-db60d059c330', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 9211 Fitzgerald Dr. (OwnerRez 492500): 72 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"emergency_key_access"}', $pid$"Yes"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(access #> '{"emergency_key_access"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / access.emergency_key_access'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'access.emergency_key_access', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"garage_remote"}', $pid$"R27- GDR-27 MLT - https://www.amazon.com/dp/B08CNKBTYJ?ref=fed_asin_title&th=1"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(access #> '{"garage_remote"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / access.garage_remote'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'access.garage_remote', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"key_storage"}', $pid$["Front Door/Smartlock","Backdoor","Garage Door"]$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(access #> '{"key_storage"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / access.key_storage'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'access.key_storage', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"lock_brand"}', $pid$"Yale"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(access #> '{"lock_brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / access.lock_brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'access.lock_brand', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_module"}', $pid$"Connected & Setup"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(access #> '{"yale_module"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / access.yale_module'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'access.yale_module', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'access.yale_needs_calibration', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"access_notes"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(amenities #> '{"access_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / amenities.access_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'amenities.access_notes', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET amenities = jsonb_set(CASE WHEN jsonb_typeof(amenities) = 'object' THEN amenities ELSE '{}'::jsonb END, '{"list"}', $pid$["Pond","Walking Trail"]$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(amenities #> '{"list"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / amenities.list'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'amenities.list', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"grill"}', $pid$"No Grill"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(facts #> '{"grill"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / facts.grill'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'facts.grill', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"interior_paint"}', $pid$"1. Wall color - agreeable gray SW7029\n2. Sheen - matte\n\nNo additional paint left at the property."$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(facts #> '{"interior_paint"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / facts.interior_paint'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'facts.interior_paint', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_locations"}', $pid$["Living Room","Primary Bedroom"]$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(facts #> '{"tv_locations"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / facts.tv_locations'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'facts.tv_locations', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"tv_specs"}', $pid$"Living room -  9211 Fitzgerald Dr - 65” Roku TV, Primary Bedroom -  9211 Fitzgerald Dr - 55” Roku TV, Bonus Room -  9211 Fitzgerald Dr - 55” Roku TV"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(facts #> '{"tv_specs"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / facts.tv_specs'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'facts.tv_specs', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET facts = jsonb_set(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END, '{"workstation"}', $pid$"Yes"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(facts #> '{"workstation"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / facts.workstation'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'facts.workstation', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"fuel_type"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(fireplace #> '{"fuel_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / fireplace.fuel_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'fireplace.fuel_type', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"gas_switch"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(fireplace #> '{"gas_switch"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / fireplace.gas_switch'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'fireplace.gas_switch', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"gas_switch_location"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(fireplace #> '{"gas_switch_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / fireplace.gas_switch_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'fireplace.gas_switch_location', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"instructions"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(fireplace #> '{"instructions"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / fireplace.instructions'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'fireplace.instructions', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"model"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(fireplace #> '{"model"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / fireplace.model'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'fireplace.model', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET fireplace = jsonb_set(CASE WHEN jsonb_typeof(fireplace) = 'object' THEN fireplace ELSE '{}'::jsonb END, '{"present"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(fireplace #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / fireplace.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'fireplace.present', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET grounds = jsonb_set(CASE WHEN jsonb_typeof(grounds) = 'object' THEN grounds ELSE '{}'::jsonb END, '{"mowing_cadence"}', $pid$"ARHA Responsible"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(grounds #> '{"mowing_cadence"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / grounds.mowing_cadence'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'grounds.mowing_cadence', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET grounds = jsonb_set(CASE WHEN jsonb_typeof(grounds) = 'object' THEN grounds ELSE '{}'::jsonb END, '{"mowing_days"}', $pid$["Monday"]$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(grounds #> '{"mowing_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / grounds.mowing_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'grounds.mowing_days', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hoa = jsonb_set(CASE WHEN jsonb_typeof(hoa) = 'object' THEN hoa ELSE '{}'::jsonb END, '{"present"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(hoa #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / hoa.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'hoa.present', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_notes"}', $pid$"1: 16×24×4"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(hvac #> '{"filter_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / hvac.filter_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'hvac.filter_notes', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET hvac = jsonb_set(CASE WHEN jsonb_typeof(hvac) = 'object' THEN hvac ELSE '{}'::jsonb END, '{"filter_sizes"}', $pid$["16x24x4"]$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(hvac #> '{"filter_sizes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / hvac.filter_sizes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'hvac.filter_sizes', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET listing_alias = (jsonb_populate_record(NULL::public.properties, $pid${"listing_alias":"4BR | Sleeps 8, Study & Bonus Room"}$pid$::jsonb)).listing_alias, updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND to_jsonb(listing_alias) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / listing_alias'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'listing_alias', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET neighborhood = (jsonb_populate_record(NULL::public.properties, $pid${"neighborhood":"Fields of New Bethel"}$pid$::jsonb)).neighborhood, updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND to_jsonb(neighborhood) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / neighborhood'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'neighborhood', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET operating_notes = (jsonb_populate_record(NULL::public.properties, $pid${"operating_notes":"Intro meeting notes - 9211 Fitzgerald \n- Per the intro meeting notes, the designated plumber, HVAC contractor, and electrician must be used for at least 2 years.\n- Per the intro meeting notes, the builder will arrange meetings around 8 months and 10 months after closing.\n\nHVAC Contractor - Chris Chittum Enterprises LLC\nPlumber - R.T. Moore\nElectrical - ARCXIS\n\n**Owner does not want to see any diagnostic fees when possible."}$pid$::jsonb)).operating_notes, updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND to_jsonb(operating_notes) IS NOT DISTINCT FROM NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / operating_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'operating_notes', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"cluster_mailbox"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(parking #> '{"cluster_mailbox"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / parking.cluster_mailbox'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'parking.cluster_mailbox', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"mailbox_location"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(parking #> '{"mailbox_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / parking.mailbox_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'parking.mailbox_location', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET parking = jsonb_set(CASE WHEN jsonb_typeof(parking) = 'object' THEN parking ELSE '{}'::jsonb END, '{"mailbox_number"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(parking #> '{"mailbox_number"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / parking.mailbox_number'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'parking.mailbox_number', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET pool_spa = jsonb_set(CASE WHEN jsonb_typeof(pool_spa) = 'object' THEN pool_spa ELSE '{}'::jsonb END, '{"present"}', $pid$"None"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(pool_spa #> '{"present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / pool_spa.present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'pool_spa.present', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"alarm"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(security #> '{"alarm"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / security.alarm'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'security.alarm', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"battery_type"}', $pid$["Hardwired - No Battery"]$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(security #> '{"battery_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / security.battery_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'security.battery_type', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"devices"}', $pid$["Front Door","Driveway"]$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(security #> '{"devices"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / security.devices'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'security.devices', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"monitoring_expires_on"}', $pid$"2027-10-27"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(security #> '{"monitoring_expires_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / security.monitoring_expires_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'security.monitoring_expires_on', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET security = jsonb_set(CASE WHEN jsonb_typeof(security) = 'object' THEN security ELSE '{}'::jsonb END, '{"monitoring_plan"}', $pid$["Active"]$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(security #> '{"monitoring_plan"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / security.monitoring_plan'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'security.monitoring_plan', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"brand"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(sprinklers #> '{"brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / sprinklers.brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'sprinklers.brand', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"controller_location"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(sprinklers #> '{"controller_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / sprinklers.controller_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'sprinklers.controller_location', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"set_for_season"}', $pid${"value":"N/A","as_of":"2026-11-05T21:46:00.000Z","source":"notion_pid"}$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(sprinklers #> '{"set_for_season"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / sprinklers.set_for_season'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'sprinklers.set_for_season', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET sprinklers = jsonb_set(CASE WHEN jsonb_typeof(sprinklers) = 'object' THEN sprinklers ELSE '{}'::jsonb END, '{"status"}', $pid$"Property Does Not Have Sprinkler System"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(sprinklers #> '{"status"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / sprinklers.status'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'sprinklers.status', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET storm_shelter = jsonb_set(CASE WHEN jsonb_typeof(storm_shelter) = 'object' THEN storm_shelter ELSE '{}'::jsonb END, '{"location_access"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(storm_shelter #> '{"location_access"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / storm_shelter.location_access'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'storm_shelter.location_access', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"breaker_panel_location"}', $pid$"Garage"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"breaker_panel_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / systems.breaker_panel_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.breaker_panel_location', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"co"}', CASE WHEN jsonb_typeof(systems #> '{"co"}') = 'object' THEN systems #> '{"co"}' ELSE '{}'::jsonb END, true), '{"co","installed"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"co","installed"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / systems.co.installed'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.co.installed', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"co"}', CASE WHEN jsonb_typeof(systems #> '{"co"}') = 'object' THEN systems #> '{"co"}' ELSE '{}'::jsonb END, true), '{"co","location"}', $pid$"Kitchen"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"co","location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / systems.co.location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.co.location', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter"}', $pid$"Everydrop"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"fridge_filter"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / systems.fridge_filter'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.fridge_filter', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"fridge_filter_5yr"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"fridge_filter_5yr"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / systems.fridge_filter_5yr'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.fridge_filter_5yr', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","batteries_changed_on"}', $pid$"2026-10-07"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"smoke","batteries_changed_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / systems.smoke.batteries_changed_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.smoke.batteries_changed_on', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","battery_type"}', $pid$"9-Volt (Lithium)"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"smoke","battery_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / systems.smoke.battery_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.smoke.battery_type', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","brand"}', $pid$"First alert"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"smoke","brand"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / systems.smoke.brand'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.smoke.brand', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_on"}', $pid$"2036-12-31"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"smoke","expires_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / systems.smoke.expires_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.smoke.expires_on', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_precision"}', $pid$"year"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"smoke","expires_precision"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / systems.smoke.expires_precision'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.smoke.expires_precision', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","expires_source_text"}', $pid$"2036"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"smoke","expires_source_text"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / systems.smoke.expires_source_text'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.smoke.expires_source_text', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","notes"}', $pid$"N/A"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"smoke","notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / systems.smoke.notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.smoke.notes', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"smoke"}', CASE WHEN jsonb_typeof(systems #> '{"smoke"}') = 'object' THEN systems #> '{"smoke"}' ELSE '{}'::jsonb END, true), '{"smoke","power_type"}', $pid$"Hardwired"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"smoke","power_type"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / systems.smoke.power_type'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.smoke.power_type', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"supply_box_location"}', $pid$"Master closet top shelf"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"supply_box_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / systems.supply_box_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.supply_box_location', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"supply_storage"}', $pid$"Closet"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"supply_storage"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / systems.supply_storage'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.supply_storage', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"water_shutoff_indoor"}', $pid$"Closet under staircase"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"water_shutoff_indoor"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / systems.water_shutoff_indoor'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.water_shutoff_indoor', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET systems = jsonb_set(CASE WHEN jsonb_typeof(systems) = 'object' THEN systems ELSE '{}'::jsonb END, '{"water_shutoff_outdoor"}', $pid$"Near the street"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(systems #> '{"water_shutoff_outdoor"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / systems.water_shutoff_outdoor'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'systems.water_shutoff_outdoor', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"router_location"}', $pid$"Living room"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(utilities #> '{"router_location"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / utilities.router_location'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'utilities.router_location', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET utilities = jsonb_set(CASE WHEN jsonb_typeof(utilities) = 'object' THEN utilities ELSE '{}'::jsonb END, '{"wifi_ssid"}', $pid$"ARHA"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(utilities #> '{"wifi_ssid"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / utilities.wifi_ssid'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'utilities.wifi_ssid', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET warranty = jsonb_set(CASE WHEN jsonb_typeof(warranty) = 'object' THEN warranty ELSE '{}'::jsonb END, '{"builder_expires_on"}', $pid$"2027-09-10"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(warranty #> '{"builder_expires_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / warranty.builder_expires_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'warranty.builder_expires_on', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET warranty = jsonb_set(CASE WHEN jsonb_typeof(warranty) = 'object' THEN warranty ELSE '{}'::jsonb END, '{"builder_present"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(warranty #> '{"builder_present"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / warranty.builder_present'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'warranty.builder_present', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET warranty = jsonb_set(CASE WHEN jsonb_typeof(warranty) = 'object' THEN warranty ELSE '{}'::jsonb END, '{"claim_process + external_links"}', $pid$"Dr. Horton- Christopher Bishop CSBishop@drhorton.com - 317-552-9067\n\n- The designated plumber, HVAC contractor, and electrician must be used for at least 2 years.\n\nWarranty request: https://www.drhorton.com/Warranty\n- The builder will arrange meetings around 8 months and 10 months after closing.\n- Fixtures: 1 year of coverage.\n- Mechanicals inside the walls: 2 years of coverage.\n- Roof: 4 years of coverage.\n- Foundation and load-bearing framing: 10 years of coverage.\n- RWC homeowner warranty exclusions: Section II, page 5.\n- RWC contact for matters beyond 2 years: 717-561-4480."$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(warranty #> '{"claim_process + external_links"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / warranty.claim_process + external_links'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'warranty.claim_process + external_links', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET warranty = jsonb_set(CASE WHEN jsonb_typeof(warranty) = 'object' THEN warranty ELSE '{}'::jsonb END, '{"furniture_expires_on"}', $pid$"2029-10-27"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(warranty #> '{"furniture_expires_on"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / warranty.furniture_expires_on'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'warranty.furniture_expires_on', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"cart_count"}', $pid$2$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(waste #> '{"cart_count"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / waste.cart_count'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'waste.cart_count', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"cart_notes"}', $pid$"2"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(waste #> '{"cart_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / waste.cart_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'waste.cart_notes', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"holiday_notes"}', $pid$"Saturday"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(waste #> '{"holiday_notes"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / waste.holiday_notes'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'waste.holiday_notes', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"recycling"}', $pid$true$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(waste #> '{"recycling"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / waste.recycling'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'waste.recycling', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"recycling_days"}', $pid$"Every Other Friday"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(waste #> '{"recycling_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / waste.recycling_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'waste.recycling_days', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"strict_rules"}', $pid$"Keep trash in enclosed cans out of street and neighbor view, don’t let it pile up, and dumping anywhere in the subdivision costs at least $150 (pickup: City of Indianapolis, 317-917-7300)."$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(waste #> '{"strict_rules"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / waste.strict_rules'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'waste.strict_rules', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"trash_days"}', $pid$["Friday"]$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(waste #> '{"trash_days"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / waste.trash_days'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'waste.trash_days', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '79319968-80c9-4f00-b6c9-608c0b1881dc' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9211 Fitzgerald Dr. / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('79319968-80c9-4f00-b6c9-608c0b1881dc', 'waste.valet', 'notion_pid', '3b94658d-5f4f-81a0-ae8b-de84667d55e7', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 9213 Anaum Ln (30D Firm) (OwnerRez 393344): 1 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '9eb43a4f-5557-4041-8066-f53b42d0ffb2' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9213 Anaum Ln (30D Firm) / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('9eb43a4f-5557-4041-8066-f53b42d0ffb2', 'access.yale_needs_calibration', 'notion_pid', '1664658d-5f4f-80a6-82fd-e7e8e7a9b32b', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- 9235 E 133rd St S (OwnerRez 439579): 2 value(s)
DO $do$ BEGIN
  UPDATE public.properties SET access = jsonb_set(CASE WHEN jsonb_typeof(access) = 'object' THEN access ELSE '{}'::jsonb END, '{"yale_needs_calibration"}', $pid$false$pid$::jsonb, true), updated_at = now() WHERE id = '792d6764-76e9-40e1-8bfc-e79b5dae44ee' AND coalesce(access #> '{"yale_needs_calibration"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9235 E 133rd St S / access.yale_needs_calibration'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('792d6764-76e9-40e1-8bfc-e79b5dae44ee', 'access.yale_needs_calibration', 'notion_pid', '16b4658d-5f4f-800b-ac5b-d57747df2836', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
DO $do$ BEGIN
  UPDATE public.properties SET waste = jsonb_set(CASE WHEN jsonb_typeof(waste) = 'object' THEN waste ELSE '{}'::jsonb END, '{"valet"}', $pid$"No"$pid$::jsonb, true), updated_at = now() WHERE id = '792d6764-76e9-40e1-8bfc-e79b5dae44ee' AND coalesce(waste #> '{"valet"}', 'null'::jsonb) = $pid$null$pid$::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Changed since the dry run: %', '9235 E 133rd St S / waste.valet'; END IF;
END $do$;
INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
  VALUES ('792d6764-76e9-40e1-8bfc-e79b5dae44ee', 'waste.valet', 'notion_pid', '16b4658d-5f4f-800b-ac5b-d57747df2836', '2026-11-12', 'PID refresh 2026-11-12')
  ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = EXCLUDED.value_source, source_record_id = EXCLUDED.source_record_id,
    as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();

-- New reference links (same kinds and flags as the Sep 1 importer).
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('cef6cc5e-9c71-4110-9261-6165c75d1adc', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1565707/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('0b993bf6-d685-4d93-bd2b-6f803708314a', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1564238/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('e4271978-babe-4126-b66a-b8c9dee73602', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1563499/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1542591/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('2ac3120b-cec9-4735-b4b6-c130bdab63fd', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1529710/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('ada9100f-26ec-4277-9fe5-9d05792aff70', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1514895/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('8decd427-35f5-43ca-afa2-ee916f98fb95', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1514896/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
  ON CONFLICT (property_id, kind, url) DO NOTHING;
INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
  VALUES ('61d75516-d1ea-43b4-a8f9-f2476393c516', 'system', 'BW Property Link', 'https://app.breezeway.io/property/1509882/profile', NULL, true, true, false, 'notion_pid', 'BW Property Link', '2026-11-12', NULL)
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
