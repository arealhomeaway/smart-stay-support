-- Live definition captured Nov 13 (read only), restored by apply.undo.sql.
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
