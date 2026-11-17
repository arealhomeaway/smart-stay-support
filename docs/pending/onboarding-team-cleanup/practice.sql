-- Practice for onboarding-team-cleanup: fingerprint, apply, checks, undo, fingerprint again.
-- Always rolls back (ends with RAISE EXCEPTION 'PRACTICE ROLLED BACK').
CREATE TEMP TABLE _p(n serial, line text);
GRANT ALL ON _p TO authenticated;
GRANT USAGE ON SEQUENCE _p_n_seq TO authenticated;
CREATE OR REPLACE FUNCTION pg_temp.fp() RETURNS text LANGUAGE sql AS $f$
  SELECT concat_ws(' ',
    'pool=' || (SELECT md5(coalesce(string_agg(id::text||role_code||user_id::text, ',' ORDER BY id), '')) FROM public.functional_role_members),
    'roles=' || (SELECT md5(string_agg(code||active::text, ',' ORDER BY code)) FROM public.functional_roles),
    'teams=' || (SELECT md5(string_agg(id::text||coalesce(role_assignments::text,''), ',' ORDER BY id)) FROM public.onboarding_projects),
    'steps=' || (SELECT md5(string_agg(id::text||coalesce(functional_role,'')||coalesce(role,''), ',' ORDER BY id)) FROM public.onboarding_template_tasks),
    'versions=' || (SELECT md5(string_agg(id::text||snapshot::text, ',' ORDER BY id)) FROM public.onboarding_template_versions),
    'tasks=' || (SELECT md5(string_agg(id::text||coalesce(assigned_seat,'')||status||coalesce(updated_at::text,'')||coalesce(completed_at::text,'')||coalesce(due_on::text,''), ',' ORDER BY id)) FROM public.onboarding_tasks),
    'work=' || (SELECT md5(string_agg(id::text||coalesce(functional_role,'')||status||updated_at::text||coalesce(completed_at::text,''), ',' ORDER BY id)) FROM public.work_items),
    'reviewers=' || (SELECT md5(coalesce(string_agg(template_task_id::text||reviewer_roles::text, ',' ORDER BY template_task_id),'')) FROM public.onboarding_step_review_settings)
      || (SELECT md5(coalesce(string_agg(id::text||reviewer_roles::text, ',' ORDER BY id),'')) FROM public.onboarding_task_reviews),
    'stagers=' || (SELECT md5(coalesce(string_agg(id::text||coalesce(removed_at::text,''), ',' ORDER BY id),'')) FROM public.onboarding_project_stagers),
    'vendors=' || (SELECT count(*) FROM public.vendor_orgs),
    'fns=' || (SELECT md5(string_agg(pg_get_functiondef(p.oid), ',' ORDER BY p.proname)) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE (n.nspname, p.proname) IN (('public','bulk_update_onboarding_home_tasks'),('public','bulk_update_onboarding_template_steps'),
                       ('public','plan_catch_up_tasks'),('private','review_role_person'),('public','set_onboarding_project_stagers'))))
$f$;
INSERT INTO _p(line) SELECT 'before: ' || pg_temp.fp();
-- @@APPLY@@
INSERT INTO _p(line) SELECT 'after: ' || pg_temp.fp();
INSERT INTO _p(line) SELECT format('left on old codes: pool=%s teams=%s steps=%s versionsteps=%s tasks=%s work=%s reviewers=%s roles_on=%s',
  (SELECT count(*) FROM public.functional_role_members WHERE role_code IN ('lead_designer','design_staging','staging_team')),
  (SELECT count(*) FROM public.onboarding_projects WHERE role_assignments ?| ARRAY['lead_designer','design_staging']),
  (SELECT count(*) FROM public.onboarding_template_tasks WHERE functional_role IN ('lead_designer','design_staging','staging_team') OR role = 'Lead Designer'),
  (SELECT count(*) FROM public.onboarding_template_versions v, jsonb_array_elements(v.snapshot->'steps') e WHERE e->>'functional_role' IN ('lead_designer','design_staging','staging_team') OR e->>'role' = 'Lead Designer'),
  (SELECT count(*) FROM public.onboarding_tasks WHERE assigned_seat IN ('lead_designer','design_staging','staging_team')),
  (SELECT count(*) FROM public.work_items WHERE functional_role IN ('lead_designer','design_staging','staging_team')),
  (SELECT count(*) FROM public.onboarding_step_review_settings WHERE reviewer_roles && ARRAY['lead_designer','design_staging']),
  (SELECT count(*) FROM public.functional_roles WHERE code IN ('lead_designer','design_staging','staging_team') AND active));
