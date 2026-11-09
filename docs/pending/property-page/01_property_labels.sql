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
