-- Property page Part 3 preflight (read only). Run first, in the same transaction as apply.sql.
DO $$
DECLARE live_chk text;
BEGIN
  SELECT md5(pg_get_constraintdef(oid)) INTO live_chk FROM pg_constraint WHERE conname = 'documents_category_chk' AND conrelid = 'public.documents'::regclass;
  IF live_chk IS DISTINCT FROM '7bf1e5ee54dc31a41ade142207766690' THEN
    RAISE EXCEPTION 'Changed since staging: documents_category_chk (md5 %).', live_chk;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'onboarding_projects' AND column_name IN ('telegram_url','loa_status')) THEN
    RAISE EXCEPTION 'Telegram or LOA already exists on onboarding_projects.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vendor_orgs' AND column_name = 'preferred_contact') THEN
    RAISE EXCEPTION 'preferred_contact already exists on vendor_orgs.';
  END IF;
  IF to_regprocedure('public.save_home_detail_field(uuid,text,text)') IS NOT NULL OR to_regprocedure('public.move_home_file(uuid,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'A function this adds already exists.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname IN ('followed_home_stage_notice','followed_home_handoff_notice','followed_home_owner_notice')) THEN
    RAISE EXCEPTION 'A follow notice trigger already exists.';
  END IF;
END $$;
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

-- 3.5 A followed home sends the person its key notices, in the app only (never email):
-- the stage (Status) moves, the handoff moves, and the owner writes and is waiting on us.
-- The person who made the change is not told about their own change.
CREATE OR REPLACE FUNCTION private.notify_home_followers(_property_id uuid, _kind text, _title text, _body text, _actor uuid, _demo boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority, actor_id, is_demo, email_status)
  SELECT f.user_id, _kind, _title, coalesce(_body, ''), 'property', _property_id, '/onboarding/' || _property_id::text, 'normal', _actor, coalesce(_demo, false), 'none'
    FROM public.onboarding_follows f
   WHERE f.property_id = _property_id AND f.user_id IS DISTINCT FROM _actor
$$;
REVOKE ALL ON FUNCTION private.notify_home_followers(uuid, text, text, text, uuid, boolean) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.follow_notice_from_project_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE home text;
BEGIN
  SELECT public.format_property_label(to_jsonb(p))->>'primary' INTO home FROM public.properties p WHERE p.id = NEW.property_id;
  PERFORM private.notify_home_followers(NEW.property_id, 'followed_home_stage', coalesce(home, 'A home you follow') || ': stage moved',
    coalesce(NEW.new_value, ''), NEW.actor, NEW.is_demo);
  RETURN NULL;
END $$;
CREATE TRIGGER followed_home_stage_notice AFTER INSERT ON public.onboarding_project_events
  FOR EACH ROW WHEN (NEW.kind = 'project_detail_changed' AND NEW.summary = 'Status changed' AND NEW.property_id IS NOT NULL)
  EXECUTE FUNCTION private.follow_notice_from_project_event();

CREATE OR REPLACE FUNCTION private.follow_notice_from_handoff()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE home text;
BEGIN
  SELECT public.format_property_label(to_jsonb(p))->>'primary' INTO home FROM public.properties p WHERE p.id = NEW.property_id;
  PERFORM private.notify_home_followers(NEW.property_id, 'followed_home_handoff', coalesce(home, 'A home you follow') || ': handoff moved',
    CASE NEW.handoff_state WHEN 'ready' THEN 'Ready for Operations' WHEN 'accepted' THEN 'Accepted by Operations' ELSE 'In progress' END,
    auth.uid(), NEW.is_demo);
  RETURN NULL;
END $$;
CREATE TRIGGER followed_home_handoff_notice AFTER UPDATE OF handoff_state ON public.onboarding_projects
  FOR EACH ROW WHEN (OLD.handoff_state IS DISTINCT FROM NEW.handoff_state)
  EXECUTE FUNCTION private.follow_notice_from_handoff();

CREATE OR REPLACE FUNCTION private.follow_notice_from_owner_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE home text;
BEGIN
  IF NEW.property_id IS NULL THEN RETURN NULL; END IF;
  SELECT public.format_property_label(to_jsonb(p))->>'primary' INTO home FROM public.properties p WHERE p.id = NEW.property_id;
  PERFORM private.notify_home_followers(NEW.property_id, 'followed_home_owner_waiting', coalesce(home, 'A home you follow') || ': the owner is waiting on us',
    left(coalesce(NEW.body, ''), 200), NEW.author_id, NEW.is_demo);
  RETURN NULL;
END $$;
CREATE TRIGGER followed_home_owner_notice AFTER INSERT ON public.owner_request_messages
  FOR EACH ROW WHEN (NEW.author_type = 'owner')
  EXECUTE FUNCTION private.follow_notice_from_owner_message();

INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'COO', 'property_page_part3_applied', 'schema', 'Property page Part 3',
        'docs/pending/property-page-part3/apply.sql applied after the preflight (Approved: apply property-page-part3, Nov 13): Telegram group and LOA status on the project, vendor preferred contact, Agreements and Estimates and invoices folders, home detail save, file move, in-app follower notices. Undo: apply.undo.sql');