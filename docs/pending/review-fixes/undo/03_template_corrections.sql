BEGIN;
UPDATE public.onboarding_template_tasks SET requires_owner_approval=false, updated_at='2026-10-26 03:37:26.420286+00'
WHERE id IN ('2dc6f929-eaa5-4e9c-afd0-56400784ad9e','f7c9426a-4642-47f2-b7ec-cfef65b45b94','263f7c5c-5df2-4d0d-943d-e2603a0f8139');
-- The update timestamp trigger runs before this alphabetical-last restore trigger.
-- Use the exact full-row restore described in README before any approved application.
ROLLBACK;