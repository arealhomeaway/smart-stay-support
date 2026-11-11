-- Undo for 02_standard_plan_v5.sql, only while no home has started from version 5.
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM public.onboarding_projects p JOIN public.onboarding_template_versions v ON v.id = p.template_version_id
             WHERE v.template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND v.version = 5) THEN
    RAISE EXCEPTION 'A home already started from version 5; undo by publishing a version 6 instead'; END IF;
END $do$;
-- Versions are permanent records (block_template_version_mutation); the trigger is paused for this one row only.
ALTER TABLE public.onboarding_template_versions DISABLE TRIGGER block_template_version_mutation;
DELETE FROM public.onboarding_template_versions WHERE template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND version = 5;
ALTER TABLE public.onboarding_template_versions ENABLE TRIGGER block_template_version_mutation;
UPDATE public.onboarding_template_tasks SET is_active = true WHERE id = '465ed7be-2ae9-497f-857f-447553df16c5';
UPDATE public.onboarding_template_tasks SET is_active = false WHERE id IN ('6a7e0b15-0c66-4d2b-9c1a-5b0e9f4d7a01','6a7e0b15-0c66-4d2b-9c1a-5b0e9f4d7a02');
UPDATE public.ao_library_cards SET linked_template_task_ids = array_remove(linked_template_task_ids, '6a7e0b15-0c66-4d2b-9c1a-5b0e9f4d7a01'::uuid),
       version = version + 1, updated_at = now() WHERE id = '890a7893-bb00-4f0d-8e48-1464494bd3d5';
INSERT INTO public.ao_library_card_history (card_id, version, snapshot, changed_by)
SELECT c.id, c.version, to_jsonb(c), NULL FROM public.ao_library_cards c WHERE c.id = '890a7893-bb00-4f0d-8e48-1464494bd3d5';
