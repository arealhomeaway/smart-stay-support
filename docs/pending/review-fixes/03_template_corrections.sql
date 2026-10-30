-- SEPARATE DATA APPROVAL REQUIRED. Not part of applying 01 and 02.
BEGIN;
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.onboarding_template_tasks WHERE id IN
 ('2dc6f929-eaa5-4e9c-afd0-56400784ad9e','f7c9426a-4642-47f2-b7ec-cfef65b45b94','263f7c5c-5df2-4d0d-943d-e2603a0f8139')
 AND owner_dependency='business_decision' AND NOT requires_owner_approval)<>3 THEN
 RAISE EXCEPTION 'The three template steps changed. Capture a fresh before state.';
 END IF;
END $check$;
UPDATE public.onboarding_template_tasks SET requires_owner_approval=true WHERE id IN
 ('2dc6f929-eaa5-4e9c-afd0-56400784ad9e','f7c9426a-4642-47f2-b7ec-cfef65b45b94','263f7c5c-5df2-4d0d-943d-e2603a0f8139');
COMMIT;