-- Property page: labels on homes (register P2).
-- Additive only. Labels are a list an Admin keeps; homes carry labels through
-- assignments. Nothing is ever deleted: removing sets removed_at / retired_at
-- and every change writes a history line with the person and the time.

CREATE TABLE public.property_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  renamed_by uuid,
  renamed_at timestamptz,
  retired_by uuid,
  retired_at timestamptz
);
CREATE UNIQUE INDEX property_labels_live_name ON public.property_labels (lower(btrim(name))) WHERE retired_at IS NULL;

CREATE TABLE public.property_label_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  label_id uuid NOT NULL REFERENCES public.property_labels(id),
  added_by uuid,
  added_at timestamptz NOT NULL DEFAULT now(),
  removed_by uuid,
  removed_at timestamptz
);
CREATE UNIQUE INDEX property_label_assignments_live ON public.property_label_assignments (property_id, label_id) WHERE removed_at IS NULL;
CREATE INDEX property_label_assignments_property ON public.property_label_assignments (property_id);

CREATE TABLE public.property_label_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id uuid NOT NULL REFERENCES public.property_labels(id),
  property_id uuid REFERENCES public.properties(id),
  action text NOT NULL CHECK (action IN ('created','renamed','retired','added','removed')),
  from_name text,
  to_name text,
  actor_id uuid,
  actor_label text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX property_label_events_property ON public.property_label_events (property_id, at DESC);

GRANT SELECT ON public.property_labels TO authenticated;
GRANT SELECT ON public.property_label_assignments TO authenticated;
GRANT SELECT ON public.property_label_events TO authenticated;
GRANT ALL ON public.property_labels TO service_role;
GRANT ALL ON public.property_label_assignments TO service_role;
GRANT ALL ON public.property_label_events TO service_role;

ALTER TABLE public.property_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_label_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_label_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY property_labels_staff_read ON public.property_labels
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY property_label_assignments_staff_read ON public.property_label_assignments
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY property_label_events_staff_read ON public.property_label_events
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

-- History lines are append-only.
CREATE FUNCTION private.block_property_label_event_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Label history cannot be changed or removed.';
END $$;
CREATE TRIGGER property_label_events_append_only BEFORE UPDATE OR DELETE ON public.property_label_events
  FOR EACH ROW EXECUTE FUNCTION private.block_property_label_event_change();

-- Who may edit a home (register A12): internal staff, except a Finance-only
-- or Utilities-only person, who views (Utilities edits only the Utilities tab).
CREATE FUNCTION private.home_profile_editor(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT _uid IS NOT NULL
    AND public.is_internal_staff(_uid)
    AND NOT (
      -- Finance only: a finance role and no other work role.
      EXISTS (SELECT 1 FROM public.functional_role_members m WHERE m.user_id = _uid AND m.role_code IN ('finance_lead','accounting'))
      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role IN ('admin','manager'))
      AND NOT EXISTS (SELECT 1 FROM public.functional_role_members m WHERE m.user_id = _uid AND m.role_code NOT IN ('finance_lead','accounting','cfo_owner_liaison'))
    )
    AND NOT (
      -- Utilities only.
      EXISTS (SELECT 1 FROM public.functional_role_members m WHERE m.user_id = _uid AND m.role_code = 'utilities')
      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role IN ('admin','manager','tech'))
      AND NOT EXISTS (SELECT 1 FROM public.functional_role_members m WHERE m.user_id = _uid AND m.role_code <> 'utilities')
    )
$$;

CREATE FUNCTION private.actor_label(_uid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT NULLIF(btrim(full_name), '') FROM public.profiles WHERE id = _uid), 'ARHA staff')
$$;

-- What the signed-in person may do on the property page.
CREATE FUNCTION public.my_home_profile_access() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT jsonb_build_object(
    'edit', private.home_profile_editor(auth.uid()),
    'admin', private.has_role(auth.uid(), 'admin'::app_role)
  )
$$;

CREATE FUNCTION public.property_label_create(_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(_name, ''));
  v_id uuid;
