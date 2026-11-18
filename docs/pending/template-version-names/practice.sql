-- Practice for template-version-names: fingerprint, apply, checks, undo, fingerprint again.
-- Always rolls back (ends with RAISE EXCEPTION 'PRACTICE ROLLED BACK').
CREATE TEMP TABLE _p(n serial, line text);
CREATE TEMP TABLE _b AS SELECT * FROM public.onboarding_template_versions;
CREATE OR REPLACE FUNCTION pg_temp.fp() RETURNS text LANGUAGE sql AS $f$
  SELECT concat_ws(' ',
    'versions=' || (SELECT md5(string_agg(id::text||template_id::text||version::text||snapshot::text||published_at::text||coalesce(published_by::text,''), ',' ORDER BY id)) FROM public.onboarding_template_versions),
    'steps=' || (SELECT md5(string_agg(id::text||title||updated_at::text, ',' ORDER BY id)) FROM public.onboarding_template_tasks),
    'tasks=' || (SELECT md5(string_agg(id::text||title||status||coalesce(updated_at::text,'')||coalesce(completed_at::text,'')||coalesce(archived_at::text,''), ',' ORDER BY id)) FROM public.onboarding_tasks))
$f$;
INSERT INTO _p(line) SELECT 'before: ' || pg_temp.fp();
-- @@APPLY@@
INSERT INTO _p(line) SELECT format('names left naming Lead Designer or Staging Team in any version: %s',
  (SELECT count(*) FROM public.onboarding_template_versions v, jsonb_array_elements(v.snapshot->'steps') e WHERE e->>'title' ~* 'lead designer|staging team'));
INSERT INTO _p(line) SELECT format('step names changed: %s in %s versions',
  (SELECT count(*) FROM _b b JOIN public.onboarding_template_versions v USING (id),
     LATERAL (SELECT 1 FROM jsonb_array_elements(b.snapshot->'steps') WITH ORDINALITY o(s, i) JOIN jsonb_array_elements(v.snapshot->'steps') WITH ORDINALITY n(s, i) USING (i) WHERE o.s->>'title' <> n.s->>'title') x),
  (SELECT count(*) FROM _b b JOIN public.onboarding_template_versions v USING (id) WHERE b.snapshot <> v.snapshot));
INSERT INTO _p(line) SELECT format('every changed name follows the fixed rename: %s',
  NOT EXISTS (SELECT 1 FROM _b b JOIN public.onboarding_template_versions v USING (id),
     jsonb_array_elements(b.snapshot->'steps') WITH ORDINALITY o(s, i) JOIN jsonb_array_elements(v.snapshot->'steps') WITH ORDINALITY n(s, i) USING (i)
     WHERE o.s->>'title' <> n.s->>'title'
       AND n.s->>'title' IS DISTINCT FROM (SELECT after_value->'renames'->>(o.s->>'title') FROM public.audit_log WHERE action = 'template_version_names.apply')));
INSERT INTO _p(line) SELECT format('everything except step names unchanged: %s',
  NOT EXISTS (SELECT 1 FROM _b b JOIN public.onboarding_template_versions v USING (id)
     WHERE b.template_id <> v.template_id OR b.version <> v.version OR b.published_at <> v.published_at
        OR b.published_by IS DISTINCT FROM v.published_by
        OR (b.snapshot - 'steps') <> (v.snapshot - 'steps')
        OR jsonb_array_length(b.snapshot->'steps') <> jsonb_array_length(v.snapshot->'steps')
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(b.snapshot->'steps') WITH ORDINALITY o(s, i) JOIN jsonb_array_elements(v.snapshot->'steps') WITH ORDINALITY n(s, i) USING (i)
                    WHERE (o.s - 'title') <> (n.s - 'title'))));
INSERT INTO _p(line) SELECT format('version lock back on: %s', (SELECT tgenabled = 'O' FROM pg_trigger WHERE tgname = 'block_template_version_mutation' AND tgrelid = 'public.onboarding_template_versions'::regclass));
INSERT INTO _p(line) SELECT 'live steps and Tasks unchanged: ' || (split_part(pg_temp.fp(), ' ', 2) || split_part(pg_temp.fp(), ' ', 3) = (SELECT split_part(substr(line, 9), ' ', 2) || split_part(substr(line, 9), ' ', 3) FROM _p WHERE line LIKE 'before: %'))::text;
INSERT INTO _p(line) SELECT 'audit: ' || (SELECT after_value - 'renames' FROM public.audit_log WHERE action = 'template_version_names.apply')::text;
-- @@UNDO@@
INSERT INTO _p(line) SELECT 'after undo: ' || pg_temp.fp();
DO $d$ DECLARE s text; b text; u text; BEGIN
  SELECT substr(line, 9) INTO b FROM _p WHERE line LIKE 'before: %';
  SELECT substr(line, 13) INTO u FROM _p WHERE line LIKE 'after undo: %';
  SELECT string_agg(line, E'\n' ORDER BY n) INTO s FROM _p;
  s := s || E'\nundo matches before: ' || (b = u)::text;
  RAISE EXCEPTION 'PRACTICE ROLLED BACK:%', E'\n' || s;
END $d$;
