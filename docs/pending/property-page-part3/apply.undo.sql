-- Undo for Property page Part 3. Puts the captured live objects back exactly.
-- Files filed into the two new folders must be moved first, or the old check refuses them:
--   UPDATE public.documents SET category = NULL WHERE category IN ('agreement','estimate_invoice');
-- (Only with approval; that line clears the folder, the files themselves stay.)
DROP FUNCTION IF EXISTS public.move_home_file(uuid, text);
DROP FUNCTION IF EXISTS public.save_home_detail_field(uuid, text, text);
DROP FUNCTION IF EXISTS private.onboarding_home_team_member(uuid, uuid);
ALTER TABLE public.documents DROP CONSTRAINT documents_category_chk;
-- From live-capture/documents_category_chk.sql:
ALTER TABLE public.documents ADD CONSTRAINT documents_category_chk CHECK (((category IS NULL) OR (category = ANY (ARRAY['pma'::text, 'insurance'::text, 'ownership'::text, 'hoa'::text, 'covenants'::text, 'permit_license'::text, 'compliance'::text, 'manual'::text, 'hvac_doc'::text, 'warranty'::text, 'equipment'::text, 'access_security'::text, 'measurements'::text, 'design'::text, 'onboarding_evidence'::text, 'assessment'::text, 'operations'::text, 'maintenance'::text, 'media'::text, 'reference'::text, 'other'::text, 'design_floor_plan'::text, 'design_mood_board'::text, 'design_pick_list'::text, 'design_install'::text, 'design_staging'::text, 'design_photo'::text]))));
ALTER TABLE public.vendor_orgs DROP COLUMN IF EXISTS preferred_contact;
ALTER TABLE public.onboarding_projects DROP COLUMN IF EXISTS loa_status, DROP COLUMN IF EXISTS telegram_url;
-- From live-capture/set_onboarding_project_stagers.sql:
CREATE OR REPLACE FUNCTION public.set_onboarding_project_stagers(_project_id uuid, _vendor_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$;