BEGIN
  IF NOT private.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only an admin can create labels.' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_name) < 1 OR char_length(v_name) > 40 THEN
    RAISE EXCEPTION 'A label needs 1 to 40 characters.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.property_labels WHERE retired_at IS NULL AND lower(btrim(name)) = lower(v_name)) THEN
    RAISE EXCEPTION 'That label is already on the list.';
  END IF;
  INSERT INTO public.property_labels (name, created_by) VALUES (v_name, v_uid) RETURNING id INTO v_id;
  INSERT INTO public.property_label_events (label_id, action, to_name, actor_id, actor_label)
    VALUES (v_id, 'created', v_name, v_uid, private.actor_label(v_uid));
  RETURN v_id;
END $$;

CREATE FUNCTION public.property_label_rename(_label_id uuid, _name text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(_name, ''));
  v_old text;
BEGIN
  IF NOT private.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only an admin can rename labels.' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_name) < 1 OR char_length(v_name) > 40 THEN
    RAISE EXCEPTION 'A label needs 1 to 40 characters.';
  END IF;
  SELECT name INTO v_old FROM public.property_labels WHERE id = _label_id AND retired_at IS NULL FOR UPDATE;
  IF v_old IS NULL THEN RAISE EXCEPTION 'That label is no longer on the list.'; END IF;
  IF v_old = v_name THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.property_labels WHERE retired_at IS NULL AND id <> _label_id AND lower(btrim(name)) = lower(v_name)) THEN
    RAISE EXCEPTION 'That label is already on the list.';
  END IF;
  UPDATE public.property_labels SET name = v_name, renamed_by = v_uid, renamed_at = now() WHERE id = _label_id;
  INSERT INTO public.property_label_events (label_id, action, from_name, to_name, actor_id, actor_label)
    VALUES (_label_id, 'renamed', v_old, v_name, v_uid, private.actor_label(v_uid));
END $$;

