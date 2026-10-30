BEGIN;
ALTER TABLE public.onboarding_template_tasks DISABLE TRIGGER onboarding_template_tasks_updated_at;
ALTER TABLE public.onboarding_template_tasks DISABLE TRIGGER owner_business_decision_template_guard;
ALTER TABLE public.onboarding_template_tasks DISABLE TRIGGER owner_work_never_blocks_handoff;
UPDATE public.onboarding_template_tasks SET requires_owner_approval=false, blocks_handoff=true, updated_at='2026-10-26 03:37:26.420286+00'
WHERE id IN ('2dc6f929-eaa5-4e9c-afd0-56400784ad9e','f7c9426a-4642-47f2-b7ec-cfef65b45b94','263f7c5c-5df2-4d0d-943d-e2603a0f8139');
ALTER TABLE public.onboarding_template_tasks ENABLE TRIGGER owner_business_decision_template_guard;
ALTER TABLE public.onboarding_template_tasks ENABLE TRIGGER owner_work_never_blocks_handoff;
ALTER TABLE public.onboarding_template_tasks ENABLE TRIGGER onboarding_template_tasks_updated_at;
COMMIT;