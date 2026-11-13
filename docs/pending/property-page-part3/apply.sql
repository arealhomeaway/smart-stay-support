-- Property page Part 3 (Admin approval Nov 12). Additive. NOT applied. Apply only with approval:
-- BEGIN; \i 00_preflight.sql \i apply.sql COMMIT;

-- 3.1 Project: Telegram group link and LOA status on the project.
ALTER TABLE public.onboarding_projects
  ADD COLUMN telegram_url text CHECK (telegram_url IS NULL OR telegram_url ~ '^https://(t\.me|telegram\.me)/[A-Za-z0-9_+/-]+$'),
  ADD COLUMN loa_status text CHECK (loa_status IS NULL OR loa_status IN ('not_started','sent','signed','not_needed'));

-- 3.3 Preferred contact method on a vendor (empty until someone records it; nothing is guessed).
ALTER TABLE public.vendor_orgs
  ADD COLUMN preferred_contact text CHECK (preferred_contact IS NULL OR preferred_contact IN ('call','text','email'));

-- 3.2 Two new folders: Agreements and Estimates and invoices.
ALTER TABLE public.documents DROP CONSTRAINT documents_category_chk;
ALTER TABLE public.documents ADD CONSTRAINT documents_category_chk CHECK (((category IS NULL) OR (category = ANY (ARRAY['pma'::text, 'insurance'::text, 'ownership'::text, 'hoa'::text, 'covenants'::text, 'permit_license'::text, 'compliance'::text, 'manual'::text, 'hvac_doc'::text, 'warranty'::text, 'equipment'::text, 'access_security'::text, 'measurements'::text, 'design'::text, 'onboarding_evidence'::text, 'assessment'::text, 'operations'::text, 'maintenance'::text, 'media'::text, 'reference'::text, 'other'::text, 'design_floor_plan'::text, 'design_mood_board'::text, 'design_pick_list'::text, 'design_install'::text, 'design_staging'::text, 'design_photo'::text, 'agreement'::text, 'estimate_invoice'::text]))));

-- Who is on a home's team (PM, Utilities, any assigned role), for the two functions below.
CREATE OR REPLACE FUNCTION private.onboarding_home_team_member(_project_id uuid, _u uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _u IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.onboarding_projects p
     WHERE p.id = _project_id
       AND (p.project_manager = _u OR p.utility_manager = _u
            OR EXISTS (SELECT 1 FROM jsonb_each_text(coalesce(p.role_assignments, '{}'::jsonb)) r WHERE r.value = _u::text)))
$$;
REVOKE ALL ON FUNCTION private.onboarding_home_team_member(uuid, uuid) FROM PUBLIC;

