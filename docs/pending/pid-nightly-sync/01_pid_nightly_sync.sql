-- PID nightly copy (approved by the Admin, Nov 12, 2026). STAGED ONLY: apply with approval.
-- Additive: one switch row (OFF), two tables in public, three in private, three functions.
-- Nothing runs until the Admin turns pid_nightly_sync on. Undo: undo/01_pid_nightly_sync.sql.

-- 1. The switch, OFF.
INSERT INTO public.feature_flags (key, label, description, enabled)
VALUES ('pid_nightly_sync', 'Nightly copy from the PID', 'Home details copy from the PID each night at 2 AM Central.', false)
ON CONFLICT (key) DO NOTHING;

-- 2. Review list: one row per item a run did not copy (changed in Resolve, OwnerRez owned, two PID
--    pages disagree, may hold a code, could not be read, a code kept in Resolve, a home that failed).
CREATE TABLE public.pid_sync_review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.integration_events(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  home text,
  ownerrez_id text,
  field_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('resolve_changed', 'ownerrez', 'pid_pages_disagree', 'withheld', 'invalid', 'code_kept', 'error')),
  resolve_value text,
  notion_value text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pid_sync_review_items_run_idx ON public.pid_sync_review_items (run_id);
GRANT SELECT ON public.pid_sync_review_items TO authenticated;
GRANT ALL ON public.pid_sync_review_items TO service_role;
ALTER TABLE public.pid_sync_review_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read the PID review list" ON public.pid_sync_review_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Synthetic accounts: demo records only" ON public.pid_sync_review_items AS RESTRICTIVE
  FOR ALL TO authenticated USING ((NOT (SELECT private.is_synthetic_account())) OR (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = pid_sync_review_items.property_id AND p.is_demo)));

-- 3. From the PID: PID fields with no place on the property page, as of the last copy. Read-only for staff.
CREATE TABLE public.property_pid_extra_fields (
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_type text NOT NULL,
  value jsonb NOT NULL,
  as_of timestamptz NOT NULL,
  synced_on date NOT NULL,
  source_page_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (property_id, field_name)
);
GRANT SELECT ON public.property_pid_extra_fields TO authenticated;
GRANT ALL ON public.property_pid_extra_fields TO service_role;
ALTER TABLE public.property_pid_extra_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read From the PID" ON public.property_pid_extra_fields
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Synthetic accounts: demo records only" ON public.property_pid_extra_fields AS RESTRICTIVE
  FOR ALL TO authenticated USING ((NOT (SELECT private.is_synthetic_account())) OR (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_pid_extra_fields.property_id AND p.is_demo)));

