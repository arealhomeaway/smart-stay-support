-- Practice on the real database: everything below is cancelled at the end (ROLLBACK). Nothing is kept.
-- Run as the database owner, signed in as the Admin. Uses a practice homeowner and two practice homes made
-- inside the transaction; practice (demo) notices are never emailed or texted.
BEGIN;
SELECT set_config('request.jwt.claim.sub', '98bd6696-4018-4965-b645-0471c5ae3925', true);
SELECT set_config('request.jwt.claims', '{"sub":"98bd6696-4018-4965-b645-0471c5ae3925","role":"authenticated"}', true);
\i docs/pending/ao-enrollment-start/apply.sql
CREATE TEMP TABLE practice(k text PRIMARY KEY, v uuid) ON COMMIT DROP;
INSERT INTO practice VALUES ('owner', gen_random_uuid()), ('home1', gen_random_uuid()), ('home2', gen_random_uuid());
INSERT INTO public.property_owners(id, name, email, active)
  SELECT v, 'Practice Owner', 'practice-owner@example.invalid', true FROM practice WHERE k = 'owner';
INSERT INTO public.properties(id, name, owner_record_id, is_demo)
  SELECT p.v, 'Practice home ' || p.k, o.v, true FROM practice p, practice o WHERE p.k IN ('home1', 'home2') AND o.k = 'owner';
-- 1. Create a draft program for the first home.
SELECT public.create_owner_program((SELECT v FROM practice WHERE k = 'home1')) AS created;
SELECT p.status, p.started_on,
  (SELECT count(*) FROM public.ao_home_plan_cards c WHERE c.property_id = (SELECT v FROM practice WHERE k = 'home1')) AS home1_cards,
  (SELECT count(*) FROM public.owner_notifications n WHERE n.program_id = p.id AND n.kind = 'ao_plan_ready') AS plan_ready_notices
FROM public.owner_programs p WHERE p.owner_record_id = (SELECT v FROM practice WHERE k = 'owner');
-- 2. Link a practice homeowner login (any synthetic owner-only account), as the one-step enrollment does.
UPDATE public.owner_programs SET owner_user_id = (
  SELECT r.user_id FROM public.user_roles r WHERE r.role = 'owner'
   AND NOT EXISTS (SELECT 1 FROM public.user_roles x WHERE x.user_id = r.user_id AND x.role <> 'owner') LIMIT 1)
WHERE owner_record_id = (SELECT v FROM practice WHERE k = 'owner');
-- 3. Add the second home later.
SELECT public.change_owner_program(p.id, p.report_version, 'add_property', (SELECT v FROM practice WHERE k = 'home2'), NULL)
FROM public.owner_programs p WHERE p.owner_record_id = (SELECT v FROM practice WHERE k = 'owner');
SELECT
  (SELECT count(*) FROM public.ao_home_plan_cards c WHERE c.property_id = (SELECT v FROM practice WHERE k = 'home1')) AS home1_cards,
  (SELECT count(*) FROM public.ao_home_plan_cards c WHERE c.property_id = (SELECT v FROM practice WHERE k = 'home2')) AS home2_cards,
  (SELECT count(*) FROM public.owner_notifications n JOIN public.owner_programs p ON p.id = n.program_id
    WHERE p.owner_record_id = (SELECT v FROM practice WHERE k = 'owner') AND n.kind = 'ao_plan_ready') AS plan_ready_notices;
ROLLBACK;
