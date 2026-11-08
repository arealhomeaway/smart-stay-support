-- Undo for fix batch 3, part 2. DATA CHANGE ONLY (data tool). Puts back the exact live text
-- captured on Nov 8, 2026. The existing owner_task_templates_updated trigger sets updated_at to
-- the time of the undo; the live value before batch 3 was 2026-10-29 22:52:32.351825+00.
UPDATE public.owner_task_templates
SET owner_action = 'Walk the onboarding checklist with Kati, ask questions and set priorities.'
WHERE code = 'onb_initial_review'
  AND owner_action = 'Walk the onboarding checklist with the Director of Onboarding, ask questions and set priorities.';

UPDATE public.owner_task_templates
SET owner_action = 'Evaluate the proposal and give business direction.'
WHERE code = 'ops_improvements'
  AND owner_action = 'Look over the improvement and give business direction.';
