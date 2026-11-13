-- Undo: put back the Nov 12 live version exactly as read Nov 13.
CREATE OR REPLACE FUNCTION public.add_upcoming_onboarding_home(_request_id uuid, _address_line1 text, _unit text, _city text, _state text, _postal_code text, _expected_closing date, _contact text, _note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); prior jsonb; pid uuid; prj uuid; director uuid;
BEGIN
  IF me IS NULL OR NOT (private.onboarding_home_lead(me) OR public.is_onboarding_staff(me)) THEN RAISE EXCEPTION 'Only the onboarding team can add a home.'; END IF;
  IF length(btrim(coalesce(_address_line1, ''))) < 3 OR length(btrim(coalesce(_city, ''))) < 2 OR length(btrim(coalesce(_state, ''))) < 2 THEN
    RAISE EXCEPTION 'Enter the street address, city and state.';
  END IF;
  IF length(btrim(coalesce(_contact, ''))) < 2 THEN RAISE EXCEPTION 'Enter the owner or DFY contact.'; END IF;
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
END $function$
;
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'COO', 'access_changed', 'function', 'add_upcoming_onboarding_home',
        'docs/pending/add-upcoming-access-fix/apply.undo.sql applied: Nov 12 live version put back.');
