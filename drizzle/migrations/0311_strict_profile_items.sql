-- Property page step 03: the Home Profile save accepts only the exact items on the page.
-- Before: any path (1-2 levels) inside a listed column could be written.
-- After: each change must match its item key's stored place exactly; links use the item's own source field.
-- Undo: 03_undo_strict_profile_items.sql (restores the step 02 function body).
CREATE OR REPLACE FUNCTION public.save_home_profile_card(_property_id uuid, _card text, _changes jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor text;
  v_change jsonb;
  v_target text;
  v_col text;
  v_path text[];
  v_value jsonb;
  v_old jsonb;
  v_type text;
  v_url text;
  v_link_id uuid;
  v_labels text[] := ARRAY[]::text[];
  v_count integer := 0;
  v_spec text;
  v_source text;
  -- The exact items the Home Profile may change, one per item key (from src/lib/home-profile.ts).
  v_allowed constant jsonb := '{"nickname":"column:nickname","listing_alias":"column:listing_alias","bedrooms":"column:bedrooms","bathrooms":"column:bathrooms","living_area_sqft":"column:living_area_sqft","year_built":"column:year_built","max_guests":"column:max_guests","tier":"column:tier","parking":"json:parking:summary","instant_book":"column:instant_book","lock_brand":"json:access:lock_brand","access_codes":"code","key_storage":"json:access:key_storage","garage_trim_code":"code","garage_keypad_code":"code","gate_code":"code","emergency_key_access":"json:access:emergency_key_access","garage_remote":"json:access:garage_remote","mailbox_number":"json:parking:mailbox_number","cluster_mailbox":"json:parking:cluster_mailbox","cluster_mailbox_location":"json:parking:mailbox_location","supply_storage":"json:systems:supply_storage","supply_box_location":"json:systems:supply_box_location","supply_box_code":"code","storage_closet_code":"code","fireplace_present":"json:fireplace:present","fireplace_type":"json:fireplace:fuel_type","fireplace_model":"json:fireplace:model","gas_switch":"json:fireplace:gas_switch","gas_switch_location":"json:fireplace:gas_switch_location","fireplace_instructions":"json:fireplace:instructions","interior_paint":"json:facts:interior_paint","grill":"json:facts:grill","workstation":"json:facts:workstation","tv_specs":"json:facts:tv_specs","tv_locations":"json:facts:tv_locations","furniture_package":"column:furniture_package","furniture_warranty":"json:warranty:furniture_expires_on","wifi_ssid":"json:utilities:wifi_ssid","wifi_password":"code","wifi_split":"json:utilities:wifi_split_confirmed","router_location":"json:utilities:router_location","yale_module":"json:access:yale_module","yale_live":"json:access:yale_integration_live","yale_calibration":"json:access:yale_needs_calibration","builder_warranty":"json:warranty:builder_present","builder_warranty_expires":"json:warranty:builder_expires_on","builder_warranty_claim":"json:warranty:claim_process","furniture_pick_list":"link:Furniture Pick List Link","alarm":"json:security:alarm","alarm_code":"code","security_cameras":"json:security:devices","camera_battery":"json:security:battery_type","camera_feed":"link:Security Camera Feed","monitoring_plan":"json:security:monitoring_plan","monitoring_expires":"json:security:monitoring_expires_on","smoke_brand":"json:systems:smoke.brand","smoke_notes":"json:systems:smoke.notes","smoke_expires":"json:systems:smoke.expires_on","smoke_power":"json:systems:smoke.power_type","smoke_battery":"json:systems:smoke.battery_type","smoke_batteries_changed":"json:systems:smoke.batteries_changed_on","co_installed":"json:systems:co.installed","co_location":"json:systems:co.location","breaker_box":"json:systems:breaker_panel_location","water_indoor":"json:systems:water_shutoff_indoor","water_outdoor":"json:systems:water_shutoff_outdoor","sprinkler_brand":"json:sprinklers:brand","sprinkler_location":"json:sprinklers:controller_location","sprinkler_status":"json:sprinklers:status","sprinkler_season":"json:sprinklers:set_for_season","fridge_filter_5yr":"json:systems:fridge_filter_5yr","fridge_filter":"json:systems:fridge_filter","storm_shelter":"json:storm_shelter:location_access","pool_present":"json:pool_spa:present","pool_heated":"json:pool_spa:heated","pool_heater":"json:pool_spa:heater","pool_season":"json:pool_spa:season","pool_service":"json:pool_spa:service_schedule","hot_tub_panel":"json:pool_spa:control_panel_location","pool_tech_form":"link:Pool & Hot Tub Technician Form","neighborhood":"column:neighborhood","hoa_present":"json:hoa:present","hoa_notes":"json:hoa:notes","covenants":"link:Covenants","amenities":"json:amenities:list","amenities_access":"json:amenities:access_notes","pool_fob_code":"code","strict_trash":"json:waste:strict_rules","trash_day":"json:waste:trash_days","recycling_cart":"json:waste:recycling","recycling_day":"json:waste:recycling_days","holiday_trash":"json:waste:holiday_notes","trash_carts":"json:waste:cart_count","trash_valet":"json:waste:valet","mowing":"json:grounds:mowing_cadence","mowing_day":"json:grounds:mowing_days","air_filters":"json:hvac:filter_notes"}'::jsonb;
  v_typed constant jsonb := jsonb_build_object(
    'nickname','text','listing_alias','text','neighborhood','text','tier','text',
    'furniture_package','text','bedrooms','integer','bathrooms','numeric',
    'max_guests','integer','living_area_sqft','integer','year_built','integer',
    'instant_book','boolean');
  v_json constant text[] := ARRAY['facts','parking','access','utilities','hvac','systems',
    'fireplace','storm_shelter','sprinklers','grounds','waste','pool_spa','hoa',
    'amenities','security','warranty','compliance'];
BEGIN
  IF NOT private.home_profile_editor(v_uid) THEN
    RAISE EXCEPTION 'You can view this home but not change it.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id = _property_id) THEN
    RAISE EXCEPTION 'That home could not be found.';
  END IF;
  IF jsonb_typeof(_changes) <> 'array' OR jsonb_array_length(_changes) = 0 THEN
    RAISE EXCEPTION 'Nothing to save.';
  END IF;
  IF jsonb_array_length(_changes) > 60 THEN
    RAISE EXCEPTION 'Too many changes in one save.';
  END IF;
  v_actor := private.actor_label(v_uid);
  PERFORM 1 FROM public.properties WHERE id = _property_id FOR UPDATE;

  FOR v_change IN SELECT * FROM jsonb_array_elements(_changes) LOOP
    v_target := v_change->>'target';
    v_value := v_change->'value';
    IF v_value = 'null'::jsonb THEN v_value := NULL; END IF;
    IF coalesce(v_change->>'key','') = '' OR coalesce(v_change->>'label','') = '' THEN
      RAISE EXCEPTION 'Each change needs its item.';
    END IF;
    v_spec := v_allowed->>(v_change->>'key');
    IF v_spec IS NULL THEN RAISE EXCEPTION 'That item cannot be edited here.'; END IF;

    IF v_target = 'column' THEN
      v_col := v_change->>'column';
      v_type := v_typed->>v_col;
      IF v_type IS NULL OR v_spec <> 'column:' || v_col THEN RAISE EXCEPTION 'That item cannot be edited here.'; END IF;
      EXECUTE format('SELECT to_jsonb(%I) FROM public.properties WHERE id = $1', v_col) INTO v_old USING _property_id;
      EXECUTE format('UPDATE public.properties SET %I = ($1 #>> ''{}'')::%s, updated_at = now() WHERE id = $2', v_col, v_type)
        USING v_value, _property_id;

    ELSIF v_target = 'json' THEN
      v_col := v_change->>'column';
      IF NOT (v_col = ANY (v_json)) THEN RAISE EXCEPTION 'That item cannot be edited here.'; END IF;
      SELECT array_agg(x) INTO v_path FROM jsonb_array_elements_text(v_change->'path') x;
      IF v_path IS NULL OR array_length(v_path, 1) NOT BETWEEN 1 AND 2
         OR v_spec <> 'json:' || v_col || ':' || array_to_string(v_path, '.') THEN
        RAISE EXCEPTION 'That item cannot be edited here.';
      END IF;
      EXECUTE format('SELECT %I #> $1 FROM public.properties WHERE id = $2', v_col) INTO v_old USING v_path, _property_id;
      IF array_length(v_path, 1) = 2 THEN
        EXECUTE format(
          'UPDATE public.properties SET %1$I = jsonb_set(CASE WHEN jsonb_typeof(%1$I) = ''object'' THEN %1$I ELSE ''{}''::jsonb END, ARRAY[$1], CASE WHEN jsonb_typeof(%1$I -> $1) = ''object'' THEN %1$I -> $1 ELSE ''{}''::jsonb END, true), updated_at = now() WHERE id = $2',
          v_col) USING v_path[1], _property_id;
      END IF;
      EXECUTE format(
        'UPDATE public.properties SET %1$I = jsonb_set(CASE WHEN jsonb_typeof(%1$I) = ''object'' THEN %1$I ELSE ''{}''::jsonb END, $1, coalesce($2, ''null''::jsonb), true), updated_at = now() WHERE id = $3',
        v_col) USING v_path, v_value, _property_id;

    ELSIF v_target = 'link' THEN
      IF v_spec NOT LIKE 'link:%' THEN RAISE EXCEPTION 'That item cannot be edited here.'; END IF;
      v_source := substr(v_spec, 6);
      v_url := nullif(btrim(coalesce(v_value #>> '{}', '')), '');
      IF v_url IS NOT NULL AND v_url !~* '^https?://' THEN
        RAISE EXCEPTION 'A link must start with http:// or https://';
      END IF;
      SELECT id, to_jsonb(url) INTO v_link_id, v_old FROM public.property_external_links
       WHERE property_id = _property_id AND source_field = v_source
       ORDER BY updated_at DESC LIMIT 1;
      IF v_link_id IS NOT NULL THEN
        IF v_url IS NULL THEN RAISE EXCEPTION 'A saved link can be changed but not left empty.'; END IF;
        UPDATE public.property_external_links SET url = v_url, updated_at = now(), as_of = now() WHERE id = v_link_id;
      ELSIF v_url IS NOT NULL THEN
        INSERT INTO public.property_external_links (property_id, kind, label, url, staff_only, canonical, needs_replacement, source, source_field, as_of)
        VALUES (_property_id, coalesce(nullif(v_change->>'link_kind',''), 'reference'), v_change->>'label', v_url, true, false, false, 'resolve', v_source, now())
        ON CONFLICT (property_id, kind, url) DO NOTHING;
      END IF;
      v_value := to_jsonb(v_url);

    ELSIF v_target = 'code' THEN
      IF v_spec <> 'code' THEN RAISE EXCEPTION 'That item cannot be edited here.'; END IF;
      -- The code itself was saved encrypted by the credential path; history only, never the value.
      v_old := NULL;
      v_value := NULL;

    ELSE
      RAISE EXCEPTION 'That item cannot be edited here.';
    END IF;

    INSERT INTO public.property_profile_edits (property_id, card, item_key, label, old_value, new_value, edited_by, edited_by_label)
    VALUES (_property_id, coalesce(_card, ''), v_change->>'key', v_change->>'label', v_old, v_value, v_uid, v_actor);
    v_labels := v_labels || (v_change->>'label');
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.audit_log (actor_id, actor_label, action, entity_type, entity_id, entity_label, reason)
  VALUES (v_uid, v_actor, 'home_profile_edited', 'property', _property_id, _card, array_to_string(v_labels, ', '));

  RETURN jsonb_build_object('saved', v_count, 'at', now(), 'by', v_actor);
END $$;
