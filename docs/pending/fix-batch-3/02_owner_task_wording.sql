-- Fix batch 3, part 2: two homeowner task template lines. DATA CHANGE ONLY (data tool).
-- Staged, NOT applied. Wording only; code, phase, stage, type, hours and order are unchanged.
-- Matched on the exact current text, so a line someone has edited since is left alone.
UPDATE public.owner_task_templates
SET owner_action = 'Walk the onboarding checklist with the Director of Onboarding, ask questions and set priorities.'
WHERE code = 'onb_initial_review'
  AND owner_action = 'Walk the onboarding checklist with Kati, ask questions and set priorities.';

UPDATE public.owner_task_templates
SET owner_action = 'Look over the improvement and give business direction.'
WHERE code = 'ops_improvements'
  AND owner_action = 'Evaluate the proposal and give business direction.';
