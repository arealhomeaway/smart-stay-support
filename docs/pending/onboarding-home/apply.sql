-- Onboarding Home as the project database (approved by the Admin, Nov 12). NOT applied.
-- Additive only: four new tables, three new columns, one switch (off), one helper and eight
-- caller-checked functions. Nothing existing is changed or removed.

-- ---------------------------------------------------------------- who leads
CREATE OR REPLACE FUNCTION private.onboarding_home_lead(_u uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _u IS NOT NULL AND (public.has_role(_u, 'admin') OR public.is_onboarding_director(_u))
$$;
REVOKE ALL ON FUNCTION private.onboarding_home_lead(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.onboarding_home_lead(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------- tiles switch (off)
INSERT INTO public.feature_flags(key, label, description, enabled)
VALUES ('onboarding_home_tiles', 'Onboarding Home tiles', 'The row of tiles under the Onboarding Home banner.', false)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------- saved views
CREATE TABLE public.saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page text NOT NULL CHECK (page IN ('onboarding_home')),
  kind text NOT NULL DEFAULT 'view' CHECK (kind IN ('view', 'columns')),
  name text NOT NULL DEFAULT '' CHECK (length(name) <= 60),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  view text,
  sort text,
  columns text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE UNIQUE INDEX saved_views_one_columns ON public.saved_views(user_id, page) WHERE kind = 'columns';
CREATE UNIQUE INDEX saved_views_one_name ON public.saved_views(user_id, page, lower(name)) WHERE kind = 'view' AND archived_at IS NULL;
GRANT SELECT ON public.saved_views TO authenticated;
GRANT ALL ON public.saved_views TO service_role;
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own saved views" ON public.saved_views FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.save_onboarding_home_view(_name text, _filters jsonb, _view text, _sort text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); vid uuid; clean text := btrim(coalesce(_name, ''));
BEGIN
  IF me IS NULL OR NOT public.is_onboarding_staff(me) THEN RAISE EXCEPTION 'Onboarding Home is for the onboarding team.'; END IF;
  IF clean = '' OR length(clean) > 60 THEN RAISE EXCEPTION 'Give the view a name of up to 60 characters.'; END IF;
  IF _view NOT IN ('table', 'gallery', 'status', 'gantt', 'workload') THEN RAISE EXCEPTION 'Unknown view.'; END IF;
  UPDATE public.saved_views SET filters = coalesce(_filters, '{}'::jsonb), view = _view, sort = _sort, updated_at = now()
   WHERE user_id = me AND page = 'onboarding_home' AND kind = 'view' AND archived_at IS NULL AND lower(name) = lower(clean)
   RETURNING id INTO vid;
  IF vid IS NULL THEN
    INSERT INTO public.saved_views(user_id, page, kind, name, filters, view, sort)
    VALUES (me, 'onboarding_home', 'view', clean, coalesce(_filters, '{}'::jsonb), _view, _sort) RETURNING id INTO vid;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', vid);
END $$;

CREATE OR REPLACE FUNCTION public.archive_onboarding_home_view(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.saved_views SET archived_at = now(), updated_at = now()
   WHERE id = _id AND user_id = auth.uid() AND kind = 'view' AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'That saved view was not found.'; END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.save_onboarding_home_columns(_columns text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL OR NOT public.is_onboarding_staff(me) THEN RAISE EXCEPTION 'Onboarding Home is for the onboarding team.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(_columns, '{}')) c
             WHERE c NOT IN ('possession', 'owner', 'market', 'scope', 'utility', 'hoa', 'committed', 'breezeway')) THEN
    RAISE EXCEPTION 'Unknown column.';
  END IF;
  INSERT INTO public.saved_views(user_id, page, kind, columns) VALUES (me, 'onboarding_home', 'columns', coalesce(_columns, '{}'))
  ON CONFLICT (user_id, page) WHERE kind = 'columns' DO UPDATE SET columns = EXCLUDED.columns, updated_at = now();
  RETURN jsonb_build_object('ok', true);
END $$;

-- ------------------------------------------------- Not in Resolve yet (OwnerRez)
CREATE TABLE public.ownerrez_listing_cache (
  listing_id text PRIMARY KEY,
  name text,
  city text,
  state text,
  added_on date,
  checked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ownerrez_listing_cache TO authenticated;
GRANT ALL ON public.ownerrez_listing_cache TO service_role;
ALTER TABLE public.ownerrez_listing_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Onboarding team reads the OwnerRez list" ON public.ownerrez_listing_cache FOR SELECT TO authenticated
  USING (public.is_onboarding_staff(auth.uid()));

CREATE TABLE public.ownerrez_listing_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id text NOT NULL,
  listing_name text,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
  dismissed_by uuid NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  restored_at timestamptz,
  restored_by uuid
);
CREATE UNIQUE INDEX ownerrez_listing_dismissals_open ON public.ownerrez_listing_dismissals(listing_id) WHERE restored_at IS NULL;
GRANT SELECT ON public.ownerrez_listing_dismissals TO authenticated;
GRANT ALL ON public.ownerrez_listing_dismissals TO service_role;
ALTER TABLE public.ownerrez_listing_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Onboarding team reads dismissals" ON public.ownerrez_listing_dismissals FOR SELECT TO authenticated
  USING (public.is_onboarding_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.dismiss_ownerrez_listing(_listing_id text, _name text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); did uuid;
BEGIN
  IF NOT private.onboarding_home_lead(me) THEN RAISE EXCEPTION 'Only the Director of Onboarding or an Admin can do this.'; END IF;
  IF length(btrim(coalesce(_reason, ''))) < 3 THEN RAISE EXCEPTION 'Give a short reason.'; END IF;
  INSERT INTO public.ownerrez_listing_dismissals(listing_id, listing_name, reason, dismissed_by)
  VALUES (btrim(_listing_id), nullif(btrim(coalesce(_name, '')), ''), btrim(_reason), me)
  ON CONFLICT (listing_id) WHERE restored_at IS NULL DO NOTHING
  RETURNING id INTO did;
  IF did IS NOT NULL THEN
    INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, reason, after_value)
    VALUES (me, 'onboarding.ownerrez_not_onboarding', 'ownerrez_listing', did, coalesce(_name, _listing_id), btrim(_reason),
            jsonb_build_object('listing_id', _listing_id));
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ------------------------------------------------------------ stagers are vendors
CREATE TABLE public.onboarding_project_stagers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.onboarding_projects(id),
  vendor_org_id uuid NOT NULL REFERENCES public.vendor_orgs(id),
  added_by uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by uuid
);
CREATE UNIQUE INDEX onboarding_project_stagers_live ON public.onboarding_project_stagers(project_id, vendor_org_id) WHERE removed_at IS NULL;
GRANT SELECT ON public.onboarding_project_stagers TO authenticated;
GRANT ALL ON public.onboarding_project_stagers TO service_role;
ALTER TABLE public.onboarding_project_stagers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read project stagers" ON public.onboarding_project_stagers FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_onboarding_project_stagers(_project_id uuid, _vendor_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); pr public.onboarding_projects; wanted uuid[] := coalesce(_vendor_ids, '{}'); before uuid[]; added int; removed int;
BEGIN
  IF NOT private.onboarding_home_lead(me) THEN RAISE EXCEPTION 'Only the Director of Onboarding or an Admin can do this.'; END IF;
  SELECT * INTO pr FROM public.onboarding_projects WHERE id = _project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That onboarding project was not found.'; END IF;
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
END $$;

-- --------------------------------------------- Upcoming and Contract fell through
ALTER TABLE public.onboarding_projects
  ADD COLUMN IF NOT EXISTS closed_reason text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid;

CREATE OR REPLACE FUNCTION public.add_upcoming_onboarding_home(
  _request_id uuid, _address_line1 text, _unit text, _city text, _state text, _postal_code text,
  _expected_closing date, _contact text, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); prior jsonb; pid uuid; prj uuid; director uuid;
BEGIN
  IF NOT private.onboarding_home_lead(me) THEN RAISE EXCEPTION 'Only the Director of Onboarding or an Admin can do this.'; END IF;
  IF length(btrim(coalesce(_address_line1, ''))) < 3 OR length(btrim(coalesce(_city, ''))) < 2 OR length(btrim(coalesce(_state, ''))) < 2 THEN
    RAISE EXCEPTION 'Enter the street address, city and state.';
  END IF;
  IF length(btrim(coalesce(_contact, ''))) < 2 THEN RAISE EXCEPTION 'Enter the owner or DFY contact.'; END IF;
  -- A double click or retry returns the home already added.
  SELECT after_value INTO prior FROM public.audit_log
   WHERE action = 'onboarding.upcoming_added' AND actor_id = me AND after_value->>'request_id' = _request_id::text LIMIT 1;
  IF prior IS NOT NULL THEN RETURN prior || jsonb_build_object('ok', true, 'repeat', true); END IF;
  SELECT current_seat_holder INTO director FROM public.functional_roles WHERE code = 'onboarding_director' AND active;
  INSERT INTO public.properties(name, address_line1, unit, city, state, postal_code, lifecycle_status, planned_closing_on)
  VALUES (btrim(_address_line1), btrim(_address_line1), nullif(btrim(coalesce(_unit, '')), ''), btrim(_city), btrim(_state),
          nullif(btrim(coalesce(_postal_code, '')), ''), 'onboarding', _expected_closing)
  RETURNING id INTO pid;
  INSERT INTO public.onboarding_projects(property_id, status, project_status, planned_closing_on, director, started_by, furnishing_scope)
  VALUES (pid, 'planning', 'Upcoming Property', _expected_closing, director, me, 'full_furnishing')
  RETURNING id INTO prj;
  INSERT INTO public.onboarding_notes(property_id, body, author_id, internal)
  VALUES (pid, 'Owner or DFY contact: ' || btrim(_contact) || CASE WHEN nullif(btrim(coalesce(_note, '')), '') IS NULL THEN '' ELSE E'\n' || btrim(_note) END, me, true);
  INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, new_value, actor)
  VALUES (prj, pid, 'upcoming_added', 'Added as Upcoming, not under contract yet', 'Upcoming Property', me);
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
  VALUES (me, 'onboarding.upcoming_added', 'property', pid, btrim(_address_line1),
          jsonb_build_object('request_id', _request_id, 'property_id', pid, 'project_id', prj));
  RETURN jsonb_build_object('ok', true, 'property_id', pid, 'project_id', prj);
END $$;

CREATE OR REPLACE FUNCTION public.start_upcoming_onboarding_home(_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); pr public.onboarding_projects;
BEGIN
  IF NOT private.onboarding_home_lead(me) THEN RAISE EXCEPTION 'Only the Director of Onboarding or an Admin can do this.'; END IF;
  SELECT * INTO pr FROM public.onboarding_projects WHERE id = _project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That onboarding project was not found.'; END IF;
  IF pr.status = 'active' AND pr.project_status IS DISTINCT FROM 'Upcoming Property' THEN RETURN jsonb_build_object('ok', true, 'repeat', true); END IF;
  IF pr.status NOT IN ('planning', 'active') THEN RAISE EXCEPTION 'This home is not Upcoming.'; END IF;
  UPDATE public.onboarding_projects
     SET status = 'active',
         project_status = CASE WHEN project_status = 'Upcoming Property' THEN NULL ELSE project_status END
   WHERE id = pr.id;
  INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, prior_value, new_value, actor, is_demo)
  VALUES (pr.id, pr.property_id, 'under_contract', 'Under contract: plan started', coalesce(pr.project_status, pr.status), 'active', me, coalesce(pr.is_demo, false));
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
  VALUES (me, 'onboarding.upcoming_under_contract', 'onboarding_project', pr.id, 'Under contract',
          jsonb_build_object('status', pr.status, 'project_status', pr.project_status), jsonb_build_object('status', 'active'));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.mark_contract_fell_through(_project_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); pr public.onboarding_projects;
BEGIN
  IF NOT private.onboarding_home_lead(me) THEN RAISE EXCEPTION 'Only the Director of Onboarding or an Admin can do this.'; END IF;
  IF length(btrim(coalesce(_reason, ''))) < 3 THEN RAISE EXCEPTION 'Give a short reason.'; END IF;
  SELECT * INTO pr FROM public.onboarding_projects WHERE id = _project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That onboarding project was not found.'; END IF;
  IF pr.project_status = 'Contract Fell Through' THEN RETURN jsonb_build_object('ok', true, 'repeat', true); END IF;
  IF pr.status NOT IN ('planning', 'active') OR EXISTS (
       SELECT 1 FROM public.onboarding_tasks t WHERE t.property_id = pr.property_id AND t.archived_at IS NULL) THEN
    RAISE EXCEPTION 'Only an Upcoming home with no plan can be closed this way.';
  END IF;
  UPDATE public.onboarding_projects
     SET status = 'cancelled', project_status = 'Contract Fell Through',
         closed_reason = btrim(_reason), closed_at = now(), closed_by = me
   WHERE id = pr.id;
  INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
  VALUES (pr.id, pr.property_id, 'contract_fell_through', 'Contract fell through', btrim(_reason), pr.project_status, 'Contract Fell Through', me, coalesce(pr.is_demo, false));
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
  VALUES (me, 'onboarding.contract_fell_through', 'onboarding_project', pr.id, 'Contract Fell Through', btrim(_reason),
          jsonb_build_object('status', pr.status, 'project_status', pr.project_status),
          jsonb_build_object('status', 'cancelled', 'project_status', 'Contract Fell Through'));
  RETURN jsonb_build_object('ok', true);
END $$;

-- ---------------------------------------------------------- function grants
REVOKE ALL ON FUNCTION public.save_onboarding_home_view(text, jsonb, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_onboarding_home_view(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_onboarding_home_columns(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dismiss_ownerrez_listing(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_onboarding_project_stagers(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_upcoming_onboarding_home(uuid, text, text, text, text, text, date, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_upcoming_onboarding_home(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_contract_fell_through(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_onboarding_home_view(text, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_onboarding_home_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_onboarding_home_columns(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_ownerrez_listing(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_onboarding_project_stagers(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_upcoming_onboarding_home(uuid, text, text, text, text, text, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_upcoming_onboarding_home(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_contract_fell_through(uuid, text) TO authenticated;
