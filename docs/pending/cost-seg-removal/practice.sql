-- Practice for cost-seg-removal: fingerprint, apply, checks, undo, fingerprint again. Always rolls back.
CREATE TEMP TABLE _p(n serial, line text);
CREATE OR REPLACE FUNCTION pg_temp.fp() RETURNS text LANGUAGE sql AS $f$
  SELECT concat_ws(' ',
   'steps=' || (SELECT md5(string_agg(id::text||title||is_active::text, ',' ORDER BY id)) FROM public.onboarding_template_tasks),
   'tasks=' || (SELECT md5(string_agg(id::text||status||coalesce(archived_at::text,'')||coalesce(archived_by::text,'')||coalesce(exception_reason,''), ',' ORDER BY id)) FROM public.onboarding_tasks),
   'versions=' || (SELECT md5(string_agg(id::text||snapshot::text, ',' ORDER BY id)) FROM public.onboarding_template_versions WHERE version<=8 OR template_id<>'84f3a777-44a8-430a-af7e-8f18dc9a7dae'))
$f$;
CREATE TEMP TABLE _n0 AS SELECT (SELECT count(*) FROM public.owner_notifications) o, (SELECT count(*) FROM public.email_log) e, (SELECT count(*) FROM public.onboarding_project_events) ev;
INSERT INTO _p(line) SELECT 'before: ' || pg_temp.fp();
-- @@APPLY@@
INSERT INTO _p(line) SELECT format('step active after apply: %s', (SELECT is_active FROM public.onboarding_template_tasks WHERE id='2dc6f929-eaa5-4e9c-afd0-56400784ad9e'));
INSERT INTO _p(line) SELECT format('version 9: %s steps, has cost seg step %s, same as version 8 apart from it %s',
  jsonb_array_length(n.snapshot->'steps'),
  EXISTS (SELECT 1 FROM jsonb_array_elements(n.snapshot->'steps') e WHERE e->>'id'='2dc6f929-eaa5-4e9c-afd0-56400784ad9e'),
  (n.snapshot->'stages') = (o.snapshot->'stages') AND NOT EXISTS (
     SELECT 1 FROM jsonb_array_elements(o.snapshot->'steps') e WHERE e->>'id'<>'2dc6f929-eaa5-4e9c-afd0-56400784ad9e'
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(n.snapshot->'steps') f WHERE f=e)))
  FROM public.onboarding_template_versions n, public.onboarding_template_versions o
 WHERE n.template_id='84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND n.version=9 AND o.id='dbd7a6ee-8458-4155-9543-0688046349a3';
INSERT INTO _p(line) SELECT format('archived now: %s; open left on in-progress homes: %s; completed kept: %s',
  (SELECT count(*) FROM public.onboarding_tasks WHERE template_task_id='2dc6f929-eaa5-4e9c-afd0-56400784ad9e' AND exception_reason='Voided — not needed: removed from the onboarding plan template'),
  (SELECT count(*) FROM public.onboarding_tasks t JOIN public.onboarding_projects p ON p.property_id=t.property_id WHERE t.template_task_id='2dc6f929-eaa5-4e9c-afd0-56400784ad9e' AND t.archived_at IS NULL AND t.status<>'complete' AND p.status='active'),
  (SELECT count(*) FROM public.onboarding_tasks WHERE template_task_id='2dc6f929-eaa5-4e9c-afd0-56400784ad9e' AND status='complete' AND archived_at IS NULL));
INSERT INTO _p(line) SELECT format('notices %s, emails %s, project events %s',
  (SELECT count(*) FROM public.owner_notifications)-(SELECT o FROM _n0),(SELECT count(*) FROM public.email_log)-(SELECT e FROM _n0),(SELECT count(*) FROM public.onboarding_project_events)-(SELECT ev FROM _n0));
-- @@UNDO@@
INSERT INTO _p(line) SELECT format('after undo: newest version %s equals version 8: %s',
  (SELECT max(version) FROM public.onboarding_template_versions WHERE template_id='84f3a777-44a8-430a-af7e-8f18dc9a7dae'),
  (SELECT snapshot FROM public.onboarding_template_versions WHERE template_id='84f3a777-44a8-430a-af7e-8f18dc9a7dae' ORDER BY version DESC LIMIT 1)
   = (SELECT snapshot FROM public.onboarding_template_versions WHERE id='dbd7a6ee-8458-4155-9543-0688046349a3'));
INSERT INTO _p(line) SELECT 'after undo: ' || pg_temp.fp();
DO $$ DECLARE r text; BEGIN SELECT string_agg(line, E'\n' ORDER BY n) INTO r FROM _p; RAISE EXCEPTION E'PRACTICE ROLLED BACK\n%', r; END $$;