-- 3.1 Telegram and LOA: PM, Director of Onboarding, Admin. Who and when in project history and audit_log.
CREATE OR REPLACE FUNCTION public.save_home_detail_field(_project_id uuid, _field text, _value text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE me uuid := auth.uid(); pr public.onboarding_projects; v text := nullif(btrim(coalesce(_value, '')), ''); old text; lbl text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in to save.'; END IF;
  SELECT * INTO pr FROM public.onboarding_projects WHERE id = _project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That onboarding project was not found.'; END IF;
  IF NOT (private.onboarding_home_lead(me) OR pr.project_manager = me) THEN
    RAISE EXCEPTION 'Only this home''s Project Manager, the Director of Onboarding or an Admin can change this.';
  END IF;
  IF _field = 'telegram_url' THEN
    lbl := 'Telegram group'; old := pr.telegram_url;
    IF v IS NOT NULL AND v !~ '^https://(t\.me|telegram\.me)/[A-Za-z0-9_+/-]+$' THEN RAISE EXCEPTION 'Paste the group''s t.me link.'; END IF;
    UPDATE public.onboarding_projects SET telegram_url = v, updated_at = now() WHERE id = pr.id;
  ELSIF _field = 'loa_status' THEN
    lbl := 'LOA status'; old := pr.loa_status;
    IF v IS NOT NULL AND v NOT IN ('not_started','sent','signed','not_needed') THEN RAISE EXCEPTION 'Choose an LOA status.'; END IF;
    UPDATE public.onboarding_projects SET loa_status = v, updated_at = now() WHERE id = pr.id;
  ELSE
    RAISE EXCEPTION 'That field cannot be saved here.';
  END IF;
  IF old IS DISTINCT FROM v THEN
    INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
    VALUES (pr.id, pr.property_id, 'project_detail_changed', lbl || ' changed', lbl || ' changed', old, v, me, coalesce(pr.is_demo, false));
    INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
    VALUES (me, 'onboarding.detail_changed', 'onboarding_project', pr.id, lbl, to_jsonb(old), to_jsonb(v));
  END IF;
  RETURN jsonb_build_object('ok', true, 'changed', old IS DISTINCT FROM v);
END $$;
REVOKE ALL ON FUNCTION public.save_home_detail_field(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_home_detail_field(uuid, text, text) TO authenticated;

-- 3.2 File a document into one of the five folders (never Other). The home's team, the
-- Director of Onboarding, the Director of Operations and Admin. Who and when in history and audit_log.
CREATE OR REPLACE FUNCTION public.move_home_file(_document_id uuid, _category text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE me uuid := auth.uid(); d public.documents; pr public.onboarding_projects; home uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in to move files.'; END IF;
  IF _category IS NULL OR _category NOT IN ('design','design_floor_plan','design_mood_board','design_pick_list','design_install','design_staging','measurements',
       'agreement','pma','estimate_invoice','media','design_photo','assessment') THEN
    RAISE EXCEPTION 'Choose a folder. New files never go into Other.';
  END IF;
  SELECT * INTO d FROM public.documents WHERE id = _document_id AND deleted_at IS NULL AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That file was not found.'; END IF;
  home := coalesce(d.property_id, CASE WHEN d.entity_type = 'property' THEN d.entity_id END);
  IF home IS NULL THEN RAISE EXCEPTION 'That file is not on a home.'; END IF;
  IF d.entity_type NOT IN ('property', 'onboarding_task') THEN RAISE EXCEPTION 'Only a home''s files and Task files can be filed here.'; END IF;
  IF d.visibility = 'internal' AND d.entity_type = 'expense' THEN RAISE EXCEPTION 'Finance files stay with Finance.'; END IF;
  SELECT * INTO pr FROM public.onboarding_projects WHERE property_id = home AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1;
  IF NOT (private.onboarding_home_lead(me) OR public.holds_functional_role(me, 'director_ops')
          OR (pr.id IS NOT NULL AND private.onboarding_home_team_member(pr.id, me))) THEN
    RAISE EXCEPTION 'Only this home''s team, a Director or an Admin can file this.';
  END IF;
  IF d.category IS NOT DISTINCT FROM _category THEN RETURN jsonb_build_object('ok', true, 'changed', false); END IF;
  UPDATE public.documents SET category = _category, updated_at = now() WHERE id = d.id;
  IF pr.id IS NOT NULL THEN
    INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
    VALUES (pr.id, home, 'file_filed', 'File moved', coalesce(d.original_filename, d.title), d.category, _category, me, coalesce(pr.is_demo, d.is_demo, false));
  END IF;
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
  VALUES (me, 'document.folder_changed', 'document', d.id, coalesce(d.original_filename, d.title), to_jsonb(d.category), to_jsonb(_category));
  RETURN jsonb_build_object('ok', true, 'changed', true);
END $$;
REVOKE ALL ON FUNCTION public.move_home_file(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_home_file(uuid, text) TO authenticated;

-- 3.1 Team: the home's PM may also set the stagers on their own homes (as for Designer and Utilities).
CREATE OR REPLACE FUNCTION public.set_onboarding_project_stagers(_project_id uuid, _vendor_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); pr public.onboarding_projects; wanted uuid[] := coalesce(_vendor_ids, '{}'); before uuid[]; added int; removed int;
BEGIN
  SELECT * INTO pr FROM public.onboarding_projects WHERE id = _project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That onboarding project was not found.'; END IF;
  IF NOT (private.onboarding_home_lead(me) OR (me IS NOT NULL AND pr.project_manager = me)) THEN
    RAISE EXCEPTION 'Only this home''s Project Manager, the Director of Onboarding or an Admin can do this.';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(wanted) v WHERE NOT EXISTS (
       SELECT 1 FROM public.vendor_orgs o WHERE o.id = v AND 'Staging' = ANY(o.service_categories))) THEN
    RAISE EXCEPTION 'Pick a stager from the staging vendors.';
  END IF;
  SELECT coalesce(array_agg(vendor_org_id ORDER BY vendor_org_id), '{}') INTO before
    FROM public.onboarding_project_stagers WHERE project_id = pr.id AND removed_at IS NULL;
  UPDATE public.onboarding_project_stagers SET removed_at = now(), removed_by = me
   WHERE project_id = pr.id AND removed_at IS NULL AND NOT (vendor_org_id = ANY(wanted));
  GET DIAGNOSTICS removed = ROW_COUNT;
  INSERT INTO public.onboarding_project_stagers(project_id, vendor_org_id, added_by)
  SELECT pr.id, v, me FROM (SELECT DISTINCT unnest(wanted) v) w
   WHERE NOT EXISTS (SELECT 1 FROM public.onboarding_project_stagers s WHERE s.project_id = pr.id AND s.vendor_org_id = w.v AND s.removed_at IS NULL);
  GET DIAGNOSTICS added = ROW_COUNT;
  IF added + removed > 0 THEN
    INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, prior_value, new_value, actor, is_demo)
    VALUES (pr.id, pr.property_id, 'stagers_changed', 'Stager changed', array_to_string(before, ','), array_to_string(wanted, ','), me, coalesce(pr.is_demo, false));
    INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
    VALUES (me, 'onboarding.stagers_changed', 'onboarding_project', pr.id, 'Stager', to_jsonb(before), to_jsonb(wanted));
  END IF;
  RETURN jsonb_build_object('ok', true, 'added', added, 'removed', removed);
END $function$;
