-- Practice for design-review-director: fingerprint, apply, checks, undo, fingerprint again.
-- Always rolls back (ends with RAISE EXCEPTION 'PRACTICE ROLLED BACK').
CREATE TEMP TABLE _p(n serial, line text);
CREATE OR REPLACE FUNCTION pg_temp.fp() RETURNS text LANGUAGE sql AS $f$
  SELECT concat_ws(' ',
    'reviewers=' || (SELECT md5(coalesce(string_agg(template_task_id::text||reviewer_roles::text||coalesce(updated_by::text,'')||updated_at::text, ',' ORDER BY template_task_id),'')) FROM public.onboarding_step_review_settings),
    'taskreviews=' || (SELECT md5(coalesce(string_agg(id::text||reviewer_roles::text, ',' ORDER BY id),'')) FROM public.onboarding_task_reviews),
    'steps=' || (SELECT md5(string_agg(id::text||title||updated_at::text, ',' ORDER BY id)) FROM public.onboarding_template_tasks),
    'tasks=' || (SELECT md5(string_agg(id::text||title||status||coalesce(updated_at::text,'')||coalesce(completed_at::text,''), ',' ORDER BY id)) FROM public.onboarding_tasks),
    'work=' || (SELECT md5(string_agg(id::text||title||status||updated_at::text, ',' ORDER BY id)) FROM public.work_items))
$f$;
INSERT INTO _p(line) SELECT 'before: ' || pg_temp.fp();
-- @@APPLY@@
INSERT INTO _p(line) SELECT format('after: step reviewers=%s task reviewers=%s',
  (SELECT string_agg(t.title || ' ' || s.reviewer_roles::text, '; ') FROM public.onboarding_step_review_settings s JOIN public.onboarding_template_tasks t ON t.id = s.template_task_id WHERE s.template_task_id = '5c1f0a52-7d4e-4b8a-9a61-2f3c8e0d1a26'),
  (SELECT reviewer_roles::text FROM public.onboarding_task_reviews WHERE id = '37003546-38bb-4b59-a56f-2654bf112957'));
INSERT INTO _p(line) SELECT format('reviewer person for the Task review is the Director of Onboarding seat holder: %s',
  (SELECT private.review_role_person(project_id, 'onboarding_director') = (SELECT current_seat_holder FROM public.functional_roles WHERE code = 'onboarding_director')
     FROM public.onboarding_task_reviews WHERE id = '37003546-38bb-4b59-a56f-2654bf112957'));
INSERT INTO _p(line) SELECT format('any review naming Designer as reviewer: settings=%s reviews=%s',
  (SELECT count(*) FROM public.onboarding_step_review_settings WHERE 'designer' = ANY(reviewer_roles)),
  (SELECT count(*) FROM public.onboarding_task_reviews WHERE 'designer' = ANY(reviewer_roles)));
INSERT INTO _p(line) SELECT format('left naming Lead Designer or Staging Team: steps=%s open tasks=%s completed tasks kept=%s archived open tasks kept=%s',
  (SELECT count(*) FROM public.onboarding_template_tasks WHERE title ~* 'lead designer|staging team'),
  (SELECT count(*) FROM public.onboarding_tasks WHERE title ~* 'lead designer|staging team' AND status = 'open' AND archived_at IS NULL),
  (SELECT count(*) FROM public.onboarding_tasks WHERE title ~* 'lead designer|staging team' AND status = 'complete'),
  (SELECT count(*) FROM public.onboarding_tasks WHERE title ~* 'lead designer|staging team' AND status = 'open' AND archived_at IS NOT NULL));
INSERT INTO _p(line) SELECT 'audit: ' || (SELECT after_value - 'renames' - 'step_review_settings_after' FROM public.audit_log WHERE action = 'design_review_director.apply')::text;
INSERT INTO _p(line) SELECT 'task work titles match: ' || NOT EXISTS (SELECT 1 FROM public.onboarding_tasks t JOIN public.work_items w ON w.source_table = 'onboarding_tasks' AND w.source_id = t.id AND w.kind = 'task' WHERE w.title <> t.title AND t.title ~* 'director of onboarding|stager');
-- @@UNDO@@
INSERT INTO _p(line) SELECT 'after undo: ' || pg_temp.fp();
DO $d$ DECLARE s text; b text; u text; BEGIN
  SELECT substr(line, 9) INTO b FROM _p WHERE line LIKE 'before: %';
  SELECT substr(line, 13) INTO u FROM _p WHERE line LIKE 'after undo: %';
  SELECT string_agg(line, E'\n' ORDER BY n) INTO s FROM _p;
  s := s || E'\nundo matches before: ' || (b = u)::text;
  RAISE EXCEPTION 'PRACTICE ROLLED BACK:%', E'\n' || s;
END $d$;