-- Removing a label from the list takes it off every home; history stays.
CREATE FUNCTION public.property_label_retire(_label_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_row record;
  v_count integer := 0;
BEGIN
  IF NOT private.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only an admin can remove labels from the list.' USING ERRCODE = '42501';
  END IF;
  SELECT name INTO v_name FROM public.property_labels WHERE id = _label_id AND retired_at IS NULL FOR UPDATE;
  IF v_name IS NULL THEN RAISE EXCEPTION 'That label is no longer on the list.'; END IF;
  FOR v_row IN SELECT id, property_id FROM public.property_label_assignments WHERE label_id = _label_id AND removed_at IS NULL LOOP
    UPDATE public.property_label_assignments SET removed_at = now(), removed_by = v_uid WHERE id = v_row.id;
    INSERT INTO public.property_label_events (label_id, property_id, action, from_name, actor_id, actor_label)
      VALUES (_label_id, v_row.property_id, 'removed', v_name, v_uid, private.actor_label(v_uid));
    v_count := v_count + 1;
  END LOOP;
  UPDATE public.property_labels SET retired_at = now(), retired_by = v_uid WHERE id = _label_id;
  INSERT INTO public.property_label_events (label_id, action, from_name, actor_id, actor_label)
    VALUES (_label_id, 'retired', v_name, v_uid, private.actor_label(v_uid));
  RETURN v_count;
END $$;

-- One home: anyone who edits a home. Many homes at once: Admin only.
CREATE FUNCTION public.property_label_add(_label_id uuid, _property_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_pid uuid;
  v_count integer := 0;
  v_n integer := coalesce(array_length(_property_ids, 1), 0);
BEGIN
  IF v_n = 0 THEN RAISE EXCEPTION 'Pick at least one home.'; END IF;
  IF v_n > 1 AND NOT private.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only an admin can add a label to many homes.' USING ERRCODE = '42501';
  END IF;
  IF NOT private.home_profile_editor(v_uid) THEN
    RAISE EXCEPTION 'You can view this home but not change its labels.' USING ERRCODE = '42501';
  END IF;
  SELECT name INTO v_name FROM public.property_labels WHERE id = _label_id AND retired_at IS NULL;
  IF v_name IS NULL THEN RAISE EXCEPTION 'That label is no longer on the list.'; END IF;
  FOREACH v_pid IN ARRAY (SELECT array_agg(DISTINCT x) FROM unnest(_property_ids) x) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id = v_pid) THEN
      RAISE EXCEPTION 'A picked home could not be found.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.property_label_assignments WHERE property_id = v_pid AND label_id = _label_id AND removed_at IS NULL) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.property_label_assignments (property_id, label_id, added_by) VALUES (v_pid, _label_id, v_uid);
    INSERT INTO public.property_label_events (label_id, property_id, action, to_name, actor_id, actor_label)
      VALUES (_label_id, v_pid, 'added', v_name, v_uid, private.actor_label(v_uid));
    INSERT INTO public.audit_log (actor_id, actor_label, action, entity_type, entity_id, entity_label, reason)
      VALUES (v_uid, private.actor_label(v_uid), 'label_added', 'property', v_pid, v_name, NULL);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

CREATE FUNCTION public.property_label_remove(_label_id uuid, _property_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_id uuid;
BEGIN
  IF NOT private.home_profile_editor(v_uid) THEN
    RAISE EXCEPTION 'You can view this home but not change its labels.' USING ERRCODE = '42501';
  END IF;
  SELECT a.id, l.name INTO v_id, v_name
    FROM public.property_label_assignments a JOIN public.property_labels l ON l.id = a.label_id
   WHERE a.label_id = _label_id AND a.property_id = _property_id AND a.removed_at IS NULL
   FOR UPDATE OF a;
  IF v_id IS NULL THEN RETURN false; END IF;
  UPDATE public.property_label_assignments SET removed_at = now(), removed_by = v_uid WHERE id = v_id;
  INSERT INTO public.property_label_events (label_id, property_id, action, from_name, actor_id, actor_label)
    VALUES (_label_id, _property_id, 'removed', v_name, v_uid, private.actor_label(v_uid));
  INSERT INTO public.audit_log (actor_id, actor_label, action, entity_type, entity_id, entity_label, reason)
    VALUES (v_uid, private.actor_label(v_uid), 'label_removed', 'property', _property_id, v_name, NULL);
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.property_label_create(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.property_label_rename(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.property_label_retire(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.property_label_add(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.property_label_remove(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_home_profile_access() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.home_profile_editor(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.actor_label(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.property_label_create(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.property_label_rename(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.property_label_retire(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.property_label_add(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.property_label_remove(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_home_profile_access() TO authenticated;
GRANT EXECUTE ON FUNCTION private.home_profile_editor(uuid) TO authenticated;

-- First import: every home whose title carries (30D FIRM) gets the label 30-day firm.
WITH lbl AS (
  INSERT INTO public.property_labels (name, created_by) VALUES ('30-day firm', NULL) RETURNING id, name
), ev AS (
  INSERT INTO public.property_label_events (label_id, action, to_name, actor_id, actor_label)
  SELECT id, 'created', name, NULL, 'Notion import' FROM lbl
), homes AS (
  SELECT p.id FROM public.properties p WHERE p.name ~* '\(30D FIRM\)'
), ins AS (
  INSERT INTO public.property_label_assignments (property_id, label_id, added_by)
  SELECT homes.id, lbl.id, NULL FROM homes, lbl RETURNING property_id, label_id
)
INSERT INTO public.property_label_events (label_id, property_id, action, to_name, actor_id, actor_label)
SELECT ins.label_id, ins.property_id, 'added', lbl.name, NULL, 'Notion import' FROM ins, lbl;

-- Property page: Home Profile editing with person and time, and photos that
-- sit next to the item they belong to. Additive only; nothing is deleted.
-- Codes are never written here: they stay encrypted in property_credentials
-- and are saved through the existing credential path. A code change is
-- recorded here as a history line with no value.

CREATE TABLE public.property_profile_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  card text NOT NULL,
  item_key text NOT NULL,
  label text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  edited_by uuid,
  edited_by_label text,
  edited_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX property_profile_edits_property ON public.property_profile_edits (property_id, edited_at DESC);

CREATE TABLE public.property_profile_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  item_key text NOT NULL CHECK (char_length(item_key) BETWEEN 1 AND 80),
  document_id uuid NOT NULL REFERENCES public.documents(id),
  added_by uuid,
  added_at timestamptz NOT NULL DEFAULT now(),
  removed_by uuid,
  removed_at timestamptz
);
CREATE UNIQUE INDEX property_profile_photos_live_doc ON public.property_profile_photos (document_id) WHERE removed_at IS NULL;
CREATE INDEX property_profile_photos_property ON public.property_profile_photos (property_id, item_key);

GRANT SELECT ON public.property_profile_edits TO authenticated;
GRANT SELECT ON public.property_profile_photos TO authenticated;
GRANT ALL ON public.property_profile_edits TO service_role;
GRANT ALL ON public.property_profile_photos TO service_role;

ALTER TABLE public.property_profile_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_profile_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY property_profile_edits_staff_read ON public.property_profile_edits
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY property_profile_photos_staff_read ON public.property_profile_photos
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

CREATE FUNCTION private.block_property_profile_edit_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Home profile history cannot be changed or removed.';
END $$;
CREATE TRIGGER property_profile_edits_append_only BEFORE UPDATE OR DELETE ON public.property_profile_edits
  FOR EACH ROW EXECUTE FUNCTION private.block_property_profile_edit_change();

-- Save one card. _changes is an array of
--   {key, label, target: 'column'|'json'|'link'|'code', column, path, value, link_kind}
-- Only the listed columns can be written. Static system fields are not listed.
CREATE FUNCTION public.save_home_profile_card(_property_id uuid, _card text, _changes jsonb) RETURNS jsonb
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

    IF v_target = 'column' THEN
      v_col := v_change->>'column';
      v_type := v_typed->>v_col;
      IF v_type IS NULL THEN RAISE EXCEPTION 'That item cannot be edited here.'; END IF;
      EXECUTE format('SELECT to_jsonb(%I) FROM public.properties WHERE id = $1', v_col) INTO v_old USING _property_id;
      EXECUTE format('UPDATE public.properties SET %I = ($1 #>> ''{}'')::%s, updated_at = now() WHERE id = $2', v_col, v_type)
        USING v_value, _property_id;

    ELSIF v_target = 'json' THEN
      v_col := v_change->>'column';
      IF NOT (v_col = ANY (v_json)) THEN RAISE EXCEPTION 'That item cannot be edited here.'; END IF;
      SELECT array_agg(x) INTO v_path FROM jsonb_array_elements_text(v_change->'path') x;
      IF v_path IS NULL OR array_length(v_path, 1) NOT BETWEEN 1 AND 2 THEN
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
      v_url := nullif(btrim(coalesce(v_value #>> '{}', '')), '');
      IF v_url IS NOT NULL AND v_url !~* '^https?://' THEN
        RAISE EXCEPTION 'A link must start with http:// or https://';
      END IF;
      SELECT id, to_jsonb(url) INTO v_link_id, v_old FROM public.property_external_links
       WHERE property_id = _property_id AND source_field = v_change->>'label'
       ORDER BY updated_at DESC LIMIT 1;
      IF v_link_id IS NOT NULL THEN
        IF v_url IS NULL THEN RAISE EXCEPTION 'A saved link can be changed but not left empty.'; END IF;
        UPDATE public.property_external_links SET url = v_url, updated_at = now(), as_of = now() WHERE id = v_link_id;
      ELSIF v_url IS NOT NULL THEN
        INSERT INTO public.property_external_links (property_id, kind, label, url, staff_only, canonical, needs_replacement, source, source_field, as_of)
        VALUES (_property_id, coalesce(nullif(v_change->>'link_kind',''), 'reference'), v_change->>'label', v_url, true, false, false, 'resolve', v_change->>'label', now())
        ON CONFLICT (property_id, kind, url) DO NOTHING;
      END IF;
      v_value := to_jsonb(v_url);

    ELSIF v_target = 'code' THEN
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

CREATE FUNCTION public.add_home_profile_photo(_property_id uuid, _item_key text, _document_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF NOT private.home_profile_editor(v_uid) THEN
    RAISE EXCEPTION 'You can view this home but not change it.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.documents d
     WHERE d.id = _document_id AND d.property_id = _property_id
       AND d.upload_status = 'stored' AND d.deleted_at IS NULL AND d.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'That photo is not stored on this home yet.';
  END IF;
  SELECT id INTO v_id FROM public.property_profile_photos WHERE document_id = _document_id AND removed_at IS NULL;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.property_profile_photos (property_id, item_key, document_id, added_by)
  VALUES (_property_id, btrim(_item_key), _document_id, v_uid) RETURNING id INTO v_id;
  INSERT INTO public.property_profile_edits (property_id, card, item_key, label, old_value, new_value, edited_by, edited_by_label)
  VALUES (_property_id, 'photo', btrim(_item_key), 'Photo added', NULL, to_jsonb(_document_id::text), v_uid, private.actor_label(v_uid));
  RETURN v_id;
END $$;

CREATE FUNCTION public.remove_home_profile_photo(_photo_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.property_profile_photos;
BEGIN
  IF NOT private.home_profile_editor(v_uid) THEN
    RAISE EXCEPTION 'You can view this home but not change it.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.property_profile_photos WHERE id = _photo_id AND removed_at IS NULL FOR UPDATE;
  IF v_row.id IS NULL THEN RETURN false; END IF;
  -- The file itself stays in Documents and Media; only its place on the item ends.
  UPDATE public.property_profile_photos SET removed_at = now(), removed_by = v_uid WHERE id = _photo_id;
  INSERT INTO public.property_profile_edits (property_id, card, item_key, label, old_value, new_value, edited_by, edited_by_label)
  VALUES (v_row.property_id, 'photo', v_row.item_key, 'Photo taken off the item', to_jsonb(v_row.document_id::text), NULL, v_uid, private.actor_label(v_uid));
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.save_home_profile_card(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_home_profile_photo(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_home_profile_photo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_home_profile_card(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_home_profile_photo(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_home_profile_photo(uuid) TO authenticated;

-- PRACTICE ONLY: checks, then a deliberate error so nothing is kept.
DO $practice$
DECLARE
  r text := '';
  v_label uuid;
  v_home uuid;
  v_home2 uuid;
  v_n int;
  v_j jsonb;
  v_t text;
BEGIN
  SELECT count(*) INTO v_n FROM public.property_label_assignments;
  r := r || 'firm_homes=' || v_n || '; ';
  PERFORM set_config('request.jwt.claims', '{"sub":"f8c6e258-6679-4517-a8bc-4817ec1cb5de","role":"authenticated"}', true);
  r := r || 'admin_access=' || public.my_home_profile_access()::text || '; ';
  v_label := public.property_label_create('Practice label');
  v_n := public.property_label_add(v_label, (SELECT array_agg(id) FROM (SELECT id FROM public.properties WHERE is_demo = false ORDER BY name LIMIT 3) s));
  r := r || 'admin_add_many=' || v_n || '; ';
  PERFORM public.property_label_rename(v_label, 'Practice label two');
  SELECT id INTO v_home FROM public.properties WHERE is_demo = false ORDER BY name LIMIT 1;
  v_j := public.save_home_profile_card(v_home, 'Entry & Access Details',
    '[{"key":"lock_brand","label":"Smart Lock Brand","target":"json","column":"access","path":["lock_brand"],"value":"Practice brand"},
      {"key":"smoke_brand","label":"Smoke Detector Brand","target":"json","column":"systems","path":["smoke","brand"],"value":"Practice smoke"},
      {"key":"nickname","label":"Property Nickname","target":"column","column":"nickname","value":"Practice nick"},
      {"key":"bedrooms","label":"Bedrooms","target":"column","column":"bedrooms","value":"4"},
      {"key":"gate_code","label":"Gate Code","target":"code","value":null}]'::jsonb);
  r := r || 'save=' || v_j::text || '; ';
  SELECT jsonb_build_object('lock', access->>'lock_brand', 'smoke', systems->'smoke'->>'brand', 'nick', nickname, 'bed', bedrooms)::text INTO STRICT v_t FROM public.properties WHERE id = v_home;
  r := r || 'readback=' || v_t || '; ';
  SELECT count(*) INTO v_n FROM public.property_profile_edits WHERE property_id = v_home;
  r := r || 'edit_lines=' || v_n || '; ';
  SELECT count(*) INTO v_n FROM public.property_profile_edits WHERE label = 'Gate Code' AND new_value IS NULL AND old_value IS NULL;
  r := r || 'code_line_without_value=' || v_n || '; ';
  -- coordinator
  PERFORM set_config('request.jwt.claims', '{"sub":"1a4b8de5-0824-4066-8691-8e6bb912f964","role":"authenticated"}', true);
  r := r || 'coord_access=' || public.my_home_profile_access()::text || '; ';
  SELECT id INTO v_home2 FROM public.properties WHERE is_demo = false ORDER BY name OFFSET 5 LIMIT 1;
  v_n := public.property_label_add(v_label, ARRAY[v_home2]);
  r := r || 'coord_add_one=' || v_n || '; ';
  BEGIN PERFORM public.property_label_create('Coordinator label'); r := r || 'coord_create=ALLOWED; ';
  EXCEPTION WHEN others THEN r := r || 'coord_create_refused=' || SQLERRM || '; '; END;
  BEGIN PERFORM public.property_label_add(v_label, (SELECT array_agg(id) FROM (SELECT id FROM public.properties ORDER BY name OFFSET 10 LIMIT 2) s)); r := r || 'coord_many=ALLOWED; ';
  EXCEPTION WHEN others THEN r := r || 'coord_many_refused=' || SQLERRM || '; '; END;
  BEGIN PERFORM public.property_label_rename(v_label, 'x'); r := r || 'coord_rename=ALLOWED; ';
  EXCEPTION WHEN others THEN r := r || 'coord_rename_refused=' || SQLERRM || '; '; END;
  r := r || 'coord_remove=' || public.property_label_remove(v_label, v_home2)::text || '; ';
  BEGIN PERFORM public.save_home_profile_card(v_home, 'x', '[{"key":"a","label":"A","target":"column","column":"name","value":"hack"}]'::jsonb); r := r || 'name_edit=ALLOWED; ';
  EXCEPTION WHEN others THEN r := r || 'name_edit_refused=' || SQLERRM || '; '; END;
  -- the Utilities person also holds Project Manager, so edits
  PERFORM set_config('request.jwt.claims', '{"sub":"f2a762fa-f28b-4df3-8f33-a94461c6837f","role":"authenticated"}', true);
  r := r || 'pm_utilities_access=' || public.my_home_profile_access()::text || '; ';
  -- a homeowner
  PERFORM set_config('request.jwt.claims', '{"sub":"68ad7bb6-458f-4c0c-921f-3299251ac3fa","role":"authenticated"}', true);
  BEGIN PERFORM public.property_label_add(v_label, ARRAY[v_home2]); r := r || 'owner_add=ALLOWED; ';
  EXCEPTION WHEN others THEN r := r || 'owner_add_refused=' || SQLERRM || '; '; END;
  SELECT string_agg(action || ':' || n, ',') INTO STRICT v_t FROM (SELECT action, count(*) n FROM public.property_label_events GROUP BY 1 ORDER BY 1) s;
  r := r || 'label_events=' || v_t || '; ';
  RAISE EXCEPTION 'PRACTICE_CANCELLED %', r;
END $practice$;