-- 4. Private state, service role only.
-- What the last copy wrote (md5 of the value), so a value changed in Resolve by any path is never overwritten.
CREATE TABLE private.pid_sync_field_hashes (
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  value_md5 text NOT NULL,
  written_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (property_id, field_key)
);
-- Keyed fingerprints (HMAC, never the text) of code-like text already sent to the encrypted intake list.
CREATE TABLE private.pid_sync_secret_fingerprints (
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  source_field text NOT NULL,
  fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (property_id, source_field, fingerprint)
);
-- Which Guest Access & Credentials record a PID code field fills, so a record edited in Resolve is recognised.
CREATE TABLE private.pid_sync_credential_links (
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  pid_field text NOT NULL,
  credential_id uuid NOT NULL REFERENCES public.property_credentials(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (property_id, pid_field)
);
REVOKE ALL ON private.pid_sync_field_hashes, private.pid_sync_secret_fingerprints, private.pid_sync_credential_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.pid_sync_credential_links TO service_role;

-- 5. Deep set: creates missing objects on the way; refuses to replace a value that is not an object.
CREATE OR REPLACE FUNCTION private.pid_jsonb_set_deep(_target jsonb, _path text[], _value jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $fn$
DECLARE
  v jsonb := _target;
  t text;
BEGIN
  FOR i IN 2 .. coalesce(array_length(_path, 1), 0) LOOP
    t := jsonb_typeof(v #> _path[1:i - 1]);
    IF t IS NULL OR t = 'null' THEN
      v := jsonb_set(v, _path[1:i - 1], '{}'::jsonb, true);
    ELSIF t <> 'object' THEN
      RAISE EXCEPTION 'PID copy: % is not a group of fields', array_to_string(_path[1:i - 1], '.');
    END IF;
  END LOOP;
  RETURN jsonb_set(v, _path, _value, true);
END $fn$;

-- 6. Fields whose Resolve value no longer matches what the last copy wrote.
CREATE OR REPLACE FUNCTION public.pid_sync_changed_since_copy()
RETURNS TABLE (property_id uuid, field_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $fn$
  SELECT h.property_id, h.field_key
  FROM private.pid_sync_field_hashes h
  JOIN public.properties p ON p.id = h.property_id
  WHERE md5(coalesce(to_jsonb(p) #> string_to_array(h.field_key, '.'), 'null'::jsonb)::text) <> h.value_md5
$fn$;
REVOKE ALL ON FUNCTION public.pid_sync_changed_since_copy() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pid_sync_changed_since_copy() TO service_role;

-- 7. One home, one transaction. Every value is written only if Resolve still holds the value, the
--    source record and the last-copy fingerprint seen when the run read it; any difference, error or
--    edit on the home during the run raises and undoes everything for this home.
CREATE OR REPLACE FUNCTION public.pid_sync_apply_home(
  _run_id uuid, _property_id uuid, _page_id text, _as_of date, _snapshot_at timestamptz,
  _writes jsonb, _links jsonb, _extras jsonb, _credentials jsonb, _intake jsonb, _review jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $fn$
DECLARE
  v_row jsonb;
  v_new jsonb;
  w jsonb;
  v_path text[];
  v_key text;
  v_cols text[] := '{}';
  v_src text;
  v_upd timestamptz;
  v_hash text;
  v_id uuid;
  v_sql text;
  n_written int := 0; n_links int := 0; n_extras int := 0; n_creds int := 0; n_intake int := 0; n_review int := 0;
  c_protected constant text[] := ARRAY['id','name','address_line1','city','state','postal_code','ownerrez_property_id',
    'latitude','longitude','formatted_address','handoff_accepted_at','is_demo','archived_at','created_at','updated_at',
    'bedrooms','bathrooms','max_guests','living_area_sqft','instant_book'];
  v_note text := 'PID nightly ' || _as_of::text;
BEGIN
  SELECT to_jsonb(p) INTO v_row FROM public.properties p WHERE p.id = _property_id AND NOT p.is_demo FOR UPDATE;
  IF v_row IS NULL THEN RAISE EXCEPTION 'PID copy: home not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.property_profile_edits e WHERE e.property_id = _property_id AND e.edited_at > _snapshot_at) THEN
    RAISE EXCEPTION 'PID copy: the home was edited in Resolve during the run';
  END IF;

  FOR w IN SELECT * FROM jsonb_array_elements(coalesce(_writes, '[]'::jsonb)) LOOP
    v_path := ARRAY(SELECT jsonb_array_elements_text(w->'path'));
    v_key := array_to_string(v_path, '.');
    IF coalesce(array_length(v_path, 1), 0) = 0 OR v_path[1] = ANY (c_protected) OR NOT (v_row ? v_path[1]) THEN
      RAISE EXCEPTION 'PID copy: % may not be written', v_key;
    END IF;
    IF coalesce(v_row #> v_path, 'null'::jsonb) IS DISTINCT FROM coalesce(w->'expected', 'null'::jsonb) THEN
      RAISE EXCEPTION 'PID copy: % changed since the run read it', v_key;
    END IF;
    SELECT f.value_source, f.updated_at INTO v_src, v_upd FROM public.property_field_provenance f
      WHERE f.property_id = _property_id AND f.field_key = v_key FOR UPDATE;
    IF NOT FOUND THEN
      IF jsonb_typeof(w->'prov') = 'object' THEN RAISE EXCEPTION 'PID copy: % source changed', v_key; END IF;
    ELSIF jsonb_typeof(w->'prov') IS DISTINCT FROM 'object'
       OR v_src IS DISTINCT FROM w->'prov'->>'value_source'
       OR v_upd IS DISTINCT FROM (w->'prov'->>'updated_at')::timestamptz THEN
      RAISE EXCEPTION 'PID copy: % source changed', v_key;
    END IF;
    SELECT h.value_md5 INTO v_hash FROM private.pid_sync_field_hashes h WHERE h.property_id = _property_id AND h.field_key = v_key;
    IF FOUND AND v_hash <> md5(coalesce(v_row #> v_path, 'null'::jsonb)::text) THEN
      RAISE EXCEPTION 'PID copy: % was changed in Resolve', v_key;
    END IF;
    v_row := private.pid_jsonb_set_deep(v_row, v_path, coalesce(w->'value', 'null'::jsonb));
    IF NOT v_path[1] = ANY (v_cols) THEN v_cols := v_cols || v_path[1]; END IF;
    n_written := n_written + 1;
  END LOOP;

  IF array_length(v_cols, 1) > 0 THEN
    SELECT string_agg(format('%I = (jsonb_populate_record(NULL::public.properties, $2)).%I', c, c), ', ') INTO v_sql FROM unnest(v_cols) c;
    EXECUTE format('UPDATE public.properties SET %s, updated_at = now() WHERE id = $1', v_sql) USING _property_id, v_row;
    SELECT to_jsonb(p) INTO v_new FROM public.properties p WHERE p.id = _property_id;
    FOR w IN SELECT * FROM jsonb_array_elements(coalesce(_writes, '[]'::jsonb)) LOOP
      v_path := ARRAY(SELECT jsonb_array_elements_text(w->'path'));
      v_key := array_to_string(v_path, '.');
      INSERT INTO public.property_field_provenance (property_id, field_key, value_source, source_record_id, as_of, note)
        VALUES (_property_id, v_key, 'notion_pid', _page_id, _as_of, v_note)
        ON CONFLICT (property_id, field_key) DO UPDATE SET value_source = 'notion_pid', source_record_id = EXCLUDED.source_record_id,
          as_of = EXCLUDED.as_of, note = EXCLUDED.note, updated_at = now();
      INSERT INTO private.pid_sync_field_hashes (property_id, field_key, value_md5, written_at)
        VALUES (_property_id, v_key, md5(coalesce(v_new #> v_path, 'null'::jsonb)::text), now())
        ON CONFLICT (property_id, field_key) DO UPDATE SET value_md5 = EXCLUDED.value_md5, written_at = now();
    END LOOP;
  END IF;

  FOR w IN SELECT * FROM jsonb_array_elements(coalesce(_links, '[]'::jsonb)) LOOP
    INSERT INTO public.property_external_links (property_id, kind, label, url, context, staff_only, canonical, needs_replacement, source, source_field, as_of, note)
      VALUES (_property_id, w->>'kind', w->>'label', w->>'url', w->>'context', coalesce((w->>'staff_only')::boolean, true),
        coalesce((w->>'canonical')::boolean, false), coalesce((w->>'needs_replacement')::boolean, false), 'notion_pid', w->>'source_field', _as_of, w->>'note')
      ON CONFLICT (property_id, kind, url) DO NOTHING;
    IF FOUND THEN n_links := n_links + 1; END IF;
  END LOOP;

  FOR w IN SELECT * FROM jsonb_array_elements(coalesce(_extras, '[]'::jsonb)) LOOP
    INSERT INTO public.property_pid_extra_fields (property_id, field_name, field_type, value, as_of, synced_on, source_page_id, updated_at)
      VALUES (_property_id, w->>'field_name', w->>'field_type', w->'value', (w->>'as_of')::timestamptz, _as_of, _page_id, now())
      ON CONFLICT (property_id, field_name) DO UPDATE SET field_type = EXCLUDED.field_type, value = EXCLUDED.value,
        as_of = EXCLUDED.as_of, synced_on = EXCLUDED.synced_on, source_page_id = EXCLUDED.source_page_id, updated_at = now();
    n_extras := n_extras + 1;
  END LOOP;

  -- Codes: only into the encrypted vault, the way the Sep 1 migration filed them.
  FOR w IN SELECT * FROM jsonb_array_elements(coalesce(_credentials, '[]'::jsonb)) LOOP
    IF w->>'op' = 'insert' THEN
      IF EXISTS (SELECT 1 FROM private.pid_sync_credential_links l WHERE l.property_id = _property_id AND l.pid_field = w->>'pid_field')
         OR EXISTS (SELECT 1 FROM public.property_credentials c WHERE c.property_id = _property_id AND c.label = w->>'label') THEN
        RAISE EXCEPTION 'PID copy: the % code changed since the run read it', w->>'pid_field';
      END IF;
      INSERT INTO public.property_credentials (property_id, category, label, username, instructions, secret_ciphertext, secret_nonce, last_verified_on, source, active)
        VALUES (_property_id, (w->>'category')::public.credential_category, w->>'label', w->>'username', w->>'instructions',
          w->>'ciphertext', w->>'nonce', (w->>'last_verified_on')::date, 'notion_pid', true)
        RETURNING id INTO v_id;
      n_creds := n_creds + 1;
    ELSIF w->>'op' = 'update' THEN
      UPDATE public.property_credentials c SET secret_ciphertext = w->>'ciphertext', secret_nonce = w->>'nonce',
          username = w->>'username', instructions = w->>'instructions', last_verified_on = (w->>'last_verified_on')::date
        WHERE c.id = (w->>'id')::uuid AND c.property_id = _property_id AND c.source = 'notion_pid' AND c.active
          AND c.updated_at = (w->>'expected_updated_at')::timestamptz
        RETURNING c.id INTO v_id;
      IF v_id IS NULL THEN RAISE EXCEPTION 'PID copy: the % code changed since the run read it', w->>'pid_field'; END IF;
      n_creds := n_creds + 1;
    ELSIF w->>'op' = 'link' THEN
      SELECT c.id INTO v_id FROM public.property_credentials c WHERE c.id = (w->>'id')::uuid AND c.property_id = _property_id;
      IF v_id IS NULL THEN RAISE EXCEPTION 'PID copy: the % code changed since the run read it', w->>'pid_field'; END IF;
    ELSE
      RAISE EXCEPTION 'PID copy: unknown code step';
    END IF;
    INSERT INTO private.pid_sync_credential_links (property_id, pid_field, credential_id)
      VALUES (_property_id, w->>'pid_field', v_id)
      ON CONFLICT (property_id, pid_field) DO UPDATE SET credential_id = EXCLUDED.credential_id, linked_at = now();
    v_id := NULL;
  END LOOP;

  FOR w IN SELECT * FROM jsonb_array_elements(coalesce(_intake, '[]'::jsonb)) LOOP
    INSERT INTO private.pid_sync_secret_fingerprints (property_id, source_field, fingerprint)
      VALUES (_property_id, w->>'source_field', w->>'fingerprint') ON CONFLICT DO NOTHING;
    IF FOUND THEN
      INSERT INTO public.credential_intake_queue (property_id, source_field, suggested_category, suggested_label, secret_ciphertext, secret_nonce, status)
        VALUES (_property_id, w->>'source_field', (w->>'category')::public.credential_category, w->>'label', w->>'ciphertext', w->>'nonce', 'pending');
      n_intake := n_intake + 1;
    END IF;
  END LOOP;

  FOR w IN SELECT * FROM jsonb_array_elements(coalesce(_review, '[]'::jsonb)) LOOP
    INSERT INTO public.pid_sync_review_items (run_id, property_id, home, ownerrez_id, field_key, kind, resolve_value, notion_value, reason)
      VALUES (_run_id, _property_id, w->>'home', w->>'ownerrez_id', w->>'field_key', w->>'kind', w->>'resolve_value', w->>'notion_value', w->>'reason');
    n_review := n_review + 1;
  END LOOP;

  RETURN jsonb_build_object('written', n_written, 'links', n_links, 'extras', n_extras, 'codes', n_creds, 'intake', n_intake, 'review', n_review);
END $fn$;
REVOKE ALL ON FUNCTION public.pid_sync_apply_home(uuid, uuid, text, date, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pid_sync_apply_home(uuid, uuid, text, date, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) TO service_role;

-- 8. The code-field links for the run (the private table is not reachable through the Data API).
CREATE OR REPLACE FUNCTION public.pid_sync_credential_links_read()
RETURNS TABLE (property_id uuid, pid_field text, credential_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $fn$
  SELECT l.property_id, l.pid_field, l.credential_id FROM private.pid_sync_credential_links l
$fn$;
REVOKE ALL ON FUNCTION public.pid_sync_credential_links_read() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pid_sync_credential_links_read() TO service_role;