INSERT INTO _p(line) SELECT format('designer pool=%s homes with designer=%s designer tasks=%s (complete %s) designer work items=%s',
  (SELECT count(*) FROM public.functional_role_members WHERE role_code = 'designer'),
  (SELECT count(*) FROM public.onboarding_projects WHERE role_assignments ? 'designer'),
  (SELECT count(*) FROM public.onboarding_tasks WHERE assigned_seat = 'designer'),
  (SELECT count(*) FROM public.onboarding_tasks WHERE assigned_seat = 'designer' AND status = 'complete'),
  (SELECT count(*) FROM public.work_items WHERE functional_role = 'designer'));
INSERT INTO _p(line) SELECT 'Comstock stager: ' || coalesce((SELECT string_agg(o.display_name || ' / ' || o.primary_contact_name || ' / ' || o.primary_contact_email || ' / ' || o.status || ' / ' || array_to_string(o.markets, ',') || ' / ' || array_to_string(o.service_categories, ','), '; ')
  FROM public.onboarding_project_stagers s JOIN public.vendor_orgs o ON o.id = s.vendor_org_id WHERE s.project_id = '5aa876df-fd59-41af-9e39-b528d51fdc74' AND s.removed_at IS NULL), 'none');
INSERT INTO _p(line) SELECT 'audit rows: ' || (SELECT string_agg(action, ', ' ORDER BY action) FROM public.audit_log WHERE action LIKE 'onboarding_team_cleanup.%');
-- Self-review in the database, as the Director of Onboarding on DEMO Birch Lane Retreat.
DO $sr$
DECLARE kati constant uuid := '40de2f41-5596-4ec1-98d7-29e16549a25f'; demo constant uuid := '814961eb-38b3-4ad6-afcc-c9c7ca45af16';
  res jsonb; who uuid; msg text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', kati, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  res := public.set_onboarding_project_role(demo, 'designer', kati, false);
  who := public.project_role_assignee(demo, 'designer');
  INSERT INTO _p(line) VALUES ('demo: designer picked, a designer Task goes to ' || CASE WHEN who = kati THEN 'the picked person (pass)' ELSE coalesce(who::text,'no one') || ' (fail)' END);
  res := public.set_onboarding_project_role(demo, 'designer', NULL, false);
  BEGIN
    PERFORM public.plan_catch_up_tasks('a0000000-0000-4000-8000-00000000b001', ARRAY(SELECT id FROM public.onboarding_tasks WHERE property_id = 'a0000000-0000-4000-8000-00000000b001' AND status = 'open' LIMIT 1), 'assign', NULL, 'lead_designer', NULL, NULL, false);
    msg := 'accepted (fail)';
  EXCEPTION WHEN others THEN msg := 'refused: ' || SQLERRM; END;
  INSERT INTO _p(line) VALUES ('assign to Lead Designer: ' || msg);
  BEGIN
    PERFORM public.set_onboarding_project_stagers(demo, ARRAY(SELECT id FROM public.vendor_orgs WHERE 'Staging' = ANY(service_categories) ORDER BY id LIMIT 2));
    msg := 'accepted (fail)';
  EXCEPTION WHEN others THEN msg := 'refused: ' || SQLERRM; END;
  INSERT INTO _p(line) VALUES ('two stagers on one home: ' || msg);
  EXECUTE 'RESET ROLE';
END $sr$;
-- @@UNDO@@
INSERT INTO _p(line) SELECT 'after undo: ' || pg_temp.fp();
DO $d$ DECLARE s text; b text; u text; BEGIN
  SELECT substr(line, 9) INTO b FROM _p WHERE line LIKE 'before: %';
  SELECT substr(line, 13) INTO u FROM _p WHERE line LIKE 'after undo: %';
  SELECT string_agg(line, E'\n' ORDER BY n) INTO s FROM _p;
  s := s || E'\nundo matches before: ' || (b = u)::text;
  RAISE EXCEPTION 'PRACTICE ROLLED BACK:%', E'\n' || s;
END $d$;
